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
    },
    
    // Add paragraph component for better spacing
    p({ node, children, ...props }: any) {
      return (
        <p className="my-4" {...props}>
          {children}
        </p>
      );
    },
    
    // Add heading components for better styling
    h1({ node, children, ...props }: any) {
      return <h1 className="text-2xl font-bold mt-8 mb-4" {...props}>{children}</h1>;
    },
    h2({ node, children, ...props }: any) {
      return <h2 className="text-xl font-bold mt-6 mb-3" {...props}>{children}</h2>;
    },
    h3({ node, children, ...props }: any) {
      return <h3 className="text-lg font-bold mt-5 mb-2" {...props}>{children}</h3>;
    },
    
    // Add list styling
    ul({ node, children, ...props }: any) {
      return <ul className="list-disc pl-8 my-4" {...props}>{children}</ul>;
    },
    ol({ node, children, ...props }: any) {
      return <ol className="list-decimal pl-8 my-4" {...props}>{children}</ol>;
    },
    li({ node, children, ...props }: any) {
      return <li className="my-1" {...props}>{children}</li>;
    },
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

  // Effect to ensure KaTeX processes all chemistry elements after render
  useEffect(() => {
    if (!isEditing && contentRef.current && typeof window !== 'undefined' && window.katex) {
      // Find all chemistry elements and process them
      const processChemElements = () => {
        const chemElements = contentRef.current?.querySelectorAll('.chemistry-content');
        if (chemElements && chemElements.length > 0) {
          chemElements.forEach(element => {
            // Attempt to render chemical formulas
            try {
              // Get the raw content
              const content = element.textContent || '';
              
              // Replace chemical formulas with KaTeX rendered elements
              const processedContent = content.replace(
                /\\ce\{([^}]+)\}/g, 
                (match, formula) => {
                  try {
                    const katexRendered = window.katex.renderToString(`\\ce{${formula}}`, {
                      throwOnError: false,
                      output: 'html'
                    });
                    return katexRendered;
                  } catch (e) {
                    console.error('Error rendering chemical formula:', e);
                    return match;
                  }
                }
              );
              
              // Set the processed content
              element.innerHTML = processedContent;
            } catch (e) {
              console.error('Error processing chemistry element:', e);
            }
          });
        }
      };
      
      // Process chemistry elements after a small delay to ensure everything is rendered
      setTimeout(processChemElements, 300);
    }
  }, [isEditing, note?.content]);

  // Helper function to process chemistry in text
  const processChemistryText = (text: string) => {
    if (!text.includes('\\ce{') && !text.includes('\\chemfig{')) {
      return text;
    }
    
    // Wrap chemical equations in KaTeX delimiters
    return text
      .replace(/\\ce\{([^}]+)\}/g, (_, formula) => `$\\ce{${formula}}$`)
      .replace(/\\chemfig\{([^}]+)\}/g, (_, formula) => `$\\chemfig{${formula}}$`);
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
                <strong>Markdown and Math Tips:</strong> 
                Use standard Markdown for formatting. For equations, use $...$ for inline math and $$...$$ for display equations.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                For chemistry formulas, use <code>{'\\ce{H_2O}'}</code> for inline chemical equations.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                For chemical structures, you can use ChemFig with <code>{'\\chemfig{...}'}</code> syntax.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                For circuit diagrams, use <code>{'```circuit'}</code> with your diagram content and end with <code>{'```'}</code>. 
                For complex chemical structures, use <code>{'```chem'}</code> with your structure and end with <code>{'```'}</code>.
              </p>
            </div>
          </div>
        ) : (
          <div 
            ref={contentRef}
            className="prose prose-sm sm:prose lg:prose-lg max-w-none bg-white p-6 rounded-lg shadow-sm border markdown-content math-content"
          >
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeRaw]}
              components={components}
            >
              {processChemistryText(note.content)}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Update custom styles for content */}
      <style jsx global>{`
        .markdown-content {
          line-height: 1.8;
          font-size: 1.1rem;
        }
        
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
        
        /* KaTeX specific styles */
        .katex-display {
          margin: 1.5em 0 !important;
          overflow-x: auto;
          overflow-y: hidden;
        }
        
        .katex {
          font-size: 1.1em !important;
        }
        
        /* Ensure chemical formulas and math are properly styled */
        .chem-structure, .circuit-diagram {
          margin: 2em 0;
          border-radius: 0.5rem;
          background-color: #f8fafc;
        }
        
        /* Add styling for chemistry content */
        .chemistry-content {
          display: block;
          width: 100%;
          overflow-x: auto;
        }
        
        /* Style for blockquotes with chemistry */
        blockquote .chemistry-content {
          margin: 0.5em 0;
        }
        
        /* Style for chemistry in lists */
        li .chemistry-content {
          display: inline-block;
          width: auto;
        }

        /* Fix to ensure all chemistry formulas render */
        .markdown-content .katex-mathml {
          display: none;
        }

        /* Fix styling for chemistry equations */
        .markdown-content .mhchem .mord {
          display: inline-block;
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