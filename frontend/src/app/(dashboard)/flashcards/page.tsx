'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, PlusCircle, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface IndividualFlashcard {
  id: string;
  front: string;
  back: string;
  created_at: string;
}

interface FlashcardSet {
  id: string;
  title: string;
  created_at: string;
  note_id: string | null;
  individual_flashcards: IndividualFlashcard[];
}

export default function FlashcardsPage() {
  const { user } = useUser();
  const router = useRouter();
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlashcardSets = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseUrl) {
        throw new Error("API base URL is not configured.");
      }
      
      const response = await fetch(`${apiBaseUrl}/api/flashcards/list`, {
        headers: {
          'X-User-Id': user.id,
        }
      });
      
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch flashcard sets');
      }
      setFlashcardSets(data.flashcardSets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching flashcards.');
      console.error("Error fetching flashcard sets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) { // Ensure user is loaded before fetching
        fetchFlashcardSets();
    }
  }, [user]);

  const handleOpenFlashcardSet = (setId: string) => {
    router.push(`/flashcards/${setId}`);
  };

  const handleDeleteSet = async (e: React.MouseEvent, setId: string) => {
    e.stopPropagation(); // Prevent navigating when deleting
    if (!window.confirm('Are you sure you want to delete this flashcard set? This action cannot be undone.')) {
      return;
    }
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseUrl) {
        throw new Error("API base URL is not configured.");
      }
      
      const response = await fetch(`${apiBaseUrl}/api/flashcards/${setId}`, {
        method: 'DELETE',
        headers: {
          'X-User-Id': user?.id || '',
        }
      });
      
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete flashcard set');
      }
      alert(data.message || 'Flashcard set deleted successfully');
      // Refetch flashcard sets to update the UI
      fetchFlashcardSets();
    } catch (err) {
      console.error(`Error deleting flashcard set ${setId}:`, err);
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to delete flashcard set'}`);
    }
  };

  if (loading && !user) {
    return (
      <div className="container mx-auto p-6 text-center">
        <p>Loading user information...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Flashcard Sets</h1>
          <Button disabled><PlusCircle className="mr-2 h-4 w-4" /> Create New Set</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-white shadow rounded-lg">
              <CardHeader className="px-6 py-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="px-6 pt-0 pb-4">
                <Skeleton className="h-4 w-full mt-2" />
              </CardContent>
              <CardFooter className="px-6 py-4 border-t">
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Flashcard Sets</h1>
        </div>
        <Card className="bg-red-50 border-red-200 text-red-700">
            <CardHeader><CardTitle>Error</CardTitle></CardHeader>
            <CardContent><p>{error}</p></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Flashcard Sets</h1>
        <Button onClick={() => alert("Create new set from scratch - not yet implemented")} variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" /> Create New Set
        </Button>
      </div>

      {flashcardSets.length === 0 ? (
        <Card className="shadow">
          <CardContent className="p-10 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-gray-700">No Flashcard Sets Found</h3>
            <p className="text-gray-500">
              You haven't created any flashcard sets yet. <br/>
              Go to your notes or documents and use the menu to generate some!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {flashcardSets.map((set) => (
            <Card 
              key={set.id} 
              className="bg-white shadow hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleOpenFlashcardSet(set.id)}
            >
              <CardHeader>
                <CardTitle>{set.title}</CardTitle>
                <CardDescription>
                  {set.individual_flashcards.length} cards • Created on {new Date(set.created_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Set contains {set.individual_flashcards.length} flashcards.
                </p>
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-4">
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={(e) => handleDeleteSet(e, set.id)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                </Button>
                <div className="text-sm text-gray-500">
                  Click to open flashcards
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
