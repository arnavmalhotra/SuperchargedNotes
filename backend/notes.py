from fastapi import APIRouter, HTTPException, Depends, Header, Response
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import os
from db import supabase, get_current_user_id
import json
from datetime import datetime
import markdown2
from mdx_math import MathExtension
import latex2mathml.converter
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
import io
import re
import base64
from weasyprint import HTML, CSS
import tempfile
from bs4 import BeautifulSoup
import matplotlib.pyplot as plt
from matplotlib import mathtext
from PIL import Image as PILImage

# Create router for notes endpoints
router = APIRouter(prefix="/api/notes", tags=["notes"])

# Pydantic models
class Note(BaseModel):
    id: str
    title: str
    content: str
    user_id: str
    created_at: str
    updated_at: Optional[str] = None

class NoteListResponse(BaseModel):
    success: bool
    notes: Optional[List[Note]] = None
    message: Optional[str] = None

class NoteResponse(BaseModel):
    success: bool
    note: Optional[Note] = None
    message: Optional[str] = None

class NoteUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

# GET /api/notes - Get all notes for a user
@router.get("", response_model=NoteListResponse)
async def get_notes(user_id: str = Depends(get_current_user_id)):
    try:
        notes_response = supabase.from_('notes')\
            .select('*')\
            .eq('user_id', user_id)\
            .order('created_at', desc=True)\
            .execute()

        if hasattr(notes_response, 'error') and notes_response.error:
            raise HTTPException(status_code=500, detail=f"Failed to fetch notes: {notes_response.error}")

        return {
            "success": True,
            "notes": notes_response.data or []
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error in GET /api/notes: {e}")
        return {
            "success": False, 
            "message": f"Failed to fetch notes: {str(e)}",
            "notes": []
        }

# GET /api/notes/{note_id} - Get a specific note
@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(note_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        if not note_id:
            raise HTTPException(status_code=400, detail="Note ID is required")

        note_response = supabase.from_('notes')\
            .select('*')\
            .eq('id', note_id)\
            .eq('user_id', user_id)\
            .single()\
            .execute()

        if hasattr(note_response, 'error') and note_response.error:
            print(f"Error fetching note: {note_response.error}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch note: {note_response.error}")

        if not note_response.data:
            raise HTTPException(status_code=404, detail="Note not found or access denied")

        return {
            "success": True,
            "note": note_response.data
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error in GET /api/notes/{{note_id}}: {e}")
        return {
            "success": False,
            "message": f"Failed to fetch note: {str(e)}"
        }

# DELETE /api/notes/{note_id} - Delete a note and its associated items
@router.delete("/{note_id}", response_model=Dict[str, Any])
async def delete_note(note_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        if not note_id:
            raise HTTPException(status_code=400, detail="Note ID is required")

        # Check if the note exists and belongs to the user
        note_check = supabase.from_('notes')\
            .select('id')\
            .eq('id', note_id)\
            .eq('user_id', user_id)\
            .single()\
            .execute()

        if hasattr(note_check, 'error') or not note_check.data:
            raise HTTPException(status_code=404, detail="Note not found or access denied")

        # 1. Delete associated quiz sets
        quiz_delete = supabase.from_('quiz_sets')\
            .delete()\
            .eq('note_id', note_id)\
            .eq('user_id', user_id)\
            .execute()

        quiz_delete_error = getattr(quiz_delete, 'error', None)
        if quiz_delete_error:
            print(f"Error deleting associated quiz sets: {quiz_delete_error}")

        # 2. Delete associated flashcard sets
        flashcard_delete = supabase.from_('flashcard_sets')\
            .delete()\
            .eq('note_id', note_id)\
            .eq('user_id', user_id)\
            .execute()

        flashcard_delete_error = getattr(flashcard_delete, 'error', None)
        if flashcard_delete_error:
            print(f"Error deleting associated flashcard sets: {flashcard_delete_error}")

        # 3. Delete the note itself
        note_delete = supabase.from_('notes')\
            .delete()\
            .eq('id', note_id)\
            .eq('user_id', user_id)\
            .execute()

        note_delete_error = getattr(note_delete, 'error', None)
        if note_delete_error:
            print(f"Error deleting the note: {note_delete_error}")
            raise HTTPException(status_code=500, 
                detail=f"Failed to delete the note after attempting to delete children: {note_delete_error}")

        # If any of the child deletions failed but the main note deletion succeeded,
        # the overall operation is partially successful
        if quiz_delete_error or flashcard_delete_error:
            print('Note deleted, but one or more associated items (quizzes/flashcards) failed to delete.')
            return {
                "success": True,
                "message": "Note deleted, but encountered errors deleting some associated items.",
                "errors": {
                    "quizDeleteError": str(quiz_delete_error) if quiz_delete_error else None,
                    "flashcardDeleteError": str(flashcard_delete_error) if flashcard_delete_error else None
                }
            }

        return {
            "success": True,
            "message": "Note and associated quizzes/flashcards deleted successfully"
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error in DELETE /api/notes/{{note_id}}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete note and associated items: {str(e)}")

# PUT /api/notes/{note_id} - Update a note
@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(note_id: str, request: NoteUpdateRequest, user_id: str = Depends(get_current_user_id)):
    try:
        if not note_id:
            raise HTTPException(status_code=400, detail="Note ID is required")

        if not request.title and not request.content:
            raise HTTPException(status_code=400, detail="Title or content is required for update")

        # Check if the note exists and belongs to the user
        note_check = supabase.from_('notes')\
            .select('id')\
            .eq('id', note_id)\
            .eq('user_id', user_id)\
            .single()\
            .execute()

        if hasattr(note_check, 'error') or not note_check.data:
            raise HTTPException(status_code=404, detail="Note not found or access denied")

        # Prepare update object
        update_data = {
            "updated_at": "now()" # Using Postgres NOW() function
        }
        if request.title is not None:
            update_data["title"] = request.title
        if request.content is not None:
            update_data["content"] = request.content

        # Update the note
        note_update = supabase.from_('notes')\
            .update(update_data)\
            .eq('id', note_id)\
            .eq('user_id', user_id)\
            .execute()

        update_error = getattr(note_update, 'error', None)
        if update_error:
            print(f"Error updating note: {update_error}")
            raise HTTPException(status_code=500, detail=f"Failed to update note: {update_error}")
        
        # Fetch the updated note
        updated_note = supabase.from_('notes')\
            .select('*')\
            .eq('id', note_id)\
            .eq('user_id', user_id)\
            .single()\
            .execute()

        return {
            "success": True,
            "message": "Note updated successfully",
            "note": updated_note.data
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error in PUT /api/notes/{{note_id}}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update note: {str(e)}")

# POST /api/notes - Create a new note
@router.post("", response_model=NoteResponse)
async def create_note(request: NoteUpdateRequest, user_id: str = Depends(get_current_user_id)):
    try:
        if not request.title:
            raise HTTPException(status_code=400, detail="Title is required")

        # Prepare note data
        note_data = {
            "user_id": user_id,
            "title": request.title,
            "content": request.content or ""
        }

        # Create the note
        note_create = supabase.from_('notes')\
            .insert(note_data)\
            .select()\
            .single()\
            .execute()

        create_error = getattr(note_create, 'error', None)
        if create_error:
            print(f"Error creating note: {create_error}")
            raise HTTPException(status_code=500, detail=f"Failed to create note: {create_error}")

        return {
            "success": True,
            "message": "Note created successfully",
            "note": note_create.data
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error in POST /api/notes: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create note: {str(e)}")

@router.post("/{note_id}/export-pdf")
async def export_note_to_pdf(note_id: str, x_user_id: Optional[str] = Header(None)):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="User ID is required")

    try:
        # Fetch the note
        response = supabase.from_('notes')\
            .select('*')\
            .eq('id', note_id)\
            .eq('user_id', x_user_id)\
            .execute()
        
        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail="Note not found")
        
        note = response.data[0]
        
        # Process the markdown content including math
        # Add the MathExtension for basic LaTeX rendering
        extensions = ["fenced_code", "tables", MathExtension(enable_dollar_delimiter=True)]
        html_content = markdown2.markdown(note['content'], extras=extensions)
        
        # Process LaTeX equations and chemical formulas
        # This requires additional processing for complex equations
        def process_latex(match):
            latex = match.group(1)
            try:
                # Try to convert LaTeX to MathML for inline display
                mathml = latex2mathml.converter.convert(latex)
                return mathml
            except:
                # Fallback to just showing the LaTeX
                return f"<span class='latex-error'>{latex}</span>"
        
        # Process inline math: $...$ or \(...\)
        html_content = re.sub(r'\$([^$]+)\$', lambda m: process_latex(m), html_content)
        html_content = re.sub(r'\\\(([^)]+)\\\)', lambda m: process_latex(m), html_content)
        
        # Process display math: $$...$$ or \[...\]
        html_content = re.sub(r'\$\$([^$]+)\$\$', lambda m: f"<div class='math-display'>{process_latex(m)}</div>", html_content)
        html_content = re.sub(r'\\\[([^\]]+)\\\]', lambda m: f"<div class='math-display'>{process_latex(m)}</div>", html_content)
        
        # For chemical equations using \ce{...}
        def process_chem(match):
            chem_formula = match.group(1)
            # Handle basic chemical formulas with subscripts
            processed = re.sub(r'(\d+)', r'<sub>\1</sub>', chem_formula)
            return f"<span class='chem-formula'>{processed}</span>"
        
        html_content = re.sub(r'\\ce\{([^}]+)\}', lambda m: process_chem(m), html_content)
        
        # Create full HTML document
        full_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>{note['title']}</title>
            <style>
                @page {{ 
                    size: A4; 
                    margin: 2cm;
                }}
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6;
                    font-size: 12pt;
                    margin: 0;
                    padding: 0;
                }}
                h1 {{
                    font-size: 24pt;
                    margin-bottom: 0.5em;
                }}
                .metadata {{
                    font-size: 10pt;
                    color: #666;
                    margin-bottom: 2em;
                }}
                pre {{
                    background-color: #f5f5f5;
                    padding: 1em;
                    border-radius: 4px;
                    overflow-x: auto;
                    white-space: pre-wrap;
                }}
                code {{
                    font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
                }}
                .chem-formula sub {{
                    font-size: 0.8em;
                }}
                .math-display {{
                    margin: 1em 0;
                    text-align: center;
                }}
            </style>
        </head>
        <body>
            <h1>{note['title']}</h1>
            <div class="metadata">
                Created: {datetime.fromisoformat(note['created_at']).strftime('%B %d, %Y')} | 
                Last updated: {datetime.fromisoformat(note['updated_at']).strftime('%B %d, %Y')}
            </div>
            <div class="content">
                {html_content}
            </div>
        </body>
        </html>
        """
        
        # Create a temporary file to save the PDF
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
            # Generate PDF using WeasyPrint
            HTML(string=full_html).write_pdf(
                tmp.name, 
                stylesheets=[CSS(string="""
                    @page { 
                        size: A4; 
                        margin: 2cm;
                    }
                """)]
            )
            
            # Read the PDF file
            with open(tmp.name, 'rb') as pdf_file:
                pdf_bytes = pdf_file.read()
            
            # Clean up
            os.unlink(tmp.name)
        
        # Return the PDF
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{note["title"].replace(" ", "_")}.pdf"'
            }
        )
        
    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}") 