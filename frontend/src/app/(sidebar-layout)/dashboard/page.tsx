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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import '@/styles/markdown-editor-custom.css';

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
    
    const handleEdit = (e: React.MouseEvent, note: Note) => {
        e.stopPropagation(); // Prevent triggering the card click
        router.push(`/notes/${note.id}`);
    };
    
    const handleDelete = async (e: React.MouseEvent, noteId: number) => {
        e.stopPropagation(); // Prevent triggering the card click
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
    
    const openNote = (noteId: number) => {
        router.push(`/notes/${noteId}`);
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
                    <div className="bg-blue-50 rounded-lg p-8 text-center">
                        <h3 className="text-lg font-medium text-gray-700">No notes found</h3>
                        <p className="mt-2 text-gray-500">Upload your first document to get started</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {notes.map((note) => (
                            <Card 
                                key={note.id} 
                                className="hover:shadow-md transition-shadow overflow-hidden flex flex-col google-docs-card cursor-pointer hover:border-blue-200"
                                onClick={() => openNote(note.id)}
                            >
                                <div className="flex flex-col h-full">
                                    <CardHeader className="pb-0 pt-2 px-4 flex items-start">
                                        <div className="flex items-center w-full">
                                            <div className="flex-1 min-w-0">
                                                <CardTitle className="truncate text-base font-medium">{note.title}</CardTitle>
                                            </div>
                                            <div className="flex space-x-1 ml-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={(e) => handleEdit(e, note)}
                                                    className="h-6 w-6 text-gray-500 hover:text-blue-500 z-10"
                                                >
                                                    <Edit className="h-3 w-3" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={(e) => handleDelete(e, note.id)}
                                                    className="h-6 w-6 text-gray-500 hover:text-red-500 z-10"
                                                    disabled={deletingNoteId === note.id}
                                                >
                                                    <Trash className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                        <CardDescription className="text-[10px] text-gray-500 mt-0.5">
                                            {note.updated_at 
                                                ? `Updated ${formatDistanceToNow(new Date(note.updated_at))} ago`
                                                : `Created ${formatDistanceToNow(new Date(note.created_at))} ago`
                                            }
                                        </CardDescription>
                                    </CardHeader>
                                    
                                    <CardContent className="flex-grow p-0 mt-1">
                                        <div className="docs-preview-wrapper">
                                            <div className="docs-preview">
                                                <div className="markdown-body prose-sm max-w-none px-4 document-content">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm, remarkMath]}
                                                        rehypePlugins={[rehypeKatex]}
                                                        components={{
                                                            h1: ({children}) => <h1 className="text-sm font-medium mt-2 mb-1">{children}</h1>,
                                                            h2: ({children}) => <h2 className="text-sm font-medium mt-2 mb-1">{children}</h2>,
                                                            h3: ({children}) => <h3 className="text-xs font-medium mt-1 mb-1">{children}</h3>,
                                                            p: ({children}) => <p className="text-xs my-1 leading-normal">{children}</p>,
                                                            ul: ({children}) => <ul className="text-xs pl-4 my-1">{children}</ul>,
                                                            ol: ({children}) => <ol className="text-xs pl-4 my-1">{children}</ol>,
                                                            li: ({children}) => <li className="text-xs my-0.5">{children}</li>,
                                                            blockquote: ({children}) => <blockquote className="text-xs italic border-l-2 border-blue-300 pl-2 my-1">{children}</blockquote>,
                                                            code: ({node, inline, className, children, ...props}: any) => {
                                                                return inline 
                                                                    ? <code className="bg-blue-50 px-1 py-0.5 rounded text-[10px] font-mono">{children}</code>
                                                                    : <code className="bg-blue-50 text-gray-800 p-1 block rounded text-[10px] font-mono my-1 max-h-[40px] overflow-hidden">{children}</code>
                                                            },
                                                            pre: ({children}) => <pre className="my-1 max-h-[40px] overflow-hidden">{children}</pre>,
                                                            img: () => <div className="text-[10px] text-gray-500 bg-blue-50 inline-block px-1 rounded">[Image]</div>,
                                                            table: () => <div className="text-[10px] text-gray-500 bg-blue-50 inline-block px-1 rounded">[Table]</div>,
                                                            a: ({href, children}) => <a href={href} onClick={(e) => e.stopPropagation()} className="text-blue-500 text-xs hover:underline">{children}</a>,
                                                        }}
                                                    >
                                                        {note.content.substring(0, 1000)}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                    
                                    <CardFooter className="flex justify-between items-center py-1 px-4 mt-auto">
                                        <div className="text-blue-500 hover:text-blue-700 transition-colors text-[10px] flex items-center">
                                            View full notes
                                            <ExternalLink className="ml-1 h-2 w-2" />
                                        </div>
                                    </CardFooter>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}