from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import os
from google import genai
import json
import re
from db import supabase, get_current_user_id

# Initialize Gemini client
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("WARNING: Missing GEMINI_API_KEY environment variable. Quiz creation will not work.")
else:
    genai_client = genai.Client(api_key=GEMINI_API_KEY)

# Create quizzes router
router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])

# Pydantic models
class QuizQuestion(BaseModel):
    id: Optional[str] = None
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str  # "A", "B", "C", or "D"
    explanation: Optional[str] = None
    created_at: Optional[str] = None

class QuizSet(BaseModel):
    id: str
    title: str
    created_at: str
    note_id: Optional[str] = None
    quiz_questions: Optional[List[QuizQuestion]] = None

class QuizSetResponse(BaseModel):
    success: bool
    quiz: Optional[QuizSet] = None
    message: Optional[str] = None

class QuizSetsResponse(BaseModel):
    success: bool
    quizSets: List[QuizSet] = []
    message: Optional[str] = None

class CreateQuizRequest(BaseModel):
    noteId: str
    userId: str
    preferences: Optional[Dict[str, Any]] = None  # Add preferences field

# GET /api/quizzes/list - Get all quiz sets for a user
@router.get("/list", response_model=QuizSetsResponse)
async def list_quizzes(user_id: str = Depends(get_current_user_id)):
    try:
        # Fetch quiz sets and their individual questions for the user
        quiz_sets_response = supabase.from_('quiz_sets')\
            .select('''
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
            ''')\
            .eq('user_id', user_id)\
            .order('created_at', desc=True)\
            .execute()

        if hasattr(quiz_sets_response, 'error') and quiz_sets_response.error:
            raise HTTPException(status_code=500, detail=f"Failed to fetch quiz sets: {quiz_sets_response.error}")

        return {
            "success": True,
            "quizSets": quiz_sets_response.data or []
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error in /api/quizzes/list: {e}")
        return {
            "success": False, 
            "message": f"Failed to list quizzes: {str(e)}",
            "quizSets": []
        }

# GET /api/quizzes/{quiz_set_id} - Get a specific quiz set
@router.get("/{quiz_set_id}", response_model=QuizSetResponse)
async def get_quiz_set(quiz_set_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        if not quiz_set_id:
            raise HTTPException(status_code=400, detail="Quiz Set ID is required")

        # Fetch the quiz set along with its questions
        quiz_set_response = supabase.from_('quiz_sets')\
            .select('''
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
            ''')\
            .eq('id', quiz_set_id)\
            .eq('user_id', user_id)\
            .single()\
            .execute()

        if hasattr(quiz_set_response, 'error') and quiz_set_response.error:
            print(f"Error fetching quiz set: {quiz_set_response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch quiz set: {quiz_set_response.error}")

        if not quiz_set_response.data:
            raise HTTPException(status_code=404, detail="Quiz set not found or access denied")

        return {
            "success": True,
            "quiz": quiz_set_response.data
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error in GET /api/quizzes/{{quiz_set_id}}: {e}")
        return {
            "success": False,
            "message": f"Failed to fetch quiz set: {str(e)}"
        }

# DELETE /api/quizzes/{quiz_set_id} - Delete a quiz set
@router.delete("/{quiz_set_id}", response_model=dict)
async def delete_quiz_set(quiz_set_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        if not quiz_set_id:
            raise HTTPException(status_code=400, detail="Quiz Set ID is required")

        # Check if the quiz set exists and belongs to the user
        quiz_set_check = supabase.from_('quiz_sets')\
            .select('id')\
            .eq('id', quiz_set_id)\
            .eq('user_id', user_id)\
            .single()\
            .execute()

        if hasattr(quiz_set_check, 'error') or not quiz_set_check.data:
            raise HTTPException(status_code=404, detail="Quiz set not found or access denied")

        # Delete the quiz set (questions will be deleted by ON DELETE CASCADE)
        delete_response = supabase.from_('quiz_sets')\
            .delete()\
            .eq('id', quiz_set_id)\
            .eq('user_id', user_id)\
            .execute()

        if hasattr(delete_response, 'error') and delete_response.error:
            print(f"Error deleting quiz set: {delete_response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to delete quiz set: {delete_response.error}")

        return {
            "success": True,
            "message": "Quiz set and associated questions deleted successfully"
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error in DELETE /api/quizzes/{{quiz_set_id}}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete quiz set: {str(e)}")

# POST /api/quizzes/create - Create quizzes from a note
@router.post("/create", response_model=QuizSetResponse)
async def create_quiz(request: CreateQuizRequest, user_id: str = Depends(get_current_user_id)):
    try:
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured on the server")

        # Verify user ID in request matches authenticated user
        if request.userId != user_id:
            raise HTTPException(status_code=403, detail="User ID mismatch")

        note_id = request.noteId
        if not note_id:
            raise HTTPException(status_code=400, detail="Missing noteId")

        # Fetch the note content
        note_response = supabase.from_('notes')\
            .select('title, content')\
            .eq('id', note_id)\
            .eq('user_id', user_id)\
            .single()\
            .execute()

        if hasattr(note_response, 'error') or not note_response.data:
            print(f"Error fetching note or note not found: {getattr(note_response, 'error', 'Note not found')}")
            raise HTTPException(
                status_code=404 if not note_response.data else 500,
                detail="Failed to fetch note or note not found"
            )

        note_data = note_response.data

        # Process user preferences
        preferences = request.preferences or {}
        question_count = preferences.get('question_count', 5)  # Default to 5 questions
        difficulty = preferences.get('difficulty', 'medium')  # Default to medium difficulty
        focus_topic = preferences.get('focus_topic', '')  # Default to no specific focus
        
        # Create prompt for Gemini with preferences
        prompt = f"""Based on the following text, generate a multiple-choice quiz with {question_count} questions at {difficulty} difficulty level. Each question should be a JSON object with the following properties:
- question_text: The question itself
- option_a: First option
- option_b: Second option
- option_c: Third option
- option_d: Fourth option
- correct_option: One of 'A', 'B', 'C', or 'D' indicating which option is correct
- explanation: Brief explanation of why the answer is correct

IMPORTANT: Return ONLY the valid JSON array as plain text without any markdown formatting, code blocks, or annotations. Do not use markdown syntax like ```json or ```. The response should be parseable directly by JSON.parse().

{f'Focus on the topic of "{focus_topic}" if present in the content.' if focus_topic else ''}

Difficulty guidelines:
- Easy: Simple recall questions with straightforward options
- Medium: Application and comprehension questions with more nuanced options
- Hard: Analysis and synthesis questions with challenging distractors

Text:
---
{note_data['content']}
---

Output format example:
[{{"question_text": "Question 1", "option_a": "Option A", "option_b": "Option B", "option_c": "Option C", "option_d": "Option D", "correct_option": "A", "explanation": "Explanation 1"}}]"""

        # Call Gemini API
        response = genai_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )

        gemini_response_text = response.text

        # Parse the response to extract quiz questions
        try:
            # Clean up the response if it contains markdown code blocks
            json_text = gemini_response_text
            
            # Remove markdown code block markers if present
            if "```" in json_text:
                json_match = re.search(r"```(?:json)?\s*\n([\s\S]*?)```", json_text)
                if json_match and json_match.group(1):
                    json_text = json_match.group(1).strip()
                else:
                    # If we can't extract from code blocks, try to find JSON array directly
                    possible_json = re.search(r"\[\s*\{[\s\S]*\}\s*\]", json_text)
                    if possible_json:
                        json_text = possible_json.group(0)
            
            # Fix LaTeX backslashes before parsing JSON
            # Replace \\ with a temporary placeholder to preserve them
            json_text = json_text.replace("\\\\", "##DOUBLE_BACKSLASH##")
            # Handle single backslashes that aren't already escaped in JSON
            json_text = re.sub(r'([^\\])\\([^\\/"bfnrt])', r'\1\\\\\2', json_text)
            # Restore double backslashes
            json_text = json_text.replace("##DOUBLE_BACKSLASH##", "\\\\\\\\")
            
            quiz_questions = json.loads(json_text)
        except Exception as parse_error:
            print(f"Error parsing Gemini response: {parse_error}. Raw response: {gemini_response_text}")
            raise HTTPException(status_code=500, detail="Failed to parse quiz data from AI response")

        # Validate quiz questions structure
        if not isinstance(quiz_questions, list) or any(
            not isinstance(q, dict) or 
            not all(key in q for key in ["question_text", "option_a", "option_b", "option_c", "option_d", "correct_option"]) or
            q["correct_option"] not in ["A", "B", "C", "D"]
            for q in quiz_questions
        ):
            print(f"Invalid quiz question structure received: {quiz_questions}")
            raise HTTPException(status_code=500, detail="AI response did not provide valid quiz question structure")
        
        if len(quiz_questions) == 0:
            return {
                "success": True,
                "message": "No quiz questions generated from the content.",
                "quiz": None
            }

        # Call the Supabase stored procedure to create the quiz set and questions
        rpc_response = supabase.rpc(
            'create_quiz_set_and_questions',
            {
                "p_user_id": user_id,
                "p_note_id": note_id,
                "p_title": f"Quiz for: {note_data['title'][:50]}{'...' if len(note_data['title']) > 50 else ''}",
                "p_questions": quiz_questions
            }
        ).execute()

        if hasattr(rpc_response, 'error') and rpc_response.error:
            print(f"Supabase RPC error (create_quiz_set_and_questions): {rpc_response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to store quiz in database: {rpc_response.error}")
        
        new_quiz_set_id = rpc_response.data

        # Fetch the newly created quiz set
        new_set_response = supabase.from_('quiz_sets')\
            .select('''
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
            ''')\
            .eq('id', new_quiz_set_id)\
            .eq('user_id', user_id)\
            .single()\
            .execute()

        if hasattr(new_set_response, 'error'):
            print(f"Error fetching newly created quiz set details: {new_set_response.error}")
            return {
                "success": True,
                "message": "Quiz created, but failed to fetch complete confirmation data.",
                "quiz": {"id": new_quiz_set_id}
            }

        return {
            "success": True,
            "message": "Quiz created successfully!",
            "quiz": new_set_response.data
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Critical error in /api/quizzes/create: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create quiz: {str(e)}") 