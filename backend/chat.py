from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import os
import json
from openai import OpenAI
import requests
from db import supabase, get_current_user_id

# Create router
router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])

# Check if OpenRouter API key is available
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
APP_URL = os.environ.get("APP_URL", "https://supernotes.app")
APP_NAME = os.environ.get("APP_NAME", "SuperchargedNotes")

if not OPENROUTER_API_KEY:
    print("WARNING: Missing OPENROUTER_API_KEY environment variable. Chatbot will not work.")

# Pydantic models
class Message(BaseModel):
    role: str
    content: str

class ContextDocument(BaseModel):
    id: str
    type: str
    name: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Message]] = []
    stream: bool = True
    responseType: str = "detailed"
    contextDocument: Optional[ContextDocument] = None

class ChatResponse(BaseModel):
    content: str

async def fetch_document_content(user_id: str, doc: ContextDocument) -> str:
    """Fetch the content of a document from Supabase based on its ID and type"""
    try:
        if doc.type == "note":
            table = "notes"
        elif doc.type == "quiz":
            table = "quiz_sets"
        elif doc.type == "flashcard_set":
            table = "flashcard_sets"
        else:
            raise ValueError(f"Unknown document type: {doc.type}")
            
        response = supabase.from_(table)\
            .select('*')\
            .eq('id', doc.id)\
            .eq('user_id', user_id)\
            .execute()
            
        if hasattr(response, 'error') and response.error:
            print(f"Supabase error fetching {doc.type}: {response.error}")
            return f"Error: Could not fetch {doc.type} with ID {doc.id}"
            
        if not response.data or len(response.data) == 0:
            return f"Error: {doc.type} with ID {doc.id} not found"
            
        document = response.data[0]
        
        # Get additional content based on document type
        if doc.type == "quiz":
            # For quizzes, fetch the questions
            questions_response = supabase.from_('quiz_questions')\
                .select('*')\
                .eq('quiz_set_id', doc.id)\
                .execute()
                
            if not hasattr(questions_response, 'error') and questions_response.data:
                questions = questions_response.data
                questions_text = "\n\n".join([
                    f"Question: {q.get('question_text')}\n"
                    f"Option A: {q.get('option_a')}\n"
                    f"Option B: {q.get('option_b')}\n"
                    f"Option C: {q.get('option_c')}\n"
                    f"Option D: {q.get('option_d')}\n"
                    f"Correct Option: {q.get('correct_option')}\n"
                    f"Explanation: {q.get('explanation')}"
                    for q in questions
                ])
                return f"Quiz: {document.get('title')}\n\n{questions_text}"
        
        elif doc.type == "flashcard_set":
            # For flashcard sets, fetch the cards
            cards_response = supabase.from_('individual_flashcards')\
                .select('*')\
                .eq('flashcard_set_id', doc.id)\
                .execute()
                
            if not hasattr(cards_response, 'error') and cards_response.data:
                cards = cards_response.data
                cards_text = "\n\n".join([
                    f"Front: {card.get('front')}\n"
                    f"Back: {card.get('back')}"
                    for card in cards
                ])
                return f"Flashcard Set: {document.get('title')}\n\n{cards_text}"
        
        # For notes or default case, return the content directly
        return f"{doc.type.capitalize()}: {document.get('title')}\n\n{document.get('content')}"
            
    except Exception as e:
        print(f"Error fetching document content: {e}")
        return f"Error: Could not fetch document content: {str(e)}"

