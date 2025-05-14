'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, Zap, BookOpen, FileText, Brain, FileQuestion, X } from 'lucide-react';
import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';

// Custom renderer components
const ChemBlock = ({ children }: { children: string }) => (
  <div className="chem-structure p-4 border border-gray-200 rounded-md bg-gray-50 my-4">
    <div className="text-gray-800 overflow-auto">
      {children}
    </div>
  </div>
);

const CircuitBlock = ({ children }: { children: string }) => (
  <div className="circuit-diagram p-4 border border-gray-200 rounded-md bg-gray-50 my-4">
    <div className="text-gray-800 overflow-auto">
      {children}
    </div>
  </div>
);

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  processedContent?: string;
  remainingContent?: string;
}

type ResponseType = 'quick' | 'detailed';

interface ContextDocument {
  id: string;
  type: 'note' | 'quiz' | 'flashcard_set';
  name: string;
}

// Mock data - replace with actual API call
// const MOCK_DOCUMENTS: ContextDocument[] = [
//   { id: 'note1', type: 'note', name: 'My Study Notes on AI' },
//   { id: 'quiz1', type: 'quiz', name: 'History Quiz Q1' },
//   { id: 'flashcard1', type: 'flashcard_set', name: 'Spanish Vocabulary Set 1' },
//   { id: 'note2', type: 'note', name: 'Recipe Ideas' },
// ];

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [responseType, setResponseType] = useState<ResponseType>('detailed');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [availableDocuments, setAvailableDocuments] = useState<ContextDocument[]>([]);
  const [selectedContextDocument, setSelectedContextDocument] = useState<ContextDocument | null>(null);
  const [showDocSelector, setShowDocSelector] = useState(false);
  const [docQuery, setDocQuery] = useState('');
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle text area auto resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputMessage]);

  // Fetch available documents (notes, quizzes, flashcards)
  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoadingDocuments(true);
      setDocumentError(null);
      try {
        const response = await fetch('/api/me/documents');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch documents');
        }
        const data = await response.json();
        if (data.success && Array.isArray(data.documents)) {
          setAvailableDocuments(data.documents);
        } else {
          throw new Error('Invalid data format for documents');
        }
      } catch (error) {
        console.error('Error fetching documents:', error);
        setDocumentError(error instanceof Error ? error.message : 'An unknown error occurred');
        setAvailableDocuments([]); // Clear documents on error
      } finally {
        setIsLoadingDocuments(false);
      }
    };

    fetchDocuments();
  }, []);

  // Handle input change for @mention and document selection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputMessage(value);

    // Regex to find @ at the end of the string, followed by characters for the query
    // Or if the string just ends with @
    const atMentionMatch = value.match(/@([\w\s-]*)$/);
    const endsWithAt = value.endsWith('@');

    if (atMentionMatch) {
      setShowDocSelector(true);
      setDocQuery(atMentionMatch[1].toLowerCase());
    } else if (endsWithAt && !value.endsWith('@@')) { // show if ends with @ but not @@ (to allow typing @ as char)
      setShowDocSelector(true);
      setDocQuery(''); // No query yet, just typed @
    } else {
      setShowDocSelector(false);
      setDocQuery('');
    }

    // Clear selected context if the user deletes the @ that initiated it, 
    // or if the @mention text is no longer in the input and a document was previously selected.
    // This part might need refinement based on desired UX if user edits around a selected @mention.
    if (selectedContextDocument && !value.includes(`@[${selectedContextDocument.name}]`)) {
       // If we are NOT showing the doc selector, it means the @ trigger is gone.
       // If it is showing, the user is actively filtering, so don't clear selectedContextDocument yet.
      if (!showDocSelector) {
        // setSelectedContextDocument(null); // Decided against auto-clearing here, clear button is explicit
      }
    }
  };

  // Process special content not handled by React-Markdown + KaTeX
  const processSpecialContent = (content: string): { processedContent: string, remainingContent: string } => {
    if (!content) return { processedContent: '', remainingContent: '' };
    
    let remainingContent = content;
    let processedContent = '';
    
    // Handle circuit diagrams with special syntax
    remainingContent = remainingContent.replace(/```circuit\n([\s\S]*?)```/g, (match, circuit) => {
      processedContent += `<div class="circuit-diagram-placeholder p-4 border border-dashed border-gray-300 rounded-md bg-gray-50 text-center">
                <p class="text-gray-500"><strong>Circuit Diagram:</strong></p>
                <pre class="text-xs text-left mt-2 bg-gray-100 p-2 rounded overflow-auto">${circuit}</pre>
              </div>`;
      return ''; // Remove from remaining content
    });

    // Handle organic chemistry advanced notations if needed
    remainingContent = remainingContent.replace(/```chem\n([\s\S]*?)```/g, (match, chem) => {
      processedContent += `<div class="chem-structure-placeholder p-4 border border-dashed border-gray-300 rounded-md bg-gray-50 text-center">
                <p class="text-gray-500"><strong>Chemical Structure:</strong></p>
                <pre class="text-xs text-left mt-2 bg-gray-100 p-2 rounded overflow-auto">${chem}</pre>
              </div>`;
      return ''; // Remove from remaining content
    });
    
    return { processedContent, remainingContent };
  };

  // Custom components for ReactMarkdown
  const components = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      if (!inline && language === 'chem') {
        return <ChemBlock>{String(children).replace(/\n$/, '')}</ChemBlock>;
      }
      
      if (!inline && language === 'circuit') {
        return <CircuitBlock>{String(children).replace(/\n$/, '')}</CircuitBlock>;
      }
      
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
  };

  // Handle submit message
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const messageToSend = inputMessage.trim();
    if (!messageToSend && !selectedContextDocument) { // Allow empty message if context is selected, to query about the whole doc
        if(!selectedContextDocument) return; // if no context and no message, do nothing
    }
    if (isLoading) return;
    
    const finalMessage = messageToSend || `Tell me about ${selectedContextDocument?.name || 'the selected document'}`;

    // Add user message
    const userMessage: Message = { role: 'user', content: finalMessage };
    const assistantMessage: Message = { 
      role: 'assistant', 
      content: '', 
      isStreaming: true 
    };
    
    // Capture the current state of messages to be used as history *before* adding new ones.
    const currentConversationHistory = messages;

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInputMessage('');
    setSelectedContextDocument(null); // Clear selection after sending
    setShowDocSelector(false);
    setDocQuery('');
    setIsLoading(true);

    try {
      const payload: any = {
        message: userMessage.content,
        stream: true,
        responseType,
        history: currentConversationHistory, // Use the captured history
      };

      if (selectedContextDocument) {
        payload.contextDocument = selectedContextDocument;
      }

      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      if (!response.body) {
        throw new Error('Response body is not readable');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let responseText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append new chunk to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from buffer
        while (true) {
          const lineEnd = buffer.indexOf('\n');
          if (lineEnd === -1) break;

          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);

          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0].delta.content;
              if (content) {
                responseText += content;
                // Update the last message with new content
                setMessages(prevMessages => {
                  const newMessages = [...prevMessages];
                  newMessages[newMessages.length - 1].content = responseText;
                  
                  // Process special content like circuit diagrams and chemistry structures
                  const { processedContent, remainingContent } = processSpecialContent(responseText);
                  newMessages[newMessages.length - 1].processedContent = processedContent;
                  newMessages[newMessages.length - 1].remainingContent = remainingContent || responseText;
                  
                  return newMessages;
                });
              }
            } catch (e) {
              // Ignore invalid JSON
            }
          }
        }
      }

      // Mark streaming as complete
      setMessages(prevMessages => {
        const newMessages = [...prevMessages];
        newMessages[newMessages.length - 1].isStreaming = false;
        return newMessages;
      });

    } catch (error) {
      console.error('Error:', error);
      setMessages(prevMessages => {
        const newMessages = [...prevMessages];
        newMessages[newMessages.length - 1].content = 'Error: Failed to get response';
        newMessages[newMessages.length - 1].isStreaming = false;
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle textarea enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !showDocSelector) { // Do not submit if selector is open
      e.preventDefault();
      handleSubmit(e);
    }
    if (showDocSelector && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
      e.preventDefault(); // Prevent default behavior while selector is active
      // Logic for navigating/selecting from selector will be here
    }
  };

  const handleDocumentSelect = (doc: ContextDocument) => {
    setSelectedContextDocument(doc);
    
    // Remove the @mention query from the input message
    // e.g., if input was "hello @my an", and "my amazing note" was selected, input becomes "hello "
    const atMentionRegex = /@([\w\s-]*)$/;
    setInputMessage(prevInput => prevInput.replace(atMentionRegex, '')); 

    setShowDocSelector(false);
    setDocQuery('');
    textareaRef.current?.focus();
  };

  const filteredDocuments = availableDocuments.filter(doc => 
    doc.name.toLowerCase().includes(docQuery)
  );

  return (
    <div className="flex flex-col h-full bg-gray-100 overflow-hidden">
      
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-center text-gray-500 py-32">
              <Bot className="h-24 w-24 opacity-50 text-blue-600" />
              <div>
                <p className="text-2xl font-medium mb-2">How can I help you today?</p>
                <p className="text-lg max-w-md mx-auto">
                  I have access to all your notes and can answer any questions about them.
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full py-6 px-4 space-y-6">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-3xl rounded-2xl px-6 py-4 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200 markdown-content'
                    }`}
                  >
                    {message.isStreaming ? (
                      <div>
                        <div className="prose prose-sm max-w-none">
                          {message.role === 'assistant' ? (
                            <ReactMarkdown
                              remarkPlugins={[remarkMath]}
                              rehypePlugins={[
                                [rehypeKatex, { 
                                  output: 'html',
                                  throwOnError: false, 
                                  strict: false,
                                  trust: true
                                }], 
                                rehypeSanitize
                              ]}
                              components={components}
                            >
                              {message.content || ''}
                            </ReactMarkdown>
                          ) : (
                            message.content
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin opacity-70" />
                          <span className="text-xs opacity-70">Thinking...</span>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        {message.role === 'assistant' ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[
                              [rehypeKatex, { 
                                output: 'html',
                                throwOnError: false, 
                                strict: false,
                                trust: true
                              }], 
                              rehypeSanitize
                            ]}
                            components={components}
                          >
                            {message.content}
                          </ReactMarkdown>
                        ) : (
                          message.content
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>
        
      {/* Input container */}
      <div className="border-t p-4">
        <div className="mx-auto relative"> {/* Added relative for popover positioning */}
          {/* Response type selection */}
          <div className="flex justify-center mb-3">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => setResponseType('quick')}
                className={`px-4 py-2 text-sm font-medium rounded-l-lg flex items-center gap-1.5 ${
                  responseType === 'quick'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                <Zap className="h-4 w-4" />
                Quick Response
              </button>
              <button
                type="button"
                onClick={() => setResponseType('detailed')}
                className={`px-4 py-2 text-sm font-medium rounded-r-lg flex items-center gap-1.5 ${
                  responseType === 'detailed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-l-0 border-gray-300'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                Detailed Response
              </button>
            </div>
          </div>
          
          {/* Input form */}
          <form onSubmit={handleSubmit} className="flex flex-col border rounded-xl shadow-sm bg-white p-2">
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isLoadingDocuments ? "Loading documents..." : (documentError ? `Error: ${documentError}` : "Ask me anything, or type @ to select a document...")}
              className="min-h-[48px] max-h-[120px] resize-none flex-1 border-0 focus:ring-0 focus:outline-none bg-transparent p-2"
              disabled={isLoading || isLoadingDocuments || !!documentError}
            />
            <div className="flex items-center justify-between px-2 pt-1 pb-0">
              <div className="text-xs text-gray-500">
                <span className="italic">Markdown and LaTeX supported</span>
              </div>
              <button 
                type="submit" 
                className="h-10 w-10 shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:bg-blue-400 self-end"
                disabled={isLoading || (!inputMessage.trim() && !selectedContextDocument)}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
          </form>

          {/* Document Selector Popover */}
          {showDocSelector && !isLoadingDocuments && !documentError && filteredDocuments.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto z-10">
              <ul>
                {filteredDocuments.map((doc) => (
                  <li 
                    key={doc.id} 
                    onClick={() => handleDocumentSelect(doc)}
                    className="p-3 hover:bg-gray-100 cursor-pointer flex items-center gap-3"
                  >
                    {doc.type === 'note' && <FileText className="h-5 w-5 text-blue-500" />}
                    {doc.type === 'quiz' && <FileQuestion className="h-5 w-5 text-green-500" />}
                    {doc.type === 'flashcard_set' && <Brain className="h-5 w-5 text-purple-500" />}
                    <span className="font-medium">{doc.name}</span>
                    <span className="text-xs text-gray-500 ml-auto capitalize">({doc.type.replace('_', ' ')})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
           {showDocSelector && isLoadingDocuments && (
             <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-300 rounded-lg shadow-xl p-3 text-center text-gray-500">
                Loading documents...
             </div>
           )}
           {showDocSelector && !isLoadingDocuments && documentError && (
             <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-red-300 rounded-lg shadow-xl p-3 text-center text-red-500">
                Error: {documentError}
             </div>
           )}
           {showDocSelector && !isLoadingDocuments && !documentError && filteredDocuments.length === 0 && docQuery && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-300 rounded-lg shadow-xl p-3 text-center text-gray-500">
                No documents found matching "{docQuery}"
            </div>
           )}
           {selectedContextDocument && !showDocSelector && (
            <div className="absolute bottom-full left-0 mb-1 px-3 py-2 text-sm bg-blue-100 text-blue-800 rounded-lg shadow-md flex items-center gap-2">
              <span className="font-medium">Context:</span>
              {selectedContextDocument.type === 'note' && <FileText className="h-4 w-4 text-blue-600 shrink-0" />}
              {selectedContextDocument.type === 'quiz' && <FileQuestion className="h-4 w-4 text-green-600 shrink-0" />}
              {selectedContextDocument.type === 'flashcard_set' && <Brain className="h-4 w-4 text-purple-600 shrink-0" />}
              <span className="truncate max-w-xs" title={selectedContextDocument.name}>@{selectedContextDocument.name}</span> 
              <span className="text-xs text-blue-700">({selectedContextDocument.type.replace('_', ' ')})</span>
              <button 
                onClick={() => {
                  setSelectedContextDocument(null);
                  // Attempt to remove the @mention from input, if user hasn't modified it heavily
                  // const mentionPattern = new RegExp(`@\[${selectedContextDocument.name.replace(/[.*+?^${}()|[\\\]\\]/g, '\\$&')}\]\s?`, 'g');
                  // setInputMessage(inputMessage.replace(mentionPattern, ''));
                  // No need to remove @[docname] from input as it's no longer there.
                  // Simply clear the input if the context is removed, or let user manage it.
                  // setInputMessage(''); // Optional: clear input when context is removed
                  textareaRef.current?.focus();
                }} 
                className="ml-1 p-0.5 rounded-full hover:bg-blue-200 text-blue-700 hover:text-blue-900 transition-colors"
                aria-label="Clear selected context"
              >
                <X className="h-4 w-4" /> 
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add custom styles for content */}
      <style jsx global>{`
        .markdown-content .katex-display {
          margin: 1em 0;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 0.5em 0;
        }
        
        .markdown-content .katex {
          font-size: 1em;
        }
        
        .markdown-content .katex-display > .katex {
          font-size: 1.1em;
        }
        
        .circuit-diagram-placeholder,
        .chem-structure-placeholder {
          margin: 1em 0;
        }
        
        /* Hide duplicate content to prevent it from rendering twice */
        .markdown-body:has(+ .circuit-chem-handler) pre {
          display: none;
        }
        
        /* Load mhchem extension for KaTeX */
        @import url('https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/mhchem.min.css');
        
        @media (max-width: 640px) {
          .markdown-content .katex-display {
            font-size: 0.8em;
          }
        }
      `}</style>
    </div>
  );
}
