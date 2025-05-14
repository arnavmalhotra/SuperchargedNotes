import Image from 'next/image';
import { Play } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Showcase() {
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
        <section id="showcase" className="py-16 sm:py-24 lg:py-32 bg-gray-50 w-full">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div 
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={containerVariants}
                    className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center"
                >
                    <motion.div variants={itemVariants}>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
                            See the transformation
                        </h2>
                        <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-xl">
                            Watch how our system accurately converts handwritten notes to perfectly formatted markdown in seconds.
                        </p>
                    </motion.div>

                    <motion.div 
                        variants={itemVariants}
                        whileHover={{ scale: 1.02 }}
                        className="bg-white p-4 sm:p-6 rounded-xl shadow-lg transition-transform duration-300"
                    >
                        <div className="aspect-w-16 aspect-h-9 bg-gray-100 rounded-lg overflow-hidden relative">
                            <video
                                className="w-full h-full object-cover"
                                controls
                                playsInline
                                preload="metadata"
                            >
                                <source src="/videos/demo.webm" type="video/webm" />
                                <source src="/videos/demo.mp4" type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                            <motion.div 
                                className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center"
                                initial={{ opacity: 1 }}
                                whileHover={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <motion.div
                                    whileHover={{ scale: 1.1 }}
                                    className="w-16 h-16 bg-white bg-opacity-90 rounded-full flex items-center justify-center cursor-pointer"
                                >
                                    <Play className="w-8 h-8 text-blue-500 ml-1" />
                                </motion.div>
                            </motion.div>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}