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
import { Upload, FileText, Image, File, X } from "lucide-react"
import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import axios from "axios"
import { MarkdownEditor } from "./markdowneditor"
import { useAuth } from "@clerk/nextjs"
import { useNotes } from "@/contexts/NotesContext"

const acceptedFileTypes = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'text/plain': ['.txt'],
  'application/msword': ['.doc'],
  'application/vnd.ms-excel': ['.xls', '.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt', '.pptx'],
  'text/markdown': ['.md'],
  'text/csv': ['.csv']
}

interface Note {
  id: number;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  updated_at: string | null;
}

export function UploadModal() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [generatedContent, setGeneratedContent] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteId, setNoteId] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { userId } = useAuth()
  const { refreshNotes } = useNotes()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prevFiles => [...prevFiles, ...acceptedFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    multiple: true
  })

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)
    const formData = new FormData()
    files.forEach((file) => {
      formData.append('files', file)
    })

    try {
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      setGeneratedContent(response.data.result)
      setNoteTitle('')
      setNoteId(null)
      setShowEditor(true)
      setFiles([])
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Failed to process your file. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const openNote = async (noteId: number) => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/notes/${noteId}?user_id=${userId}`
      )
      const note: Note = response.data
      setGeneratedContent(note.content)
      setNoteTitle(note.title)
      setNoteId(note.id)
      setShowEditor(true)
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Failed to fetch note:', error)
      alert('Failed to open note. Please try again.')
    }
  }

  const handleEditorClose = () => {
    setShowEditor(false)
    setIsDialogOpen(false)
    refreshNotes();
  }

  const removeFile = (indexToRemove: number) => {
    setFiles(files.filter((_, index) => index !== indexToRemove))
  }

  return (
    <>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" className="bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors w-full justify-start">
            <Upload className="w-4 h-4 mr-2" />
            Upload Notes
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-blue-500">Upload Notes</DialogTitle>
            <DialogDescription>
              Drag and drop your files here, or click to select files.
              <br />
              All the files you upload at once will be grouped together and processed as one note.
              <br />
              PSA: We currently cannot process diagrams, work in progress.
            </DialogDescription>
          </DialogHeader>
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500'}`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <Upload className="w-12 h-12 text-blue-400" />
              <div>
                <p className="text-sm text-gray-600">
                  {isDragActive
                    ? "Drop the files here..."
                    : "Drag and drop files here, or click to select files"}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Supported formats: PDF, DOCX, JPG, PNG, TXT, DOC, XLS, PPT, MD, CSV
                </p>
              </div>
            </div>
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium">Selected files:</h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm p-2 bg-blue-50 rounded justify-between">
                    <div className="flex items-center gap-2 truncate">
                      {file.type.includes('pdf') ? (
                        <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                      ) : file.type.includes('image') ? (
                        <Image className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      ) : (
                        <File className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      )}
                      <span className="truncate">{file.name}</span>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="p-1 hover:bg-blue-100 rounded-full flex-shrink-0"
                      aria-label="Remove file"
                    >
                      <X className="w-3 h-3 text-gray-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              onClick={handleUpload} 
              disabled={files.length === 0 || uploading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white"
            >
              {uploading ? 'Uploading...' : 'Upload Files'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showEditor && (
        <MarkdownEditor
          isOpen={showEditor}
          onClose={handleEditorClose}
          initialContent={generatedContent}
          userId={userId || ''}
          initialTitle={noteTitle}
          noteId={noteId}
        />
      )}
    </>
  )
}
