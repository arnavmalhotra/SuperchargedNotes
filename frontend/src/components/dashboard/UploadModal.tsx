'use client';

import { useState, useCallback } from 'react';
import { Upload, X, Loader2 } from "lucide-react"
import { useDropzone } from 'react-dropzone';
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useNotes } from '@/contexts/NotesContext';
import { useUser } from '@clerk/nextjs';

interface UploadModalProps {
  onUploadSuccess?: () => void;
}

// Add a utility function to truncate filenames
const truncateFilename = (filename: string, maxLength: number = 20): string => {
  if (filename.length <= maxLength) return filename;
  
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return filename.slice(0, maxLength - 3) + '...';
  }
  
  const name = filename.slice(0, lastDotIndex);
  const extension = filename.slice(lastDotIndex);
  
  // Ensure we have at least 1 character of the name
  const nameLength = Math.max(1, maxLength - extension.length - 3);
  return name.slice(0, nameLength) + '...' + extension;
};

export function UploadModal({ onUploadSuccess }: UploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [groupFiles, setGroupFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const { refreshNotes } = useNotes();
  const { user } = useUser();

  const resetState = () => {
    setFiles([]);
    setGroupFiles(false);
    setError(null);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const removeFile = (fileToRemove: File) => {
    setFiles(files.filter(file => file !== fileToRemove));
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    multiple: true
  });

  const handleUpload = async () => {
    try {
      setIsUploading(true);
      setError(null);
      
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      formData.append('groupFiles', groupFiles.toString());

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/upload`, {
        method: 'POST',
        headers: {
          'X-User-Id': user?.id || '',
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Upload failed');
      }

      // Close modal and reset state on success
      setIsOpen(false);
      resetState();
      
      // Call both the local success callback and refresh the global notes list
      onUploadSuccess?.();
      await refreshNotes();
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className="bg-blue-600 text-white hover:bg-blue-500 transition-colors w-full"
          onClick={() => setIsOpen(true)}
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Notes
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-w-[95vw] w-full">
        <DialogHeader>
          <DialogTitle>Upload Notes</DialogTitle>
          <DialogDescription>
            Upload your handwritten or typed notes in PDF, JPG, or PNG format.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div {...getRootProps()} className={`
            border-2 border-dashed rounded-lg p-6 cursor-pointer
            transition-colors duration-200 text-center
            ${isDragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-blue-400'
            }
          `}>
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            {isDragActive ? (
              <p className="text-blue-600">Drop your files here</p>
            ) : (
              <div className="space-y-1">
                <p className="text-gray-600">Drag & drop your files here, or click to select</p>
                <p className="text-sm text-gray-500">Supported formats: PDF, JPG, PNG</p>
              </div>
            )}
          </div>

          {files.length > 0 && (
            <div className="space-y-2 w-full">
              <Label>Selected Files</Label>
              <div className="max-h-32 overflow-y-auto overflow-x-hidden space-y-2 w-full">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 bg-gray-50 p-2 rounded-md"
                  >
                    <p className="text-sm text-gray-600 overflow-hidden min-w-0 flex-1">
                      {truncateFilename(file.name, 20)}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(file)}
                      className="h-6 w-6 text-gray-500 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600">
              {error}
            </div>
          )}

          {files.length > 1 && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="groupFiles"
                checked={groupFiles}
                onCheckedChange={(checked) => setGroupFiles(checked as boolean)}
              />
              <Label 
                htmlFor="groupFiles" 
                className="text-sm font-normal cursor-pointer"
              >
                Group files into one note?
              </Label>
            </div>
          )}
        </div>
        <DialogFooter className="flex justify-between mt-4">
          <Button 
            variant="outline" 
            onClick={() => {
              setIsOpen(false);
              resetState();
            }}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            className="bg-blue-600 text-white hover:bg-blue-500"
            onClick={handleUpload}
            disabled={files.length === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>Upload {files.length > 0 && `(${files.length} ${files.length === 1 ? 'file' : 'files'})`}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UploadModal;