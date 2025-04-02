import { ArrowRight, Upload, Sparkles, BookOpen } from 'lucide-react';

export default function HowItWorks() {
    const steps = [
        {
            title: "Upload Notes",
            description: "Upload your handwritten or typed notes in various formats (PDF, JPG, PNG).",
            icon: <Upload className="w-8 h-8 text-blue-500" />
        },
        {
            title: "Automatic Conversion",
            description: "Our AI converts your notes to clean, formatted markdown with perfect accuracy.",
            icon: <Sparkles className="w-8 h-8 text-blue-500" />
        },
        {
            title: "Generate Study Materials",
            description: "Create quizzes, flashcards, and summaries from your converted notes.",
            icon: <BookOpen className="w-8 h-8 text-blue-500" />
        }
    ];

    return (
        <section id="how-it-works" className="py-24 sm:py-32 bg-white">
            <div className="max-w-6xl mx-auto px-4">
                <h2 className="text-4xl font-bold text-center mb-4">How It Works</h2>
                <p className="text-xl text-gray-600 text-center mb-16">
                    Our intelligent platform transforms your notes into powerful learning tools in three simple steps
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                    {steps.map((step, index) => (
                        <div key={index} className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                                {step.icon}
                            </div>
                            <h3 className="text-2xl font-semibold mb-4">{step.title}</h3>
                            <p className="text-gray-600">{step.description}</p>
                            
                            {index < steps.length - 1 && (
                                <div className="hidden md:block absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${(index + 1) * (100/3)}%` }}>
                                    <ArrowRight className="w-8 h-8 text-blue-300" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}  