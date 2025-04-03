import { useState } from 'react'
import MDEditor from '@uiw/react-md-editor'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import axios from 'axios'
import { useNotes } from '@/contexts/NotesContext'

interface MarkdownEditorProps {
  isOpen: boolean
  onClose: () => void
  initialContent: string
  userId: string
  initialTitle?: string
  noteId?: number | null
}

export function MarkdownEditor({ isOpen, onClose, initialContent, userId, initialTitle = '', noteId = null }: MarkdownEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [title, setTitle] = useState(initialTitle)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { addNote, refreshNotes } = useNotes()

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a title for your notes')
      return
    }

    setSaving(true)
    setErrorMessage(null)
    
    try {
      const payload = {
        title,
        content,
        user_id: userId
      }
      
      let response;
      
      if (noteId) {
        // Update existing note
        response = await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/notes/${noteId}`, payload)
        console.log('Update response:', response.data)
        refreshNotes()
      } else {
        // Create new note
        response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/save`, payload)
        console.log('Save response:', response.data)
        addNote(response.data)
      }
      
      onClose()
    } catch (error: any) {
      console.error('Failed to save:', error)
      let message = 'Failed to save your notes. Please try again.'
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Error response data:', error.response.data)
        console.error('Error response status:', error.response.status)
        console.error('Error response headers:', error.response.headers)
        
        if (error.response.data && error.response.data.detail) {
          message = `Error: ${error.response.data.detail}`
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error('Error request:', error.request)
        message = 'No response received from server. Please check your connection.'
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error message:', error.message)
        message = `Error: ${error.message}`
      }
      
      setErrorMessage(message)
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{noteId ? 'Edit Note' : 'Edit Your Notes'}</DialogTitle>
          <DialogDescription>
            {noteId 
              ? 'Edit your existing note.' 
              : 'Review and edit the generated notes before saving.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="mb-4">
          <Input
            placeholder="Enter a title for your notes"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full"
          />
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-md text-sm">
            {errorMessage}
          </div>
        )}

        <div className="flex-grow overflow-y-auto">
          <MDEditor
            value={content}
            onChange={(value) => setContent(value || '')}
            preview="live"
            height="100%"
          />
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            {saving ? 'Saving...' : (noteId ? 'Update Notes' : 'Save Notes')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 