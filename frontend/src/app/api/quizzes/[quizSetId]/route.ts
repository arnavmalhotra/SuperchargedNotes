import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizSetId: string }> }
) {
  try {
    const { userId } = await auth();
    const { quizSetId } = await params;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    if (!quizSetId) {
      return NextResponse.json(
        { success: false, message: 'Quiz Set ID is required' },
        { status: 400 }
      );
    }

    // Fetch the quiz set along with its questions
    const { data: quiz, error: fetchError } = await supabase
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
      .eq('id', quizSetId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching quiz set:', fetchError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch quiz set', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!quiz) {
      return NextResponse.json(
        { success: false, message: 'Quiz set not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      quiz
    });
  } catch (error) {
    console.error('Error in GET /api/quizzes/[quizSetId]:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to fetch quiz set'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ quizSetId: string }> }
) {
  try {
    const { userId } = await auth();
    const { quizSetId } = await params;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    if (!quizSetId) {
      return NextResponse.json(
        { success: false, message: 'Quiz Set ID is required' },
        { status: 400 }
      );
    }

    // Check if the quiz set exists and belongs to the user
    const { data: quizSet, error: fetchError } = await supabase
      .from('quiz_sets')
      .select('id')
      .eq('id', quizSetId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !quizSet) {
      return NextResponse.json(
        { success: false, message: 'Quiz set not found or access denied' },
        { status: 404 }
      );
    }

    // Delete the quiz set (questions will be deleted by ON DELETE CASCADE)
    const { error: deleteError } = await supabase
      .from('quiz_sets')
      .delete()
      .eq('id', quizSetId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting quiz set:', deleteError);
      return NextResponse.json(
        { success: false, message: 'Failed to delete quiz set', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Quiz set and associated questions deleted successfully' 
    });

  } catch (error) {
    console.error('Error in DELETE /api/quizzes/[quizSetId]:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to delete quiz set'
      },
      { status: 500 }
    );
  }
}

// export async function PUT(
//   request: NextRequest,
//   { params }: { params: { quizSetId: string } }
// ) {
//   try {
//     const { userId } = await auth();
//     const { quizSetId } = params;
//     const { title } = await request.json();

//     if (!userId) {
//       return NextResponse.json(
//         { success: false, message: 'Unauthorized - Please sign in' },
//         { status: 401 }
//       );
//     }

//     if (!quizSetId) {
//       return NextResponse.json(
//         { success: false, message: 'Quiz Set ID is required' },
//         { status: 400 }
//       );
//     }

//     if (!title || typeof title !== 'string' || title.trim() === '') {
//       return NextResponse.json(
//         { success: false, message: 'Title is required and must be a non-empty string' },
//         { status: 400 }
//       );
//     }

//     // Check if the quiz set exists and belongs to the user
//     const { data: quizSet, error: fetchError } = await supabase
//       .from('quiz_sets')
//       .select('id')
//       .eq('id', quizSetId)
//       .eq('user_id', userId)
//       .single();

//     if (fetchError || !quizSet) {
//       return NextResponse.json(
//         { success: false, message: 'Quiz set not found or access denied' },
//         { status: 404 }
//       );
//     }

//     const { data: updatedQuizSet, error: updateError } = await supabase
//       .from('quiz_sets')
//       .update({ title: title.trim(), updated_at: new Date().toISOString() })
//       .eq('id', quizSetId)
//       .eq('user_id', userId)
//       .select()
//       .single();

//     if (updateError) {
//       console.error('Error updating quiz set title:', updateError);
//       return NextResponse.json(
//         { success: false, message: 'Failed to update quiz set title', details: updateError.message },
//         { status: 500 }
//       );
//     }

//     return NextResponse.json({
//       success: true,
//       message: 'Quiz set title updated successfully',
//       quizSet: updatedQuizSet,
//     });

//   } catch (error) {
//     console.error('Error in PUT /api/quizzes/[quizSetId]:', error);
//     return NextResponse.json(
//       { 
//         success: false, 
//         message: error instanceof Error ? error.message : 'Failed to update quiz set title'
//       },
//       { status: 500 }
//     );
//   }
// } 