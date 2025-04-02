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

interface MarkdownEditorProps {
  isOpen: boolean
  onClose: () => void
  initialContent: string
}

export function MarkdownEditor({ isOpen, onClose, initialContent }: MarkdownEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a title for your notes')
      return
    }

    setSaving(true)
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/save`, {
        title,
        content
      })
      onClose()
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Failed to save your notes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Your Notes</DialogTitle>
          <DialogDescription>
            Review and edit the generated notes before saving.
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

        <div className="flex-grow overflow-y-auto">
          <MDEditor
            value={content}
            onChange={(value) => setContent(value || '')}
            preview="edit"
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
            {saving ? 'Saving...' : 'Save Notes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 