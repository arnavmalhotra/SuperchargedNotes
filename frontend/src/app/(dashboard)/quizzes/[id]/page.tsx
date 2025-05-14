'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

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

export default function QuizDetail() {
  const { user } = useUser();
  const router = useRouter();
  const params = useParams();
  const quizId = params.id as string;
  
  const [quiz, setQuiz] = useState<QuizSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);

  const fetchQuiz = async () => {
    if (!user?.id || !quizId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/quizzes/${quizId}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch quiz');
      }
      setQuiz(data.quiz || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching the quiz.');
      console.error("Error fetching quiz:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id && quizId) {
      fetchQuiz();
    }
  }, [user, quizId]);

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleSubmitQuiz = () => {
    setShowResults(true);
  };

  const handleBackToList = () => {
    router.push('/quizzes');
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

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="sm" onClick={handleBackToList} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <h1 className="text-3xl font-bold">Loading Quiz...</h1>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4 mb-6" />
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-white shadow rounded-lg mb-6">
              <CardHeader className="px-6 py-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
              </CardHeader>
              <CardContent className="px-6 py-4">
                <div className="space-y-4">
                  {[...Array(4)].map((_, j) => (
                    <Skeleton key={j} className="h-10 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-end">
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !quiz) {
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
            <p>{error || 'Quiz not found'}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleBackToList}>Back to Quizzes</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const score = calculateScore(quiz.quiz_questions);
  
  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center mb-8">
        <Button variant="ghost" size="sm" onClick={handleBackToList} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <h1 className="text-3xl font-bold">{quiz.title}</h1>
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
        {quiz.quiz_questions.map((question, index) => (
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
          <Button onClick={handleSubmitQuiz} disabled={Object.keys(userAnswers).length < quiz.quiz_questions.length}>
            Submit Answers
          </Button>
        ) : (
          <Button onClick={handleBackToList}>
            Back to Quizzes
          </Button>
        )}
      </div>
    </div>
  );
} 