@router.post("")
async def chat(request: ChatRequest, user_id: str = Depends(get_current_user_id)):
    """
    Chat with an AI assistant using OpenRouter.
    Can include document context and supports streaming responses.
    """
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")
    
    try:
        # Prepare messages
        messages = [{"role": msg.role, "content": msg.content} for msg in request.history]
        
        # If there's a context document, fetch its content and add it to the prompt
        context_text = ""
        if request.contextDocument:
            context_text = await fetch_document_content(user_id, request.contextDocument)
            context_message = f"I want you to answer questions about the following document. First, I'll provide the document content, and then I'll ask questions about it.\n\nDocument Content:\n{context_text}\n\nNow, based on this document, please answer the following question: {request.message}"
            messages.append({"role": "user", "content": context_message})
        else:
            messages.append({"role": "user", "content": request.message})
            
        # Handle streaming response
        if request.stream:
            return StreamingResponse(
                stream_openrouter_response(messages, request.responseType),
                media_type="text/event-stream"
            )
        else:
            # Non-streaming response
            completion = get_openrouter_response(messages, request.responseType)
            return ChatResponse(content=completion)
    
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get AI response: {str(e)}")

def get_openrouter_response(messages: List[Dict[str, str]], response_type: str) -> str:
    """Get a non-streaming response from OpenRouter"""
    # Create OpenAI client with OpenRouter base URL
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    )
    
    # Choose model based on response type
    model = "openai/gpt-4o" if response_type == "detailed" else "anthropic/claude-3-haiku"
    
    # System message based on response type
    system_message = (
        "You are an expert chemistry tutor. Provide detailed, in-depth answers with examples and thorough explanations."
        if response_type == "detailed" else
        "You are a helpful assistant. Provide concise, to-the-point answers."
    )
    
    # Add system message to the beginning
    all_messages = [{"role": "system", "content": system_message}] + messages
    
    # Create chat completion
    completion = client.chat.completions.create(
        extra_headers={
            "HTTP-Referer": APP_URL,
            "X-Title": APP_NAME,
        },
        model=model,
        messages=all_messages
    )
    
    return completion.choices[0].message.content

async def stream_openrouter_response(messages: List[Dict[str, str]], response_type: str):
    """Stream response from OpenRouter"""
    # Choose model based on response type
    model = "deepseek/deepseek-r1" if response_type == "detailed" else "google/gemini-pro-1.5"
    
    # System message based on response type
    system_message = (
        "You are an expert chemistry tutor. Provide detailed, in-depth answers with examples and thorough explanations."
        if response_type == "detailed" else
        "You are a helpful assistant. Provide concise, to-the-point answers."
    )
    
    # Add system message to the beginning
    all_messages = [{"role": "system", "content": system_message}] + messages
    
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": APP_URL,
        "X-Title": APP_NAME,
    }
    
    payload = {
        "model": model,
        "messages": all_messages,
        "stream": True
    }
    
    # Create HTTP session
    with requests.Session() as session:
        with session.post(url, headers=headers, json=payload, stream=True) as r:
            if r.status_code != 200:
                error_msg = f"Error from OpenRouter API: {r.status_code}"
                try:
                    error_data = r.json()
                    if error_data.get("error"):
                        error_msg = f"OpenRouter error: {error_data['error']['message']}"
                except:
                    pass
                yield f"data: {json.dumps({'error': error_msg})}\n\n"
                return
            
            buffer = ""
            for chunk in r.iter_content(chunk_size=1024, decode_unicode=False):
                if chunk:
                    text_chunk = chunk.decode('utf-8')
                    buffer += text_chunk
                    
                    while '\n' in buffer:
                        line, buffer = buffer.split('\n', 1)
                        line = line.strip()
                        
                        if line.startswith('data: '):
                            data = line[6:]
                            if data == '[DONE]':
                                yield f"data: [DONE]\n\n"
                                return
                            
                            try:
                                data_obj = json.loads(data)
                                content = data_obj["choices"][0]["delta"].get("content", "")
                                
                                # Format as Server-Sent Event
                                output = {
                                    "choices": [
                                        {
                                            "delta": {"content": content},
                                            "index": 0
                                        }
                                    ]
                                }
                                yield f"data: {json.dumps(output)}\n\n"
                            except json.JSONDecodeError:
                                pass 