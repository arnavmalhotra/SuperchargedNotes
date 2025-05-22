from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import os
from google import genai
import json
import re

# Import from shared db module instead of main
from db import supabase, get_current_user_id

# Initialize Gemini client
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("WARNING: Missing GEMINI_API_KEY environment variable. Flashcard creation will not work.")
else:
    genai_client = genai.Client(api_key=GEMINI_API_KEY)

# Create flashcards router
router = APIRouter(prefix="/api/flashcards", tags=["flashcards"])

# Pydantic models
class Flashcard(BaseModel):
    id: Optional[str] = None
    front: Optional[str] = None
    back: Optional[str] = None
    created_at: Optional[str] = None

class FlashcardSet(BaseModel):
    id: str
    title: str
    created_at: str
    note_id: Optional[str] = None
    individual_flashcards: Optional[List[Flashcard]] = None

class FlashcardSetResponse(BaseModel):
    success: bool
    flashcardSet: Optional[FlashcardSet] = None
    message: Optional[str] = None

class FlashcardSetsResponse(BaseModel):
    success: bool
    flashcardSets: List[FlashcardSet] = []
    message: Optional[str] = None

class CreateFlashcardRequest(BaseModel):
    noteId: str
    userId: str
    preferences: Optional[Dict[str, Any]] = None

class FormattedFlashcard(BaseModel):
    front_text: str
    back_text: str

