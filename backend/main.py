from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
import tempfile
from gemini import process_file
from sqlalchemy.orm import Session
from database import engine, get_db
import models
import schemas

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

@app.post("/upload")
async def upload(files: list[UploadFile] = File(...)):
    results = []
    for file in files:
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file.flush()
            
            try:
                # Process the file using gemini.py
                result = process_file(temp_file.name)
                results.append(result)
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))
            finally:
                os.unlink(temp_file.name)
    
    # Join all results with a newline
    combined_result = "\n\n".join(results)
    return {"result": combined_result}

@app.post("/save", response_model=schemas.Note)
async def save_note(note: schemas.NoteCreate, db: Session = Depends(get_db)):
    try:
        db_note = models.Note(**note.dict())
        db.add(db_note)
        db.commit()
        db.refresh(db_note)
        return db_note
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/notes", response_model=list[schemas.Note])
async def get_notes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    notes = db.query(models.Note).offset(skip).limit(limit).all()
    return notes

@app.get("/notes/{note_id}", response_model=schemas.Note)
async def get_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)





