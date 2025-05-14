//handle grouping of files
import { NextResponse } from 'next/server';
import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';
import { supabase } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// New function to generate a topic/title using AI
async function generateTopicWithAi(content: string, contextHint?: string) {
  try {
    let prompt = `Generate a very concise and relevant title or topic (ideally 5-10 words, absolutely max 15 words) for the following text. Be succinct.`;
    if (contextHint) {
      prompt += `\nContext for the text: ${contextHint}.`;
    }
    prompt += `\n\nText to generate a title for:\n${content}`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash", 
      contents: createUserContent([prompt])
      // Removed generationConfig as it caused a linter error
      // Relying on prompt engineering and model behavior for concise titles
    });
    // Clean up the title: remove quotes, trim whitespace
    let topic = response.text.trim();
    if (topic.startsWith('"') && topic.endsWith('"')) {
      topic = topic.substring(1, topic.length - 1);
    }
    return topic || (contextHint || "Untitled Note"); // Fallback title

  } catch (error) {
    console.error('Error generating topic with AI:', error);
    return contextHint || "Untitled Note"; // Fallback in case of error
  }
}

async function processFileWithGemini(file: File) {
  try {
    // Upload file to Gemini
    const uploadedFile = await ai.files.upload({
      file: file,
      config: { mimeType: file.type }
    });

    // For PDFs, ask for a summary
    // For images, ask for a description and any text extraction
    const prompt = file.type === 'application/pdf' 
      ? "Give me a detailed summary of this PDF file, including any key points and important information."
      : "Please analyze this image. Extract any text if present, and provide a detailed description of what you see.";

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: createUserContent([
        createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
        prompt
      ]),
    });

    const analysis = response.text;
    const generatedTopic = await generateTopicWithAi(analysis, file.name);

    return {
      fileName: file.name,
      analysis: analysis,
      mimeType: file.type,
      title: generatedTopic
    };
  } catch (error) {
    console.error(`Error processing file ${file.name}:`, error);
    throw error;
  }
}

// New function to process multiple files as a group with Gemini
async function processGroupedFilesWithGemini(files: File[]) {
  try {
    const uploadedFileParts = await Promise.all(
      files.map(async (file) => {
        const uploadedFile = await ai.files.upload({
          file: file,
          config: { mimeType: file.type }
        });
        return createPartFromUri(uploadedFile.uri, uploadedFile.mimeType);
      })
    );

    const prompt = "Analyze the following files as a single group. For PDF documents, provide a comprehensive summary. For images, describe the content and extract any visible text. Combine all findings into a single, coherent response, clearly indicating which finding pertains to which file if necessary.";

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash-latest", // Using a model that's good with multi-file context
      contents: createUserContent([
        ...uploadedFileParts,
        prompt
      ]),
    });

    const analysis = response.text;
    const fileNamesString = files.map(f => f.name).join(', ');
    const generatedTopic = await generateTopicWithAi(analysis, `Group: ${fileNamesString}`);

    return {
      fileNames: files.map(f => f.name),
      analysis: analysis,
      title: generatedTopic
    };
  } catch (error) {
    console.error(`Error processing grouped files:`, error);
    throw error; // Re-throw to be caught by the main handler
  }
}

async function storeResultsInSupabase(
  results: any, // Can be single result for grouped, or array for individual
  groupFiles: boolean,
  userId: string
) {
  try {
    if (groupFiles) {
      // results is a single object from processGroupedFilesWithGemini
      const groupResult = results as { fileNames: string[]; analysis: string; title: string };
      console.log('Inserting group note for user:', userId, 'Title:', groupResult.title);
      const { data, error } = await supabase
        .from('notes')
        .insert({
          title: groupResult.title,
          content: groupResult.analysis,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: userId,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error (group):', error);
        throw error;
      }
      return data;
    } else {
      // results is an array of objects from processFileWithGemini
      const individualResults = results as Array<{ fileName: string; analysis: string; mimeType: string; title: string }>;
      console.log('Inserting individual notes for user:', userId);
      const insertPromises = individualResults.map(result => 
        supabase
          .from('notes')
          .insert({
            title: result.title,
            content: result.analysis,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            user_id: userId,
          })
          .select()
          .single()
      );

      const responses = await Promise.all(insertPromises);
      const errors = responses.filter(r => r.error).map(r => r.error);
      if (errors.length > 0) {
        console.error('Supabase batch insert error:', errors[0]);
        throw errors[0];
      }
      
      return responses.map(r => r.data);
    }
  } catch (error) {
    console.error('Error in storeResultsInSupabase:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    // Get the authenticated user from Clerk
    const { userId } = await auth();
    console.log('Authenticated user ID:', userId);
    
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const groupFiles = formData.get('groupFiles') === 'true';

    // Check for the maximum number of files
    if (files.length > 5) {
      return NextResponse.json(
        { success: false, message: 'You can upload a maximum of 5 files at a time.' },
        { status: 413 } // 413 Payload Too Large is appropriate here
      );
    }

    console.log('Processing files:', files.map(f => f.name), 'Group files:', groupFiles);
    
    let processedResults;

    if (groupFiles && files.length > 0) {
      processedResults = await processGroupedFilesWithGemini(files);
    } else if (files.length > 0) {
      processedResults = await Promise.all(
        files.map(file => processFileWithGemini(file))
      );
    } else {
      return NextResponse.json(
        { success: false, message: 'No files provided' },
        { status: 400 }
      );
    }

    // Store results in Supabase with user ID
    const storedNotes = await storeResultsInSupabase(processedResults, groupFiles, userId);

    return NextResponse.json({ 
      success: true, 
      message: 'Files processed and stored successfully',
      notes: storedNotes
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to process files'
      },
      { status: 500 }
    );
  }
} 