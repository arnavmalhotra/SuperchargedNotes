'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Trash2, PlusCircle, BookOpen, CheckCircle2, AlertCircle } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';

interface QuizQuestion {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  created_at: string;
}

interface QuizSet {
  id: string;
  title: string;
  created_at: string;
  note_id: string | null;
  quiz_questions: QuizQuestion[];
}

export default function QuizzesPage() {
  const { user } = useUser();
  const router = useRouter();
  const [quizSets, setQuizSets] = useState<QuizSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for tracking answers and active quiz
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);

  const fetchQuizSets = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/quizzes/list`, {
        headers: {
          'X-User-Id': user.id,
        }
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch quiz sets');
      }
      setQuizSets(data.quizSets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching quizzes.');
      console.error("Error fetching quiz sets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchQuizSets();
    }
  }, [user]);

  const handleStartQuiz = (quizId: string) => {
    setActiveQuizId(quizId);
    setUserAnswers({});
    setShowResults(false);
  };

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleSubmitQuiz = () => {
    setShowResults(true);
  };

  const handleOpenQuiz = (quizId: string) => {
    router.push(`/quizzes/${quizId}`);
  };

  const handleDeleteQuiz = async (e: React.MouseEvent, quizId: string) => {
    e.stopPropagation(); // Prevent navigating when deleting
    if (!window.confirm('Are you sure you want to delete this quiz set? This action cannot be undone.')) {
      return;
    }
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/quizzes/${quizId}`, {
        method: 'DELETE',
        headers: {
          'X-User-Id': user.id,
        }
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete quiz set');
      }
      alert(data.message || 'Quiz set deleted successfully');
      // Refetch quiz sets to update the UI
      fetchQuizSets();
    } catch (err) {
      console.error(`Error deleting quiz set ${quizId}:`, err);
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to delete quiz set'}`);
    }
  };

  const calculateScore = (questions: QuizQuestion[]) => {
    if (!showResults) return null;
    
    let correct = 0;
    let total = questions.length;
    
    questions.forEach(q => {
      if (userAnswers[q.id] === q.correct_option) {
        correct++;
      }
    });
    
    return {
      correct,
      total,
      percentage: total > 0 ? Math.round((correct / total) * 100) : 0
    };
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
          <h1 className="text-3xl font-bold">My Quizzes</h1>
          <Button disabled><PlusCircle className="mr-2 h-4 w-4" /> Create New Quiz</Button>
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
          <h1 className="text-3xl font-bold">My Quizzes</h1>
        </div>
        <Card className="bg-red-50 border-red-200 text-red-700">
          <CardHeader><CardTitle>Error</CardTitle></CardHeader>
          <CardContent><p>{error}</p></CardContent>
        </Card>
      </div>
    );
  }

  // If a quiz is active, display the quiz interface
  if (activeQuizId) {
    const activeQuiz = quizSets.find(quiz => quiz.id === activeQuizId);
    
    if (!activeQuiz) {
      return (
        <div className="container mx-auto p-6">
          <Card className="bg-red-50 border-red-200 text-red-700">
            <CardHeader><CardTitle>Error</CardTitle></CardHeader>
            <CardContent><p>Quiz not found. Please try again.</p></CardContent>
            <CardFooter>
              <Button onClick={() => setActiveQuizId(null)}>Back to Quizzes</Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    const score = calculateScore(activeQuiz.quiz_questions);
    
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">{activeQuiz.title}</h1>
          <Button variant="outline" onClick={() => setActiveQuizId(null)}>
            Back to Quizzes
          </Button>
        </div>
        
        {showResults && score && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Quiz Results</CardTitle>
              <CardDescription>
                You scored {score.correct} out of {score.total} ({score.percentage}%)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={score.percentage} className="h-2 mb-2" />
              <p className="text-sm text-gray-500">
                {score.percentage >= 80 ? 'Great job!' : 
                 score.percentage >= 60 ? 'Good effort!' : 
                 'Keep studying!'}
              </p>
            </CardContent>
          </Card>
        )}
        
        <div className="space-y-6">
          {activeQuiz.quiz_questions.map((question, index) => (
            <Card key={question.id} className="bg-white shadow">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-start gap-2">
                  <span className="inline-block min-w-6">Q{index + 1}.</span>
                  <span className="flex-1">{question.question_text}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2">
                <RadioGroup
                  value={userAnswers[question.id] || ''}
                  onValueChange={(value) => handleAnswerSelect(question.id, value)}
                  disabled={showResults}
                  className="space-y-3"
                >
                  {['A', 'B', 'C', 'D'].map((option) => {
                    const optionText = question[`option_${option.toLowerCase()}` as keyof QuizQuestion] as string;
                    const isSelected = userAnswers[question.id] === option;
                    const isCorrect = question.correct_option === option;
                    
                    // Styles for showing correct/incorrect after submission
                    let optionClassName = "flex items-start space-x-2 border p-3 rounded-md";
                    if (showResults) {
                      if (isCorrect) {
                        optionClassName += " bg-green-50 border-green-200";
                      } else if (isSelected && !isCorrect) {
                        optionClassName += " bg-red-50 border-red-200";
                      }
                    } else if (isSelected) {
                      optionClassName += " bg-blue-50 border-blue-200";
                    } else {
                      optionClassName += " hover:bg-gray-50";
                    }
                    
                    return (
                      <div key={option} className={optionClassName}>
                        <RadioGroupItem value={option} id={`${question.id}-${option}`} className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor={`${question.id}-${option}`} className="flex items-start cursor-pointer">
                            <span className="font-medium min-w-4">{option}.</span>
                            <span className="ml-1">{optionText}</span>
                            {showResults && isCorrect && (
                              <CheckCircle2 className="h-4 w-4 text-green-500 ml-2 mt-1 flex-shrink-0" />
                            )}
                            {showResults && isSelected && !isCorrect && (
                              <AlertCircle className="h-4 w-4 text-red-500 ml-2 mt-1 flex-shrink-0" />
                            )}
                          </Label>
                        </div>
                      </div>
                    );
                  })}
                </RadioGroup>
                
                {showResults && (
                  <div className="mt-4 text-sm border-t pt-3 border-gray-100">
                    <p className="font-semibold">Explanation:</p>
                    <p className="text-gray-700">{question.explanation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="mt-8 flex justify-end">
          {!showResults ? (
            <Button onClick={handleSubmitQuiz} disabled={Object.keys(userAnswers).length < activeQuiz.quiz_questions.length}>
              Submit Answers
            </Button>
          ) : (
            <Button onClick={() => setActiveQuizId(null)}>
              Back to Quizzes
            </Button>
          )}
        </div>
      </div>
    );
  }
  
  // Default view of all quiz sets
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Quizzes</h1>
        <Button onClick={() => alert("Create new quiz from scratch - not yet implemented")} variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" /> Create New Quiz
        </Button>
      </div>

      {quizSets.length === 0 ? (
        <Card className="shadow">
          <CardContent className="p-10 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-gray-700">No Quizzes Found</h3>
            <p className="text-gray-500">
              You haven't created any quizzes yet. <br/>
              Go to your notes or documents and use the menu to generate some!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizSets.map((quiz) => (
            <Card 
              key={quiz.id} 
              className="bg-white shadow hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleOpenQuiz(quiz.id)}
            >
              <CardHeader>
                <CardTitle>{quiz.title}</CardTitle>
                <CardDescription>
                  {quiz.quiz_questions.length} questions • Created on {new Date(quiz.created_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  {quiz.quiz_questions.length} multiple choice questions on this topic.
                </p>
              </CardContent>
              <CardFooter className="flex justify-between border-t pt-4">
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={(e) => handleDeleteQuiz(e, quiz.id)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                </Button>
                <div className="text-sm text-gray-500">
                  Click to open quiz
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 