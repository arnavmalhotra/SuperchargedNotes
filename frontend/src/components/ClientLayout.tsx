'use client';

import { ReactNode } from 'react';
import { NotesProvider } from '@/contexts/NotesContext';
import { CommandK } from './CommandK';

interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <NotesProvider refreshFunction={() => Promise.resolve()}>
      <CommandK />
      {children}
    </NotesProvider>
  );
} 