'use client';

import { UserButton, SignOutButton } from '@clerk/nextjs';
import { Home, Book, Settings, LogOut, Upload, ChevronDown, ChevronRight, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/button';
import { useState } from 'react';

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
}

interface Note {
    id: string;
    title: string;
    href: string;
}

const dummyNotes: Note[] = [
    { id: '1', title: 'Math Notes', href: '/dashboard/notes/math' },
    { id: '2', title: 'Physics Notes', href: '/dashboard/notes/physics' },
    { id: '3', title: 'Chemistry Notes', href: '/dashboard/notes/chemistry' },
    { id: '4', title: 'Biology Notes', href: '/dashboard/notes/biology' },
];

const navItems: NavItem[] = [
    {
        label: 'Home',
        href: '/dashboard',
        icon: <Home className="w-4 h-4" />,
    },
];

export default function Sidebar() {
    const pathname = usePathname();
    const [isNotesOpen, setIsNotesOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <>
            <button
                className="lg:hidden fixed bottom-4 left-4 p-3 rounded-full bg-white shadow-lg hover:shadow-xl transition-shadow"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
                <Menu className="w-6 h-6 text-gray-700" />
            </button>

            <div className={`
                fixed inset-y-0 left-0 z-50 
                transform transition-transform duration-300 ease-in-out
                lg:relative lg:translate-x-0
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                flex h-full w-[250px] flex-col bg-white border-r
            `}>
                <div className="p-6">
                    <h2 className="text-xl font-bold text-gray-800">SuperchargedNotes</h2>
                </div>
                
                <div className="flex-1 px-4">
                    <nav className="space-y-2">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                        ${isActive 
                                            ? 'bg-gray-100 text-gray-900' 
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                >
                                    {item.icon}
                                    {item.label}
                                </Link>
                            );
                        })}
                        
                        <button
                            onClick={() => setIsNotesOpen(!isNotesOpen)}
                            className={`flex items-center justify-between w-full gap-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                ${pathname.startsWith('/dashboard/notes')
                                    ? 'bg-gray-100 text-gray-900'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center gap-x-3">
                                <Book className="w-4 h-4" />
                                Notes
                            </div>
                            {isNotesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        
                        {isNotesOpen && (
                            <div className="ml-6 space-y-1">
                                {dummyNotes.map((note) => (
                                    <Link
                                        key={note.id}
                                        href={note.href}
                                        className={`flex items-center gap-x-3 px-3 py-2 rounded-lg text-sm transition-colors
                                            ${pathname === note.href
                                                ? 'bg-gray-100 text-gray-900'
                                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                                            }`}
                                    >
                                        {note.title}
                                    </Link>
                                ))}
                            </div>
                        )}

                        <Button variant="ghost" className="bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors w-full justify-start">
                            <Upload className="w-4 h-4" />
                            Upload Notes
                        </Button>
                    </nav>
                </div>

                <div className="mt-auto p-4 border-t">
                    <div className="flex flex-col gap-y-2">
                        <Button 
                            variant="ghost" 
                            className="h-10 w-full justify-start text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            <Settings className="w-4 h-4 mr-2" />
                            Settings
                        </Button>
                        
                        <Button 
                            variant="ghost" 
                            className="h-10 w-full justify-start text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            <SignOutButton />
                        </Button>
                        
                        <Button 
                            variant="ghost" 
                            className="h-10 w-full justify-start text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            <UserButton showName={true} />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}
        </>
    );
} 