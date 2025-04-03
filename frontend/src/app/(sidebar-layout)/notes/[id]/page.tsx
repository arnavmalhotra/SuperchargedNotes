'use client';

import { useEffect, useState, useRef, useReducer } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trash, Save, ArrowLeft, Edit, X } from 'lucide-react';
import { useNotes } from '@/contexts/NotesContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './markdown-styles.css';
import Link from 'next/link';

// Define a separate component for view mode to ensure clean rendering
const ViewMode = ({ note }: { note: Note }) => {
  return (
    <>
      <h1 className="text-3xl font-bold text-gray-900 mb-2 p-2">
        {note.title}
      </h1>
      
      <div className="text-sm text-gray-500 mb-4">
        {note.updated_at 
          ? `Last updated: ${new Date(note.updated_at).toLocaleString()}`
          : `Created: ${new Date(note.created_at).toLocaleString()}`
        }
      </div>
      
      <hr className="my-4 border-blue-100" />
      
      <div className="markdown-body prose max-w-none mt-4 p-2">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            h1: ({children}) => <h1 className="text-2xl font-bold mt-6 mb-4 pb-1 border-b border-blue-100">{children}</h1>,
            h2: ({children}) => <h2 className="text-xl font-bold mt-5 mb-3 text-blue-900">{children}</h2>,
            h3: ({children}) => <h3 className="text-lg font-bold mt-4 mb-2 text-blue-800">{children}</h3>,
            p: ({children}) => <p className="mb-4 leading-relaxed">{children}</p>,
            ul: ({children}) => <ul className="list-disc pl-6 mb-4">{children}</ul>,
            ol: ({children}) => <ol className="list-decimal pl-6 mb-4">{children}</ol>,
            li: ({children}) => <li className="mb-1">{children}</li>,
            blockquote: ({children}) => <blockquote className="border-l-4 border-blue-300 pl-4 py-1 mb-4 italic bg-blue-50 rounded-sm">{children}</blockquote>,
            code: ({node, inline, className, children, ...props}: any) => {
              return inline 
                ? <code className="bg-blue-50 px-1 py-0.5 rounded text-sm font-mono">{children}</code>
                : <pre className="bg-blue-900 text-white p-4 rounded-md overflow-x-auto mb-4">
                    <code className="font-mono text-sm">{children}</code>
                  </pre>
            },
            a: ({href, children}) => <a href={href} className="text-blue-600 hover:underline">{children}</a>,
            table: ({children}) => <div className="overflow-x-auto mb-4"><table className="w-full border-collapse border border-blue-200">{children}</table></div>,
            thead: ({children}) => <thead className="bg-blue-50">{children}</thead>,
            th: ({children}) => <th className="border border-blue-200 px-4 py-2 text-left">{children}</th>,
            td: ({children}) => <td className="border border-blue-200 px-4 py-2">{children}</td>,
            img: ({src, alt}) => <img src={src} alt={alt} className="max-w-full rounded-md my-4" />,
            hr: () => <hr className="my-6 border-blue-200" />,
          }}
        >
          {note.content}
        </ReactMarkdown>
      </div>
    </>
  );
};

interface Note {
  id: number;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  updated_at: string | null;
}

type State = {
  mode: 'view' | 'edit';
  hasChanges: boolean;
  isSaving: boolean;
  isDeleting: boolean;
}

type Action = 
  | { type: 'VIEW_MODE' }
  | { type: 'EDIT_MODE' }
  | { type: 'CONTENT_CHANGED' }
  | { type: 'START_SAVE' }
  | { type: 'FINISH_SAVE' }
  | { type: 'START_DELETE' }
  | { type: 'FINISH_DELETE' }
  | { type: 'DISCARD_CHANGES' };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'VIEW_MODE':
      return { ...state, mode: 'view' };
    case 'EDIT_MODE':
      return { ...state, mode: 'edit' };
    case 'CONTENT_CHANGED':
      return { ...state, hasChanges: true };
    case 'START_SAVE':
      return { ...state, isSaving: true };
    case 'FINISH_SAVE':
      return { ...state, isSaving: false, hasChanges: false, mode: 'view' };
    case 'START_DELETE':
      return { ...state, isDeleting: true };
    case 'FINISH_DELETE':
      return { ...state, isDeleting: false };
    case 'DISCARD_CHANGES':
      return { ...state, hasChanges: false, mode: 'view' };
    default:
      return state;
  }
};

