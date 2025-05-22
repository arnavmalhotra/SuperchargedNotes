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
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/mhchem';
import 'katex/contrib/mhchem'
import 'katex'
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
  rendered_question?: string;
  rendered_option_a?: string;
  rendered_option_b?: string;
  rendered_option_c?: string;
  rendered_option_d?: string;
  rendered_explanation?: string;
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

  const renderLatexContent = async (content: string): Promise<string> => {
    const preprocessContent = (content: string) => {
      return content
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
      return content;
    }
  };

  const processQuizQuestions = async (questions: QuizQuestion[]): Promise<QuizQuestion[]> => {
    return Promise.all(
      questions.map(async (q) => {
        const rendered_question = await renderLatexContent(q.question_text);
        const rendered_option_a = await renderLatexContent(q.option_a);
        const rendered_option_b = await renderLatexContent(q.option_b);
        const rendered_option_c = await renderLatexContent(q.option_c);
        const rendered_option_d = await renderLatexContent(q.option_d);
        const rendered_explanation = await renderLatexContent(q.explanation);
        
        return {
          ...q,
          rendered_question,
          rendered_option_a,
          rendered_option_b,
          rendered_option_c,
          rendered_option_d,
          rendered_explanation
        };
      })
    );
  };

  const fetchQuiz = async () => {
    if (!user?.id || !quizId) return;
    setLoading(true);
    setError(null);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/quizzes/${quizId}`, {
        headers: {
          'X-User-Id': user.id,
        }
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch quiz');
      }
      
      if (data.quiz) {
        const processedQuestions = await processQuizQuestions(data.quiz.quiz_questions);
        const processedQuiz = {
          ...data.quiz,
          quiz_questions: processedQuestions
        };
        setQuiz(processedQuiz);
      } else {
        setQuiz(null);
      }
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
                <div 
                  className="prose"
                  dangerouslySetInnerHTML={{ 
                    __html: question.rendered_question || question.question_text 
                  }}
                />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={userAnswers[question.id] || ''}
                onValueChange={(value) => handleAnswerSelect(question.id, value)}
                disabled={showResults}
              >
                <div className="space-y-3">
                  <div className="flex items-start">
                    <RadioGroupItem value="A" id={`q${question.id}-a`} className="mt-1" />
                    <Label
                      htmlFor={`q${question.id}-a`}
                      className={`ml-3 flex-1 ${showResults && question.correct_option === 'A' ? 'text-green-600 font-medium' : ''}`}
                    >
                      <div 
                        className="prose"
                        dangerouslySetInnerHTML={{ 
                          __html: question.rendered_option_a || question.option_a 
                        }}
                      />
                    </Label>
                    {showResults && question.correct_option === 'A' && (
                      <CheckCircle2 className="h-5 w-5 text-green-600 ml-1" />
                    )}
                  </div>
                  
                  <div className="flex items-start">
                    <RadioGroupItem value="B" id={`q${question.id}-b`} className="mt-1" />
                    <Label
                      htmlFor={`q${question.id}-b`}
                      className={`ml-3 flex-1 ${showResults && question.correct_option === 'B' ? 'text-green-600 font-medium' : ''}`}
                    >
                      <div 
                        className="prose"
                        dangerouslySetInnerHTML={{ 
                          __html: question.rendered_option_b || question.option_b 
                        }}
                      />
                    </Label>
                    {showResults && question.correct_option === 'B' && (
                      <CheckCircle2 className="h-5 w-5 text-green-600 ml-1" />
                    )}
                  </div>
                  
                  <div className="flex items-start">
                    <RadioGroupItem value="C" id={`q${question.id}-c`} className="mt-1" />
                    <Label
                      htmlFor={`q${question.id}-c`}
                      className={`ml-3 flex-1 ${showResults && question.correct_option === 'C' ? 'text-green-600 font-medium' : ''}`}
                    >
                      <div 
                        className="prose"
                        dangerouslySetInnerHTML={{ 
                          __html: question.rendered_option_c || question.option_c 
                        }}
                      />
                    </Label>
                    {showResults && question.correct_option === 'C' && (
                      <CheckCircle2 className="h-5 w-5 text-green-600 ml-1" />
                    )}
                  </div>
                  
                  <div className="flex items-start">
                    <RadioGroupItem value="D" id={`q${question.id}-d`} className="mt-1" />
                    <Label
                      htmlFor={`q${question.id}-d`}
                      className={`ml-3 flex-1 ${showResults && question.correct_option === 'D' ? 'text-green-600 font-medium' : ''}`}
                    >
                      <div 
                        className="prose"
                        dangerouslySetInnerHTML={{ 
                          __html: question.rendered_option_d || question.option_d 
                        }}
                      />
                    </Label>
                    {showResults && question.correct_option === 'D' && (
                      <CheckCircle2 className="h-5 w-5 text-green-600 ml-1" />
                    )}
                  </div>
                </div>
              </RadioGroup>
              
              {showResults && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md">
                  <div className="flex items-start">
                    <div className={`flex items-center ${userAnswers[question.id] === question.correct_option ? 'text-green-600' : 'text-red-600'}`}>
                      {userAnswers[question.id] === question.correct_option ? (
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                      ) : (
                        <AlertCircle className="h-5 w-5 mr-2" />
                      )}
                      <p className="font-medium">
                        {userAnswers[question.id] === question.correct_option ? 'Correct!' : `Incorrect. The correct answer is ${question.correct_option}.`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-700">Explanation:</p>
                    <div 
                      className="text-sm text-gray-600 mt-1 prose"
                      dangerouslySetInnerHTML={{ 
                        __html: question.rendered_explanation || question.explanation 
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {!showResults && (
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSubmitQuiz} disabled={Object.keys(userAnswers).length < quiz.quiz_questions.length}>
            Submit Quiz
          </Button>
        </div>
      )}
      
      <style jsx global>{`
        .katex {
          font-size: 1.1em !important;
        }
        
        .katex-display {
          margin: 1em 0 !important;
          overflow-x: auto;
          overflow-y: hidden;
        }
        
        .prose {
          max-width: 100% !important;
        }
      `}</style>
    </div>
  );
} 