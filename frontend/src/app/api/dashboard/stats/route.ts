import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    // Fetch notes data
    const notesResponse = await supabase
      .from('notes')
      .select('id, title, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    // Fetch quizzes data (aligning with /api/quizzes/list)
    const quizzesResponse = await supabase
      .from('quiz_sets') // Using quiz_sets table name
      .select(`
        id,
        title,
        created_at,
        note_id,
        quiz_questions (
          id
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    // Fetch flashcards data (aligning with /api/flashcards/list)
    const flashcardsResponse = await supabase
      .from('flashcard_sets') // Using flashcard_sets table name
      .select(`
        id,
        title,
        created_at,
        note_id,
        individual_flashcards (
          id
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Process quiz data to include question count
    const processedQuizzes = quizzesResponse.data?.map(quiz => ({
      id: quiz.id,
      title: quiz.title,
      created_at: quiz.created_at,
      // Assuming quiz_questions is an array of objects, even if we only selected id
      questionCount: Array.isArray(quiz.quiz_questions) ? quiz.quiz_questions.length : 0 
    })) || [];

    // Process flashcard data to include card count
    const processedFlashcards = flashcardsResponse.data?.map(flashcard => ({
      id: flashcard.id,
      title: flashcard.title,
      created_at: flashcard.created_at,
      // Assuming individual_flashcards is an array of objects
      cardCount: Array.isArray(flashcard.individual_flashcards) ? flashcard.individual_flashcards.length : 0
    })) || [];

    return NextResponse.json({ 
      success: true, 
      stats: {
        totalNotes: notesResponse.data?.length || 0,
        totalQuizzes: quizzesResponse.data?.length || 0,
        totalFlashcards: flashcardsResponse.data?.length || 0,
        allFiles: notesResponse.data || [],
        quizzes: processedQuizzes,
        flashcards: processedFlashcards
      }
    });
  } catch (error) {
    console.error('Dashboard stats fetch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to fetch dashboard stats'
      },
      { status: 500 }
    );
  }
} 