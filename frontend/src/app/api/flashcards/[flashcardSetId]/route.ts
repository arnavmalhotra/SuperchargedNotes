import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ flashcardSetId: string }> }
) {
  try {
    const { userId } = await auth();
    const { flashcardSetId } = await params;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    if (!flashcardSetId) {
      return NextResponse.json(
        { success: false, message: 'Flashcard Set ID is required' },
        { status: 400 }
      );
    }

    // Fetch the flashcard set along with its cards
    const { data: flashcardSet, error: fetchError } = await supabase
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
      .eq('id', flashcardSetId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching flashcard set:', fetchError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch flashcard set', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!flashcardSet) {
      return NextResponse.json(
        { success: false, message: 'Flashcard set not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      flashcardSet
    });
  } catch (error) {
    console.error('Error in GET /api/flashcards/[flashcardSetId]:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to fetch flashcard set'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ flashcardSetId: string }> }
) {
  try {
    const { userId } = await auth();
    const { flashcardSetId } = await params;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    if (!flashcardSetId) {
      return NextResponse.json(
        { success: false, message: 'Flashcard Set ID is required' },
        { status: 400 }
      );
    }

    // Check if the flashcard set exists and belongs to the user
    const { data: flashcardSet, error: fetchError } = await supabase
      .from('flashcard_sets')
      .select('id')
      .eq('id', flashcardSetId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !flashcardSet) {
      return NextResponse.json(
        { success: false, message: 'Flashcard set not found or access denied' },
        { status: 404 }
      );
    }

    // Delete the flashcard set (cards will be deleted by ON DELETE CASCADE)
    const { error: deleteError } = await supabase
      .from('flashcard_sets')
      .delete()
      .eq('id', flashcardSetId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting flashcard set:', deleteError);
      return NextResponse.json(
        { success: false, message: 'Failed to delete flashcard set', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Flashcard set and associated cards deleted successfully' 
    });

  } catch (error) {
    console.error('Error in DELETE /api/flashcards/[flashcardSetId]:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to delete flashcard set'
      },
      { status: 500 }
    );
  }
}

// export async function PUT(
//   request: NextRequest,
//   { params }: { params: { flashcardSetId: string } }
// ) {
//   try {
//     const { userId } = await auth();
//     const { flashcardSetId } = params;
//     const { title } = await request.json();

//     if (!userId) {
//       return NextResponse.json(
//         { success: false, message: 'Unauthorized - Please sign in' },
//         { status: 401 }
//       );
//     }

//     if (!flashcardSetId) {
//       return NextResponse.json(
//         { success: false, message: 'Flashcard Set ID is required' },
//         { status: 400 }
//       );
//     }

//     if (!title || typeof title !== 'string' || title.trim() === '') {
//       return NextResponse.json(
//         { success: false, message: 'Title is required and must be a non-empty string' },
//         { status: 400 }
//       );
//     }

//     // Check if the flashcard set exists and belongs to the user
//     const { data: flashcardSet, error: fetchError } = await supabase
//       .from('flashcard_sets')
//       .select('id')
//       .eq('id', flashcardSetId)
//       .eq('user_id', userId)
//       .single();

//     if (fetchError || !flashcardSet) {
//       return NextResponse.json(
//         { success: false, message: 'Flashcard set not found or access denied' },
//         { status: 404 }
//       );
//     }

//     const { data: updatedFlashcardSet, error: updateError } = await supabase
//       .from('flashcard_sets')
//       .update({ title: title.trim(), updated_at: new Date().toISOString() })
//       .eq('id', flashcardSetId)
//       .eq('user_id', userId)
//       .select()
//       .single();

//     if (updateError) {
//       console.error('Error updating flashcard set title:', updateError);
//       return NextResponse.json(
//         { success: false, message: 'Failed to update flashcard set title', details: updateError.message },
//         { status: 500 }
//       );
//     }

//     return NextResponse.json({
//       success: true,
//       message: 'Flashcard set title updated successfully',
//       flashcardSet: updatedFlashcardSet,
//     });

//   } catch (error) {
//     console.error('Error in PUT /api/flashcards/[flashcardSetId]:', error);
//     return NextResponse.json(
//       { 
//         success: false, 
//         message: error instanceof Error ? error.message : 'Failed to update flashcard set title'
//       },
//       { status: 500 }
//     );
//   }
// } 