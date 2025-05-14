'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Trash2, Edit3, PlusCircle, BookOpen } from 'lucide-react'; 

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
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFlashcardSets = async () => {
      if (!user?.id) return;

      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/flashcards/list'); 
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

    if (user?.id) { // Ensure user is loaded before fetching
        fetchFlashcardSets();
    }
  }, [user]);

  const handleDeleteSet = async (setId: string) => {
    // Placeholder - TODO: Implement API call and UI update
    console.log("Delete set:", setId);
    alert("Delete functionality not yet implemented.");
  };

  const handleEditSet = (setId: string) => {
    // Placeholder - TODO: Implement navigation or modal
    console.log("Edit set:", setId);
    alert("Edit functionality not yet implemented.");
  };
  
  const handleStudySet = (setId: string) => {
    // Placeholder - TODO: Implement navigation to study interface
    console.log("Study set:", setId);
    alert("Study functionality not yet implemented.");
  };

  if (loading && !user) {
    return (
      <div className="container mx-auto p-6 text-center">
        <p>Loading user information...</p>
        {/* You could add a spinner here */}
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
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-white shadow rounded-lg">
              <CardHeader className="px-6 py-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/4" />
              </CardHeader>
              <CardContent className="px-6 pt-0 pb-4">
                <Skeleton className="h-10 w-full mt-2" />
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
        <Accordion type="single" collapsible className="w-full space-y-4">
          {flashcardSets.map((set) => (
            <AccordionItem value={set.id} key={set.id} className="bg-white shadow rounded-lg border-none">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-gray-50 rounded-t-lg">
                <div className="flex-1 text-left">
                  <h2 className="text-xl font-semibold text-gray-800">{set.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {set.individual_flashcards.length} cards - Created on {new Date(set.created_at).toLocaleDateString()}
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pt-0 pb-4 bg-white rounded-b-lg">
                {set.individual_flashcards.length > 0 ? (
                  <div className="space-y-3 mt-4">
                    {set.individual_flashcards.map((card, index) => (
                      <Card key={card.id} className="bg-gray-50 border border-gray-200">
                        <CardHeader className="pb-2 pt-3 px-4">
                           <CardTitle className="text-sm font-medium text-blue-700">Card {index + 1}</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-3 space-y-1">
                          <div>
                            <p className="font-semibold text-gray-700 text-xs">FRONT</p>
                            <p className="text-gray-800">{card.front}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-700 text-xs">BACK</p>
                            <p className="text-gray-800">{card.back}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 mt-4">This set has no flashcards.</p>
                )}
                <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end space-x-2">
                  <Button variant="default" size="sm" onClick={() => handleStudySet(set.id)}>
                    <BookOpen className="mr-2 h-4 w-4" /> Study Set
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEditSet(set.id)}>
                    <Edit3 className="mr-1.5 h-4 w-4" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteSet(set.id)}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
