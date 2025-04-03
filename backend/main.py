from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import tempfile
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
        prompt = f"Generate a concise and relevant title (less than 10 words) for the following notes:\n\n{content}\n\nTitle:"
        response = client.models.generate_content(
            model="gemini-2.0-flash", # Or another suitable model like gemini-1.5-flash
            contents=[prompt],
            generation_config={"max_output_tokens": 20} # Limit title length
        )
        # Clean up the title - remove potential quotes or extra whitespace
        title = response.text.strip().strip('"').strip("'")
        return title if title else "Untitled Note"
    except Exception as e:
        print(f"Error generating title: {e}")
        return "Untitled Note" # Fallback title

@app.post("/upload", response_model=schemas.Note) # Return the created note schema
async def upload(
    files: list[UploadFile] = File(...),
    user_id: str = Form(...), # Get user_id from form data
    db: Session = Depends(get_db) # Inject DB session
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
        
    results = []
    errors = []
    
    for file in files:
        temp_file = None
        try:
            print(f"Processing file: {file.filename}")
            with tempfile.NamedTemporaryFile(delete=False) as tmp:
                temp_file = tmp.name
                content = await file.read()
                tmp.write(content)
                tmp.flush()
            
            print(f"Temporary file created at: {temp_file}")
            # Process the file with original filename
            result = process_file(temp_file, file.filename)
            
            # Check if result is an error message
            if result and result.startswith("Error:"):
                errors.append(f"Error processing {file.filename}: {result}")
                print(f"Error result: {result}")
                continue
                
            results.append(result)
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            error_msg = f"Error processing {file.filename}: {str(e)}"
            errors.append(error_msg)
            print(f"Exception in upload: {error_msg}")
            print(error_trace)
            
        finally:
            # Only attempt to delete if the file was created
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except PermissionError:
                    print(f"Could not delete temporary file: {temp_file}")
                except OSError as e: # Catch other potential OS errors
                    print(f"Error deleting temporary file {temp_file}: {e}")
    
    if not results and errors:
        # If all files failed, return a 500 with error details
        error_detail = {"errors": errors}
        print(f"Upload failed for all files: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)
    
    # Join all results with a newline
    combined_result = "\n\n".join(results)

    if not combined_result.strip():
        error_detail = {"errors": errors, "message": "Processed content is empty."}
        print(f"Upload resulted in empty content: {error_detail}")
        raise HTTPException(status_code=400, detail=error_detail)

    # Generate title for the combined content
    print("Generating title...")
    generated_title = generate_title(combined_result[:2000]) # Use first 2000 chars for title generation context
    print(f"Generated title: {generated_title}")

    # Save the combined result and generated title as a new note
    try:
        note_data = schemas.NoteCreate(
            title=generated_title,
            content=combined_result,
            user_id=user_id
        )
        db_note = models.Note(**note_data.dict())
        db.add(db_note)
        db.commit()
        db.refresh(db_note)
        print(f"Note saved successfully with ID: {db_note.id}")
        # Return the newly created note
        # Also include any non-critical errors encountered during file processing
        # Note: The response_model ensures only Note fields are returned,
        # but we might want a custom response model later if we strictly need to include errors.
        # For now, returning the Note object upon success.
        return db_note
    except Exception as e:
        db.rollback()
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error saving note: {str(e)}")
        print(error_trace)
        # Include previous file processing errors if any
        error_detail = {"errors": errors, "database_error": str(e)}
        raise HTTPException(status_code=500, detail=error_detail)

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