// Add a utility function for markdown shortcuts
const applyMarkdownShortcuts = (event: React.KeyboardEvent<HTMLDivElement>, ref: React.RefObject<HTMLDivElement | null>) => {
  if (!ref.current) return;
  
  // Get selection
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  
  const range = selection.getRangeAt(0);
  const selectedText = range.toString();
  
  // Handle shortcuts
  if (event.key === 'b' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    document.execCommand('insertText', false, `**${selectedText}**`);
    return true;
  }
  
  if (event.key === 'i' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    document.execCommand('insertText', false, `*${selectedText}*`);
    return true;
  }
  
  if (event.key === '`' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    document.execCommand('insertText', false, '`' + selectedText + '`');
    return true;
  }
  
  if (event.key === 'k' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    document.execCommand('insertText', false, `[${selectedText}](url)`);
    return true;
  }
  
  // LaTeX shortcuts
  if (event.key === 'm' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    document.execCommand('insertText', false, `$${selectedText}$`);
    return true;
  }

  if (event.key === 'M' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
    event.preventDefault();
    document.execCommand('insertText', false, `$$\n${selectedText}\n$$`);
    return true;
  }
  
  return false;
};

export default function NotePage() {
  const { id } = useParams();
  const { userId } = useAuth();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';
  const titleRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { refreshNotes } = useNotes();
  
  const [state, dispatch] = useReducer(reducer, {
    mode: isEditMode ? 'edit' : 'view',
    hasChanges: false,
    isSaving: false,
    isDeleting: false
  });

  // Sync state.mode with URL when URL changes
  useEffect(() => {
    if (isEditMode && state.mode !== 'edit') {
      dispatch({ type: 'EDIT_MODE' });
    } else if (!isEditMode && state.mode !== 'view') {
      dispatch({ type: 'VIEW_MODE' });
    }
  }, [isEditMode, state.mode]);

  useEffect(() => {
    if (userId) {
      fetchNote();
    }
  }, [userId, id]);

  // Warn before leaving if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.hasChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.hasChanges]);

  // Effect for edit mode setup
  useEffect(() => {
    if (state.mode === 'edit' && note) {
      setTimeout(() => {
        if (titleRef.current) {
          titleRef.current.innerText = note.title;
        }
        if (contentRef.current) {
          contentRef.current.innerText = note.content;
        }
      }, 50);
    }
  }, [state.mode, note]);

  const fetchNote = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/notes/${id}?user_id=${userId}`
      );
      setNote(response.data);
    } catch (error) {
      console.error('Failed to fetch note:', error);
      alert('Failed to load note. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    // Update URL to indicate edit mode
    const url = new URL(window.location.href);
    url.searchParams.set('edit', 'true');
    router.replace(url.pathname + url.search);
    dispatch({ type: 'EDIT_MODE' });
  };

  const handleCancelEdit = () => {
    if (state.hasChanges) {
      if (!confirm("You have unsaved changes. Are you sure you want to discard them?")) {
        return;
      }
    }
    
    // Remove edit parameter from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('edit');
    router.replace(url.pathname + url.search);
    
    dispatch({ type: 'DISCARD_CHANGES' });
  };

  const handleSave = async () => {
    if (!titleRef.current?.innerText.trim()) {
      alert('Please enter a title for your note');
      return;
    }

    try {
      dispatch({ type: 'START_SAVE' });
      const title = titleRef.current?.innerText || '';
      const content = contentRef.current?.innerText || '';
      
      const payload = {
        title,
        content,
        user_id: userId
      };
      
      const response = await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/notes/${id}`, payload);
      
      if (response.data) {
        setNote(response.data);
      } else {
        setNote(prev => prev ? {...prev, title, content} : null);
      }
      
      refreshNotes();
      
      // Remove edit parameter from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('edit');
      router.replace(url.pathname + url.search);
      
      dispatch({ type: 'FINISH_SAVE' });
    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save note. Please try again.');
      dispatch({ type: 'FINISH_SAVE' });
    }
  };

  const handleContentChange = () => {
    dispatch({ type: 'CONTENT_CHANGED' });
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      return;
    }

    try {
      dispatch({ type: 'START_DELETE' });
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/notes/${id}?user_id=${userId}`
      );
      refreshNotes();
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Failed to delete note. Please try again.');
      dispatch({ type: 'FINISH_DELETE' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {loading ? (
        <div className="flex justify-center items-center h-[60vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      ) : note ? (
        <div className="relative">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
            asChild
          >
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>

          {/* Document */}
          <div className="bg-white rounded-lg overflow-hidden mt-4">
            {state.mode === 'view' ? (
              <ViewMode note={note} />
            ) : (
              <div className="p-4">
                <h3 className="text-xs text-gray-500 mb-1">Title</h3>
                <h1
                  ref={titleRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="text-3xl font-bold mb-4 outline-none border border-transparent focus:border-blue-300 rounded-md p-2"
                  onInput={handleContentChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      contentRef.current?.focus();
                    }
                  }}
                ></h1>

                <hr className="my-4 border-blue-100" />

                <h3 className="text-xs text-gray-500 mb-1">Content (Markdown)</h3>
                <div
                  ref={contentRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="outline-none border border-transparent focus:border-blue-300 rounded-md p-2 min-h-[60vh] font-mono text-sm whitespace-pre-wrap"
                  onInput={handleContentChange}
                  onKeyDown={(e) => applyMarkdownShortcuts(e, contentRef)}
                ></div>
              </div>
            )}
          </div>

          {/* Floating action buttons at top right */}
          <div className="fixed top-8 right-8 flex flex-col gap-3 z-40">
            {state.mode === 'view' ? (
              <>
                <Button
                  variant="default"
                  size="icon"
                  className="bg-blue-500 hover:bg-blue-600 text-white shadow-lg rounded-full h-14 w-14"
                  onClick={handleEdit}
                >
                  <Edit className="h-6 w-6" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-white text-red-500 border-red-500 hover:bg-red-50 shadow-lg rounded-full h-14 w-14"
                  onClick={handleDelete}
                  disabled={state.isDeleting}
                >
                  {state.isDeleting ? (
                    <div className="animate-spin h-6 w-6 border-2 border-red-500 rounded-full border-t-transparent"></div>
                  ) : (
                    <Trash className="h-6 w-6" />
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="default"
                  size="icon"
                  className="bg-blue-500 hover:bg-blue-600 text-white shadow-lg rounded-full h-14 w-14"
                  onClick={handleSave}
                  disabled={state.isSaving || !state.hasChanges}
                >
                  {state.isSaving ? (
                    <div className="animate-spin h-6 w-6 border-2 border-white rounded-full border-t-transparent"></div>
                  ) : (
                    <Save className="h-6 w-6" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-white text-gray-500 border-gray-300 hover:bg-gray-50 shadow-lg rounded-full h-14 w-14"
                  onClick={handleCancelEdit}
                >
                  <X className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center">
          <h2 className="text-xl font-medium text-gray-700">Note not found</h2>
          <p className="mt-2 text-gray-500">The note you're looking for doesn't exist or you don't have permission to view it.</p>
          <Button
            variant="outline"
            className="mt-4 border-blue-200 text-blue-500 hover:bg-blue-50"
            asChild
          >
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
} 



