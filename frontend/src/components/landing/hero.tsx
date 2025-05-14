import Image from 'next/image';
import { motion } from 'framer-motion';

export default function Hero() {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.3
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.5
            }
        }
    };

    return (
        <div id="hero" className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8 md:py-16 w-full max-w-[1400px] mx-auto">
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="w-full"
            >
                <motion.div 
                    variants={itemVariants}
                    className="text-center mb-8 md:mb-16"
                >
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-4">
                        Your Notes, <span className="text-blue-500">Supercharged</span>
                    </h1>
                    <p className="text-lg md:text-xl lg:text-2xl text-gray-600 max-w-2xl mx-auto">
                        Convert your notes into flashcards, quizzes, and more.
                    </p>
                </motion.div>

                {/* Conversion Flow Visualization */}
                <motion.div 
                    variants={itemVariants}
                    className="relative w-full max-w-5xl mx-auto px-4"
                >
                    <div className="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-12">
                        {/* Notes Preview */}
                        <motion.div 
                            whileHover={{ scale: 1.02, rotate: 0 }}
                            className="w-full max-w-[280px] sm:max-w-[320px] md:max-w-[400px] h-[300px] sm:h-[400px] md:h-[500px] bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden flex-shrink-0 transform md:-rotate-6 transition-all duration-300"
                        >
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
                        </motion.div>

                        <motion.div 
                            variants={itemVariants}
                            className="flex-shrink-0 relative w-16 h-16 md:w-24 md:h-24 rotate-90 md:rotate-0"
                        >
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Image 
                                    src="/arrow.png"
                                    alt="Conversion arrow"
                                    width={180}
                                    height={90}
                                    className="w-12 md:w-16 lg:w-24"
                                    priority
                                />
                            </div>
                        </motion.div>

                        {/* Markdown Preview */}
                        <motion.div 
                            whileHover={{ scale: 1.02, rotate: 0 }}
                            className="w-full max-w-[280px] sm:max-w-[320px] md:max-w-[400px] h-[300px] sm:h-[400px] md:h-[500px] bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden flex-shrink-0 transform md:rotate-6 transition-all duration-300"
                        >
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
                        </motion.div>
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}