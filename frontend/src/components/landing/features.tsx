import { BookOpen, Brain, Layers, FileText, MessageSquareMore, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Features() {
    const features = [
        {
            title: "Handwriting Recognition",
            description: "Our AI accurately recognizes even messy handwriting",
            icon: <Brain className="w-6 h-6 text-blue-500" />
        },
        {
            title: "Structure Preservation",
            description: "Maintains headings, lists, and formatting from your original notes",
            icon: <Layers className="w-6 h-6 text-blue-500" />
        },
        {
            title: "Multiple Input Formats",
            description: "Upload PDFs, images, or scanned documents",
            icon: <FileText className="w-6 h-6 text-blue-500" />
        }
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -20 },
        visible: {
            opacity: 1,
            x: 0,
            transition: { duration: 0.5 }
        }
    };

    return (
        <section id="features" className="py-16 sm:py-24 bg-white w-full">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={containerVariants}
                        className="order-2 lg:order-1"
                    >
                        <motion.div 
                            variants={itemVariants}
                            className="bg-white rounded-xl shadow-lg p-6 mb-6 transform hover:scale-[1.02] transition-transform duration-300"
                        >
                            {/* Original Notes Preview */}
                            <div className="h-48 bg-gray-50 rounded-lg mb-4 p-4 font-handwriting text-gray-700">
                                <h3 className="text-lg mb-2 font-semibold">Chapter 3: Cell Biology</h3>
                                <p className="mb-2">- Mitochondria = powerhouse of cell</p>
                                <p className="mb-2">- Produces ATP through:</p>
                                <p className="ml-4">* Krebs cycle</p>
                                <p className="ml-4">* Electron transport chain</p>
                                <p className="mb-2">! Important for test: know the stages</p>
                            </div>
                        </motion.div>

                        <motion.div 
                            variants={itemVariants}
                            className="flex justify-center my-4"
                        >
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                                <FileText className="w-4 h-4 text-white" />
                            </div>
                        </motion.div>

                        <motion.div 
                            variants={itemVariants}
                            className="bg-white rounded-xl shadow-lg p-6 transform hover:scale-[1.02] transition-transform duration-300"
                        >
                            {/* Converted Notes Preview */}
                            <div className="space-y-2 font-mono text-sm text-gray-800">
                                <p className="font-semibold"># Chapter 3: Cell Biology</p>
                                <p>- Mitochondria = powerhouse of cell</p>
                                <p>- Produces ATP through:</p>
                                <p>&nbsp;&nbsp;* Krebs cycle</p>
                                <p>&nbsp;&nbsp;* Electron transport chain</p>
                                <p className="text-yellow-600">{'>'}Important for test: know the stages</p>
                            </div>
                        </motion.div>
                    </motion.div>

                    <motion.div 
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        variants={containerVariants}
                        className="order-1 lg:order-2"
                    >
                        <motion.div variants={itemVariants}>
                            <div className="inline-flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-full text-blue-600 font-medium mb-6">
                                <FileText className="w-4 h-4" />
                                Markdown Conversion
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                                Our technology converts your handwritten or typed notes into clean, structured markdown.
                            </h2>
                        </motion.div>
                        
                        <motion.div 
                            variants={containerVariants}
                            className="space-y-6"
                        >
                            {features.map((feature, index) => (
                                <motion.div
                                    key={index}
                                    variants={itemVariants}
                                    className="flex gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors duration-300"
                                >
                                    <div className="flex-shrink-0">
                                        {feature.icon}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
                                        <p className="text-gray-600">{feature.description}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}