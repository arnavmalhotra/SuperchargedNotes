import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized - Please sign in' }, { status: 401 });
    }

    // Fetch flashcard sets and their individual flashcards for the user
    const { data: flashcardSets, error } = await supabase
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
      .eq('user_id', userId)
      .order('created_at', { ascending: false }); // Optional: order by newest first

    if (error) {
      console.error('Error fetching flashcard sets:', error);
      return NextResponse.json({ success: false, message: 'Failed to fetch flashcard sets', error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      flashcardSets: flashcardSets || [] 
    });

  } catch (error) {
    console.error('Error in /api/flashcards/list:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ success: false, message: `Failed to list flashcards: ${errorMessage}` }, { status: 500 });
  }
} 