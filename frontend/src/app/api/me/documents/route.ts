import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

interface ContextDocument {
  id: string;
  type: 'note' | 'quiz' | 'flashcard_set';
  name: string;
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    const allDocuments: ContextDocument[] = [];

    // Fetch Notes
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, title')
      .eq('user_id', userId);

    if (notesError) {
      console.error('Error fetching notes:', notesError);
      // Decide if to throw or return partial/empty
    } else if (notes) {
      notes.forEach(note => {
        allDocuments.push({ id: note.id, name: note.title || 'Untitled Note', type: 'note' });
      });
    }

    // Fetch Quizzes
    // Assuming 'quizzes' table and 'title' column
    const { data: quizzes, error: quizzesError } = await supabase
      .from('quiz_sets')
      .select('id, title') 
      .eq('user_id', userId);

    if (quizzesError) {
      console.error('Error fetching quizzes:', quizzesError);
    } else if (quizzes) {
      quizzes.forEach(quiz => {
        allDocuments.push({ id: quiz.id, name: quiz.title || 'Untitled Quiz', type: 'quiz' });
      });
    }

    // Fetch Flashcard Sets
    // Assuming 'flashcard_sets' table and 'title' column
    const { data: flashcardSets, error: flashcardSetsError } = await supabase
      .from('flashcard_sets')
      .select('id, title')
      .eq('user_id', userId);

    if (flashcardSetsError) {
      console.error('Error fetching flashcard sets:', flashcardSetsError);
    } else if (flashcardSets) {
      flashcardSets.forEach(set => {
        allDocuments.push({ id: set.id, name: set.title || 'Untitled Flashcard Set', type: 'flashcard_set' });
      });
    }

    return NextResponse.json({ success: true, documents: allDocuments });

  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to fetch documents' 
      },
      { status: 500 }
    );
  }
} 