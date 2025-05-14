import { NextResponse } from 'next/server';
import { GoogleGenAI, createUserContent } from '@google/genai';
import { supabase } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY environment variable');
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface QuizQuestion {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  explanation: string;
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

    const prompt = `Based on the following text, generate a multiple-choice quiz. Each question should be a JSON object with the following properties:
- question_text: The question itself
- option_a: First option
- option_b: Second option
- option_c: Third option
- option_d: Fourth option
- correct_option: One of 'A', 'B', 'C', or 'D' indicating which option is correct
- explanation: Brief explanation of why the answer is correct

IMPORTANT: Return ONLY the valid JSON array as plain text without any markdown formatting, code blocks, or annotations. Do not use markdown syntax like \`\`\`json or \`\`\`. The response should be parseable directly by JSON.parse().

Text:
---
${noteData.content}
---

Output format example:
[{"question_text": "Question 1", "option_a": "Option A", "option_b": "Option B", "option_c": "Option C", "option_d": "Option D", "correct_option": "A", "explanation": "Explanation 1"}]`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: createUserContent([prompt]),
    });

    const geminiResponseText = response.text;

    let quizQuestions: QuizQuestion[];
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
      
      quizQuestions = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError, "Raw response:", geminiResponseText);
      return NextResponse.json({ success: false, message: 'Failed to parse quiz data from AI response' }, { status: 500 });
    }

    if (!Array.isArray(quizQuestions) || 
        quizQuestions.some(q => typeof q.question_text !== 'string' ||
                             typeof q.option_a !== 'string' ||
                             typeof q.option_b !== 'string' ||
                             typeof q.option_c !== 'string' ||
                             typeof q.option_d !== 'string' ||
                             !['A', 'B', 'C', 'D'].includes(q.correct_option) ||
                             typeof q.explanation !== 'string')) {
      console.error('Invalid quiz question structure received:', quizQuestions);
      return NextResponse.json({ success: false, message: 'AI response did not provide valid quiz question structure' }, { status: 500 });
    }
    
    if (quizQuestions.length === 0) {
      return NextResponse.json({ success: true, message: 'No quiz questions generated from the content.', quizSet: null });
    }

    const { data: newQuizSetId, error: rpcError } = await supabase.rpc('create_quiz_set_and_questions', {
      p_user_id: userId,
      p_note_id: noteId,
      p_title: `Quiz for: ${noteData.title.substring(0, 50)}${noteData.title.length > 50 ? '...' : ''}`,
      p_questions: quizQuestions
    });

    if (rpcError) {
      console.error('Supabase RPC error (create_quiz_set_and_questions):', rpcError);
      return NextResponse.json({ success: false, message: 'Failed to store quiz in database', error: rpcError.message }, { status: 500 });
    }
    
    const { data: newQuizData, error: newQuizError } = await supabase
      .from('quiz_sets')
      .select(`
        id,
        title,
        created_at,
        note_id,
        quiz_questions (
          id,
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_option,
          explanation,
          created_at
        )
      `)
      .eq('id', newQuizSetId)
      .eq('user_id', userId)
      .single();

    if (newQuizError) {
      console.error('Error fetching newly created quiz set details:', newQuizError);
      return NextResponse.json({ 
        success: true, 
        message: 'Quiz created, but failed to fetch complete confirmation data.', 
        quizSetId: newQuizSetId 
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Quiz created successfully!',
      quizSet: newQuizData
    });

  } catch (error) {
    console.error('Critical error in /api/quizzes/create:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
    return NextResponse.json({ success: false, message: `Failed to create quiz: ${errorMessage}` }, { status: 500 });
  }
} 