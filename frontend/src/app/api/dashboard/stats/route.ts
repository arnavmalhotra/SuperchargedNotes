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

    // Fetch counts and files
    const [notesCount, quizzesCount, flashcardsCount, allFiles] = await Promise.all([
      supabase
        .from('notes')
        .select('id', { count: 'exact' })
        .eq('user_id', userId),
      supabase
        .from('quizzes')
        .select('id', { count: 'exact' })
        .eq('user_id', userId),
      supabase
        .from('flashcards')
        .select('id', { count: 'exact' })
        .eq('user_id', userId),
      supabase
        .from('notes')
        .select('id, title, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    ]);

    return NextResponse.json({ 
      success: true, 
      stats: {
        totalNotes: notesCount.count || 0,
        totalQuizzes: quizzesCount.count || 0,
        totalFlashcards: flashcardsCount.count || 0,
        allFiles: allFiles.data || []
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