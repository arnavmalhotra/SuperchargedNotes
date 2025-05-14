//handle grouping of files
import { NextResponse } from 'next/server';
import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';
import { supabase } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

    return {
      fileName: file.name,
      analysis: response.text,
      mimeType: file.type
    };
  } catch (error) {
    console.error(`Error processing file ${file.name}:`, error);
    throw error;
  }
}

async function storeResultsInSupabase(
  results: Array<{ fileName: string; analysis: string; mimeType: string }>, 
  groupFiles: boolean,
  userId: string
) {
  try {
    if (groupFiles && results.length > 1) {
      // If groupFiles is true, combine all analyses into one note
      const combinedAnalysis = results.map(r => `File: ${r.fileName}\n\n${r.analysis}`).join('\n\n---\n\n');
      console.log('Inserting group note for user:', userId);
      const { data, error } = await supabase
        .from('notes')
        .insert({
          title: `Group Note (${results.length} files)`,
          content: combinedAnalysis,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: userId,
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }
      return data;
    } else {
      // Store each file as a separate note
      console.log('Inserting individual notes for user:', userId);
      const insertPromises = results.map(result => 
        supabase
          .from('notes')
          .insert({
            title: result.fileName,
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

    console.log('Processing files:', files.map(f => f.name));
    
    // Process files with Gemini
    const results = await Promise.all(
      files.map(file => processFileWithGemini(file))
    );

    // Store results in Supabase with user ID
    const storedNotes = await storeResultsInSupabase(results, groupFiles, userId);

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