# GET /api/flashcards/list - Get all flashcard sets for a user
@router.get("/list", response_model=FlashcardSetsResponse)
async def list_flashcards(user_id: str = Depends(get_current_user_id)):
    try:
        # Fetch flashcard sets and their individual flashcards for the user
        flashcard_sets_response = supabase.from_('flashcard_sets')\
            .select('''
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
            ''')\
            .eq('user_id', user_id)\
            .order('created_at', desc=True)\
            .execute()

        if hasattr(flashcard_sets_response, 'error') and flashcard_sets_response.error:
            raise HTTPException(status_code=500, detail=f"Failed to fetch flashcard sets: {flashcard_sets_response.error}")

        return {
            "success": True,
            "flashcardSets": flashcard_sets_response.data or []
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error in /api/flashcards/list: {e}")
        return {
            "success": False, 
            "message": f"Failed to list flashcards: {str(e)}",
            "flashcardSets": []
        }

# GET /api/flashcards/{flashcard_set_id} - Get a specific flashcard set
@router.get("/{flashcard_set_id}", response_model=FlashcardSetResponse)
async def get_flashcard_set(flashcard_set_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        if not flashcard_set_id:
            raise HTTPException(status_code=400, detail="Flashcard Set ID is required")

        # Fetch the flashcard set along with its cards
        flashcard_set_response = supabase.from_('flashcard_sets')\
            .select('''
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
            ''')\
            .eq('id', flashcard_set_id)\
            .eq('user_id', user_id)\
            .single()\
            .execute()

        if hasattr(flashcard_set_response, 'error') and flashcard_set_response.error:
            print(f"Error fetching flashcard set: {flashcard_set_response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch flashcard set: {flashcard_set_response.error}")

        if not flashcard_set_response.data:
            raise HTTPException(status_code=404, detail="Flashcard set not found or access denied")

        return {
            "success": True,
            "flashcardSet": flashcard_set_response.data
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error in GET /api/flashcards/{{flashcard_set_id}}: {e}")
        return {
            "success": False,
            "message": f"Failed to fetch flashcard set: {str(e)}"
        }

# DELETE /api/flashcards/{flashcard_set_id} - Delete a flashcard set
@router.delete("/{flashcard_set_id}", response_model=dict)
async def delete_flashcard_set(flashcard_set_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        if not flashcard_set_id:
            raise HTTPException(status_code=400, detail="Flashcard Set ID is required")

        # Check if the flashcard set exists and belongs to the user
        flashcard_set_check = supabase.from_('flashcard_sets')\
            .select('id')\
            .eq('id', flashcard_set_id)\
            .eq('user_id', user_id)\
            .single()\
            .execute()

        if hasattr(flashcard_set_check, 'error') or not flashcard_set_check.data:
            raise HTTPException(status_code=404, detail="Flashcard set not found or access denied")

        # Delete the flashcard set (cards will be deleted by ON DELETE CASCADE)
        delete_response = supabase.from_('flashcard_sets')\
            .delete()\
            .eq('id', flashcard_set_id)\
            .eq('user_id', user_id)\
            .execute()

        if hasattr(delete_response, 'error') and delete_response.error:
            print(f"Error deleting flashcard set: {delete_response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to delete flashcard set: {delete_response.error}")

        return {
            "success": True,
            "message": "Flashcard set and associated cards deleted successfully"
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error in DELETE /api/flashcards/{{flashcard_set_id}}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete flashcard set: {str(e)}")

# POST /api/flashcards/create - Create flashcards from a note
@router.post("/create", response_model=FlashcardSetResponse)
async def create_flashcards(request: CreateFlashcardRequest, user_id: str = Depends(get_current_user_id)):
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
        card_count = preferences.get('card_count', 10)  # Default to 10 cards
        difficulty = preferences.get('difficulty', 'medium')  # Default to medium difficulty
        focus_topic = preferences.get('focus_topic', '')  # Default to no specific focus
        
        # Create prompt for Gemini with preferences
        prompt = f"""Based on the following text, generate a list of {card_count} flashcards at {difficulty} difficulty level. Each flashcard should be a JSON object with a "front" (question, term, or concept) and a "back" (answer or definition).

IMPORTANT: Return ONLY the valid JSON array as plain text without any markdown formatting, code blocks, or annotations. Do not use markdown syntax like ```json or ```. The response should be parseable directly by JSON.parse().

{f'Focus on the topic of "{focus_topic}" if present in the content.' if focus_topic else ''}

Difficulty guidelines:
- Easy: Simple definitions, basic concepts, and straightforward questions
- Medium: More detailed explanations, intermediate concepts, and application-level questions
- Hard: Complex details, advanced concepts, and questions requiring synthesis of multiple ideas

Special formatting guidelines:
1. Mathematical expressions: Use LaTeX notation
   - Inline math: $E = mc^2$
   - Display math: $$K_a = \\frac{{[H^+][A^-]}}{{[HA]}}$$

2. Chemical equations and formulas: Use \\ce{} notation (will be rendered with mhchem)
   - Example: \\ce{2H2 + O2 -> 2H2O}
   - Example: \\ce{H2SO4}

Text:
---
{note_data['content']}
---

Output format example:
[{{"front": "Question 1", "back": "Answer 1"}}, {{"front": "Question 2", "back": "Answer 2"}}]"""

        # Call Gemini API
        response = genai_client.models.generate_content(
            model="gemini-1.5-pro",
            contents=prompt,
        )

        gemini_response_text = response.text

        # Parse the response to extract flashcards
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
            
            flashcards = json.loads(json_text)
        except Exception as parse_error:
            print(f"Error parsing Gemini response: {parse_error}. Raw response: {gemini_response_text}")
            raise HTTPException(status_code=500, detail="Failed to parse flashcard data from AI response")

        # Validate flashcards structure
        if not isinstance(flashcards, list) or any(not isinstance(fc, dict) or 'front' not in fc or 'back' not in fc for fc in flashcards):
            print(f"Invalid flashcard structure received: {flashcards}")
            raise HTTPException(status_code=500, detail="AI response did not provide valid flashcard structure")
        
        if len(flashcards) == 0:
            return {
                "success": True,
                "message": "No flashcards generated from the content.",
                "flashcardSet": None
            }

        # Create the properly formatted flashcards array
        formatted_flashcards = [{"front_text": fc["front"], "back_text": fc["back"]} for fc in flashcards]

        # Call the Supabase stored procedure to create the flashcard set and cards
        rpc_response = supabase.rpc(
            'create_flashcard_set_and_cards',
            {
                "p_user_id": user_id,
                "p_note_id": note_id,
                "p_title": f"Flashcards for: {note_data['title'][:50]}{'...' if len(note_data['title']) > 50 else ''}",
                "p_flashcards": formatted_flashcards
            }
        ).execute()

        if hasattr(rpc_response, 'error') and rpc_response.error:
            print(f"Supabase RPC error (create_flashcard_set_and_cards): {rpc_response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to store flashcards in database: {rpc_response.error}")
        
        new_flashcard_set_id = rpc_response.data

        # Fetch the newly created flashcard set
        new_set_response = supabase.from_('flashcard_sets')\
            .select('''
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
            ''')\
            .eq('id', new_flashcard_set_id)\
            .eq('user_id', user_id)\
            .single()\
            .execute()

        if hasattr(new_set_response, 'error'):
            print(f"Error fetching newly created flashcard set details: {new_set_response.error}")
            return {
                "success": True,
                "message": "Flashcards created, but failed to fetch complete confirmation data.",
                "flashcardSet": {"id": new_flashcard_set_id}
            }

        return {
            "success": True,
            "message": "Flashcards created successfully!",
            "flashcardSet": new_set_response.data
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Critical error in /api/flashcards/create: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create flashcards: {str(e)}") 