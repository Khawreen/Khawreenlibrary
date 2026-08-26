import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';

interface ChatbotProps {
  isOpen: boolean;
  onToggle: () => void;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

const Chatbot: React.FC<ChatbotProps> = ({ isOpen, onToggle, messages, onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onToggle]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <>
      {/* Chat Window */}
      <div
        className={`fixed bottom-24 right-4 sm:right-8 w-[calc(100%-2rem)] max-w-sm h-[60vh] max-h-[500px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ease-in-out z-[110] ${
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
        }`}
        role="dialog"
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <h3 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
            <i className="fas fa-robot"></i> AI Assistant
          </h3>
          <button
            onClick={onToggle}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Close chat"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </header>

        {/* Messages */}
        <div className="flex-grow p-4 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-2 items-end animate-fade-in ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'model' && <i className="fas fa-robot text-xl text-indigo-500 dark:text-indigo-400 bg-slate-100 dark:bg-slate-700 p-2 rounded-full self-start"></i>}
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 items-end justify-start animate-fade-in">
                 <i className="fas fa-robot text-xl text-indigo-500 dark:text-indigo-400 bg-slate-100 dark:bg-slate-700 p-2 rounded-full self-start"></i>
                 <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-700 rounded-bl-none">
                    <div className="flex gap-1.5 items-center">
                        <span className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="h-2 w-2 bg-indigo-400 rounded-full animate-bounce"></span>
                    </div>
                 </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        {/* Input Form */}
        <footer className="p-3 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              className="flex-grow p-2.5 border border-slate-300 dark:border-slate-600 rounded-full focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 focus:border-indigo-500 transition px-4 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              aria-label="Chat input"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-indigo-600 text-white rounded-full w-10 h-10 flex items-center justify-center transition-all duration-200 hover:bg-indigo-500 disabled:bg-slate-400 dark:disabled:bg-slate-500 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <i className="fas fa-paper-plane"></i>
            </button>
          </form>
        </footer>
      </div>

      {/* FAB (Floating Action Button) */}
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-4 sm:right-8 bg-indigo-600 text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-transform duration-300 ease-in-out hover:scale-110 hover:bg-indigo-500 dark:shadow-indigo-900/50 z-[120]"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <i className={`fas ${isOpen ? 'fa-times' : 'fa-comment-dots'} text-2xl transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`}></i>
      </button>
    </>
  );
};

export default Chatbot;
