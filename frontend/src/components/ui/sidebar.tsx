'use client';

import { UserButton, useUser } from "@clerk/nextjs";
import { Home, BookOpen, BrainCircuit, Layers, MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UploadModal } from "@/components/dashboard/UploadModal";
import { Button } from "./button";
import { NotesProvider } from "@/contexts/NotesContext";
import { useRef, useCallback } from "react";

const Sidebar = () => {
  const { user } = useUser();
  const pathname = usePathname();
  const notesRef = useRef<{ fetchNotes: () => Promise<void> }>(null);

  const handleUploadSuccess = useCallback(() => {
    notesRef.current?.fetchNotes();
  }, []);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === path;
    }
    return pathname?.startsWith(path);
  };

  return (
    <NotesProvider refreshFunction={notesRef.current?.fetchNotes ?? (() => Promise.resolve())}>
      <div className="flex flex-col h-full w-64 bg-white border-r border-gray-200 shadow-sm">
        <div className="flex-1 p-4">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900">SuperchargedNotes</h2>
          </div>
          <nav className="space-y-2">
            <div className="flex justify-end w-full mb-4">
              <UploadModal onUploadSuccess={handleUploadSuccess} />
            </div>

            <Link 
              href="/dashboard" 
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors group
                ${isActive('/dashboard') 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'}`}
            >
              <Home size={20} className={isActive('/dashboard') 
                ? 'text-blue-500' 
                : 'text-gray-400 group-hover:text-blue-500'} />
              <span>Home</span>
            </Link>
            
            <Link 
              href="/notes" 
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors group
                ${isActive('/notes') 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'}`}
            >
              <BookOpen size={20} className={isActive('/notes') 
                ? 'text-blue-500' 
                : 'text-gray-400 group-hover:text-blue-500'} />
              <span>Notes</span>
            </Link>

            <Link 
              href="/quizzes" 
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors group
                ${isActive('/quizzes') 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'}`}
            >
              <BrainCircuit size={20} className={isActive('/quizzes') 
                ? 'text-blue-500' 
                : 'text-gray-400 group-hover:text-blue-500'} />
              <span>Quizzes</span>
            </Link>

            <Link 
              href="/flashcards" 
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors group
                ${isActive('/flashcards') 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'}`}
            >
              <Layers size={20} className={isActive('/flashcards') 
                ? 'text-blue-500' 
                : 'text-gray-400 group-hover:text-blue-500'} />
              <span>Flashcards</span>
            </Link>

            <Link 
              href="/chatbot" 
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors group
                ${isActive('/chatbot') 
                  ? 'bg-blue-50 text-blue-600' 
                  : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'}`}
            >
              <MessageSquare size={20} className={isActive('/chatbot') 
                ? 'text-blue-500' 
                : 'text-gray-400 group-hover:text-blue-500'} />
              <span>Chatbot</span>
            </Link>
          </nav>
        </div>
        
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center space-x-3">
            <UserButton afterSignOutUrl="/" />
            <span className="text-sm text-gray-600 font-medium">{user?.fullName || user?.username}</span>
          </div>
        </div>
      </div>
    </NotesProvider>
  );
};

export default Sidebar; 