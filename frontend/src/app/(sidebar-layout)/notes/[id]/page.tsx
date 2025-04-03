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

// Add a separate MarkdownView component for cleaner re-rendering
const MarkdownView = ({ content, keyValue }: { content: string, keyValue: number }) => {
  return (
    <ReactMarkdown 
      key={keyValue}
      remarkPlugins={[remarkGfm]}
    >
      {content}
    </ReactMarkdown>
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
      
      <hr className="my-4 border-gray-200" />
      
      <div className="prose max-w-none mt-4 p-2">
        {/* Use dangerouslySetInnerHTML first to convert markdown */}
        <div 
          style={{ display: 'none' }}
          dangerouslySetInnerHTML={{ __html: note.content.replace(/\n/g, '<br/>') }} 
        />
        {/* Then render with ReactMarkdown */}
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {note.content}
        </ReactMarkdown>
      </div>
    </>
  );
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <h3 className="text-lg font-medium text-gray-700">Note not found</h3>
            <p className="mt-2 text-gray-500">The note you're looking for doesn't exist or you don't have permission to view it.</p>
            <Button 
              onClick={() => router.push('/dashboard')}
              className="mt-4"
              variant="outline"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button 
            onClick={() => router.push('/dashboard')}
            variant="outline"
            size="sm"
            className="text-gray-600"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <Card className="p-6 shadow-sm">
          {isEditMode ? (
            <>
              <h1 
                ref={titleRef}
                contentEditable={true}
                onInput={handleContentChange}
                className="text-3xl font-bold text-gray-900 mb-2 outline-none border-b-2 border-transparent focus:border-blue-300 p-2"
                spellCheck={true}
                suppressContentEditableWarning={true}
              />
              
              <div className="text-sm text-gray-500 mb-4">
                {note.updated_at 
                  ? `Last updated: ${new Date(note.updated_at).toLocaleString()}`
                  : `Created: ${new Date(note.created_at).toLocaleString()}`
                }
                {state.hasChanges && <span className="ml-2 text-amber-500">(Unsaved changes)</span>}
              </div>
              
              <hr className="my-4 border-gray-200" />
              
              <div
                ref={contentRef}
                contentEditable={true}
                onInput={handleContentChange}
                className="prose max-w-none mt-4 outline-none min-h-[300px] p-2 focus:bg-gray-50 whitespace-pre-wrap"
                spellCheck={true}
                suppressContentEditableWarning={true}
              />
            </>
          ) : (
            // Use the separate view mode component with a key for forced re-renders
            <ViewMode note={note} key={`view-${note.id}-${isEditMode}-${Date.now()}`} />
          )}
        </Card>
      </div>

      {/* Floating action buttons */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-50">
        {state.mode === 'edit' ? (
          <>
            <Button 
              type="button"
              onClick={handleSave}
              variant="default"
              size="lg"
              className={`${state.hasChanges ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400'} text-white shadow-lg rounded-full h-14 w-14 p-0 flex items-center justify-center transition-all duration-200`}
              disabled={state.isSaving || !state.hasChanges}
              title="Save"
            >
              <Save className="w-6 h-6" />
            </Button>
            <Button 
              type="button"
              onClick={handleCancelEdit}
              variant="outline"
              size="lg"
              className="bg-white text-orange-500 border-orange-500 hover:bg-orange-50 shadow-lg rounded-full h-14 w-14 p-0 flex items-center justify-center transition-all duration-200"
              title="Cancel"
            >
              <X className="w-6 h-6" />
            </Button>
          </>
        ) : (
          <>
            <Button 
              type="button"
              onClick={handleEdit}
              variant="default"
              size="lg"
              className="bg-blue-500 hover:bg-blue-600 text-white shadow-lg rounded-full h-14 w-14 p-0 flex items-center justify-center transition-all duration-200"
              title="Edit"
            >
              <Edit className="w-6 h-6" />
            </Button>
            <Button 
              type="button"
              onClick={handleDelete}
              variant="outline"
              size="lg"
              className="bg-white text-red-500 border-red-500 hover:bg-red-50 shadow-lg rounded-full h-14 w-14 p-0 flex items-center justify-center transition-all duration-200"
              disabled={state.isDeleting}
              title="Delete"
            >
              <Trash className="w-6 h-6" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
} 



