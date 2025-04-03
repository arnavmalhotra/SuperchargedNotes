from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import tempfile
import json
from google import genai
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from database import engine, get_db
import models
import schemas

# Load environment variables
load_dotenv()

# Initialize Gemini client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Update with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def process_file(file_path: str, original_filename: str = None):
    try:
        # Get the file extension from the original filename
        file_extension = ""
        if original_filename:
            file_extension = os.path.splitext(original_filename)[1]
        
        # Create a new temporary file with the proper extension
        with tempfile.NamedTemporaryFile(suffix=file_extension, delete=False) as tmp_with_ext:
            # Copy content from the original temp file to the new one
            with open(file_path, 'rb') as src_file:
                tmp_with_ext.write(src_file.read())
            
            temp_path_with_ext = tmp_with_ext.name
            
        try:
            print(f"Attempting to upload file: {temp_path_with_ext}")
            # Upload the file using official Gemini API syntax
            myfile = client.files.upload(file=temp_path_with_ext)
            print(f"File uploaded successfully: {myfile}")

            prompt = """Convert this to well formatted markdown notes with the following requirements:
1. Create clear headings and subheadings using proper markdown syntax (# for main headings, ## for subheadings)
2. Format all mathematical equations using LaTeX syntax, including:
   - Inline equations with $...$ notation
   - Block equations with $$...$$ notation
   - Properly formatted fractions, integrals, summations, and special symbols
3. Include all important details, definitions, theorems, and examples
4. Use bullet points and numbered lists where appropriate
5. Preserve any tables using markdown table format
6. Add bold and italic formatting for emphasis
7. Do not include diagrams
8. Include proper code blocks with syntax highlighting if applicable
"""
            
            # Process the text with Gemini
            print(f"Sending request to Gemini model")
            response = client.models.generate_content(
                model="gemini-1.5-pro",  # Using gemini-1.5-pro as in the working example
                contents=[prompt, myfile],
            )
            print(f"Received response from Gemini")
            
            return response.text
        finally:
            # Clean up the temporary file with extension
            if os.path.exists(temp_path_with_ext):
                try:
                    os.unlink(temp_path_with_ext)
                except PermissionError:
                    print(f"Could not delete temporary file: {temp_path_with_ext}")
                except OSError as e: # Catch other potential OS errors like file in use
                    print(f"Error deleting temporary file {temp_path_with_ext}: {e}")
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in process_file: {str(e)}")
        print(error_trace)
        return f"Error: {str(e)}"

def generate_title(content: str) -> str:
    """Generates a concise title for the given content using the AI model."""
    try:
        prompt = f"Generate an extremely concise plaintext title (5 words or less) that accurately reflects the following notes:\n\n{content}\n\nTitle:"
        response = client.models.generate_content(
            model="gemini-2.0-flash", # Or another suitable model like gemini-1.5-flash
            contents=[prompt])
        # Clean up the title - remove potential quotes or extra whitespace
        title = response.text.strip().strip('"').strip("'")
        return title if title else "Untitled Note"
    except Exception as e:
        print(f"Error generating title: {e}")
        return "Untitled Note" # Fallback title

