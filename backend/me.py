from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from db import supabase, get_current_user_id

# Create router
router = APIRouter(prefix="/api/me", tags=["me"])

# Pydantic models
class ContextDocument(BaseModel):
    id: str
    type: str  # 'note' | 'quiz' | 'flashcard_set'
    name: str

class DocumentsResponse(BaseModel):
    success: bool
    documents: Optional[List[ContextDocument]] = None
    message: Optional[str] = None

@router.get("/documents", response_model=DocumentsResponse)
async def get_user_documents(user_id: str = Depends(get_current_user_id)):
    """
    Get all user's documents (notes, quizzes, flashcard sets) for use in chatbot contexts
    """
    try:
        all_documents: List[ContextDocument] = []

        # Fetch Notes
        notes_response = supabase.from_('notes')\
            .select('id, title')\
            .eq('user_id', user_id)\
            .execute()

        if hasattr(notes_response, 'error') and notes_response.error:
            print(f"Error fetching notes: {notes_response.error}")
        elif notes_response.data:
            for note in notes_response.data:
                all_documents.append(ContextDocument(
                    id=note['id'],
                    name=note['title'] or 'Untitled Note',
                    type='note'
                ))

        # Fetch Quizzes
        quizzes_response = supabase.from_('quiz_sets')\
            .select('id, title')\
            .eq('user_id', user_id)\
            .execute()

        if hasattr(quizzes_response, 'error') and quizzes_response.error:
            print(f"Error fetching quizzes: {quizzes_response.error}")
        elif quizzes_response.data:
            for quiz in quizzes_response.data:
                all_documents.append(ContextDocument(
                    id=quiz['id'],
                    name=quiz['title'] or 'Untitled Quiz',
                    type='quiz'
                ))

        # Fetch Flashcard Sets
        flashcards_response = supabase.from_('flashcard_sets')\
            .select('id, title')\
            .eq('user_id', user_id)\
            .execute()

        if hasattr(flashcards_response, 'error') and flashcards_response.error:
            print(f"Error fetching flashcard sets: {flashcards_response.error}")
        elif flashcards_response.data:
            for set in flashcards_response.data:
                all_documents.append(ContextDocument(
                    id=set['id'],
                    name=set['title'] or 'Untitled Flashcard Set',
                    type='flashcard_set'
                ))

        return DocumentsResponse(success=True, documents=all_documents)

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error in get_user_documents: {e}")
        return DocumentsResponse(
            success=False,
            message=f"Failed to fetch documents: {str(e)}"
        ) 