'use client'

import { SearchIcon } from 'lucide-react'
import { useState } from 'react'
import { CommandK } from '@/components/CommandK'

export function SearchBar() {
  const [open, setOpen] = useState(false)

  const handleOpenCommandK = () => {
    // Simulate cmd+k keyboard shortcut
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true
    })
    document.dispatchEvent(event)
  }

  return (
    <div className="relative w-full">
      <button 
        onClick={handleOpenCommandK}
        className="w-full flex items-center gap-2 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <SearchIcon className="h-4 w-4" />
        <span className="flex-grow text-left">Search...</span>
        <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
    </div>
  )
} 