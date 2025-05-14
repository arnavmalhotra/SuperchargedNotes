'use client';

import { useEffect, useState, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Edit2, Save, Download, FilePlus } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import rehypeSanitize from 'rehype-sanitize';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export default function NoteDetailPage() {
  const { user } = useUser();
  const router = useRouter();
  const params = useParams();
  const noteId = params.id as string;
  const markdownRef = useRef<HTMLDivElement>(null);
  
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPdfExporting, setIsPdfExporting] = useState(false);

  const fetchNote = async () => {
    if (!user?.id || !noteId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/notes/${noteId}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch note');
      }
      setNote(data.note);
      setEditedTitle(data.note.title);
      setEditedContent(data.note.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching the note.');
      console.error("Error fetching note:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id && noteId) {
      fetchNote();
    }
  }, [user, noteId]);

  const handleBackToNotes = () => {
    router.push('/notes');
  };

  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
    if (!isEditing) {
      // Entering edit mode
      setEditedTitle(note?.title || '');
      setEditedContent(note?.content || '');
    }
  };

  const handleSave = async () => {
    if (!user?.id || !noteId) return;
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editedTitle,
          content: editedContent
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update note');
      }
      
      setNote(data.note);
      setIsEditing(false);
      
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'An unknown error occurred while saving the note.');
      console.error("Error saving note:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportToPdf = async () => {
    if (!markdownRef.current) return;
    
    setIsPdfExporting(true);
    
    try {
      const element = markdownRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 30;
      
      pdf.setFontSize(18);
      pdf.text(note?.title || 'Note', pdfWidth / 2, 15, { align: 'center' });
      
      pdf.addImage(
        imgData, 
        'JPEG', 
        imgX, 
        imgY, 
        imgWidth * ratio, 
        imgHeight * ratio
      );
      
      pdf.save(`${note?.title || 'note'}.pdf`);
    } catch (err) {
      console.error("Error exporting to PDF:", err);
      alert('Failed to export to PDF');
    } finally {
      setIsPdfExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="sm" onClick={handleBackToNotes} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-full mb-6" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="sm" onClick={handleBackToNotes} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <h1 className="text-3xl font-bold">Error</h1>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p>{error || 'Note not found'}</p>
        </div>
        <div className="mt-4">
          <Button onClick={handleBackToNotes}>Back to Notes</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={handleBackToNotes} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          {isEditing ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="text-3xl font-bold bg-gray-100 px-2 py-1 rounded w-full"
              placeholder="Note Title"
            />
          ) : (
            <h1 className="text-3xl font-bold">{note.title}</h1>
          )}
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={handleExportToPdf}
            disabled={isPdfExporting || isEditing}
          >
            <Download className="h-4 w-4 mr-2" /> 
            {isPdfExporting ? 'Exporting...' : 'Export PDF'}
          </Button>
          <Button 
            variant={isEditing ? "default" : "outline"} 
            onClick={isEditing ? handleSave : handleToggleEdit}
            disabled={isSaving}
          >
            {isEditing ? (
              <>
                <Save className="h-4 w-4 mr-2" /> 
                {isSaving ? 'Saving...' : 'Save'}
              </>
            ) : (
              <>
                <Edit2 className="h-4 w-4 mr-2" /> Edit
              </>
            )}
          </Button>
          {isEditing && (
            <Button variant="outline" onClick={handleToggleEdit}>
              Cancel
            </Button>
          )}
        </div>
      </div>
      
      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          <p>Error saving note: {saveError}</p>
        </div>
      )}
      
      <div className="mt-6">
        <div className="text-sm text-gray-500 mb-2">
          Last updated: {new Date(note.updated_at).toLocaleString()}
        </div>
        
        {isEditing ? (
          <div data-color-mode="light">
            <MDEditor
              value={editedContent}
              onChange={(value) => setEditedContent(value || '')}
              height={600}
              preview="edit"
              hideToolbar={false}
              enableScroll={true}
            />
          </div>
        ) : (
          <div 
            ref={markdownRef}
            className="prose prose-sm sm:prose lg:prose-lg max-w-none bg-white p-6 rounded-lg shadow-sm border"
          >
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeSanitize]}
            >
              {note.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
} 