'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, BrainCircuit, Layers, Calendar, MoreHorizontal, Book, Search, Trash2 } from "lucide-react";
import { useUser } from '@clerk/nextjs';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface DashboardStats {
  totalNotes: number;
  totalQuizzes: number;
  totalFlashcards: number;
  allFiles: Array<{
    id: string;
    title: string;
    content: string;
    created_at: string;
  }>;
  quizzes: Array<{
    id: string;
    title: string;
    created_at: string;
    questionCount: number;
  }>;
  flashcards: Array<{
    id: string;
    title: string;
    created_at: string;
    cardCount: number;
  }>;
}

export default function DashboardPage() {
  const { user } = useUser();
  const [stats, setStats] = useState<DashboardStats>({
    totalNotes: 0,
    totalQuizzes: 0,
    totalFlashcards: 0,
    allFiles: [],
    quizzes: [],
    flashcards: []
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [isCreatingFlashcards, setIsCreatingFlashcards] = useState<Record<string, boolean>>({});
  const [flashcardCreationError, setFlashcardCreationError] = useState<Record<string, string | null>>({});
  const [isCreatingQuiz, setIsCreatingQuiz] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string | null>>({});
  
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

  const fetchDashboardStats = async () => {
    if (!user?.id) {
      console.log("User not available yet for fetching stats.");
      return;
    }
    setLoading(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseUrl) {
        throw new Error("API base URL is not configured.");
      }
      const response = await fetch(`${apiBaseUrl}/api/dashboard/stats`, {
        method: 'GET',
        headers: {
          'X-User-Id': user.id,
        }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      } else {
        console.error('Error fetching dashboard stats:', data.message || 'Unknown error from backend');
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchDashboardStats();
    }
  }, [user]);

  const handleCreateFlashcards = async (fileId: string) => {
    if (!user?.id) {
      console.error("User not authenticated");
      setFlashcardCreationError(prev => ({ ...prev, [fileId]: "User not authenticated" }));
      return;
    }

    setIsCreatingFlashcards(prev => ({ ...prev, [fileId]: true }));
    setFlashcardCreationError(prev => ({ ...prev, [fileId]: null }));

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
          noteId: fileId, 
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

      console.log('Flashcards created successfully for file:', data.flashcardSet);
      fetchDashboardStats();

    } catch (err) {
      console.error(`Error creating flashcards for file ${fileId}:`, err);
      setFlashcardCreationError(prev => ({ ...prev, [fileId]: err instanceof Error ? err.message : 'An unknown error occurred' }));
    } finally {
      setIsCreatingFlashcards(prev => ({ ...prev, [fileId]: false }));
      setShowFlashcardPreferences(false); // Close the dialog
    }
  };

  const handleCreateQuiz = async (fileId: string) => {
    if (!user?.id) {
      console.error("User ID not found");
      return;
    }
    
    setIsCreatingQuiz(prev => ({ ...prev, [fileId]: true }));
    setError(prev => ({ ...prev, [fileId]: null }));
    
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/quizzes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id,
        },
        body: JSON.stringify({
          noteId: fileId,
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
      
      console.log('Quiz created successfully');
      // Refresh dashboard data
      fetchDashboardStats();
      
    } catch (err) {
      console.error(`Error creating quiz for file ${fileId}:`, err);
      setError(prev => ({
        ...prev,
        [fileId]: err instanceof Error ? err.message : 'An unknown error occurred'
      }));
    } finally {
      setIsCreatingQuiz(prev => ({ ...prev, [fileId]: false }));
      setShowQuizPreferences(false); // Close the dialog
    }
  };

  const handleDeleteNoteOnDashboard = async (noteId: string) => {
    if (!window.confirm('Are you sure you want to delete this note and all its associated quizzes and flashcards? This will also refresh dashboard stats.')) {
      return;
    }
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
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
      alert(data.message || 'Note deleted successfully');
      fetchDashboardStats();
    } catch (err) {
      console.error(`Error deleting note ${noteId} from dashboard:`, err);
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to delete note'}`);
    }
  };

  const filteredNotes = stats.allFiles.filter(file => 
    file.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (file.content && file.content.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const filteredQuizzes = stats.quizzes?.filter(quiz => 
    quiz.title.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];
  
  const filteredFlashcards = stats.flashcards?.filter(flashcard => 
    flashcard.title.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const openFlashcardPreferences = (fileId: string) => {
    setCurrentNoteId(fileId);
    setShowFlashcardPreferences(true);
  };

  const openQuizPreferences = (fileId: string) => {
    setCurrentNoteId(fileId);
    setShowQuizPreferences(true);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.firstName || 'Student'}!
        </h1>
        <p className="text-gray-600 mt-2">
          Here's an overview of your study materials
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Notes</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalNotes}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Quizzes Created</CardTitle>
            <BrainCircuit className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalQuizzes}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Flashcard Sets</CardTitle>
            <Layers className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFlashcards}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search notes, quizzes and flashcards..."
          className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Tabs for Notes, Quizzes, Flashcards */}
      <Tabs defaultValue="notes" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="notes" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="quizzes" className="flex items-center gap-1.5">
            <BrainCircuit className="h-4 w-4" />
            Quizzes
          </TabsTrigger>
          <TabsTrigger value="flashcards" className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            Flashcards
          </TabsTrigger>
        </TabsList>
        
        {/* Notes Tab */}
        <TabsContent value="notes">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Your Notes</h2>
          <div className="grid grid-cols-1 gap-4">
            {filteredNotes.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-gray-500">
                  {searchTerm ? "No notes matching your search." : "No notes found. Start by uploading your first document!"}
                </CardContent>
              </Card>
            ) : (
              filteredNotes.map((file) => (
                <Card key={file.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex flex-row items-start justify-between">
                      <Link href={`/notes/${file.id}`} className="flex-grow cursor-pointer">
                        <CardTitle className="text-lg font-medium">{file.title}</CardTitle>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <Calendar className="h-4 w-4 mr-1.5" />
                          {new Date(file.created_at).toLocaleDateString()}
                        </div>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onSelect={() => handleDeleteNoteOnDashboard(file.id)}
                            className="text-red-600 hover:!text-red-600 hover:!bg-red-50"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Note
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {flashcardCreationError[file.id] && (
                      <p className="text-xs text-red-500 mt-1">Error creating flashcards: {flashcardCreationError[file.id]}</p>
                    )}
                    {error[file.id] && (
                      <p className="text-xs text-red-500 mt-1">Error creating quiz: {error[file.id]}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Link href={`/notes/${file.id}`} className="cursor-pointer">
                      <p className="text-gray-600 line-clamp-2 mb-3">{file.content || ''}</p>
                    </Link>
                    <div className="flex gap-2 mt-3">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-grow text-xs py-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                        onClick={() => openFlashcardPreferences(file.id)} 
                        disabled={isCreatingFlashcards[file.id]}
                      >
                        {isCreatingFlashcards[file.id] ? 'Creating...' : 'Create Flashcards'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="flex-grow text-xs py-1 text-purple-600 border-purple-300 hover:bg-purple-50" 
                        onClick={() => openQuizPreferences(file.id)}
                        disabled={isCreatingQuiz[file.id]}
                      >
                        {isCreatingQuiz[file.id] ? 'Creating...' : 'Create Quiz'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
        
        {/* Quizzes Tab */}
        <TabsContent value="quizzes">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Your Quizzes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredQuizzes.length === 0 ? (
              <Card className="md:col-span-2 lg:col-span-3">
                <CardContent className="p-6 text-center text-gray-500">
                  {searchTerm ? "No quizzes matching your search." : "No quizzes found. Create one from your notes!"}
                </CardContent>
              </Card>
            ) : (
              filteredQuizzes.map((quiz) => (
                <Card key={quiz.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex flex-row items-start justify-between">
                      <CardTitle className="text-lg font-medium">{quiz.title}</CardTitle>
                      <BrainCircuit className="h-5 w-5 text-purple-500" />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {quiz.questionCount} {quiz.questionCount === 1 ? 'question' : 'questions'}
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center text-xs text-gray-500">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(quiz.created_at).toLocaleDateString()}
                      </div>
                      <Link href={`/quizzes/${quiz.id}`}>
                        <Button size="sm" variant="outline">
                          Start Quiz
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
        
        {/* Flashcards Tab */}
        <TabsContent value="flashcards">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Your Flashcard Sets</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFlashcards.length === 0 ? (
              <Card className="md:col-span-2 lg:col-span-3">
                <CardContent className="p-6 text-center text-gray-500">
                  {searchTerm ? "No flashcard sets matching your search." : "No flashcard sets found. Create one from your notes!"}
                </CardContent>
              </Card>
            ) : (
              filteredFlashcards.map((flashcard) => (
                <Card key={flashcard.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex flex-row items-start justify-between">
                      <CardTitle className="text-lg font-medium">{flashcard.title}</CardTitle>
                      <Layers className="h-5 w-5 text-green-500" />
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {flashcard.cardCount} {flashcard.cardCount === 1 ? 'card' : 'cards'}
                    </p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center text-xs text-gray-500">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(flashcard.created_at).toLocaleDateString()}
                      </div>
                      <Link href={`/flashcards/${flashcard.id}`}>
                        <Button size="sm" variant="outline">
                          Study Cards
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

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
              onClick={() => currentNoteId && handleCreateFlashcards(currentNoteId)} 
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
              onClick={() => currentNoteId && handleCreateQuiz(currentNoteId)} 
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