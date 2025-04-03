'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import axios from 'axios';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { useNotes } from '@/contexts/NotesContext';
import { Button } from '@/components/ui/button';
import { Edit, Trash, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Note {
    id: number;
    title: string;
    content: string;
    user_id: string;
    created_at: string;
    updated_at: string | null;
}

export default function DashboardPage() {
    const { notes, loading, refreshNotes } = useNotes();
    const { userId } = useAuth();
    const router = useRouter();
    const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);
    
    const handleEdit = (note: Note) => {
        router.push(`/notes/${note.id}`);
    };
    
    const handleDelete = async (noteId: number) => {
        if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
            return;
        }
        
        try {
            setDeletingNoteId(noteId);
            await axios.delete(
                `${process.env.NEXT_PUBLIC_API_URL}/notes/${noteId}?user_id=${userId}`
            );
            refreshNotes();
        } catch (error) {
            console.error('Failed to delete note:', error);
            alert('Failed to delete note. Please try again.');
        } finally {
            setDeletingNoteId(null);
        }
    };
    
    return (
        <div className="p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900">Your Notes</h1>
                <p className="mt-2 text-gray-600 mb-6">Review and manage your saved notes</p>
                
                {loading ? (
                    <div className="flex justify-center my-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : notes.length === 0 ? (
                    <div className="bg-gray-50 rounded-lg p-8 text-center">
                        <h3 className="text-lg font-medium text-gray-700">No notes found</h3>
                        <p className="mt-2 text-gray-500">Upload your first document to get started</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {notes.map((note) => (
                            <Card key={note.id} className="hover:shadow-md transition-shadow">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="truncate">{note.title}</CardTitle>
                                        <div className="flex space-x-1">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleEdit(note)}
                                                className="h-8 w-8 text-gray-500 hover:text-blue-500"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleDelete(note.id)}
                                                className="h-8 w-8 text-gray-500 hover:text-red-500"
                                                disabled={deletingNoteId === note.id}
                                            >
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <CardDescription>
                                        {note.updated_at 
                                            ? `Updated ${formatDistanceToNow(new Date(note.updated_at))} ago`
                                            : `Created ${formatDistanceToNow(new Date(note.created_at))} ago`
                                        }
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-gray-700 line-clamp-3">
                                        {note.content.replace(/#{1,6}|[*_~`]/g, '').substring(0, 150)}
                                        {note.content.length > 150 ? '...' : ''}
                                    </p>
                                </CardContent>
                                <CardFooter className="flex justify-between items-center">
                                    <Link 
                                        href={`/notes/${note.id}`} 
                                        className="text-blue-500 hover:text-blue-700 transition-colors text-sm flex items-center"
                                    >
                                        View full notes
                                        <ExternalLink className="ml-1 h-3 w-3" />
                                    </Link>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}