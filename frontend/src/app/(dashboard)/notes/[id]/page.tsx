'use client';

import { useEffect, useState, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Edit2, Save, Download, FilePlus, Layers, BrainCircuit } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';

// Custom renderer components
const ChemBlock = ({ children }: { children: string }) => (
  <div className="chem-structure p-4 border border-gray-200 rounded-md bg-gray-50 my-4">
    <div className="text-gray-800 overflow-auto">
      {children}
    </div>
  </div>
);

const CircuitBlock = ({ children }: { children: string }) => (
  <div className="circuit-diagram p-4 border border-gray-200 rounded-md bg-gray-50 my-4">
    <div className="text-gray-800 overflow-auto">
      {children}
    </div>
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
  
  // Custom components for ReactMarkdown
  const components = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      if (!inline && language === 'chem') {
        return <ChemBlock>{String(children).replace(/\n$/, '')}</ChemBlock>;
      }
      
      if (!inline && language === 'circuit') {
        return <CircuitBlock>{String(children).replace(/\n$/, '')}</CircuitBlock>;
      }
      
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
  };

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
        body: JSON.stringify({ noteId, userId: user.id }), 
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
            onClick={handleCreateFlashcards}
            disabled={isCreatingFlashcards || isEditing}
          >
            <Layers className="h-4 w-4 mr-2" />
            {isCreatingFlashcards ? 'Creating...' : 'Flashcards'}
          </Button>
          <Button
            variant="default"
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={handleCreateQuiz}
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
          Last updated: {new Date(note.updated_at).toLocaleString()}
        </div>
        
        {isEditing ? (
          <div className="border border-gray-300 rounded-lg">
            <CodeMirror
              value={editedContent}
              onChange={setEditedContent}
              height="600px"
              className="text-base"
              theme="light"
            />
            <div className="p-3 bg-gray-50 border-t">
              <p className="text-xs text-gray-500">
                <strong>Markdown and LaTeX Tips:</strong> 
                Use standard Markdown for formatting. For equations, use $...$ for inline math and $$...$$ for display equations.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                For chemistry formulas, use <code>$\ce&#123;H2O&#125;$</code> for inline or <code>$$\ce&#123;H2O&#125;$$</code> for display formulas.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                For circuit diagrams, use <code>```circuit</code> with your diagram content and end with <code>```</code>. 
                For complex chemical structures, use <code>```chem</code> with your structure and end with <code>```</code>.
              </p>
            </div>
          </div>
        ) : (
          <div 
            ref={contentRef}
            className="prose prose-sm sm:prose lg:prose-lg max-w-none bg-white p-6 rounded-lg shadow-sm border markdown-content"
          >
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[
                [rehypeKatex, { 
                  output: 'html',
                  throwOnError: false, 
                  strict: false,
                  trust: true
                }], 
                rehypeSanitize
              ]}
              components={components}
            >
              {note.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Add custom styles for content */}
      <style jsx global>{`
        .markdown-content .katex-display {
          margin: 1.5em 0;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 0.5em 0;
        }
        
        .markdown-content .katex {
          font-size: 1.1em;
        }
        
        .markdown-content .katex-display > .katex {
          font-size: 1.21em;
        }
        
        /* Load mhchem extension for KaTeX */
        @import url('https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/mhchem.min.css');
        
        @media (max-width: 640px) {
          .markdown-content .katex-display {
            font-size: 0.85em;
          }
        }
      `}</style>
    </div>
  );
} 