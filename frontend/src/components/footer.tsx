'use client';

import { usePathname } from 'next/navigation';

export default function Footer() {
    const pathname = usePathname();
    const isHomePage = pathname === "/";
    const isSidebarLayout = pathname?.includes('/dashboard') || 
                           pathname?.includes('/forum') || 
                           pathname?.includes('/account') || 
                           pathname?.includes('/profile') ||
                           pathname?.includes('/settings') ||
                           pathname?.includes('/upload') ||
                           pathname?.includes('/calendar') ||
                           pathname?.includes('/chat') ||
                           pathname?.includes('/courses') ||
                           pathname?.includes('/onboarding');

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Minimal footer for non-home pages
    if (!isHomePage) {
        return (
            <footer className={`bg-white py-6 border-t border-gray-200 ${isSidebarLayout ? 'lg:pl-[250px]' : ''}`}>
                <div className="max-w-6xl mx-auto px-4">
                    <p className="text-center text-gray-500 text-sm">
                        © 2024 SuperchargedNotes. All rights reserved. Developed by{' '}
                        <a 
                            href="https://arnavmalhotra.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600 transition-colors"
                        >
                            Arnav Malhotra
                        </a>
                    </p>
                </div>
            </footer>
        );
    }

    // Full footer for the home page
    return (
        <footer className="bg-gradient-to-b from-white to-blue-50 py-16">
            <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-12">
                {/* Brand Section */}
                <div>
                    <h2 className="text-gray-900 text-2xl font-bold mb-4">SuperchargedNotes</h2>
                    <p className="text-gray-600">
                        Transforming study materials into powerful learning tools for students and educators.
                    </p>
                </div>

                {/* Quick Links */}
                <div>
                    <h3 className="text-gray-900 text-lg font-semibold mb-4">Quick Links</h3>
                    <ul className="space-y-3">
                        <li>
                            <button 
                                onClick={() => scrollToSection('hero')} 
                                className="text-gray-600 hover:text-blue-500 transition-colors cursor-pointer"
                            >
                                Home
                            </button>
                        </li>
                        <li>
                            <button 
                                onClick={() => scrollToSection('features')} 
                                className="text-gray-600 hover:text-blue-500 transition-colors cursor-pointer"
                            >
                                Features
                            </button>
                        </li>
                        <li>
                            <button 
                                onClick={() => scrollToSection('how-it-works')} 
                                className="text-gray-600 hover:text-blue-500 transition-colors cursor-pointer"
                            >
                                How It Works
                            </button>
                        </li>
                        <li>
                            <button 
                                onClick={() => scrollToSection('showcase')} 
                                className="text-gray-600 hover:text-blue-500 transition-colors cursor-pointer"
                            >
                                Showcase
                            </button>
                        </li>
                    </ul>
                </div>

                {/* Contact Section */}
                <div>
                    <h3 className="text-gray-900 text-lg font-semibold mb-4">Contact Us</h3>
                    <p className="text-gray-600 mb-3">Have questions or feedback? Reach out to us.</p>
                    <a 
                        href="mailto:support@superchargednotes.com" 
                        className="text-blue-500 hover:text-blue-600 transition-colors"
                    >
                        support@superchargednotes.com
                    </a>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="max-w-6xl mx-auto px-4 mt-12 pt-8 border-t border-gray-200">
                <p className="text-center text-gray-500 text-sm">
                    © 2024 SuperchargedNotes. All rights reserved. Developed by{' '}
                    <a 
                        href="https://arnavmalhotra.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600 transition-colors"
                    >
                        Arnav Malhotra
                    </a>
                </p>
            </div>
        </footer>
    );
} 