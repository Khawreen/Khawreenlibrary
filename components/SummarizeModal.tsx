
import React, { useState, useEffect, useRef } from 'react';

interface SummarizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookTitle: string;
  bookLanguage: string;
  summary: string;
  isLoading: boolean;
  error: string;
}

// Define a more descriptive state for the speech synthesis feature
type SpeechStatus = 'idle' | 'loading' | 'speaking' | 'paused' | 'error' | 'unavailable';


const SummarizeModal: React.FC<SummarizeModalProps> = ({ isOpen, onClose, bookTitle, bookLanguage, summary, isLoading, error }) => {
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle');
  const [speechError, setSpeechError] = useState<string>('');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // This effect manages the entire lifecycle of speech synthesis for the modal.
  useEffect(() => {
    // 1. Check for browser support on mount.
    if (!('speechSynthesis' in window)) {
      setSpeechStatus('unavailable');
      return;
    }

    const handleVoicesChanged = () => {
      // Once voices are loaded, we are ready to speak.
      if (speechSynthesis.getVoices().length > 0) {
        setSpeechStatus(currentStatus => currentStatus === 'loading' ? 'idle' : currentStatus);
      }
    };

    // Preemptively check if voices are already loaded.
    if (speechSynthesis.getVoices().length === 0) {
        setSpeechStatus('loading');
        speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    } else {
        setSpeechStatus('idle');
    }

    // 2. Cleanup function: runs when the modal closes or component unmounts.
    return () => {
      speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }
      utteranceRef.current = null;
    };
  }, [isOpen]); // Re-run if the modal is re-opened.

  if (!isOpen) return null;

  const handlePlayPause = () => {
    if (speechStatus === 'speaking') {
      speechSynthesis.pause();
      setSpeechStatus('paused');
    } else if (speechStatus === 'paused') {
      speechSynthesis.resume();
      setSpeechStatus('speaking');
    } else if (speechStatus === 'idle') {
      // Start a new speech
      const utterance = new SpeechSynthesisUtterance(summary);
      utteranceRef.current = utterance;

      const voices = speechSynthesis.getVoices();
      if (voices.length === 0) {
        setSpeechStatus('error');
        setSpeechError(`No voices available on your device.`);
        return;
      }
      
      const langMap: { [key: string]: string[] } = {
        'Pashto': ['ps-AF', 'ps'],
        'Dari': ['fa-AF', 'fa'],
        'English': ['en-US', 'en-GB', 'en'],
      };

      const targetLangs = langMap[bookLanguage] || ['en-US', 'en'];
      let selectedVoice = null;
      for (const langCode of targetLangs) {
        selectedVoice = voices.find(voice => voice.lang.startsWith(langCode));
        if (selectedVoice) break;
      }
      
      // Graceful fallback if no specific language voice is found
      if (!selectedVoice) {
        selectedVoice = voices.find(voice => voice.lang.startsWith('en')) || voices[0];
      }

      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
      utterance.rate = 0.9;

      utterance.onend = () => {
        setSpeechStatus('idle');
        utteranceRef.current = null;
      };

      utterance.onerror = (event) => {
        console.error('SpeechSynthesisUtterance.onerror', event);
        setSpeechStatus('error');
        setSpeechError('An error occurred during playback.');
        utteranceRef.current = null;
      };

      speechSynthesis.speak(utterance);
      setSpeechStatus('speaking');
      setSpeechError(''); // Clear previous errors
    }
  };

  const handleStop = () => {
    speechSynthesis.cancel(); // 'onend' will be triggered, resetting the state.
  };

  const handleClose = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    setSpeechStatus('idle'); // Reset for next time
    setSpeechError('');
    onClose();
  };
  
  const renderSpeechControls = () => {
    if (isLoading || error || !summary) return null; // Don't show controls if there's no summary

    switch (speechStatus) {
      case 'unavailable':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Text-to-speech is not supported by your browser.</p>;
      case 'loading':
        return <button disabled className="bg-slate-400 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 cursor-wait"><i className="fas fa-spinner fa-spin"></i> Loading Voices...</button>;
      case 'error':
        return <p className="text-sm text-red-500 dark:text-red-400">{speechError}</p>;
      case 'idle':
      case 'speaking':
      case 'paused':
        return (
          <>
            <button
              onClick={handlePlayPause}
              className="bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-emerald-600 transition-all duration-300 flex items-center justify-center gap-2"
              title={speechStatus === 'speaking' ? "Pause Summary" : "Listen to Summary"}
            >
              <i className={`fas ${speechStatus === 'speaking' ? 'fa-pause-circle' : 'fa-play-circle'}`}></i>
              <span>{speechStatus === 'speaking' ? "Pause" : (speechStatus === 'paused' ? "Resume" : "Listen")}</span>
            </button>
            {(speechStatus === 'speaking' || speechStatus === 'paused') && (
              <button
                onClick={handleStop}
                className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-all duration-300 flex items-center justify-center gap-2 animate-fade-in"
                title="Stop Playback"
              >
                <i className="fas fa-stop-circle"></i>
                <span>Stop</span>
              </button>
            )}
          </>
        );
      default:
        return null;
    }
  }

  const isRtl = bookLanguage === 'Pashto' || bookLanguage === 'Dari';

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 dark:bg-opacity-75 z-[90] flex justify-center items-center p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-modal-title"
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 sm:p-8 w-full max-w-2xl transform transition-all duration-300 ease-out animate-fade-in-up"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <div className="flex justify-between items-center mb-4 border-b pb-3 border-slate-200 dark:border-slate-700">
          <h2 id="summary-modal-title" className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            Summary for: <span className="text-slate-800 dark:text-slate-100">{bookTitle}</span>
          </h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
            <i className="fas fa-times text-2xl"></i>
          </button>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto pr-2">
          {isLoading && (
            <div className="text-center py-10">
              <i className="fas fa-spinner fa-spin text-4xl text-indigo-500 dark:text-indigo-400 mb-4"></i>
              <p className="text-slate-600 dark:text-slate-300 font-semibold text-lg">Generating summary...</p>
              <p className="text-slate-500 dark:text-slate-400">This may take a moment.</p>
            </div>
          )}
          {error && (
            <div className="text-center py-10 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg">
              <i className="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
              <p className="text-red-700 dark:text-red-300 font-semibold text-lg">An Error Occurred</p>
              <p className="text-red-600 dark:text-red-400 mt-2 text-sm">{error}</p>
            </div>
          )}
          {summary && (
            <div 
              className={`prose prose-lg max-w-none text-slate-700 dark:text-slate-300 leading-relaxed dark:prose-invert ${isRtl ? 'text-right' : ''}`}
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <p>{summary}</p>
            </div>
          )}
        </div>

        <div className="mt-6 border-t pt-4 border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            {renderSpeechControls()}
          </div>
          <button 
            onClick={handleClose} 
            className="bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-bold py-2 px-6 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all duration-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SummarizeModal;
