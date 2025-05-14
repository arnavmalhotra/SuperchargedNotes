import { NextResponse } from 'next/server';
import { GoogleGenAI, createUserContent } from '@google/genai';
import { supabase } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Flashcard {
  front: string;
  back: string;
}

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ success: false, message: 'Unauthorized - Please sign in' }, { status: 401 });
    }

    const body = await request.json();
    const { noteId, userId } = body;

    if (userId !== clerkUserId) {
        return NextResponse.json({ success: false, message: 'User ID mismatch' }, { status: 403 });
    }

    if (!noteId || !userId) {
      return NextResponse.json({ success: false, message: 'Missing noteId or userId' }, { status: 400 });
    }

    const { data: noteData, error: noteError } = await supabase
      .from('notes')
      .select('title, content')
      .eq('id', noteId)
      .eq('user_id', userId)
      .single();

    if (noteError || !noteData) {
      console.error('Error fetching note or note not found:', noteError);
      return NextResponse.json({ success: false, message: 'Failed to fetch note or note not found' }, { status: noteError ? 500 : 404 });
    }

    const prompt = `Based on the following text, generate a list of flashcards. Each flashcard should be a JSON object with a "front" (question, term, or concept) and a "back" (answer or definition).

IMPORTANT: Return ONLY the valid JSON array as plain text without any markdown formatting, code blocks, or annotations. Do not use markdown syntax like \`\`\`json or \`\`\`. The response should be parseable directly by JSON.parse().

Text:
---
${noteData.content}
---

Output format example:
[{"front": "Question 1", "back": "Answer 1"}, {"front": "Question 2", "back": "Answer 2"}]`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: createUserContent([prompt]),
    });

    const geminiResponseText = response.text;

    let flashcards: Flashcard[];
    try {
      // Clean up the response if it contains markdown code blocks
      let jsonText = geminiResponseText;
      
      // Remove markdown code block markers if present
      if (jsonText.includes('```')) {
        const jsonMatch = jsonText.match(/```(?:json)?\s*\n([\s\S]*?)```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonText = jsonMatch[1].trim();
        } else {
          // If we can't extract from code blocks, try to find JSON array directly
          const possibleJson = jsonText.match(/\[\s*\{[\s\S]*\}\s*\]/);
          if (possibleJson) {
            jsonText = possibleJson[0];
          }
        }
      }
      
      flashcards = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError, "Raw response:", geminiResponseText);
      return NextResponse.json({ success: false, message: 'Failed to parse flashcard data from AI response' }, { status: 500 });
    }

    if (!Array.isArray(flashcards) || flashcards.some(fc => typeof fc.front !== 'string' || typeof fc.back !== 'string')) {
      console.error('Invalid flashcard structure received:', flashcards);
      return NextResponse.json({ success: false, message: 'AI response did not provide valid flashcard structure' }, { status: 500 });
    }
    
    if (flashcards.length === 0) {
        return NextResponse.json({ success: true, message: 'No flashcards generated from the content.', flashcardSet: null });
    }

    // Create the properly formatted flashcards array
    const formattedFlashcards = flashcards.map(fc => ({ 
      front_text: fc.front, 
      back_text: fc.back 
    }));

    const { data: newFlashcardSetId, error: rpcError } = await supabase.rpc('create_flashcard_set_and_cards', {
        p_user_id: userId,
        p_note_id: noteId,
        p_title: `Flashcards for: ${noteData.title.substring(0, 50)}${noteData.title.length > 50 ? '...' : ''}`,
        p_flashcards: formattedFlashcards
    });

    if (rpcError) {
      console.error('Supabase RPC error (create_flashcard_set_and_cards):', rpcError);
      return NextResponse.json({ success: false, message: 'Failed to store flashcards in database', error: rpcError.message }, { status: 500 });
    }
    
    const { data: newSetData, error: newSetError } = await supabase
        .from('flashcard_sets')
        .select(`
            id,
            title,
            created_at,
            note_id,
            individual_flashcards (
                id,
                front,
                back,
                created_at
            )
        `)
        .eq('id', newFlashcardSetId) 
        .eq('user_id', userId)
        .single();

    if (newSetError) {
        console.error('Error fetching newly created flashcard set details:', newSetError);
        return NextResponse.json({ 
            success: true, 
            message: 'Flashcards created, but failed to fetch complete confirmation data.', 
            flashcardSetId: newFlashcardSetId 
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Flashcards created successfully!',
      flashcardSet: newSetData
    });

  } catch (error) {
    console.error('Critical error in /api/flashcards/create:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
    return NextResponse.json({ success: false, message: `Failed to create flashcards: ${errorMessage}` }, { status: 500 });
  }
} 