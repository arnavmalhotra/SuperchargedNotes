'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { FileIcon, BookOpenIcon, BrainCircuitIcon, LayersIcon, SearchIcon } from 'lucide-react'
import { useUser } from '@clerk/nextjs'

type Note = {
  id: string
  title: string
  // Including other potential fields that might be in your notes data
  content?: string
  user_id?: string
  created_at?: string
  updated_at?: string
}

type QuizSet = {
  id: string
  title: string
  created_at?: string
  note_id?: string
}

type FlashcardSet = {
  id: string
  title: string
  created_at?: string
  note_id?: string
}

export function CommandK() {
  const router = useRouter()
  const { user } = useUser()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [notes, setNotes] = useState<Note[]>([])
  const [quizzes, setQuizzes] = useState<QuizSet[]>([])
  const [flashcards, setFlashcards] = useState<FlashcardSet[]>([])
  const [loading, setLoading] = useState(false)

  // Function to fetch all user content
  const fetchContent = async () => {
    if (!user?.id) return;
    
    setLoading(true)
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
      
      // Fetch notes
      const notesResponse = await fetch(`${apiBaseUrl}/api/notes`, {
        headers: {
          'X-User-Id': user.id,
        }
      })
      if (notesResponse.ok) {
        const notesData = await notesResponse.json()
        if (notesData.success && notesData.notes) {
          setNotes(notesData.notes)
        }
      }

      // Fetch quizzes
      const quizzesResponse = await fetch(`${apiBaseUrl}/api/quizzes/list`, {
        headers: {
          'X-User-Id': user.id,
        }
      })
      if (quizzesResponse.ok) {
        const quizzesData = await quizzesResponse.json()
        if (quizzesData.success && quizzesData.quizSets) {
          setQuizzes(quizzesData.quizSets)
        }
      }

      // Fetch flashcards
      const flashcardsResponse = await fetch(`${apiBaseUrl}/api/flashcards/list`, {
        headers: {
          'X-User-Id': user.id,
        }
      })
      if (flashcardsResponse.ok) {
        const flashcardsData = await flashcardsResponse.json()
        if (flashcardsData.success && flashcardsData.flashcardSets) {
          setFlashcards(flashcardsData.flashcardSets)
        }
      }
    } catch (error) {
      console.error('Error fetching content:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && user?.id) {
      fetchContent()
    }
  }, [open, user?.id])

  // Handle keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Handle selection
  const onNoteSelect = (note: Note) => {
    router.push(`/dashboard/notes/${note.id}`)
    setOpen(false)
  }

  const onQuizSelect = (quiz: QuizSet) => {
    router.push(`/dashboard/quizzes/${quiz.id}`)
    setOpen(false)
  }

  const onFlashcardSelect = (flashcard: FlashcardSet) => {
    router.push(`/dashboard/flashcards/${flashcard.id}`)
    setOpen(false)
  }

  // Filter content based on search term
  const filteredNotes = notes.filter(note => 
    note.title?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredQuizzes = quizzes.filter(quiz => 
    quiz.title?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredFlashcards = flashcards.filter(flashcard => 
    flashcard.title?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Search everything..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Notes">
          {loading ? (
            <CommandItem disabled>Loading...</CommandItem>
          ) : filteredNotes.length > 0 ? (
            filteredNotes.map((note) => (
              <CommandItem
                key={`note-${note.id}`}
                onSelect={() => onNoteSelect(note)}
              >
                <FileIcon className="mr-2 h-4 w-4" />
                {note.title}
              </CommandItem>
            ))
          ) : (
            <CommandItem disabled>No matching notes</CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />
        
        <CommandGroup heading="Quizzes">
          {loading ? (
            <CommandItem disabled>Loading...</CommandItem>
          ) : filteredQuizzes.length > 0 ? (
            filteredQuizzes.map((quiz) => (
              <CommandItem
                key={`quiz-${quiz.id}`}
                onSelect={() => onQuizSelect(quiz)}
              >
                <BrainCircuitIcon className="mr-2 h-4 w-4" />
                {quiz.title}
              </CommandItem>
            ))
          ) : (
            <CommandItem disabled>No matching quizzes</CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />
        
        <CommandGroup heading="Flashcards">
          {loading ? (
            <CommandItem disabled>Loading...</CommandItem>
          ) : filteredFlashcards.length > 0 ? (
            filteredFlashcards.map((flashcard) => (
              <CommandItem
                key={`flashcard-${flashcard.id}`}
                onSelect={() => onFlashcardSelect(flashcard)}
              >
                <LayersIcon className="mr-2 h-4 w-4" />
                {flashcard.title}
              </CommandItem>
            ))
          ) : (
            <CommandItem disabled>No matching flashcards</CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
} 