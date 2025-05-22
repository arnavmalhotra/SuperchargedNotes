'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowLeftCircle, ArrowRightCircle, RotateCcw } from 'lucide-react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/mhchem';

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

export default function FlashcardDetail() {
  const { user } = useUser();
  const router = useRouter();
  const params = useParams();
  const flashcardSetId = params.id as string;
  
  const [flashcardSet, setFlashcardSet] = useState<FlashcardSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showingFront, setShowingFront] = useState(true);
  const [renderedFront, setRenderedFront] = useState('');
  const [renderedBack, setRenderedBack] = useState('');

  // Function to preprocess and render content with LaTeX
  const renderLatexContent = async (content: string): Promise<string> => {
    // Preprocess content to properly handle chemical equations
    const preprocessContent = (content: string) => {
      return content
        // Wrap inline chemical equations in math delimiters if they aren't already
        .replace(/(?<!\$)\\ce\{([^}]+)\}(?!\$)/g, '$\\ce{$1}$');
    };

    const preprocessedContent = preprocessContent(content);

    try {
      const file = await unified()
        .use(remarkParse)
        .use(remarkMath)
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeRaw)
        .use(rehypeKatex, { strict: false })
        .use(rehypeStringify, { allowDangerousHtml: true })
        .process(preprocessedContent);
        
      return String(file);
    } catch (err) {
      console.error('Error rendering LaTeX content:', err);
      return content; // Fallback to original content if rendering fails
    }
  };

  // Render the current card content when it changes
  useEffect(() => {
    if (flashcardSet && flashcardSet.individual_flashcards.length > 0) {
      const currentCard = flashcardSet.individual_flashcards[currentCardIndex];
      renderLatexContent(currentCard.front).then(setRenderedFront);
      renderLatexContent(currentCard.back).then(setRenderedBack);
    }
  }, [flashcardSet, currentCardIndex]);

  const fetchFlashcardSet = async () => {
    if (!user?.id || !flashcardSetId) return;
    setLoading(true);
    setError(null);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!apiBaseUrl) {
        throw new Error("API base URL is not configured.");
      }
      
      const response = await fetch(`${apiBaseUrl}/api/flashcards/${flashcardSetId}`, {
        headers: {
          'X-User-Id': user.id,
        }
      });
      
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch flashcard set');
      }
      setFlashcardSet(data.flashcardSet || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching the flashcard set.');
      console.error("Error fetching flashcard set:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id && flashcardSetId) {
      fetchFlashcardSet();
    }
  }, [user, flashcardSetId]);

  const handleBackToList = () => {
    router.push('/flashcards');
  };

  const handleFlipCard = () => {
    setShowingFront(!showingFront);
  };

  const handleNextCard = () => {
    if (flashcardSet && currentCardIndex < flashcardSet.individual_flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setShowingFront(true);
    }
  };

  const handlePreviousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setShowingFront(true);
    }
  };

  const handleRestart = () => {
    setCurrentCardIndex(0);
    setShowingFront(true);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="sm" onClick={handleBackToList} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <h1 className="text-3xl font-bold">Loading Flashcards...</h1>
        </div>
        <div className="flex flex-col items-center justify-center">
          <Card className="w-full max-w-2xl h-80 shadow-lg">
            <CardContent className="flex items-center justify-center h-full">
              <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
          <div className="flex justify-between w-full max-w-2xl mt-6">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !flashcardSet) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="sm" onClick={handleBackToList} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <h1 className="text-3xl font-bold">Error</h1>
        </div>
        <Card className="bg-red-50 border-red-200 text-red-700">
          <CardHeader><CardTitle>Error</CardTitle></CardHeader>
          <CardContent>
            <p>{error || 'Flashcard set not found'}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleBackToList}>Back to Flashcards</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // If no cards in the set
  if (flashcardSet.individual_flashcards.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="sm" onClick={handleBackToList} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <h1 className="text-3xl font-bold">{flashcardSet.title}</h1>
        </div>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader><CardTitle>No Flashcards</CardTitle></CardHeader>
          <CardContent>
            <p>This flashcard set doesn't contain any cards yet.</p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleBackToList}>Back to Flashcards</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const currentCard = flashcardSet.individual_flashcards[currentCardIndex];
  
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center mb-8">
        <Button variant="ghost" size="sm" onClick={handleBackToList} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-3xl font-bold">{flashcardSet.title}</h1>
      </div>
      
      <div className="flex flex-col items-center justify-center">
        <div className="mb-4 text-center">
          <p className="text-gray-600">
            Card {currentCardIndex + 1} of {flashcardSet.individual_flashcards.length}
          </p>
        </div>
        
        <Card 
          className="w-full max-w-2xl h-80 shadow-lg cursor-pointer transition-all duration-300 ease-in-out hover:shadow-xl"
          onClick={handleFlipCard}
        >
          <CardContent className="flex items-center justify-center h-full p-6">
            <div className="text-center w-full">
              <p className="text-sm text-gray-500 uppercase mb-4">
                {showingFront ? 'FRONT' : 'BACK'}
              </p>
              <div 
                className="text-xl prose max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: showingFront ? renderedFront : renderedBack 
                }} 
              />
              <p className="text-gray-400 text-sm mt-6 italic">Click to flip</p>
            </div>
          </CardContent>
        </Card>
        
        <div className="flex justify-between w-full max-w-2xl mt-6">
          <Button 
            variant="outline" 
            onClick={handlePreviousCard}
            disabled={currentCardIndex === 0}
          >
            <ArrowLeftCircle className="h-4 w-4 mr-2" /> Previous
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleRestart}
            disabled={currentCardIndex === 0 && showingFront}
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Restart
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleNextCard}
            disabled={currentCardIndex === flashcardSet.individual_flashcards.length - 1}
          >
            Next <ArrowRightCircle className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
      
      <style jsx global>{`
        .katex {
          font-size: 1.1em !important;
        }
        
        .katex-display {
          margin: 1em 0 !important;
          overflow-x: auto;
          overflow-y: hidden;
        }
      `}</style>
    </div>
  );
} 