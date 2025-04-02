import Image from 'next/image';
import { Play } from 'lucide-react';

export default function Showcase() {
    return (
        <section id="showcase" className="py-24">
            <div className="max-w-6xl mx-auto px-4">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-4xl font-bold mb-6">See the transformation</h2>
                        <p className="text-xl text-gray-600 mb-8">
                            Watch how our system accurately converts handwritten notes to perfectly formatted markdown in seconds.
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-lg">
                        <div className="aspect-w-16 aspect-h-9 bg-gray-100 rounded-lg overflow-hidden">
                            <video
                                className="w-full h-full object-cover min-h-[200px] min-w-[200px]"
                                controls
                                playsInline
                                preload="metadata"
                            >
                                <source src="/videos/demo.webm" type="video/webm" />
                                <source src="/videos/demo.mp4" type="video/mp4" />
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}