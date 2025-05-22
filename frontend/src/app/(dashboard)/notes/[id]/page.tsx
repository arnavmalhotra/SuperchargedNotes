'use client';

import { useEffect, useState, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Edit2, Save, Download, FilePlus, Layers, BrainCircuit } from 'lucide-react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/mhchem';
import type { ReactCodeMirrorProps } from '@uiw/react-codemirror';
import { Extension } from '@codemirror/state';
import React from 'react';
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import 'katex'
import 'katex/contrib/mhchem'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


// Define KaTeX types
declare global {
  interface Window {
    katex?: {
      renderToString: (formula: string, options?: any) => string;
    }
  }
}

// Dynamically import components to avoid SSR issues
const CodeMirror = dynamic<ReactCodeMirrorProps>(() => import('@uiw/react-codemirror'), { 
  ssr: false,
  loading: () => <div className="h-[600px] bg-gray-100 animate-pulse rounded-md"></div>
});

// Custom renderer components
const ChemBlock = ({ children }: { children: string }) => {
  // Pre-process the chemical formulas to prepare them for KaTeX
  const processedContent = children
    .replace(/\\ce\{([^}]+)\}/g, (_, formula) => `$\\ce{${formula}}$`)
    .replace(/\\chemfig\{([^}]+)\}/g, (_, formula) => `$\\chemfig{${formula}}$`);
  
  // Ensure KaTeX with mhchem is loaded
  useEffect(() => {
    if (typeof window !== 'undefined' && window.katex) {
      // Ensure mhchem extension is loaded
      require('katex/dist/contrib/mhchem');
    }
  }, []);
    
  return (
    <div className="chem-structure p-4 border border-gray-200 rounded-md bg-gray-50 my-4">
      <div className="text-gray-800 overflow-auto" dangerouslySetInnerHTML={{ __html: processedContent }} />
    </div>
  );
};

