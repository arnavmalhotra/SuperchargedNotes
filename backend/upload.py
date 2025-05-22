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


# --------------------------------------------------
# Prompts
# --------------------------------------------------

PDF_PROMPT = r"""
You are a **Markdown-first note enhancer**.  
Take the content of this PDF and output **one clear, structured Markdown document** that a student can study from.  
Follow these exact rules:

### 1. General Formatting
- Organize with `#`, `##`, `###` headings, bullet/numbered lists, and bold/*italic* for emphasis.  
- Preserve the original order of topics, but feel free to split dense paragraphs into lists.  
- Add brief transitions or one-sentence summaries where it improves flow.

### 2. Mathematics
- Inline math: `$E = mc^2$`  
- Display math:  

  latex
  $$K_a = \frac{[H^+][A^-]}{[HA]}$$
`

### 3. Chemistry

1. **Formulae & reactions**: use `\ce{}` (mhchem).

   * Example: `\ce{2H2 + O2 -> 2H2O}`
   

### 4. Circuit Diagrams

If any appear, describe them inside

circuit
# Example: RC low-pass filter
Vin -- R (10 kΩ) --+-- Vout
                   |
                  C (100 nF)
                   |
                  GND


### 5. Enrichment

* Define key terms on first use.
* Add clarifying sentences where derivations are implicit.
* Insert **Practice Question** call-outs for major concepts:

> **Practice Question:**
> Why does increasing temperature usually raise the acid-dissociation constant $K_a$?

### 6. Do **NOT**

* Invent unrelated material.
* Omit substantive information.
* Output anything except the final enriched Markdown.
  """.strip()

IMAGE_PROMPT = r"""
You are an expert chemistry tutor.
Analyze this image and produce a detailed Markdown explanation.

* If text is present, extract it verbatim.
* Render **math** in LaTeX (`$...$` for inline, `$$...$$` for display).
* Render **chemical formulas** with `\ce{}`.
* For structural formulas, use a combination of`\ce{}` blocks and latex code.
* For circuit diagrams, describe them in a `circuit` block.
* Explain any chemical principles depicted and, if relevant, guide the student toward a solution as a tutor would.
  """.strip()

GROUP_PROMPT = r"""
Combine all the following files into **one cohesive study note** in Markdown.

Follow the same rules for headings, math (`$...$` / `$$...$$`), `\ce{}` chemistry, and `circuit` blocks as described earlier.
""".strip()

# --------------------------------------------------

# Router & Gemini client setup

# --------------------------------------------------

router = APIRouter(prefix="/api/upload", tags=["upload"])

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("WARNING: Missing GEMINI_API_KEY environment variable. File uploads will not work.")
else:
    genai_client = genai.Client(api_key=GEMINI_API_KEY)

# --------------------------------------------------

# Pydantic models

# --------------------------------------------------

class UploadResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    notes: Optional[List[dict]] = None

# --------------------------------------------------

# Helper functions

# --------------------------------------------------

async def generate_topic_with_ai(content: str, context_hint: Optional[str] = None):
    """Generate a short title for the note via Gemini."""
    try:
        if not GEMINI_API_KEY:
            return context_hint or "Untitled Note"

        prompt = (
            "Generate a concise, relevant title (5–10 words, max 15) for the text below."
        )
        if context_hint:
            prompt += f"\nContext: {context_hint}."
        prompt += f"\n\nText:\n{content}"

        response = genai_client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt
        )
        title = response.text.strip().strip('"') or context_hint or "Untitled Note"
        return title
    except Exception as e:
        print(f"Title generation failed: {e}")
        return context_hint or "Untitled Note"


async def process_file_with_gemini(file: UploadFile):
    """Process a single file."""
    temp_path = None
    try:
        if not GEMINI_API_KEY:
            raise HTTPException(500, "GEMINI_API_KEY is not configured")

        # Save to temp file
        data = await file.read()
        suffix = Path(file.filename).suffix or ""
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(data)
            temp_path = tmp.name

        # Upload
        uploaded = genai_client.files.upload(file=temp_path)

        # Choose prompt
        prompt = PDF_PROMPT if file.content_type == "application/pdf" else IMAGE_PROMPT

        response = genai_client.models.generate_content(
            model="gemini-1.5-pro",
            contents=[prompt, uploaded]
        )

        markdown = response.text
        title = await generate_topic_with_ai(markdown, file.filename)

        return {
            "fileName": file.filename,
            "analysis": markdown,
            "mimeType": file.content_type,
            "title": title
        }

    except Exception as e:
        print(f"Error processing {file.filename}: {e}")
        raise HTTPException(500, f"Failed to process {file.filename}: {e}")
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except Exception as e:
                print(f"Temp-file cleanup failed ({temp_path}): {e}")


