import { Book, ArrowRight, CircleDot } from 'lucide-react';

export default function StudyMaterials() {
    return (
        <section id="study-materials" className="py-24">
            <div className="max-w-6xl mx-auto px-4">
                <div className="text-center mb-16">
                    <div className="inline-flex justify-center items-center w-16 h-16 bg-blue-600 rounded-full mb-6">
                        <Book className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-4xl font-bold mb-4">Generate Study Materials</h2>
                    <p className="text-xl text-gray-600">
                        Transform your converted notes into effective study materials with a single click
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Quizzes Card */}
                    <div className="bg-white rounded-2xl p-8 shadow-lg">
                        <h3 className="text-2xl font-bold mb-4">Quizzes</h3>
                        <p className="text-gray-600 mb-8">
                            Generate interactive quizzes from your notes to test your knowledge and reinforce learning.
                        </p>
                        <div className="bg-gray-50 rounded-xl p-6">
                            <div className="h-auto bg-blue-100 rounded-lg mb-4 p-4 text-gray-800">
                                What is the final product of glycolysis in cellular respiration?
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <CircleDot className="w-5 h-5 text-blue-200" />
                                    <div className="text-gray-600">Acetyl-CoA</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <CircleDot className="w-5 h-5 text-blue-600" />
                                    <div className="text-blue-600 font-medium">Pyruvate</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <CircleDot className="w-5 h-5 text-blue-200" />
                                    <div className="text-gray-600">ATP</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Flashcards Card */}
                    <div className="bg-white rounded-2xl p-8 shadow-lg">
                        <h3 className="text-2xl font-bold mb-4">Flashcards</h3>
                        <p className="text-gray-600 mb-8">
                            Create digital flashcards from key concepts in your notes for effective spaced repetition.
                        </p>
                        <div className="bg-gray-50 rounded-xl p-6">
                            <div className="bg-white rounded-lg p-6 shadow-sm">
                                <div className="space-y-4">
                                    <h4 className="text-lg font-semibold text-gray-800">Cellular Respiration</h4>
                                    <p className="text-gray-700">
                                        The process of cellular respiration includes three main stages:
                                    </p>
                                    <ul className="list-disc pl-5 text-gray-700 space-y-2">
                                        <li><strong>Glycolysis:</strong> Glucose → Pyruvate</li>
                                        <li><strong>Krebs Cycle:</strong> Pyruvate → CO₂</li>
                                        <li><strong>Electron Transport:</strong> NADH → ATP</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
} 