import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error('Missing OPENROUTER_API_KEY environment variable');
}

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://supernotes.app',
    'X-Title': 'SuperchargedNotes',
  },
});

// Model mapping for different response types
const MODEL_MAPPING = {
  quick: 'google/gemini-pro-1.5',
  detailed: 'deepseek/deepseek-r1'
};

interface ContextDocument {
  id: string;
  type: 'note' | 'quiz' | 'flashcard_set';
  name: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'; // Added system for full compatibility
  content: string;
}

// Simple in-memory cache for general context
const generalContextCache = new Map<string, { context: string, timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - Please sign in' },
        { status: 401 }
      );
    }

    const { message, stream = false, responseType = 'detailed', contextDocument, history = [] } = await request.json() as { 
      message: string, 
      stream?: boolean, 
      responseType?: 'quick' | 'detailed',
      contextDocument?: ContextDocument,
      history?: ChatMessage[] // Added history parameter
    };

    if (!message) {
      return NextResponse.json(
        { success: false, message: 'Message is required' },
        { status: 400 }
      );
    }

    // Get the appropriate model based on response type
    const model = MODEL_MAPPING[responseType as keyof typeof MODEL_MAPPING] || MODEL_MAPPING.detailed;

    let systemMessageContent = ''; // Renamed to avoid conflict with systemMessage object
    let contextContent: any = null;

    if (contextDocument) {
      let tableName = '';
      let titleColumn = 'title'; // Default title column for all types now
      // Content fetching logic will be type-specific

      switch (contextDocument.type) {
        case 'note':
          tableName = 'notes';
          const { data: noteDoc, error: noteDocError } = await supabase
            .from(tableName)
            .select('id, title, content') // Explicitly list columns
            .eq('user_id', userId)
            .eq('id', contextDocument.id)
            .single();

          if (noteDocError || !noteDoc) {
            console.error(`Error fetching note:`, noteDocError);
            systemMessageContent = `You are an intelligent assistant for SuperchargedNotes. The user tried to provide a specific note titled "${contextDocument.name}" as context, but it could not be found or accessed. Please inform the user about this issue. If the query is general, try to answer it.`;
          } else {
            const docTitle = noteDoc.title || contextDocument.name;
            const stringifiedContent = String(noteDoc.content);
            systemMessageContent = `You are an intelligent assistant for SuperchargedNotes. The user is asking a question specifically about their note titled "${docTitle}". Here is its content:\n\n${stringifiedContent}\n\nBased EXCLUSIVELY on this information, provide helpful and accurate answers. If the answer is not in the provided content, state that the information is not available in this specific document.`;
          }
          break;

        case 'quiz':
          tableName = 'quiz_sets';
          const { data: quizSetDoc, error: quizSetDocError } = await supabase
            .from(tableName)
            .select(titleColumn) // Only fetch title from quiz_sets
            .eq('user_id', userId)
            .eq('id', contextDocument.id)
            .single();

          if (quizSetDocError || !quizSetDoc) {
            console.error(`Error fetching quiz set:`, quizSetDocError);
            systemMessageContent = `You are an intelligent assistant for SuperchargedNotes. The user tried to provide a specific quiz titled "${contextDocument.name}" as context, but it could not be found or accessed. Please inform the user about this issue. If the query is general, try to answer it.`;
          } else {
            const docTitle = quizSetDoc[titleColumn] || contextDocument.name;
            // Now fetch questions for this quiz set
            const { data: questions, error: questionsError } = await supabase
              .from('quiz_questions')
              .select('question_text, option_a, option_b, option_c, option_d, correct_option, explanation') // Adjust columns as needed
              .eq('quiz_id', contextDocument.id); // Assuming foreign key is quiz_id
            
            if (questionsError) {
              console.error(`Error fetching questions for quiz ${docTitle}:`, questionsError);
              systemMessageContent = `You are an intelligent assistant for SuperchargedNotes. The quiz set "${docTitle}" was found, but its questions could not be retrieved. Please inform the user.`;
            } else {
              const stringifiedContent = questions
                .map(q => 
                  `Question: ${q.question_text}\nOptions:\n  A: ${q.option_a || 'N/A'}\n  B: ${q.option_b || 'N/A'}\n  C: ${q.option_c || 'N/A'}\n  D: ${q.option_d || 'N/A'}\n  Explanation: ${q.explanation || 'N/A'}\nCorrect Option: ${q.correct_option || 'N/A'}`
                )
                .join('\n\n---\n\n');
              systemMessageContent = `You are an intelligent assistant for SuperchargedNotes. The user is asking a question specifically about their quiz titled "${docTitle}". Here are its questions and options:\n\n${stringifiedContent}\n\nBased EXCLUSIVELY on this information, provide helpful and accurate answers. If the answer is not in the provided content, state that the information is not available in this specific document.`;
            }
          }
          break;

        case 'flashcard_set':
          tableName = 'flashcard_sets';
          const { data: flashcardSetDoc, error: flashcardSetDocError } = await supabase
            .from(tableName)
            .select(titleColumn) // Only fetch title from flashcard_sets
            .eq('user_id', userId)
            .eq('id', contextDocument.id)
            .single();

          if (flashcardSetDocError || !flashcardSetDoc) {
            console.error(`Error fetching flashcard set:`, flashcardSetDocError);
            systemMessageContent = `You are an intelligent assistant for SuperchargedNotes. The user tried to provide a specific flashcard set titled "${contextDocument.name}" as context, but it could not be found or accessed. Please inform the user about this issue. If the query is general, try to answer it.`;
          } else {
            const docTitle = flashcardSetDoc[titleColumn] || contextDocument.name;
            // Now fetch individual flashcards for this set
            const { data: flashcards, error: flashcardsError } = await supabase
              .from('individual_flashcards')
              .select('front, back') // Assuming columns are front and back
              .eq('set_id', contextDocument.id); // Assuming foreign key is set_id

            if (flashcardsError) {
              console.error(`Error fetching flashcards for set ${docTitle}:`, flashcardsError);
              systemMessageContent = `You are an intelligent assistant for SuperchargedNotes. The flashcard set "${docTitle}" was found, but its cards could not be retrieved. Please inform the user.`;
            } else {
              const stringifiedContent = flashcards
                .map(fc => `Front: ${fc.front}\nBack: ${fc.back}`)
                .join('\n\n---\n\n');
              systemMessageContent = `You are an intelligent assistant for SuperchargedNotes. The user is asking a question specifically about their flashcard set titled "${docTitle}". Here are its flashcards:\n\n${stringifiedContent}\n\nBased EXCLUSIVELY on this information, provide helpful and accurate answers. If the answer is not in the provided content, state that the information is not available in this specific document.`;
            }
          }
          break;

        default:
          return NextResponse.json(
            { success: false, message: 'Invalid context document type' },
            { status: 400 }
          );
      }
      // The rest of the 'if (contextDocument)' block is removed as logic is handled per case.
    } else {
      // General context: Check cache first
      const cacheKey = `userGeneralContext-${userId}`;
      const cachedEntry = generalContextCache.get(cacheKey);

      if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS)) {
        systemMessageContent = cachedEntry.context;
        console.log('Using cached general context for user:', userId);
      } else {
        console.log('Fetching fresh general context for user:', userId);
        // Fetch all user notes, quizzes, and flashcards for general context
        let comprehensiveContext = "";

        // 1. Fetch Notes
        const { data: notes, error: notesError } = await supabase
          .from('notes')
          .select('title, content')
          .eq('user_id', userId);

        if (notesError) {
          console.error('Error fetching notes for general context:', notesError);
          comprehensiveContext += "Could not retrieve notes.\n\n";
        } else if (notes && notes.length > 0) {
          comprehensiveContext += "User's Notes:\n" + notes.map(note => 
            `Title: ${note.title}\nContent: ${note.content}`
          ).join('\n\n---\n\n') + "\n\nEnd of Notes.\n\n";
        } else {
          comprehensiveContext += "User has no notes.\n\n";
        }

        // 2. Fetch Quiz Sets and their Questions
        const { data: quizSets, error: quizSetsError } = await supabase
          .from('quiz_sets')
          .select('id, title')
          .eq('user_id', userId);

        if (quizSetsError) {
          console.error('Error fetching quiz sets for general context:', quizSetsError);
          comprehensiveContext += "Could not retrieve quiz sets.\n\n";
        } else if (quizSets && quizSets.length > 0) {
          comprehensiveContext += "User's Quiz Sets:\n";
          for (const quizSet of quizSets) {
            comprehensiveContext += `Quiz Title: ${quizSet.title}\n`;
            const { data: questions, error: questionsError } = await supabase
              .from('quiz_questions')
              .select('question_text, option_a, option_b, option_c, option_d, option_e, correct_option')
              .eq('quiz_id', quizSet.id);
            if (questionsError) {
              comprehensiveContext += "  Could not retrieve questions for this quiz.\n";
            } else if (questions && questions.length > 0) {
              comprehensiveContext += questions.map(q => 
                `  Question: ${q.question_text}\n    Options: A) ${q.option_a || 'N/A'}, B) ${q.option_b || 'N/A'}, C) ${q.option_c || 'N/A'}, D) ${q.option_d || 'N/A'}, E) ${q.option_e || 'N/A'}\n    Correct: ${q.correct_option || 'N/A'}`
              ).join('\n--\n') + "\n";
            } else {
              comprehensiveContext += "  This quiz has no questions.\n";
            }
            comprehensiveContext += "---\n";
          }
          comprehensiveContext += "End of Quiz Sets.\n\n";
        } else {
          comprehensiveContext += "User has no quiz sets.\n\n";
        }

        // 3. Fetch Flashcard Sets and their Cards
        const { data: flashcardSets, error: flashcardSetsError } = await supabase
          .from('flashcard_sets')
          .select('id, title')
          .eq('user_id', userId);

        if (flashcardSetsError) {
          console.error('Error fetching flashcard sets for general context:', flashcardSetsError);
          comprehensiveContext += "Could not retrieve flashcard sets.\n\n";
        } else if (flashcardSets && flashcardSets.length > 0) {
          comprehensiveContext += "User's Flashcard Sets:\n";
          for (const flashcardSet of flashcardSets) {
            comprehensiveContext += `Flashcard Set Title: ${flashcardSet.title}\n`;
            const { data: cards, error: cardsError } = await supabase
              .from('individual_flashcards')
              .select('front, back')
              .eq('set_id', flashcardSet.id);
            if (cardsError) {
              comprehensiveContext += "  Could not retrieve cards for this set.\n";
            } else if (cards && cards.length > 0) {
              comprehensiveContext += cards.map(fc => `  Front: ${fc.front}\n  Back: ${fc.back}`).join('\n--\n') + "\n";
            } else {
              comprehensiveContext += "  This set has no flashcards.\n";
            }
            comprehensiveContext += "---\n";
          }
          comprehensiveContext += "End of Flashcard Sets.\n\n";
        } else {
          comprehensiveContext += "User has no flashcard sets.\n\n";
        }

        if (comprehensiveContext.trim() === "User has no notes.\n\nUser has no quiz sets.\n\nUser has no flashcard sets.\n\n") {
          systemMessageContent = "You are an intelligent assistant for SuperchargedNotes. The user currently has no notes, quizzes, or flashcards, or they could not be accessed. Please assist with general queries or encourage the user to create some content.";
        } else {
          systemMessageContent = `You are an intelligent assistant for SuperchargedNotes. You have access to the user's notes, quizzes, and flashcards. Here is their content:\n\n${comprehensiveContext}Based on ALL this information, provide helpful and accurate answers to the user's questions. If you don't know the answer based on the provided context, be honest about it.`;
        }
        // Store the newly fetched context in cache
        generalContextCache.set(cacheKey, { context: systemMessageContent, timestamp: Date.now() });
      }
    }

    const messagesToOpenAI: ChatMessage[] = [
      { role: 'system', content: systemMessageContent },
      // Add previous messages from history, ensuring they conform to ChatMessage
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message } // Current user message
    ];

    // Handle streaming response
    if (stream) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://supernotes.app',
          'X-Title': 'SuperchargedNotes',
        },
        body: JSON.stringify({
          model,
          messages: messagesToOpenAI, // Use the combined messages array
          stream: true,
        }),
      });

      // Return the streaming response
      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        },
      });
    } 
    
    // Handle non-streaming response
    const completion = await openai.chat.completions.create({
      model,
      messages: messagesToOpenAI, // Use the combined messages array
    });

    return NextResponse.json({
      success: true,
      response: completion.choices[0].message.content,
    });
    
  } catch (error) {
    console.error('Chatbot API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to process message'
      },
      { status: 500 }
    );
  }
} 