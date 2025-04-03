'use client';

import { UserButton, SignOutButton } from '@clerk/nextjs';
import { Home, Book, Settings, LogOut, Upload, ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/button';
import { useState } from 'react';
import { UploadModal } from './Sidebar/uploadmodal';
import { useNotes } from '@/contexts/NotesContext';

interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
}

interface Note {
    id: number;
    title: string;
    content: string;
    user_id: string;
    created_at: string;
    updated_at: string | null;
}

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
    const { notes, loading } = useNotes();

    return (
        <>
            {/* Hamburger menu - only show when menu is closed */}
            {!isMobileMenuOpen && (
                <button
                    className="lg:hidden fixed bottom-4 right-4 p-3 rounded-full bg-white shadow-lg hover:shadow-xl transition-shadow z-[60]"
                    onClick={() => setIsMobileMenuOpen(true)}
                >
                    <Menu className="w-6 h-6 text-blue-500" />
                </button>
            )}

            {/* Close button - only show when menu is open */}
            {isMobileMenuOpen && (
                <button
                    className="lg:hidden fixed bottom-4 right-4 p-3 rounded-full bg-white shadow-lg hover:shadow-xl transition-shadow z-[60]"
                    onClick={() => setIsMobileMenuOpen(false)}
                >
                    <X className="w-6 h-6 text-blue-500" />
                </button>
            )}

            <div className={`
                fixed inset-y-0 left-0 z-[55]
                transform transition-transform duration-300 ease-in-out
                lg:h-screen lg:translate-x-0 lg:w-[250px] 
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                flex flex-col bg-white border-r overflow-y-auto
            `}>
                <div className="p-6 flex-shrink-0">
                    <h2 className="text-xl font-bold text-blue-500">SuperchargedNotes</h2>
                </div>
                
                <div className="flex-1 px-4 overflow-y-auto">
                    <nav className="space-y-2">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                        ${isActive 
                                            ? 'bg-blue-50 text-blue-500' 
                                            : 'text-gray-600 hover:text-blue-500 hover:bg-blue-50'
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
                                ${pathname.startsWith('/dashboard/notes') || pathname.startsWith('/notes/')
                                    ? 'bg-blue-50 text-blue-500'
                                    : 'text-gray-600 hover:text-blue-500 hover:bg-blue-50'
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
                                {loading ? (
                                    <div className="px-3 py-2 text-sm text-gray-500">Loading notes...</div>
                                ) : notes.length === 0 ? (
                                    <div className="px-3 py-2 text-sm text-gray-500">No notes yet</div>
                                ) : (
                                    notes.map((note) => (
                                        <Link
                                            key={note.id}
                                            href={`/notes/${note.id}`}
                                            className={`flex items-center gap-x-3 px-3 py-2 rounded-lg text-sm transition-colors
                                                ${pathname === `/notes/${note.id}`
                                                    ? 'bg-blue-50 text-blue-500'
                                                    : 'text-gray-500 hover:text-blue-500 hover:bg-blue-50'
                                                }`}
                                        >
                                            {note.title}
                                        </Link>
                                    ))
                                )}
                            </div>
                        )}

                        <UploadModal />
                    </nav>
                </div>

                <div className="mt-auto p-4 border-t flex-shrink-0">
                    <div className="flex flex-col gap-y-2">
                        <Button 
                            variant="ghost" 
                            className="h-10 w-full justify-start text-gray-600 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            <Settings className="w-4 h-4 mr-2" />
                            Settings
                        </Button>
                        
                        <Button 
                            variant="ghost" 
                            className="h-10 w-full justify-start text-gray-600 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            <SignOutButton />
                        </Button>
                        
                        <Button 
                            variant="ghost" 
                            className="h-10 w-full justify-start text-gray-600 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            <UserButton showName={true} />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 z-[54] lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}
        </>
    );
} 