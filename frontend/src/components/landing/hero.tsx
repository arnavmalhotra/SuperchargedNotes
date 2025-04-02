import Image from 'next/image';

export default function Hero() {
    return (
        <div id="hero" className="flex flex-col items-center justify-center min-h-screen px-4 py-8 md:py-16">
            <div className="text-center mb-8 md:mb-16">
                <h1 className="text-4xl md:text-6xl font-bold mb-4">Your Notes, <span className="text-blue-500">Supercharged</span></h1>
                <p className="text-lg md:text-xl text-gray-600">Convert your notes into flashcards, quizzes, and more.</p>
            </div>

            {/* Conversion Flow Visualization */}
            <div className="relative w-full max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-12">
                    {/* Notes Preview */}
                    <div className="w-full max-w-[320px] md:max-w-[400px] h-[400px] md:h-[500px] bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden flex-shrink-0 transform md:-rotate-6 hover:rotate-0 transition-transform duration-300">
                        <div className="h-10 bg-gray-100 border-b border-gray-200 flex items-center px-4">
                            <div className="flex gap-2">
                                <p className="text-sm font-medium text-gray-600">Handwritten Notes</p>
                            </div>
                        </div>
                        <div className="relative h-[calc(100%-2.5rem)] bg-[#fcfaf7] flex items-center justify-center">
                            <Image 
                                src="/note.png"
                                alt="Handwritten math notes"
                                fill
                                style={{ objectFit: 'cover', objectPosition: 'center' }}
                                className="p-2"
                                priority
                            />
                        </div>
                    </div>

                    {/* Arrow */}
                    <div className="flex-shrink-0 relative w-24 h-24 md:w-48 md:h-auto rotate-90 md:rotate-0">
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Image 
                                src="/arrow.png"
                                alt="Conversion arrow"
                                width={180}
                                height={90}
                                className="w-16 md:w-auto"
                                priority
                            />
                        </div>
                    </div>

                    {/* Markdown Preview */}
                    <div className="w-full max-w-[320px] md:max-w-[400px] h-[400px] md:h-[500px] bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden flex-shrink-0 transform md:rotate-6 hover:rotate-0 transition-transform duration-300">
                        <div className="h-10 bg-gray-100 border-b border-gray-200 flex items-center px-4">
                            <span className="text-sm font-medium text-gray-600">Converted Notes</span>
                        </div>
                        <div className="relative h-[calc(100%-2.5rem)]">
                            <Image 
                                src="/markdown.png"
                                alt="Converted markdown notes"
                                fill
                                style={{ objectFit: 'cover', objectPosition: 'center' }}
                                className="p-2"
                                priority
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}