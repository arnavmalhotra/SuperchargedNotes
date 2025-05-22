'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingFlashcards, setIsCreatingFlashcards] = useState<Record<string, boolean>>({});
  const [flashcardCreationError, setFlashcardCreationError] = useState<Record<string, string | null>>({});
  const [isCreatingQuiz, setIsCreatingQuiz] = useState<Record<string, boolean>>({});
  const [quizCreationError, setQuizCreationError] = useState<Record<string, string | null>>({});
  
  // Preferences dialog state
  const [showFlashcardPreferences, setShowFlashcardPreferences] = useState(false);
  const [showQuizPreferences, setShowQuizPreferences] = useState(false);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  
  // Flashcard preferences
  const [flashcardCount, setFlashcardCount] = useState(10);
  const [flashcardDifficulty, setFlashcardDifficulty] = useState('medium');
  const [flashcardFocusTopic, setFlashcardFocusTopic] = useState('');
  
  // Quiz preferences
  const [quizQuestionCount, setQuizQuestionCount] = useState(5);
  const [quizDifficulty, setQuizDifficulty] = useState('medium');
  const [quizFocusTopic, setQuizFocusTopic] = useState('');

  const fetchNotes = async () => {
    if (!user?.id) {
      setError("User not authenticated");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseUrl) {
        throw new Error("API base URL is not configured.");
      }
      
      const response = await fetch(`${apiBaseUrl}/api/notes`, {
        headers: {
          'X-User-Id': user.id,
        }
      });
      
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

  useEffect(() => {
    if (user?.id) {
      fetchNotes();
    }
  }, [user]);

  const handleOpenNote = (noteId: string) => {
    router.push(`/notes/${noteId}`);
  };

  const handleDeleteNote = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation(); // Prevent note opening when deleting
    if (!window.confirm('Are you sure you want to delete this note and all its associated quizzes and flashcards?')) {
      return;
    }

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseUrl) {
        throw new Error("API base URL is not configured.");
      }
      
      const response = await fetch(`${apiBaseUrl}/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
          'X-User-Id': user?.id || '',
        }
      });
      
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete note');
      }
      // Re-fetch notes to update the list
      fetchNotes(); 
      // Optionally, you might want to show a success toast/notification here
      alert(data.message || 'Note deleted successfully');
      // Don't navigate away - we're already on the notes page
      // router.push('/');

    } catch (err) {
      console.error(`Error deleting note ${noteId}:`, err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while deleting the note');
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to delete note'}`);
    }
  };

  const handleCreateFlashcards = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation(); // Prevent note opening when creating flashcards
    if (!user?.id) {
      console.error("User not authenticated");
      setFlashcardCreationError(prev => ({ ...prev, [noteId]: "User not authenticated" }));
      return;
    }

    setIsCreatingFlashcards(prev => ({ ...prev, [noteId]: true }));
    setFlashcardCreationError(prev => ({ ...prev, [noteId]: null }));

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
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

      console.log('Flashcards created successfully:', data.flashcardSet);
      // Optionally, you can redirect or show a success message here
      // For now, just log and reset loading state

    } catch (err) {
      console.error(`Error creating flashcards for note ${noteId}:`, err);
      setFlashcardCreationError(prev => ({ ...prev, [noteId]: err instanceof Error ? err.message : 'An unknown error occurred' }));
    } finally {
      setIsCreatingFlashcards(prev => ({ ...prev, [noteId]: false }));
      setShowFlashcardPreferences(false); // Close the dialog
    }
  };

  const handleCreateQuiz = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation(); // Prevent note opening when creating quiz
    if (!user?.id) {
      console.error("User not authenticated");
      setQuizCreationError(prev => ({ ...prev, [noteId]: "User not authenticated" }));
      return;
    }

    setIsCreatingQuiz(prev => ({ ...prev, [noteId]: true }));
    setQuizCreationError(prev => ({ ...prev, [noteId]: null }));

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

      console.log('Quiz created successfully:', data.quizSet);
      // Optionally, you can redirect or show a success message here

    } catch (err) {
      console.error(`Error creating quiz for note ${noteId}:`, err);
      setQuizCreationError(prev => ({ ...prev, [noteId]: err instanceof Error ? err.message : 'An unknown error occurred' }));
    } finally {
      setIsCreatingQuiz(prev => ({ ...prev, [noteId]: false }));
      setShowQuizPreferences(false); // Close the dialog
    }
  };

  const openFlashcardPreferences = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent note opening when creating flashcards
    setCurrentNoteId(noteId);
    setShowFlashcardPreferences(true);
  };

  const openQuizPreferences = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent note opening when creating quiz
    setCurrentNoteId(noteId);
    setShowQuizPreferences(true);
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
            <Card 
              key={note.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleOpenNote(note.id)}
            >
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
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()} // Prevent note opening when clicking menu
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onSelect={(e) => handleDeleteNote(e as unknown as React.MouseEvent, note.id)}
                        className="text-red-600 hover:!text-red-600 hover:!bg-red-50"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Note
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {flashcardCreationError[note.id] && (
                  <p className="text-xs text-red-500 mt-1">Error creating flashcards: {flashcardCreationError[note.id]}</p>
                )}
                {quizCreationError[note.id] && (
                  <p className="text-xs text-red-500 mt-1">Error creating quiz: {quizCreationError[note.id]}</p>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 line-clamp-3 mb-4">{note.content}</p>
                <div className="flex gap-2 mt-3">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-grow text-xs py-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      openFlashcardPreferences(note.id, e);
                    }}
                    disabled={isCreatingFlashcards[note.id]}
                  >
                    {isCreatingFlashcards[note.id] ? 'Creating...' : 'Create Flashcards'}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="flex-grow text-xs py-1 text-purple-600 border-purple-300 hover:bg-purple-50" 
                    onClick={(e) => {
                      e.stopPropagation();
                      openQuizPreferences(note.id, e);
                    }}
                    disabled={isCreatingQuiz[note.id]}
                  >
                    {isCreatingQuiz[note.id] ? 'Creating...' : 'Create Quiz'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
              onClick={(e) => currentNoteId && handleCreateFlashcards(e, currentNoteId)} 
              disabled={!currentNoteId || isCreatingFlashcards[currentNoteId || '']}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {currentNoteId && isCreatingFlashcards[currentNoteId] ? 'Creating...' : 'Create Flashcards'}
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
              onClick={(e) => currentNoteId && handleCreateQuiz(e, currentNoteId)} 
              disabled={!currentNoteId || isCreatingQuiz[currentNoteId || '']}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {currentNoteId && isCreatingQuiz[currentNoteId] ? 'Creating...' : 'Create Quiz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
