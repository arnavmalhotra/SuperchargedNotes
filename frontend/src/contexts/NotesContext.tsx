'use client';

import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/nextjs';

interface Note {
    id: number;
    title: string;
    content: string;
    user_id: string;
    created_at: string;
    updated_at: string | null;
}

interface NotesContextType {
    notes: Note[];
    loading: boolean;
    addNote: (note: Note) => void;
    refreshNotes: () => Promise<void>;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export function NotesProvider({ children }: { children: ReactNode }) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const { userId } = useAuth();

    const refreshNotes = async () => {
        if (!userId) return;
        
        try {
            setLoading(true);
            const response = await axios.get(
                `${process.env.NEXT_PUBLIC_API_URL}/notes?user_id=${userId}`
            );
            setNotes(response.data);
        } catch (error) {
            console.error('Failed to fetch notes:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshNotes();
    }, [userId]);

    const addNote = (note: Note) => {
        setNotes(prevNotes => [note, ...prevNotes]);
    };

    return (
        <NotesContext.Provider value={{ notes, loading, addNote, refreshNotes }}>
            {children}
        </NotesContext.Provider>
    );
}

export function useNotes() {
    const context = useContext(NotesContext);
    if (context === undefined) {
        throw new Error('useNotes must be used within a NotesProvider');
    }
    return context;
} 