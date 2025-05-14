import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { userId } = await auth();
    const { noteId } = await params;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    if (!noteId) {
      return NextResponse.json(
        { success: false, message: 'Note ID is required' },
        { status: 400 }
      );
    }

    // Fetch the specific note
    const { data: note, error: fetchError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching note:', fetchError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch note', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!note) {
      return NextResponse.json(
        { success: false, message: 'Note not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      note
    });
  } catch (error) {
    console.error('Error in GET /api/notes/[noteId]:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to fetch note'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { userId } = await auth();
    const { noteId } = await params;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    if (!noteId) {
      return NextResponse.json(
        { success: false, message: 'Note ID is required' },
        { status: 400 }
      );
    }

    // Check if the note exists and belongs to the user before attempting to delete children
    const { data: note, error: noteFetchError } = await supabase
      .from('notes')
      .select('id')
      .eq('id', noteId)
      .eq('user_id', userId)
      .single();

    if (noteFetchError || !note) {
      return NextResponse.json(
        { success: false, message: 'Note not found or access denied' },
        { status: 404 } // Or 403 if you prefer for access denied
      );
    }

    // 1. Delete associated quiz sets
    // Assuming 'quiz_sets' table has a 'note_id' column
    const { error: quizDeleteError } = await supabase
      .from('quiz_sets')
      .delete()
      .eq('note_id', noteId)
      .eq('user_id', userId); // Ensure user owns these quiz sets too

    if (quizDeleteError) {
      console.error('Error deleting associated quiz sets:', quizDeleteError);
      // Not returning immediately, try to delete other items, but log the error
      // Depending on desired atomicity, you might want to handle this differently (e.g., transaction)
    }

    // 2. Delete associated flashcard sets
    // Assuming 'flashcard_sets' table has a 'note_id' column
    const { error: flashcardDeleteError } = await supabase
      .from('flashcard_sets')
      .delete()
      .eq('note_id', noteId)
      .eq('user_id', userId); // Ensure user owns these flashcard sets too

    if (flashcardDeleteError) {
      console.error('Error deleting associated flashcard sets:', flashcardDeleteError);
      // Not returning immediately, log error.
    }

    // 3. Delete the note itself
    const { error: noteDeleteError } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId);

    if (noteDeleteError) {
      console.error('Error deleting the note:', noteDeleteError);
      return NextResponse.json(
        { success: false, message: 'Failed to delete the note after attempting to delete children.', details: noteDeleteError.message },
        { status: 500 }
      );
    }
    
    // If any of the child deletions failed but the main note deletion succeeded, 
    // the overall operation is partially successful. You might want to reflect this.
    // For now, if note deletion is successful, we consider it a success.
    if (quizDeleteError || flashcardDeleteError) {
        console.warn('Note deleted, but one or more associated items (quizzes/flashcards) failed to delete.');
        return NextResponse.json({
            success: true, 
            message: 'Note deleted, but encountered errors deleting some associated items.',
            errors: {
                quizDeleteError: quizDeleteError?.message,
                flashcardDeleteError: flashcardDeleteError?.message
            }
        });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Note and associated quizzes/flashcards deleted successfully' 
    });

  } catch (error) {
    console.error('Error in DELETE /api/notes/[noteId]:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to delete note and associated items'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { userId } = await auth();
    const { noteId } = await params;
    const { title, content } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    if (!noteId) {
      return NextResponse.json(
        { success: false, message: 'Note ID is required' },
        { status: 400 }
      );
    }

    if (!title && !content) {
      return NextResponse.json(
        { success: false, message: 'Title or content is required for update' },
        { status: 400 }
      );
    }

    // Check if the note exists and belongs to the user
    const { data: note, error: fetchError } = await supabase
      .from('notes')
      .select('id')
      .eq('id', noteId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !note) {
      return NextResponse.json(
        { success: false, message: 'Note not found or access denied' },
        { status: 404 }
      );
    }

    // Prepare update object
    const updateData: { title?: string; content?: string; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (title) updateData.title = title;
    if (content) updateData.content = content;

    const { data: updatedNote, error: updateError } = await supabase
      .from('notes')
      .update(updateData)
      .eq('id', noteId)
      .eq('user_id', userId)
      .select()
      .single(); // To return the updated note

    if (updateError) {
      console.error('Error updating note:', updateError);
      return NextResponse.json(
        { success: false, message: 'Failed to update note', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Note updated successfully',
      note: updatedNote
    });

  } catch (error) {
    console.error('Error in PUT /api/notes/[noteId]:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to update note'
      },
      { status: 500 }
    );
  }
} 