'use client';

import { ReactNode } from 'react';
import { NotesProvider } from '@/contexts/NotesContext';

interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <NotesProvider refreshFunction={() => Promise.resolve()}>
      {children}
    </NotesProvider>
  );
} 