const CircuitBlock = ({ children }: { children: string }) => (
  <div className="circuit-diagram p-4 border border-gray-200 rounded-md bg-gray-50 my-4">
    <div className="text-gray-800 overflow-auto" dangerouslySetInnerHTML={{ __html: children }} />
  </div>
);

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export default function NoteDetailPage() {
  const { user } = useUser();
  const router = useRouter();
  const params = useParams();
  const noteId = params.id as string;
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isCreatingFlashcards, setIsCreatingFlashcards] = useState(false);
  const [flashcardCreationError, setFlashcardCreationError] = useState<string | null>(null);
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  const [quizCreationError, setQuizCreationError] = useState<string | null>(null);
  const [processedContent, setProcessedContent] = useState('');
  
  // Preferences dialogs
  const [showFlashcardPreferences, setShowFlashcardPreferences] = useState(false);
  const [showQuizPreferences, setShowQuizPreferences] = useState(false);
  
  // Flashcard preferences
  const [flashcardCount, setFlashcardCount] = useState(10);
  const [flashcardDifficulty, setFlashcardDifficulty] = useState('medium');
  const [flashcardFocusTopic, setFlashcardFocusTopic] = useState('');
  
  // Quiz preferences
  const [quizQuestionCount, setQuizQuestionCount] = useState(5);
  const [quizDifficulty, setQuizDifficulty] = useState('medium');
  const [quizFocusTopic, setQuizFocusTopic] = useState('');

  // Process content using unified when note content changes
  useEffect(() => {
    if (!isEditing && note?.content) {
      // Preprocess the content to properly handle chemical equations
      const preprocessContent = (content: string) => {
        return content
          // Fix the \ce command by removing the backslash
          .replace(/\\ce/g, '\\ce')
          // Handle block chemical equations (those on their own line)
          .replace(/^\s*\\ce\{([^}]+)\}\s*$/gm, '$$\\ce{$1}$$')
          // Handle inline chemical equations that aren't already wrapped in $
          .replace(/(?<!\$)\\ce\{([^}]+)\}(?!\$)/g, '$\\ce{$1}$')
          // Clean up any double-wrapped equations
          .replace(/\$\$\$\$/g, '$$')
          .replace(/\$\$/g, '$');
      };

      const preprocessedContent = preprocessContent(note.content);

      unified()
        .use(remarkParse)
        .use(remarkMath)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeRaw)
        .use(rehypeKatex, { strict: false })
        .use(rehypeStringify, { allowDangerousHtml: true })
        .process(preprocessedContent)
        .then((file) => {
          setProcessedContent(String(file));
        })
        .catch((err) => {
          console.error('Error processing content:', err);
        });
    }
  }, [isEditing, note?.content]);

  const fetchNote = async () => {
    if (!user?.id || !noteId) return;
    setLoading(true);
    setError(null);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseUrl) {
        throw new Error("API base URL is not configured.");
      }
      
      const response = await fetch(`${apiBaseUrl}/api/notes/${noteId}`, {
        headers: {
          'X-User-Id': user.id,
        }
      });
      
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch note');
      }
      setNote(data.note);
      setEditedTitle(data.note.title);
      setEditedContent(data.note.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching the note.');
      console.error("Error fetching note:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id && noteId) {
      fetchNote();
    }
  }, [user, noteId]);

  const handleBackToNotes = () => {
    router.push('/notes');
  };

  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      // Entering edit mode
      setEditedTitle(note?.title || '');
      setEditedContent(note?.content || '');
    } else {
      // Exiting edit mode without saving
      // No content processing needed here
    }
  };

  const handleSave = async () => {
    if (!user?.id || !noteId) return;
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseUrl) {
        throw new Error("API base URL is not configured.");
      }
      
      const response = await fetch(`${apiBaseUrl}/api/notes/${noteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id,
        },
        body: JSON.stringify({
          title: editedTitle,
          content: editedContent
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update note');
      }
      
      setNote(data.note);
      setIsEditing(false);
      
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'An unknown error occurred while saving the note.');
      console.error("Error saving note:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportToPdf = async () => {
    if (!note || !user?.id) return;
    setIsPdfExporting(true);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseUrl) {
        throw new Error("API base URL is not configured.");
      }

      const response = await fetch(`${apiBaseUrl}/api/notes/${noteId}/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      // Get the PDF blob from the response
      const blob = await response.blob();
      
      // Create a download link and trigger it
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'note'}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error exporting to PDF:", err);
      alert('Failed to export to PDF. Please try again.');
    } finally {
      setIsPdfExporting(false);
    }
  };

  const handleCreateFlashcards = async () => {
    if (!user?.id || !noteId) return;
    setIsCreatingFlashcards(true);
    setFlashcardCreationError(null);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseUrl) {
        throw new Error("API base URL is not configured.");
      }
      
      const response = await fetch(`${apiBaseUrl}/api/flashcards/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id,
        },
        body: JSON.stringify({ 
          noteId, 
          userId: user.id,
          preferences: {
            card_count: flashcardCount,
            difficulty: flashcardDifficulty,
            focus_topic: flashcardFocusTopic
          }
        }), 
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create flashcards');
      }

      router.push(`/flashcards/${data.flashcardSet.id}`);
    } catch (err) {
      console.error(`Error creating flashcards:`, err);
      setFlashcardCreationError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsCreatingFlashcards(false);
      setShowFlashcardPreferences(false);  // Close the dialog
    }
  };

  const handleCreateQuiz = async () => {
    if (!user?.id || !noteId) return;
    setIsCreatingQuiz(true);
    setQuizCreationError(null);
    
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/quizzes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id,
        },
        body: JSON.stringify({
          noteId,
          userId: user.id,
          preferences: {
            question_count: quizQuestionCount,
            difficulty: quizDifficulty,
            focus_topic: quizFocusTopic
          }
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create quiz');
      }
      
      router.push(`/quizzes/${data.quiz.id}`);
    } catch (err) {
      console.error(`Error creating quiz:`, err);
      setQuizCreationError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsCreatingQuiz(false);
      setShowQuizPreferences(false);  // Close the dialog
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="sm" onClick={handleBackToNotes} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-full mb-6" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="sm" onClick={handleBackToNotes} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <h1 className="text-3xl font-bold">Error</h1>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p>{error || 'Note not found'}</p>
        </div>
        <div className="mt-4">
          <Button onClick={handleBackToNotes}>Back to Notes</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={handleBackToNotes} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          {isEditing ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="text-3xl font-bold bg-gray-100 px-2 py-1 rounded w-full"
              placeholder="Note Title"
            />
          ) : (
            <h1 className="text-3xl font-bold">{note.title}</h1>
          )}
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={handleExportToPdf}
            disabled={isPdfExporting || isEditing}
            className="text-gray-700"
          >
            <Download className="h-4 w-4 mr-2" /> 
            {isPdfExporting ? 'Exporting...' : 'Export PDF'}
          </Button>
          <Button
            variant="default"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => setShowFlashcardPreferences(true)}
            disabled={isCreatingFlashcards || isEditing}
          >
            <Layers className="h-4 w-4 mr-2" />
            {isCreatingFlashcards ? 'Creating...' : 'Flashcards'}
          </Button>
          <Button
            variant="default"
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => setShowQuizPreferences(true)}
            disabled={isCreatingQuiz || isEditing}
          >
            <BrainCircuit className="h-4 w-4 mr-2" />
            {isCreatingQuiz ? 'Creating...' : 'Quiz'}
          </Button>
          <Button 
            variant={isEditing ? "default" : "outline"} 
            onClick={isEditing ? handleSave : handleToggleEdit}
            disabled={isSaving}
          >
            {isEditing ? (
              <>
                <Save className="h-4 w-4 mr-2" /> 
                {isSaving ? 'Saving...' : 'Save'}
              </>
            ) : (
              <>
                <Edit2 className="h-4 w-4 mr-2" /> Edit
              </>
            )}
          </Button>
          {isEditing && (
            <Button variant="outline" onClick={handleToggleEdit}>
              Cancel
            </Button>
          )}
        </div>
      </div>
      
      {flashcardCreationError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          <p>Error creating flashcards: {flashcardCreationError}</p>
        </div>
      )}
      
      {quizCreationError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          <p>Error creating quiz: {quizCreationError}</p>
        </div>
      )}
      
      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          <p>Error saving note: {saveError}</p>
        </div>
      )}
      
      <div className="mt-6">
        <div className="text-sm text-gray-500 mb-2">
          Last updated: {new Date(note?.updated_at || '').toLocaleString()}
        </div>
        
        {isEditing ? (
          <div className="border border-gray-300 rounded-lg">
            {/* @ts-ignore - CodeMirror props are handled by dynamic import */}
            <CodeMirror
              value={editedContent}
              onChange={setEditedContent}
              height="600px"
              className="text-base"
              theme="light"
            />
            <div className="p-3 bg-gray-50 border-t">
              <p className="text-xs text-gray-500">
                <strong>Chemistry Equations:</strong> 
                Use {`\\ce{}`} for chemical equations (e.g. {`\\ce{H2O + H+ <=> H3O+}`})
              </p>
              <p className="text-xs text-gray-500 mt-1">
                <strong>Examples:</strong>
              </p>
              <ul className="text-xs text-gray-500 list-disc pl-4">
                <li>Simple molecule: {`\\ce{H2O}`}</li>
                <li>Reaction: {`\\ce{CH3CHO + H+ <=> [CH3CHOH]+ <=> CH2=CHOH + H+}`}</li>
                <li>With states: {`\\ce{Fe^{2+}}`}, {`\\ce{H2O(l)}`}</li>
              </ul>
            </div>
          </div>
        ) : (
          <div 
            ref={contentRef}
            className="prose prose-sm sm:prose lg:prose-lg max-w-none bg-white p-6 rounded-lg shadow-sm border markdown-content math-content"
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />
        )}
      </div>

      {/* Flashcard Preferences Dialog */}
      <Dialog open={showFlashcardPreferences} onOpenChange={setShowFlashcardPreferences}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Flashcard Generation Options</DialogTitle>
            <DialogDescription>
              Customize how your flashcards are generated from this note.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="flashcard-count" className="text-right">
                Number of Cards
              </Label>
              <Input
                id="flashcard-count"
                type="number"
                min={5}
                max={30}
                value={flashcardCount}
                onChange={(e) => setFlashcardCount(parseInt(e.target.value) || 10)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="flashcard-difficulty" className="text-right">
                Difficulty
              </Label>
              <Select 
                value={flashcardDifficulty} 
                onValueChange={setFlashcardDifficulty}
              >
                <SelectTrigger id="flashcard-difficulty" className="col-span-3">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="flashcard-topic" className="text-right">
                Focus Topic
              </Label>
              <Input
                id="flashcard-topic"
                placeholder="Optional topic to focus on"
                value={flashcardFocusTopic}
                onChange={(e) => setFlashcardFocusTopic(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFlashcardPreferences(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateFlashcards} 
              disabled={isCreatingFlashcards}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isCreatingFlashcards ? 'Creating...' : 'Create Flashcards'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quiz Preferences Dialog */}
      <Dialog open={showQuizPreferences} onOpenChange={setShowQuizPreferences}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Quiz Generation Options</DialogTitle>
            <DialogDescription>
              Customize how your quiz is generated from this note.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quiz-count" className="text-right">
                Number of Questions
              </Label>
              <Input
                id="quiz-count"
                type="number"
                min={3}
                max={20}
                value={quizQuestionCount}
                onChange={(e) => setQuizQuestionCount(parseInt(e.target.value) || 5)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quiz-difficulty" className="text-right">
                Difficulty
              </Label>
              <Select 
                value={quizDifficulty} 
                onValueChange={setQuizDifficulty}
              >
                <SelectTrigger id="quiz-difficulty" className="col-span-3">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quiz-topic" className="text-right">
                Focus Topic
              </Label>
              <Input
                id="quiz-topic"
                placeholder="Optional topic to focus on"
                value={quizFocusTopic}
                onChange={(e) => setQuizFocusTopic(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuizPreferences(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateQuiz} 
              disabled={isCreatingQuiz}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isCreatingQuiz ? 'Creating...' : 'Create Quiz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .markdown-content {
          line-height: 1.8;
          font-size: 1.1rem;
        }
        
        /* KaTeX specific styles */
        .katex {
          font-size: 1.1em !important;
        }
        
        .katex-display {
          margin: 1.5em 0 !important;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 0.5em 0;
        }

        /* Ensure chemical equations are properly aligned */
        .katex .mord.text {
          text-align: left;
        }

        .katex .mrel {
          padding: 0 0.2em;
        }

        /* Ensure proper spacing for chemical equations */
        .katex .mord.textord {
          margin: 0 0.1em;
        }

        .katex .mspace {
          margin: 0 0.1em;
        }

        /* Fix arrow alignment in chemical equations */
        .katex .mrel.amsrm {
          padding: 0 0.2em;
          vertical-align: middle;
        }

        /* Basic markdown styles */
        .markdown-content p {
          margin-bottom: 1.5em;
        }
        
        .markdown-content h1, 
        .markdown-content h2, 
        .markdown-content h3 {
          margin-top: 1.5em;
          margin-bottom: 0.75em;
          line-height: 1.3;
        }
        
        .markdown-content ul, 
        .markdown-content ol {
          margin-top: 0.75em;
          margin-bottom: 0.75em;
        }
        
        .markdown-content li {
          margin-bottom: 0.5em;
        }
        
        .markdown-content blockquote {
          border-left: 4px solid #e2e8f0;
          padding-left: 1em;
          color: #4a5568;
          font-style: italic;
          margin: 1.5em 0;
        }
        
        .markdown-content pre {
          background: #f7fafc;
          border-radius: 0.375rem;
          padding: 1em;
          overflow-x: auto;
          margin: 1.5em 0;
        }
        
        .markdown-content code {
          background: #edf2f7;
          padding: 0.2em 0.4em;
          border-radius: 0.25rem;
          font-size: 0.9em;
        }
        
        .markdown-content pre code {
          background: transparent;
          padding: 0;
        }

        @media (max-width: 640px) {
          .markdown-content {
            font-size: 1rem;
          }
          
          .katex {
            font-size: 1em !important;
          }
        }
      `}</style>
    </div>
  );
} 