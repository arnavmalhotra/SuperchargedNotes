import { BookOpen, Brain, Layers, FileText, MessageSquareMore, CheckCircle2 } from 'lucide-react';

export default function Features() {
    const features = [
        {
            title: "Handwriting Recognition",
            description: "Our AI accurately recognizes even messy handwriting"
        },
        {
            title: "Structure Preservation",
            description: "Maintains headings, lists, and formatting from your original notes"
        },
        {
            title: "Multiple Input Formats",
            description: "Upload PDFs, images, or scanned documents"
        }
    ];

    return (
        <section id="features" className="py-24 bg-white">
            <div className="max-w-6xl mx-auto px-4">
                <div className="grid md:grid-cols-2 gap-16 items-center">
                    <div className="relative bg-blue-50 p-8 rounded-2xl">
                        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                            {/* Original Notes Preview */}
                            <div className="h-48 bg-gray-50 rounded-lg mb-4 p-4 font-handwriting text-gray-700">
                                <h3 className="text-lg mb-2 font-semibold">Chapter 3: Cell Biology</h3>
                                <p className="mb-2">- Mitochondria = powerhouse of cell</p>
                                <p className="mb-2">- Produces ATP through:</p>
                                <p className="ml-4">* Krebs cycle</p>
                                <p className="ml-4">* Electron transport chain</p>
                                <p className="mb-2">! Important for test: know the stages</p>
                            </div>
                        </div>
                        <div className="flex justify-center my-4">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                                <FileText className="w-4 h-4 text-white" />
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-lg p-6">
                            {/* Converted Notes Preview */}
                            <div className="space-y-2 font-mono text-sm text-gray-800">
                                <p className="font-semibold"># Chapter 3: Cell Biology</p>
                                <p>- Mitochondria = powerhouse of cell</p>
                                <p>- Produces ATP through:</p>
                                <p>&nbsp;&nbsp;* Krebs cycle</p>
                                <p>&nbsp;&nbsp;* Electron transport chain</p>
                                <p className="text-yellow-600">{'>'}Important for test: know the stages</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="inline-flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-full text-blue-600 font-medium mb-6">
                            <FileText className="w-4 h-4" />
                            Markdown Conversion
                        </div>
                        <h2 className="text-3xl font-bold mb-6">
                            Our technology converts your handwritten or typed notes into clean, structured markdown.
                        </h2>
                        <div className="space-y-6">
                            {features.map((feature, index) => (
                                <div key={index} className="flex gap-4">
                                    <div className="flex-shrink-0">
                                        <CheckCircle2 className="w-6 h-6 text-blue-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
                                        <p className="text-gray-600">{feature.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}