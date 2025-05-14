'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, BrainCircuit, Layers, Calendar, MoreHorizontal } from "lucide-react";
import { useUser } from '@clerk/nextjs';
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

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
}

export default function DashboardPage() {
  const { user } = useUser();
  const [stats, setStats] = useState<DashboardStats>({
    totalNotes: 0,
    totalQuizzes: 0,
    totalFlashcards: 0,
    allFiles: []
  });
  const [loading, setLoading] = useState(true);
  const [isCreatingFlashcards, setIsCreatingFlashcards] = useState<Record<string, boolean>>({});
  const [flashcardCreationError, setFlashcardCreationError] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const fetchDashboardStats = async () => {
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
        // Assuming file.id from dashboard maps to a noteId
        body: JSON.stringify({ noteId: fileId, userId: user.id }), 
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create flashcards');
      }

      console.log('Flashcards created successfully for file:', data.flashcardSet);
      // TODO: Potentially update totalFlashcards count here, or refetch stats

    } catch (err) {
      console.error(`Error creating flashcards for file ${fileId}:`, err);
      setFlashcardCreationError(prev => ({ ...prev, [fileId]: err instanceof Error ? err.message : 'An unknown error occurred' }));
    } finally {
      setIsCreatingFlashcards(prev => ({ ...prev, [fileId]: false }));
    }
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

      {/* All Files */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Your Files</h2>
        <div className="grid grid-cols-1 gap-4">
          {stats.allFiles.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-gray-500">
                No files found. Start by uploading your first document!
              </CardContent>
            </Card>
          ) : (
            stats.allFiles.map((file) => (
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
                        <DropdownMenuItem onSelect={() => console.log(`Create Quizzes for file ${file.id}`)}>
                          Create Quizzes
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {flashcardCreationError[file.id] && (
                    <p className="text-xs text-red-500 mt-1">Error: {flashcardCreationError[file.id]}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 line-clamp-2">{file.content}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

    </div>
  );
} 