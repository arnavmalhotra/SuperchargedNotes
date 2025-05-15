from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import List, Optional
from pydantic import BaseModel
import os
import json
import tempfile
from pathlib import Path
from db import supabase, get_current_user_id
from google import genai
from datetime import datetime

# Create router
router = APIRouter(prefix="/api/upload", tags=["upload"])

# Check if Gemini API key is available
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("WARNING: Missing GEMINI_API_KEY environment variable. File uploads will not work.")
else:
    genai_client = genai.Client(api_key=GEMINI_API_KEY)

# Pydantic models for response
class UploadResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    notes: Optional[List[dict]] = None

async def generate_topic_with_ai(content: str, context_hint: Optional[str] = None):
    """Generate a title for the content using Google's Gemini API"""
    try:
        if not GEMINI_API_KEY:
            return context_hint or "Untitled Note"
            
        prompt = f"Generate a very concise and relevant title or topic (ideally 5-10 words, absolutely max 15 words) for the following text. Be succinct."
        if context_hint:
            prompt += f"\nContext for the text: {context_hint}."
        prompt += f"\n\nText to generate a title for:\n{content}"

        response = genai_client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt
        )

        # Clean up the title: remove quotes, trim whitespace
        topic = response.text.strip()
        if topic.startswith('"') and topic.endswith('"'):
            topic = topic[1:-1]
        return topic or (context_hint or "Untitled Note")  # Fallback title

    except Exception as e:
        print(f"Error generating topic with AI: {e}")
        return context_hint or "Untitled Note"  # Fallback in case of error

async def process_file_with_gemini(file: UploadFile):
    """Process a single file with Gemini"""
    temp_file_path = None
    try:
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured")
            
        # Save the uploaded file to a temporary file
        file_content = await file.read()
        
        # Create a temporary file with the appropriate extension
        suffix = Path(file.filename).suffix if file.filename else ""
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(file_content)
            temp_file_path = temp_file.name
        
        # Upload file to Gemini
        uploaded_file = genai_client.files.upload(
            file=temp_file_path
        )

        # For PDFs, ask for a summary, for images, ask for a description
        prompt = ("You are an expert chemistry tutor. Your task is to create a comprehensive and clear study note from this PDF file.\\\\nUse Markdown formatting for your response.\\\\nFor **mathematical expressions**, use LaTeX notation:\\\\n- Inline math: `$E = mc^2$`\\\\n- Display math: `$$K_a = \\\\frac{[H^+][A^-]}{[HA]}$$`\\\\nFor **chemical formulae and reaction schemes**, use the `\\\\ce{}` command, which will be rendered. Examples:\\\\n- Formula: `\\\\ce{H2O}`, `\\\\ce{CH3COOH}`\\\\n- Reaction: `\\\\ce{2H2 + O2 -> 2H2O}`\\\\n- Reaction with conditions: `\\\\ce{A + B ->[catalyst][heat] C + D}`\\\\nFor **detailed 2D molecular structural formulae**, use `chemfig` LaTeX syntax within ` \\`\\`\\`chem ... \\`\\`\\` ` blocks. This code will be displayed as is. Examples:\\\\n- Simple chain: `\\\\chemfig{CH_3-CH_2-OH}`\\\\n- Benzene: `\\\\chemfig{*6(=-=--=)}`\\\\n- Acetic Acid: `\\\\chemfig{C(-[2]H)(-[4]H)(-[6]H)-C(=[1]O)-[7]OH}`\\\\nIf the document contains circuit diagrams, describe them within ` \\`\\`\\`circuit ... \\`\\`\\` ` blocks.\\\\nStructure the note logically with headings, lists, and emphasis. Explain key chemical concepts clearly. If appropriate, include practice questions or points for further study based on the document\\\'s content to enhance its value as a study aid."
                if file.content_type == 'application/pdf' else 
                "You are an expert chemistry tutor. Analyze this image and provide a detailed description and explanation.\\\\nUse Markdown formatting for your response.\\\\nIf the image contains text, extract and present it.\\\\nIf the image displays **mathematical expressions**, represent them using LaTeX notation:\\\\n- Inline math: `$E = mc^2$`\\\\n- Display math: `$$K_a = \\\\frac{[H^+][A^-]}{[HA]}$$`\\\\nIf the image shows **chemical formulae or reaction schemes**, describe them and use the `\\\\ce{}` command. Examples:\\\\n- Formula: `\\\\ce{H2O}`\\\\n- Reaction: `\\\\ce{SO3 + H2O -> H2SO4}`\\\\nIf the image depicts **detailed 2D molecular structural formulae**, describe them. If you are confident in generating the `chemfig` LaTeX code for the structure, provide it within ` \\`\\`\\`chem ... \\`\\`\\` ` blocks. If the structure is too complex to represent accurately with `chemfig` or if you are unsure, describe it textually in detail instead of attempting `chemfig` code. Examples of `chemfig`:\\\\n- Methane: `\\\\chemfig{C(-[2]H)(-[4]H)(-[6]H)-[8]H}`\\\\n- Benzene: `\\\\chemfig{*6(=-=--=)}`\\\\nIf the image shows a circuit diagram, describe it within a ` \\`\\`\\`circuit ... \\`\\`\\` ` block.\\\\nExplain any chemical concepts or processes depicted. If the image is part of a problem, try to guide the user towards solving it as a tutor would.")

        # Rewind the file after reading
        await file.seek(0)
        
        response = genai_client.models.generate_content(
            model="gemini-1.5-pro",
            contents=[prompt, uploaded_file]
        )

        analysis = response.text
        generated_topic = await generate_topic_with_ai(analysis, file.filename)

        return {
            "fileName": file.filename,
            "analysis": analysis,
            "mimeType": file.content_type,
            "title": generated_topic
        }
    except Exception as e:
        print(f"Error processing file {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process file {file.filename}: {str(e)}")
    finally:
        # Clean up the temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                print(f"Warning: Failed to delete temporary file {temp_file_path}: {e}")

