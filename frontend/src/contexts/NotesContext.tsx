import { createContext, useContext, ReactNode } from 'react';

interface NotesContextType {
  refreshNotes: () => Promise<void>;
}

const NotesContext = createContext<NotesContextType | null>(null);

export function useNotes() {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
}

interface NotesProviderProps {
  children: ReactNode;
  refreshFunction: () => Promise<void>;
}

export function NotesProvider({ children, refreshFunction }: NotesProviderProps) {
  return (
    <NotesContext.Provider value={{ refreshNotes: refreshFunction }}>
      {children}
    </NotesContext.Provider>
  );
} 