async def process_grouped_files_with_gemini(files: List[UploadFile]):
    """Process multiple related files together."""
    temp_paths, uploaded_parts = [], []
    try:
        if not GEMINI_API_KEY:
            raise HTTPException(500, "GEMINI_API_KEY is not configured")

        for f in files:
            data = await f.read()
            await f.seek(0)  # reset pointer
            suffix = Path(f.filename).suffix or ""
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(data)
                temp_paths.append(tmp.name)
            uploaded_parts.append(genai_client.files.upload(file=temp_paths[-1]))

        response = genai_client.models.generate_content(
            model="gemini-1.5-pro",
            contents=[IMAGE_PROMPT, PDF_PROMPT, GROUP_PROMPT] + uploaded_parts
        )

        markdown = response.text
        title = await generate_topic_with_ai(markdown, f"Group: {', '.join(f.filename for f in files)}")

        return {
            "fileNames": [f.filename for f in files],
            "analysis": markdown,
            "title": title
        }

    except Exception as e:
        print(f"Grouped processing error: {e}")
        raise HTTPException(500, f"Grouped processing failed: {e}")
    finally:
        for p in temp_paths:
            if os.path.exists(p):
                try: 
                    os.unlink(p)
                except Exception as e: 
                    print(f"Temp-file cleanup failed ({p}): {e}")


async def store_results_in_supabase(results, group_files: bool, user_id: str):
    """Persist results to Supabase."""
    ts = datetime.now().isoformat()

    try:
        if group_files:
            # Single note
            resp = supabase.from_("notes").insert({
                "title": results["title"],
                "content": results["analysis"],
                "created_at": ts,
                "updated_at": ts,
                "user_id": user_id
            }).execute()

            if hasattr(resp, "error") and resp.error:
                raise HTTPException(500, f"DB error: {resp.error}")

            fetch = supabase.from_("notes").select("*") \
                .eq("user_id", user_id).eq("title", results["title"]) \
                .order("created_at", desc=True).limit(1).execute()
            return fetch.data

        else:
            inserted = []
            for r in results:
                ins = supabase.from_("notes").insert({
                    "title": r["title"],
                    "content": r["analysis"],
                    "created_at": ts,
                    "updated_at": ts,
                    "user_id": user_id
                }).execute()

                if hasattr(ins, "error") and ins.error:
                    raise HTTPException(500, f"DB error: {ins.error}")

                fetch = supabase.from_("notes").select("*") \
                    .eq("user_id", user_id).eq("title", r["title"]) \
                    .order("created_at", desc=True).limit(1).execute()

                inserted.append(fetch.data[0] if fetch.data else None)
            return inserted

    except HTTPException:
        raise
    except Exception as e:
        print(f"Supabase store error: {e}")
        raise HTTPException(500, f"Failed to store notes: {e}")


# --------------------------------------------------

# Routes

# --------------------------------------------------

@router.post("/", response_model=UploadResponse)
async def upload_files(
    files: List[UploadFile] = File(...),
    group_files: bool = Form(False),
    user_id: str = Depends(get_current_user_id)
):
    """Upload PDF / image files and generate enriched Markdown notes."""
    try:
        if not files:
            raise HTTPException(400, "No files provided")
        if len(files) > 5:
            raise HTTPException(413, "You can upload a maximum of 5 files")

        if group_files:
            processed = await process_grouped_files_with_gemini(files)
        else:
            processed = [await process_file_with_gemini(f) for f in files]

        stored = await store_results_in_supabase(processed, group_files, user_id)

        return UploadResponse(
            success=True,
            message="Files processed and stored successfully",
            notes=stored
        )

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Upload error: {e}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Failed to process files: {e}"}
        )


