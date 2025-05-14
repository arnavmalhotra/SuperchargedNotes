'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MoreHorizontal } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export default function NotesPage() {
  const { user } = useUser();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingFlashcards, setIsCreatingFlashcards] = useState<Record<string, boolean>>({});
  const [flashcardCreationError, setFlashcardCreationError] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await fetch('/api/notes');
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || 'Failed to fetch notes');
        }

        setNotes(data.notes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch notes');
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, []);

  const handleCreateFlashcards = async (noteId: string) => {
    if (!user?.id) {
      console.error("User not authenticated");
      setFlashcardCreationError(prev => ({ ...prev, [noteId]: "User not authenticated" }));
      return;
    }

    setIsCreatingFlashcards(prev => ({ ...prev, [noteId]: true }));
    setFlashcardCreationError(prev => ({ ...prev, [noteId]: null }));

    try {
      const response = await fetch('/api/flashcards/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ noteId, userId: user.id }), 
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create flashcards');
      }

      console.log('Flashcards created successfully:', data.flashcardSet);
      // Optionally, you can redirect or show a success message here
      // For now, just log and reset loading state

    } catch (err) {
      console.error(`Error creating flashcards for note ${noteId}:`, err);
      setFlashcardCreationError(prev => ({ ...prev, [noteId]: err instanceof Error ? err.message : 'An unknown error occurred' }));
    } finally {
      setIsCreatingFlashcards(prev => ({ ...prev, [noteId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-8">My Notes</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Notes</h1>
      </div>
      
      {notes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No notes found. Create your first note to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map((note) => (
            <Card key={note.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{note.title}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(note.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onSelect={() => handleCreateFlashcards(note.id)}
                        disabled={isCreatingFlashcards[note.id]}
                      >
                        {isCreatingFlashcards[note.id] ? 'Creating...' : 'Create Flashcards'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => console.log(`Create Quizzes for note ${note.id}`)}>
                        Create Quizzes
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {flashcardCreationError[note.id] && (
                  <p className="text-xs text-red-500 mt-1">Error: {flashcardCreationError[note.id]}</p>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 line-clamp-3">{note.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
