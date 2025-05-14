'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, BrainCircuit, Layers, Calendar, MoreHorizontal, Book, Search, Trash2 } from "lucide-react";
import { useUser } from '@clerk/nextjs';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [isCreatingFlashcards, setIsCreatingFlashcards] = useState<Record<string, boolean>>({});
  const [flashcardCreationError, setFlashcardCreationError] = useState<Record<string, string | null>>({});
  const [isCreatingQuiz, setIsCreatingQuiz] = useState<Record<string, boolean>>({});
  const [quizCreationError, setQuizCreationError] = useState<Record<string, string | null>>({});

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard/stats');
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const handleCreateFlashcards = async (fileId: string) => {
    if (!user?.id) {
      console.error("User not authenticated");
      setFlashcardCreationError(prev => ({ ...prev, [fileId]: "User not authenticated" }));
      return;
    }

    setIsCreatingFlashcards(prev => ({ ...prev, [fileId]: true }));
    setFlashcardCreationError(prev => ({ ...prev, [fileId]: null }));

    try {
      const response = await fetch('/api/flashcards/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ noteId: fileId, userId: user.id }), 
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
    }
  };

  const handleCreateQuiz = async (fileId: string) => {
    if (!user?.id) {
      console.error("User not authenticated");
      setQuizCreationError(prev => ({ ...prev, [fileId]: "User not authenticated" }));
      return;
    }

    setIsCreatingQuiz(prev => ({ ...prev, [fileId]: true }));
    setQuizCreationError(prev => ({ ...prev, [fileId]: null }));

    try {
      const response = await fetch('/api/quizzes/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ noteId: fileId, userId: user.id }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create quiz');
      }

      console.log('Quiz created successfully for file:', data.quizSet);
      fetchDashboardStats();

    } catch (err) {
      console.error(`Error creating quiz for file ${fileId}:`, err);
      setQuizCreationError(prev => ({ ...prev, [fileId]: err instanceof Error ? err.message : 'An unknown error occurred' }));
    } finally {
      setIsCreatingQuiz(prev => ({ ...prev, [fileId]: false }));
    }
  };

  const handleDeleteNoteOnDashboard = async (noteId: string) => {
    if (!window.confirm('Are you sure you want to delete this note and all its associated quizzes and flashcards? This will also refresh dashboard stats.')) {
      return;
    }
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
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
                      <div>
                        <CardTitle className="text-lg font-medium">{file.title}</CardTitle>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <Calendar className="h-4 w-4 mr-1.5" />
                          {new Date(file.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onSelect={() => handleCreateFlashcards(file.id)}
                            disabled={isCreatingFlashcards[file.id]}
                          >
                            {isCreatingFlashcards[file.id] ? 'Creating...' : 'Create Flashcards'}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onSelect={() => handleCreateQuiz(file.id)}
                            disabled={isCreatingQuiz[file.id]}
                          >
                            {isCreatingQuiz[file.id] ? 'Creating...' : 'Create Quizzes'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
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
                    {quizCreationError[file.id] && (
                      <p className="text-xs text-red-500 mt-1">Error creating quiz: {quizCreationError[file.id]}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 line-clamp-2">{file.content || ''}</p>
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
    </div>
  );
} 