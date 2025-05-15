from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv
import os
import flashcards
import notes
import quizzes
import me
import upload
import chat  # Added import for chat module

# Import from shared db module
from db import supabase, get_current_user_id

load_dotenv()

# Initialize FastAPI app
app = FastAPI()

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://www.superchargednotes.com", "https://supercharged-notes.vercel.app", "https://superchargednotes.com"],  # Allow all origins
    allow_credentials=True, # Allows cookies to be included in requests
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

# Import and include routers
app.include_router(flashcards.router)
app.include_router(notes.router)
app.include_router(quizzes.router)
app.include_router(me.router)
app.include_router(upload.router)
app.include_router(chat.router)  # Added chat router

# Pydantic models for response data
class Note(BaseModel):
    id: Any # Supabase might return int or string depending on actual schema
    title: Optional[str] = None
    content: Optional[str] = None
    created_at: Optional[str] = None # Or datetime

class ProcessedQuiz(BaseModel):
    id: Any
    title: Optional[str] = None
    created_at: Optional[str] = None # Or datetime
    questionCount: int

class ProcessedFlashcard(BaseModel):
    id: Any
    title: Optional[str] = None
    created_at: Optional[str] = None # Or datetime
    cardCount: int

class DashboardStats(BaseModel):
    totalNotes: int
    totalQuizzes: int
    totalFlashcards: int
    allFiles: List[Note]
    quizzes: List[ProcessedQuiz]
    flashcards: List[ProcessedFlashcard]

class StatsResponse(BaseModel):
    success: bool
    stats: Optional[DashboardStats] = None
    message: Optional[str] = None


@app.get("/api/dashboard/stats", response_model=StatsResponse)
async def get_dashboard_stats(user_id: str = Depends(get_current_user_id)):
    try:
        # Fetch notes data
        notes_response = supabase.from_('notes')\
            .select('id, title, content, created_at')\
            .eq('user_id', user_id)\
            .order('created_at', desc=True)\
            .execute()

        if hasattr(notes_response, 'error') and notes_response.error:
            raise HTTPException(status_code=500, detail=f"Supabase error (notes): {notes_response.error}")


        # Fetch quizzes data
        quizzes_response = supabase.from_('quiz_sets')\
            .select('id, title, created_at, note_id, quiz_questions(id)')\
            .eq('user_id', user_id)\
            .order('created_at', desc=True)\
            .execute()
        
        if hasattr(quizzes_response, 'error') and quizzes_response.error:
            raise HTTPException(status_code=500, detail=f"Supabase error (quizzes): {quizzes_response.error}")


        # Fetch flashcards data
        flashcards_response = supabase.from_('flashcard_sets')\
            .select('id, title, created_at, note_id, individual_flashcards(id)')\
            .eq('user_id', user_id)\
            .order('created_at', desc=True)\
            .execute()

        if hasattr(flashcards_response, 'error') and flashcards_response.error:
            raise HTTPException(status_code=500, detail=f"Supabase error (flashcards): {flashcards_response.error}")

        # Process quiz data
        processed_quizzes = []
        if quizzes_response.data:
            for quiz in quizzes_response.data:
                processed_quizzes.append(ProcessedQuiz(
                    id=quiz.get('id'),
                    title=quiz.get('title'),
                    created_at=quiz.get('created_at'),
                    questionCount=len(quiz.get('quiz_questions', [])) if isinstance(quiz.get('quiz_questions'), list) else 0
                ))

        # Process flashcard data
        processed_flashcards = []
        if flashcards_response.data:
            for flashcard in flashcards_response.data:
                processed_flashcards.append(ProcessedFlashcard(
                    id=flashcard.get('id'),
                    title=flashcard.get('title'),
                    created_at=flashcard.get('created_at'),
                    cardCount=len(flashcard.get('individual_flashcards', [])) if isinstance(flashcard.get('individual_flashcards'), list) else 0
                ))
        
        notes_data = [Note(**note) for note in notes_response.data] if notes_response.data else []

        stats_data = DashboardStats(
            totalNotes=len(notes_response.data) if notes_response.data else 0,
            totalQuizzes=len(quizzes_response.data) if quizzes_response.data else 0,
            totalFlashcards=len(flashcards_response.data) if flashcards_response.data else 0,
            allFiles=notes_data,
            quizzes=processed_quizzes,
            flashcards=processed_flashcards
        )

        return StatsResponse(success=True, stats=stats_data)

    except HTTPException as http_exc:
        # Re-raise HTTPExceptions (like 401 from auth)
        raise http_exc
    except Exception as e:
        print(f"Dashboard stats fetch error: {e}") # Log the error
        # For other exceptions, return a generic 500 error
        # Avoid leaking internal error details to the client in production
        return StatsResponse(success=False, message=str(e) if os.environ.get("APP_ENV") == "development" else "Failed to fetch dashboard stats", stats=None)



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