async def process_grouped_files_with_gemini(files: List[UploadFile]):
    """Process multiple files as a group with Gemini"""
    temp_file_paths = []
    try:
        if not GEMINI_API_KEY:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured")
            
        uploaded_file_parts = []
        for file in files:
            file_content = await file.read()
            # Rewind the file after reading
            await file.seek(0)
            
            # Create a temporary file with the appropriate extension
            suffix = Path(file.filename).suffix if file.filename else ""
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                temp_file.write(file_content)
                temp_file_path = temp_file.name
                temp_file_paths.append(temp_file_path)
            
            uploaded_file = genai_client.files.upload(
                file=temp_file_path
            )
            
            uploaded_file_parts.append(uploaded_file)

        prompt = "Analyze the following files as a single related group and create a cohesive summary using Markdown formatting. Use standard Markdown structure (headers with #, lists, emphasis, etc). For mathematical expressions, use LaTeX notation: $...$ for inline math and $$...$$ for display equations. For chemical formulas, use $\\ce{H2O}$ notation. For complex chemical structures or reactions, represent them in ```chem blocks with proper chemical notation, like: ```chem\\nR-OH + R'-COOH -> R'-COOR + H2O\\n```. If analyzing circuits, represent them using ```circuit [diagram description] ``` blocks. Create a well-structured, comprehensive summary that clearly relates information from all the files, with special attention to properly formatting any chemical or mathematical content."

        response = genai_client.models.generate_content(
            model="gemini-1.5-pro",
            contents=[prompt] + uploaded_file_parts
        )

        analysis = response.text
        file_names_string = ", ".join([file.filename for file in files])
        generated_topic = await generate_topic_with_ai(analysis, f"Group: {file_names_string}")

        return {
            "fileNames": [file.filename for file in files],
            "analysis": analysis,
            "title": generated_topic
        }
    except Exception as e:
        print(f"Error processing grouped files: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process grouped files: {str(e)}")
    finally:
        # Clean up the temporary files
        for path in temp_file_paths:
            if os.path.exists(path):
                try:
                    os.unlink(path)
                except Exception as e:
                    print(f"Warning: Failed to delete temporary file {path}: {e}")

async def store_results_in_supabase(results, group_files: bool, user_id: str):
    """Store processed results in Supabase"""
    try:
        current_time = datetime.now().isoformat()
        
        if group_files:
            # Results is a single object from process_grouped_files_with_gemini
            print(f'Inserting group note for user: {user_id}, Title: {results["title"]}')
            response = supabase.from_('notes')\
                .insert({
                    "title": results["title"],
                    "content": results["analysis"],
                    "created_at": current_time,
                    "updated_at": current_time,
                    "user_id": user_id,
                })\
                .execute()
                
            if hasattr(response, 'error') and response.error:
                print(f"Supabase insert error (group): {response.error}")
                raise HTTPException(status_code=500, detail=f"Database error: {response.error}")
                
            # Return the inserted data
            fetch_response = supabase.from_('notes')\
                .select('*')\
                .eq('user_id', user_id)\
                .eq('title', results["title"])\
                .order('created_at', desc=True)\
                .limit(1)\
                .execute()
                
            return fetch_response.data
        else:
            # Results is an array of objects from process_file_with_gemini
            print(f'Inserting individual notes for user: {user_id}')
            insert_responses = []
            
            for result in results:
                insert_response = supabase.from_('notes')\
                    .insert({
                        "title": result["title"],
                        "content": result["analysis"],
                        "created_at": current_time,
                        "updated_at": current_time,
                        "user_id": user_id,
                    })\
                    .execute()
                    
                if hasattr(insert_response, 'error') and insert_response.error:
                    print(f"Supabase insert error: {insert_response.error}")
                    raise HTTPException(status_code=500, detail=f"Database error: {insert_response.error}")
                
                # Fetch the inserted note
                fetch_response = supabase.from_('notes')\
                    .select('*')\
                    .eq('user_id', user_id)\
                    .eq('title', result["title"])\
                    .order('created_at', desc=True)\
                    .limit(1)\
                    .execute()
                
                if fetch_response.data and len(fetch_response.data) > 0:
                    insert_responses.append(fetch_response.data[0])
                else:
                    insert_responses.append(None)
            
            return insert_responses
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error in store_results_in_supabase: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to store notes: {str(e)}")

@router.post("/", response_model=UploadResponse)
async def upload_files(
    files: List[UploadFile] = File(...),
    group_files: bool = Form(False),
    user_id: str = Depends(get_current_user_id)
):
    """
    Upload and process files to create notes.
    Supports PDF, JPEG, and PNG files.
    """
    try:
        # Check for maximum number of files
        if len(files) > 5:
            raise HTTPException(
                status_code=413,  # Payload Too Large
                detail="You can upload a maximum of 5 files at a time."
            )

        if len(files) == 0:
            raise HTTPException(
                status_code=400,
                detail="No files provided"
            )

        print(f"Processing files: {[file.filename for file in files]}, Group files: {group_files}")
        
        # Process files
        if group_files and len(files) > 0:
            processed_results = await process_grouped_files_with_gemini(files)
        else:
            processed_results = []
            for file in files:
                result = await process_file_with_gemini(file)
                processed_results.append(result)

        # Store results in Supabase
        stored_notes = await store_results_in_supabase(processed_results, group_files, user_id)

        return UploadResponse(
            success=True,
            message="Files processed and stored successfully",
            notes=stored_notes
        )

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Upload error: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": f"Failed to process files: {str(e)}"
            }
        ) 