@app.post("/upload", response_model=list[schemas.Note]) # Return a LIST of created notes
async def upload(
    files: list[UploadFile] = File(...),
    user_id: str = Form(...), # Get user_id from form data
    grouping_structure: str = Form(None), # Optional grouping structure (JSON string)
    db: Session = Depends(get_db) # Inject DB session
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    # Create a mapping from original filename to UploadFile object for easy lookup
    file_map = {file.filename: file for file in files}
    created_notes = []
    errors = []

    if grouping_structure:
        try:
            structure = json.loads(grouping_structure)
            print(f"Processing with grouping structure: {structure}")

            # --- Process based on structure ---
            for item in structure:
                item_type = item.get('type')
                item_id = item.get('id') # Frontend ID, useful for potential error reporting

                if item_type == 'individual':
                    filename = item.get('filename')
                    file = file_map.get(filename)
                    if not file:
                        errors.append(f"File '{filename}' mentioned in structure not found in upload.")
                        continue
                    
                    print(f"Processing individual file: {filename}")
                    temp_file_path = None
                    try:
                        # --- Process the single file ---
                        with tempfile.NamedTemporaryFile(delete=False) as tmp:
                            temp_file_path = tmp.name
                            content = await file.read()
                            await file.seek(0) # Reset file pointer in case it's read again
                            tmp.write(content)
                            tmp.flush()
                        
                        processed_content = process_file(temp_file_path, filename)
                        if processed_content and processed_content.startswith("Error:"):
                            errors.append(f"Error processing {filename}: {processed_content}")
                            continue # Skip saving this note
                        
                        if not processed_content or not processed_content.strip():
                            errors.append(f"Empty content after processing {filename}.")
                            continue # Skip saving empty note

                        # --- Generate title and save note ---
                        title = generate_title(processed_content)
                        note_data = schemas.NoteCreate(
                            title=title,
                            content=processed_content,
                            user_id=user_id
                        )
                        db_note = models.Note(**note_data.dict())
                        db.add(db_note)
                        db.commit()
                        db.refresh(db_note)
                        created_notes.append(db_note)
                        print(f"Saved individual note: {title} (ID: {db_note.id})")

                    except Exception as e:
                        db.rollback()
                        import traceback
                        error_trace = traceback.format_exc()
                        err_msg = f"Failed to process/save individual file {filename}: {str(e)}"
                        print(f"{err_msg}\n{error_trace}")
                        errors.append(err_msg)
                    finally:
                        if temp_file_path and os.path.exists(temp_file_path):
                            try: os.unlink(temp_file_path)
                            except OSError as e: print(f"Error deleting temp file {temp_file_path}: {e}")

                elif item_type == 'group':
                    group_filenames = item.get('filenames', [])
                    print(f"Processing group with files: {group_filenames}")
                    group_results = []
                    temp_files_in_group = []

                    try:
                        for filename in group_filenames:
                            file = file_map.get(filename)
                            if not file:
                                errors.append(f"File '{filename}' for group {item_id} not found.")
                                continue # Skip this file within the group
                            
                            temp_file_path = None
                            try:
                                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                                    temp_file_path = tmp.name
                                    content = await file.read()
                                    await file.seek(0) # Reset pointer
                                    tmp.write(content)
                                    tmp.flush()
                                temp_files_in_group.append(temp_file_path) # Track for cleanup

                                result = process_file(temp_file_path, filename)
                                if result and result.startswith("Error:"):
                                     errors.append(f"Error processing {filename} in group: {result}")
                                     # Decide if we should skip the whole group or just this file's content
                                     # For now, we'll just log the error and exclude its content
                                     continue 
                                group_results.append(result)
                            except Exception as e:
                                errors.append(f"Failed processing file {filename} within group: {e}")
                            # Note: Temp file cleanup for group happens in outer finally block

                        # --- Combine, generate title, save group note ---
                        if not group_results:
                             errors.append(f"Group {item_id} resulted in no processable content.")
                             continue # Skip saving this group note
                        
                        combined_content = "\n\n".join(filter(None, group_results)) # Filter out potential None/empty results
                        if not combined_content or not combined_content.strip():
                            errors.append(f"Empty combined content for group {item_id}.")
                            continue # Skip saving empty group note

                        title = generate_title(combined_content)
                        note_data = schemas.NoteCreate(
                            title=title,
                            content=combined_content,
                            user_id=user_id
                        )
                        db_note = models.Note(**note_data.dict())
                        db.add(db_note)
                        db.commit()
                        db.refresh(db_note)
                        created_notes.append(db_note)
                        print(f"Saved group note: {title} (ID: {db_note.id})")

                    except Exception as e:
                        db.rollback()
                        import traceback
                        error_trace = traceback.format_exc()
                        err_msg = f"Failed to process/save group {item_id}: {str(e)}"
                        print(f"{err_msg}\n{error_trace}")
                        errors.append(err_msg)
                    finally:
                        # Cleanup temp files created for this group
                        for temp_f in temp_files_in_group:
                            if os.path.exists(temp_f):
                                try: os.unlink(temp_f)
                                except OSError as e: print(f"Error deleting group temp file {temp_f}: {e}")
                else:
                    errors.append(f"Unknown item type '{item_type}' in grouping structure.")
        
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid grouping structure format.")
        except Exception as e: # Catch-all for unexpected structure processing errors
             import traceback
             error_trace = traceback.format_exc()
             err_msg = f"Error processing grouping structure: {str(e)}"
             print(f"{err_msg}\n{error_trace}")
             # Return 500 if structure processing fails catastrophically
             raise HTTPException(status_code=500, detail=err_msg)

    else:
        # --- Original behavior: Process all files as one note ---
        print("No grouping structure provided. Processing all files as one note.")
        all_results = []
        temp_files_all = []
        try:
            for file in files:
                temp_file_path = None
                try:
                    with tempfile.NamedTemporaryFile(delete=False) as tmp:
                        temp_file_path = tmp.name
                        content = await file.read()
                        # No need to seek(0) here as each file is read only once
                        tmp.write(content)
                        tmp.flush()
                    temp_files_all.append(temp_file_path) # Track for cleanup
                    
                    result = process_file(temp_file_path, file.filename)
                    if result and result.startswith("Error:"):
                        errors.append(f"Error processing {file.filename}: {result}")
                        continue # Skip this file
                    all_results.append(result)
                except Exception as e:
                    err_msg = f"Error processing file {file.filename} in batch: {str(e)}"
                    print(err_msg)
                    errors.append(err_msg)
                # Temp file cleanup happens in outer finally

            if not all_results:
                # If all files failed or resulted in empty content with no grouping
                error_detail = {"errors": errors, "message": "No content could be processed from the uploaded files."}
                print(f"Upload failed for all files (no grouping): {error_detail}")
                # Raise 400 or 500 depending on whether errors were file processing or system issues
                # Using 400 assuming file content issues are more likely
                raise HTTPException(status_code=400, detail=error_detail) 

            combined_result = "\n\n".join(filter(None, all_results))
            if not combined_result or not combined_result.strip():
                 error_detail = {"errors": errors, "message": "Processed content is empty."}
                 print(f"Upload resulted in empty content (no grouping): {error_detail}")
                 raise HTTPException(status_code=400, detail=error_detail)

            generated_title = generate_title(combined_result[:2000])
            
            note_data = schemas.NoteCreate(
                title=generated_title,
                content=combined_result,
                user_id=user_id
            )
            db_note = models.Note(**note_data.dict())
            db.add(db_note)
            db.commit()
            db.refresh(db_note)
            created_notes.append(db_note)
            print(f"Saved single combined note: {generated_title} (ID: {db_note.id})")

        except Exception as e:
            db.rollback()
            import traceback
            error_trace = traceback.format_exc()
            err_msg = f"Error saving combined note: {str(e)}"
            print(f"{err_msg}\n{error_trace}")
            error_detail = {"errors": errors, "database_error": err_msg}
            raise HTTPException(status_code=500, detail=error_detail)
        finally:
             # Cleanup all temp files created in this block
            for temp_f in temp_files_all:
                if os.path.exists(temp_f):
                    try: os.unlink(temp_f)
                    except OSError as e: print(f"Error deleting temp file {temp_f}: {e}")

    # --- Final Response --- 
    # Even if some errors occurred during processing individual files/groups,
    # we return the list of notes that *were* successfully created.
    # The frontend toast can indicate partial success if desired by checking the length vs expected.
    if not created_notes and errors:
         # If absolutely no notes were created and errors exist, raise 500
         # The specific errors might have been file-related (4xx) or server-related (5xx)
         # but the overall outcome is a server failure to produce any requested note.
         raise HTTPException(status_code=500, detail={"errors": errors, "message": "Failed to create any notes from the upload."}) 
    
    # Return the list of successfully created notes
    # The response_model ensures only Note fields are returned.
    print(f"Upload complete. Created notes: {len(created_notes)}. Errors encountered: {len(errors)}.")
    return created_notes

@app.get("/notes", response_model=list[schemas.Note])
async def get_notes(user_id: str, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    notes = db.query(models.Note).filter(models.Note.user_id == user_id).order_by(models.Note.created_at.desc()).offset(skip).limit(limit).all() # Order by creation time
    return notes

@app.get("/notes/{note_id}", response_model=schemas.Note)
async def get_note(note_id: int, user_id: str, db: Session = Depends(get_db)):
    note = db.query(models.Note).filter(models.Note.id == note_id, models.Note.user_id == user_id).first()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

@app.put("/notes/{note_id}", response_model=schemas.Note)
async def update_note(note_id: int, note_update: schemas.NoteUpdate, db: Session = Depends(get_db)):
    db_note = db.query(models.Note).filter(models.Note.id == note_id, models.Note.user_id == note_update.user_id).first()
    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    
    # Update note fields
    db_note.title = note_update.title
    db_note.content = note_update.content
    
    db.commit()
    db.refresh(db_note)
    return db_note

@app.delete("/notes/{note_id}", response_model=dict)
async def delete_note(note_id: int, user_id: str, db: Session = Depends(get_db)):
    db_note = db.query(models.Note).filter(models.Note.id == note_id, models.Note.user_id == user_id).first()
    if db_note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db.delete(db_note)
    db.commit()
    return {"success": True, "message": "Note deleted successfully"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)





