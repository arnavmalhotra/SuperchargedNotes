import { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { NotesProvider } from '@/contexts/NotesContext';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const Notes = forwardRef((props, ref) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/notes');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch notes');
      }

      setNotes(data.notes);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch notes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    fetchNotes
  }));

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const NotesContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-red-600 p-4">
          {error}
        </div>
      );
    }

    if (notes.length === 0) {
      return (
        <div className="text-center text-gray-500 p-4">
          No notes found. Upload some files to get started!
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {notes.map((note) => (
          <div
            key={note.id}
            className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <FileText className="w-5 h-5 text-blue-500 mr-2" />
                <h3 className="font-medium text-gray-900 truncate">
                  {note.title}
                </h3>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600 line-clamp-3">
              {note.content}
            </p>
            <div className="mt-4 text-xs text-gray-500">
              Created {formatDistanceToNow(new Date(note.created_at))} ago
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <NotesProvider refreshFunction={fetchNotes}>
      <NotesContent />
    </NotesProvider>
  );
}); 