'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import axios from 'axios';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { useNotes } from '@/contexts/NotesContext';

interface Note {
    id: number;
    title: string;
    content: string;
    user_id: string;
    created_at: string;
    updated_at: string | null;
}

export default function DashboardPage() {
    const { notes, loading } = useNotes();
    
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
                                    <CardTitle className="truncate">{note.title}</CardTitle>
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
                                <CardFooter>
                                    <Link 
                                        href={`/notes/${note.id}`} 
                                        className="text-blue-500 hover:text-blue-700 transition-colors text-sm"
                                    >
                                        View full notes →
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