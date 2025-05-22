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
        
        # Pre-process content to handle chemical equations
        content = note['content']
        
        # Convert chemical equations to LaTeX format that MathML can handle
        # Wrap inline chemical equations in math delimiters
        content = re.sub(r'(?<!\$)\\ce\{([^}]+)\}(?!\$)', r'$\\ce{\1}$', content)
        
        # Process the markdown content with better handling for math and chemistry
        # 1. First convert the markdown to HTML with MathExtension for basic LaTeX
        extensions = ["fenced_code", "tables", MathExtension(enable_dollar_delimiter=True)]
        html_content = markdown2.markdown(content, extras=extensions)
        
        # 2. Create a BeautifulSoup object to manipulate the HTML
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # 3. Process all math tags including chemical equations
        for math_tag in soup.find_all(class_='math'):
            try:
                # Get the LaTeX content and check if it's display or inline
                latex_content = math_tag.string.strip()
                is_display = 'display' in math_tag.get('class', [])
                
                # Convert LaTeX to MathML using latex2mathml
                # The latex2mathml library has built-in support for mhchem
                mathml = latex2mathml.converter.convert(latex_content)
                
                # Replace the original tag with the MathML
                new_tag = soup.new_tag('div')
                if is_display:
                    new_tag['class'] = 'math-display'
                    new_tag['style'] = 'text-align: center; margin: 1em 0;'
                else:
                    new_tag['class'] = 'math-inline'
                    new_tag['style'] = 'display: inline-block; vertical-align: middle;'
                
                # Create a new tag with the MathML content
                mathml_tag = BeautifulSoup(mathml, 'html.parser')
                new_tag.append(mathml_tag)
                
                math_tag.replace_with(new_tag)
            except Exception as e:
                print(f"Error rendering math expression: {e}")
                # If conversion fails, keep the original LaTeX
                continue
        
        # Get the updated HTML
        html_content = str(soup)
        
        # Create full HTML document for PDF rendering
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
                .math-display {{
                    text-align: center;
                    margin: 1em 0;
                }}
                .math-inline {{
                    display: inline-block;
                    vertical-align: middle;
                }}
                math {{
                    font-size: 1.1em;
                }}
                /* Styling for chemical equations */
                .math-display math,
                .math-inline math {{
                    max-width: 100%;
                }}
                /* Improve rendering of chemical arrows and bonds */
                math .mrow {{
                    display: inline-block;
                    vertical-align: middle;
                }}
                math .mo {{
                    padding: 0 0.2em;
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
            tmp_path = tmp.name
            
        try:
            # Generate PDF using WeasyPrint
            HTML(string=full_html).write_pdf(
                tmp_path, 
                stylesheets=[
                    CSS(string="""
                        @page { 
                            size: A4; 
                            margin: 2cm;
                        }
                        math {
                            font-size: 1.1em;
                        }
                        /* Improve rendering of chemical equations */
                        math .mrow {
                            display: inline-block;
                            vertical-align: middle;
                        }
                        math .mo {
                            padding: 0 0.2em;
                        }
                    """)
                ]
            )
            
            # Read the PDF file
            with open(tmp_path, 'rb') as pdf_file:
                pdf_bytes = pdf_file.read()
        finally:
            # Clean up - make sure to handle errors if file is in use
            try:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
            except Exception as e:
                print(f"Warning: Could not delete temporary file {tmp_path}: {e}")
                # This is non-fatal, so we continue
        
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