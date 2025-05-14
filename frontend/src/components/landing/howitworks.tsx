import { ArrowRight, Upload, Sparkles, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';

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
            transition: { duration: 0.5 }
        }
    };

    return (
        <section id="how-it-works" className="py-16 sm:py-24 lg:py-32 bg-white w-full">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={containerVariants}
                    className="text-center"
                >
                    <motion.h2 
                        variants={itemVariants}
                        className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4"
                    >
                        How It Works
                    </motion.h2>
                    <motion.p 
                        variants={itemVariants}
                        className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-16"
                    >
                        Our intelligent platform transforms your notes into powerful learning tools in three simple steps
                    </motion.p>
                </motion.div>

                <motion.div 
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={containerVariants}
                    className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 relative"
                >
                    {steps.map((step, index) => (
                        <motion.div 
                            key={index}
                            variants={itemVariants}
                            className="flex flex-col items-center text-center relative"
                        >
                            <motion.div 
                                whileHover={{ scale: 1.05 }}
                                className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6 shadow-md"
                            >
                                {step.icon}
                            </motion.div>
                            <h3 className="text-xl sm:text-2xl font-semibold mb-4">{step.title}</h3>
                            <p className="text-gray-600 max-w-xs mx-auto">{step.description}</p>
                            
                            {index < steps.length - 1 && (
                                <div className="hidden md:block absolute top-1/2 -translate-y-1/2 left-full -translate-x-1/2 w-12">
                                    <motion.div
                                        animate={{
                                            x: [0, 10, 0],
                                        }}
                                        transition={{
                                            duration: 1.5,
                                            repeat: Infinity,
                                            ease: "easeInOut"
                                        }}
                                    >
                                        <ArrowRight className="w-8 h-8 text-blue-300" />
                                    </motion.div>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}  