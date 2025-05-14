import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized - Please sign in' }, { status: 401 });
    }

    // Fetch quiz sets and their individual questions for the user
    const { data: quizSets, error } = await supabase
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
      .eq('user_id', userId)
      .order('created_at', { ascending: false }); // Order by newest first

    if (error) {
      console.error('Error fetching quiz sets:', error);
      return NextResponse.json({ success: false, message: 'Failed to fetch quiz sets', error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      quizSets: quizSets || [] 
    });

  } catch (error) {
    console.error('Error in /api/quizzes/list:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, message: `Failed to list quizzes: ${errorMessage}` }, { status: 500 });
  }
} 