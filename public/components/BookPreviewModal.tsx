
import React, { useEffect, useRef, useState } from 'react';
import { Book } from '../types';
import * as db from '../db';
import { useAuth } from '../AuthContext';

// Let TypeScript know that pdfjsLib is available globally
declare var pdfjsLib: any;

interface BookPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book | null;
  initialPage?: number;
}

type SpeechStatus = 'idle' | 'speaking' | 'paused' | 'unavailable';
type PreviewTheme = 'light' | 'sepia' | 'dark';

const BookPreviewModal: React.FC<BookPreviewModalProps> = ({ isOpen, onClose, book, initialPage }) => {
  const { currentUser } = useAuth();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [useNativeViewer, setUseNativeViewer] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const [previewPages, setPreviewPages] = useState(0);
  const [remainingAccessSeconds, setRemainingAccessSeconds] = useState<number | null>(null);

  // Anti-Screenshot & Screen Capture Protection state
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);
  const [screenshotDetected, setScreenshotDetected] = useState(false);

  // Reader experience states
  const [scale, setScale] = useState(1.2);
  const [theme, setTheme] = useState<PreviewTheme>('light');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle');
  const [extractedText, setExtractedText] = useState('');
  
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Anti-Screenshot & DRM Listeners
  useEffect(() => {
    if (!isOpen) return;

    // Window Blur (e.g. Snipping tool, Lightshot, Alt+Tab, Screen capture software)
    const handleBlur = () => {
      setIsWindowBlurred(true);
    };

    const handleFocus = () => {
      setIsWindowBlurred(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsWindowBlurred(true);
      } else {
        setIsWindowBlurred(false);
      }
    };

    // Keyboard Shortcuts Blocker (PrintScreen, Ctrl+P, Ctrl+S, Ctrl+U, Ctrl+Shift+I, Cmd+Shift+3/4/5)
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen detection
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        setScreenshotDetected(true);
        setIsWindowBlurred(true);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            navigator.clipboard.writeText('');
          } catch (err) {}
        }
        setTimeout(() => setScreenshotDetected(false), 3000);
        return;
      }

      // Block Ctrl+P (Print / Save as PDF)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setScreenshotDetected(true);
        setTimeout(() => setScreenshotDetected(false), 3000);
        return;
      }

      // Block Ctrl+S (Save web page / assets)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        return;
      }

      // Block Ctrl+Shift+S (Firefox / Windows Snipping shortcut)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setScreenshotDetected(true);
        setIsWindowBlurred(true);
        setTimeout(() => setScreenshotDetected(false), 3000);
        return;
      }

      // Block Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        return;
      }

      // Block Ctrl+Shift+I / F12 (Inspect Element)
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'i' || e.key === 'I' || e.key === 'c' || e.key === 'C'))) {
        e.preventDefault();
        return;
      }
    };

    // Disable Right-Click Context Menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isOpen]);

  // 30-second access window enforcement inside reader
  useEffect(() => {
    if (!isOpen || !book) return;
    const isPaid = book.isForSale && book.price > 0;
    const isOwner = currentUser?.email === book.uploadedBy;
    const isAdmin = currentUser?.role === 'admin';

    if (!isPaid || isOwner || isAdmin) {
      setRemainingAccessSeconds(null);
      return;
    }

    const checkAccess = () => {
      const remaining = db.getBookAccessRemainingSeconds(book.id);
      const hasAccess = db.checkBookAccess(book.id);

      if (!hasAccess || remaining <= 0) {
        setRemainingAccessSeconds(0);
        if (speechSynthesis.speaking) {
          speechSynthesis.cancel();
        }
        window.dispatchEvent(new CustomEvent('showtoast', {
          detail: { 
            message: '⏳ The 30-second online reading time has expired. The book is now locked.', 
            type: 'error' 
          }
        }));
        onClose();
      } else {
        setRemainingAccessSeconds(remaining);
      }
    };

    checkAccess();
    const interval = setInterval(checkAccess, 1000);
    return () => clearInterval(interval);
  }, [isOpen, book, currentUser, onClose]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setSpeechStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !book) return;

    // Reset state for the new preview
    setIsLoading(true);
    setError('');
    setUseNativeViewer(false);
    setTotalPages(0);
    setPreviewPages(0);
    setExtractedText('');
    if (canvasContainerRef.current) {
      canvasContainerRef.current.innerHTML = ''; // Clear previous preview
    }
    
    // Cancel any ongoing speech when a new book is opened
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      setSpeechStatus('idle');
    }

    let isMounted = true;

    const renderPdf = async () => {
      try {
        if (typeof pdfjsLib === 'undefined') {
          await new Promise<void>((resolve, reject) => {
            let checkCount = 0;
            const interval = setInterval(() => {
              checkCount++;
              if (typeof pdfjsLib !== 'undefined') {
                clearInterval(interval);
                resolve();
              } else if (checkCount > 20) {
                clearInterval(interval);
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
                script.onload = () => {
                  if (typeof pdfjsLib !== 'undefined') {
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                  }
                  resolve();
                };
                script.onerror = () => reject(new Error('Failed to load PDF viewer library'));
                document.head.appendChild(script);
              }
            }, 100);
          });
        }

        if (typeof pdfjsLib !== 'undefined') {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        }

        let pdfSource: any = `/api/files/view/${book.id}`;
        
        if (book.pdfUrl && book.pdfUrl.startsWith('data:')) {
          const base64Parts = book.pdfUrl.split(',');
          const base64Data = base64Parts[1] || base64Parts[0];
          const binaryStr = atob(base64Data);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          pdfSource = { data: bytes };
        } else {
          try {
            const fetchUrl = `/api/files/view/${book.id}`;
            const response = await fetch(fetchUrl);
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              pdfSource = { data: new Uint8Array(arrayBuffer) };
            } else {
              pdfSource = `/api/files/view/${book.id}`;
            }
          } catch (e) {
            pdfSource = `/api/files/view/${book.id}`;
          }
        }

        if (!isMounted) return;

        const loadingTask = pdfjsLib.getDocument(pdfSource);
        const pdf = await loadingTask.promise;

        if (!isMounted) return;

        setTotalPages(pdf.numPages);
        
        let allText = '';
        const isPaidBook = Boolean((book.isForSale || (book.price && Number(book.price) > 0)) && Number(book.price || 0) > 0);
        const cleanBookId = book.id.replace(/^book-/, '');
        const isPurchased = Boolean(
          currentUser &&
          isPaidBook &&
          currentUser.purchasedBookIds &&
          Array.isArray(currentUser.purchasedBookIds) &&
          currentUser.purchasedBookIds.some(id => {
            if (!id) return false;
            const clean = id.replace(/^book-/, '');
            return id === book.id || id === cleanBookId || clean === cleanBookId || id === `book-${cleanBookId}`;
          })
        );
        const isAdmin = currentUser?.role === 'admin';
        const hasFullAccess = !isPaidBook || isAdmin || isPurchased;

        const numPagesToRender = hasFullAccess ? pdf.numPages : Math.min(2, pdf.numPages);

        // Render pages
        for (let pageNum = 1; pageNum <= numPagesToRender; pageNum++) {
          if (!isMounted) break;

          const page = await pdf.getPage(pageNum);
          const desiredWidth = canvasContainerRef.current?.clientWidth || 600;
          const viewport = page.getViewport({ scale: 1 });
          const initialScale = (desiredWidth - 32) / viewport.width;
          const scaledViewport = page.getViewport({ scale: initialScale * scale });

          const pageWrapper = document.createElement('div');
          pageWrapper.id = `pdf-page-${pageNum}`;
          pageWrapper.className = 'pdf-page-card mb-6 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col items-center transition-all';

          const pageHeader = document.createElement('div');
          pageHeader.className = 'w-full px-4 py-2 bg-slate-100 dark:bg-slate-700/60 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-300';
          
          const pageBadge = document.createElement('span');
          pageBadge.className = 'flex items-center gap-1.5 font-bold';
          pageBadge.innerHTML = `<i class="fas fa-file-alt text-indigo-500"></i> Page ${pageNum} of ${pdf.numPages} ${!hasFullAccess ? '(Free Sample)' : ''}`;
          pageHeader.appendChild(pageBadge);
          pageWrapper.appendChild(pageHeader);

          const canvasBox = document.createElement('div');
          canvasBox.className = 'relative w-full flex justify-center items-center select-none overflow-hidden';

          const canvas = document.createElement('canvas');
          canvas.className = 'p-2 sm:p-4 max-w-full block';
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Could not get canvas context');

          canvas.height = scaledViewport.height;
          canvas.width = scaledViewport.width;
          canvasBox.appendChild(canvas);

          // Official Brand Watermark Overlay
          const watermarkOverlay = document.createElement('div');
          watermarkOverlay.className = 'absolute inset-0 pointer-events-none flex flex-col justify-between items-center p-6 sm:p-10 select-none z-10';
          watermarkOverlay.innerHTML = `
            <div class="w-full flex justify-between items-center text-[10px] sm:text-xs font-semibold text-slate-500/40 dark:text-slate-400/40 tracking-wider">
              <span>Khawreen library 🇦🇫</span>
              <span>Official Copy</span>
            </div>
            <div class="transform -rotate-45 font-black text-2xl sm:text-4xl text-slate-900/[0.08] dark:text-white/[0.09] tracking-widest uppercase pointer-events-none select-none text-center whitespace-nowrap drop-shadow-sm">
              Khawreen library 🇦🇫
            </div>
            <div class="w-full text-center text-[10px] sm:text-xs font-medium text-slate-500/50 dark:text-slate-400/50">
              © Khawreen Library 🇦🇫 — All Rights Reserved
            </div>
          `;
          canvasBox.appendChild(watermarkOverlay);
          pageWrapper.appendChild(canvasBox);

          if (canvasContainerRef.current) {
            canvasContainerRef.current.appendChild(pageWrapper);
          }

          await page.render({ canvasContext: context, viewport: scaledViewport }).promise;

          // Direct subtle canvas watermark stamp
          try {
            context.save();
            context.translate(canvas.width / 2, canvas.height / 2);
            context.rotate(-Math.PI / 4);
            context.font = `bold ${Math.max(18, Math.floor(canvas.width / 18))}px Arial, sans-serif`;
            context.fillStyle = 'rgba(100, 116, 139, 0.12)';
            context.textAlign = 'center';
            context.fillText('Khawreen library 🇦🇫', 0, 0);
            context.restore();
          } catch (e) {}
          
          if (pageNum <= 5) {
            try {
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item: any) => item.str).join(' ');
              allText += pageText + '\n\n';
            } catch (e) {}
          }

          setPreviewPages(pageNum);

          if (pageNum === 1) {
            setIsLoading(false); // Hide loading indicator as soon as page 1 is displayed!
          }

          // Small pause to keep browser UI responsive during multi-page rendering
          await new Promise(r => setTimeout(r, 15));
        }

        // If paid and unauthorized, show Paywall CTA Card at the end of sample preview
        if (!hasFullAccess && canvasContainerRef.current) {
          const paywallCard = document.createElement('div');
          paywallCard.className = 'w-full p-6 sm:p-8 my-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-2xl border-2 border-amber-400/60 flex flex-col items-center text-center animate-fade-in';
          paywallCard.innerHTML = `
            <div class="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-3xl mb-4 shadow-inner border border-amber-400/40">
              <i class="fas fa-lock"></i>
            </div>
            <h3 class="text-xl sm:text-2xl font-black mb-2 text-amber-300">Premium Book (${book.price.toLocaleString()} AFN)</h3>
            <p class="text-sm text-slate-300 max-w-md mb-6 leading-relaxed">
              You are currently viewing a free sample preview (first 2 pages). To read the full book (${pdf.numPages} pages) and download it, please purchase the book.
            </p>
            <button id="preview-buy-btn" class="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-3.5 px-8 rounded-xl text-base shadow-lg shadow-emerald-500/30 transition transform active:scale-95 cursor-pointer flex items-center gap-2">
              <i class="fas fa-shopping-cart"></i>
              <span>Buy Book Now (${book.price.toLocaleString()} AFN)</span>
            </button>
          `;
          canvasContainerRef.current.appendChild(paywallCard);
          const buyBtn = paywallCard.querySelector('#preview-buy-btn');
          if (buyBtn) {
            buyBtn.addEventListener('click', () => {
              onClose();
              window.dispatchEvent(new CustomEvent('requestbookpurchase', { detail: { bookId: book.id } }));
            });
          }
        }

        if (isMounted) {
          setExtractedText(allText);
          setIsLoading(false);

          if (initialPage && initialPage > 0) {
            setTimeout(() => {
              const targetEl = document.getElementById(`pdf-page-${initialPage}`);
              if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 300);
          }
        }

      } catch (err: any) {
        console.error('Failed to render PDF preview:', err);
        if (isMounted) {
          setError(`Error loading PDF: ${err.message || 'File could not be loaded'}`);
          setUseNativeViewer(true);
          setIsLoading(false);
        }
      }
    };

    renderPdf();

    return () => {
      isMounted = false;
    };
  }, [isOpen, book, scale]);


  const handleZoom = (direction: 'in' | 'out') => {
    setScale(currentScale => {
        const newScale = direction === 'in' ? currentScale + 0.2 : currentScale - 0.2;
        return Math.max(0.5, Math.min(3, newScale));
    });
  };

  const handleToggleFullScreen = () => {
    if (!document.fullscreenElement) {
      modalRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const handlePlayPauseSpeech = () => {
    if (speechStatus === 'speaking') {
      speechSynthesis.pause();
      setSpeechStatus('paused');
    } else if (speechStatus === 'paused') {
      speechSynthesis.resume();
      setSpeechStatus('speaking');
    } else if (speechStatus === 'idle' && extractedText) {
      const utterance = new SpeechSynthesisUtterance(extractedText);
      utteranceRef.current = utterance;
      
      const langMap: { [key: string]: string[] } = {
        'Pashto': ['ps-AF', 'ps'], 'Dari': ['fa-AF', 'fa'], 'English': ['en-US', 'en-GB', 'en'],
      };
      const targetLangs = (book && langMap[book.language]) || ['en-US', 'en'];
      const voices = speechSynthesis.getVoices();
      let selectedVoice = null;
      for (const langCode of targetLangs) {
        selectedVoice = voices.find(voice => voice.lang.startsWith(langCode));
        if (selectedVoice) break;
      }
      if (!selectedVoice) selectedVoice = voices.find(voice => voice.lang.startsWith('en')) || voices[0];

      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice?.lang || 'en-US';
      utterance.rate = 0.9;
      utterance.onend = () => setSpeechStatus('idle');
      utterance.onerror = () => setSpeechStatus('idle');

      speechSynthesis.speak(utterance);
      setSpeechStatus('speaking');
    }
  };

  const handleStopSpeech = () => {
    speechSynthesis.cancel();
    setSpeechStatus('idle');
  };

  const handleCloseModal = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      setSpeechStatus('idle');
    }
    onClose();
  };

  if (!isOpen) return null;

  const isPaidBook = Boolean((book?.isForSale || (book?.price && Number(book.price) > 0)) && Number(book?.price || 0) > 0);
  const cleanBookId = book?.id?.replace(/^book-/, '') || '';
  const isPurchased = Boolean(
    currentUser &&
    isPaidBook &&
    currentUser.purchasedBookIds &&
    Array.isArray(currentUser.purchasedBookIds) &&
    currentUser.purchasedBookIds.some(id => {
      if (!id) return false;
      const clean = id.replace(/^book-/, '');
      return id === book?.id || id === cleanBookId || clean === cleanBookId || id === `book-${cleanBookId}`;
    })
  );
  const isAdmin = currentUser?.role === 'admin';
  const hasFullAccess = !isPaidBook || isAdmin || isPurchased;

  const themeClasses: Record<PreviewTheme, string> = {
    light: 'bg-slate-100 dark:bg-slate-900/50',
    sepia: 'bg-[#fbf0d9] dark:bg-[#5a4d3c]',
    dark: 'bg-gray-800 dark:bg-black',
  };
  const canvasFilterClass = theme === 'dark' ? 'dark-theme-canvas-filter' : '';
  const userParam = currentUser?.email ? `?user=${encodeURIComponent(currentUser.email)}` : '';
  const viewUrl = `/api/files/view/${book?.id}${userParam}`;
  const downloadUrl = `/api/files/download/${book?.id}${userParam}`;

  return (
    <div
      ref={modalRef}
      className={`fixed inset-0 bg-black bg-opacity-60 dark:bg-opacity-75 z-[90] flex justify-center items-center p-0 sm:p-4 select-none ${isFullScreen ? 'bg-white dark:bg-slate-800' : ''}`}
      onClick={handleCloseModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      style={{
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      <style>{`
        .dark-theme-canvas-filter { filter: invert(1) hue-rotate(180deg); }
        @media print {
          body * {
            display: none !important;
            visibility: hidden !important;
          }
          body::after {
            content: "🚫 Print / Save as PDF is disabled for copyright protection. Khawreen Library 🇦🇫";
            display: block !important;
            font-size: 24pt;
            text-align: center;
            margin-top: 100px;
            color: #dc2626;
            font-weight: bold;
          }
        }
      `}</style>

      {/* Screen Capture / Snipping Tool Blur Privacy Shield */}
      {(isWindowBlurred || screenshotDetected) && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            setIsWindowBlurred(false);
            setScreenshotDetected(false);
          }}
          className="absolute inset-0 z-[100] backdrop-blur-2xl bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center animate-fade-in cursor-pointer select-none"
        >
          <div className="bg-slate-800/95 border border-red-500/40 p-6 sm:p-8 rounded-3xl max-w-md shadow-2xl flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 text-3xl animate-bounce">
              <i className="fas fa-shield-alt"></i>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white mb-2">
                Anti-Screenshot Security Active 🚫
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                To protect authors' copyright and content integrity, screenshots, recording, and printing are protected.
              </p>
            </div>
            <div className="px-4 py-2 bg-indigo-600/30 border border-indigo-500/40 rounded-xl text-indigo-300 text-xs font-semibold">
              Khawreen library 🇦🇫 — Click here to continue reading 👆
            </div>
          </div>
        </div>
      )}

      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full h-full flex flex-col relative overflow-hidden transform transition-all duration-300 ease-out animate-fade-in-up select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-3 sm:p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2 max-w-[35%]">
             <h2 id="preview-modal-title" className="text-base sm:text-xl font-bold text-indigo-600 dark:text-indigo-400 truncate">
                {book?.title}
            </h2>
            {previewPages > 0 && totalPages > 0 && (
                <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">({previewPages}/{totalPages} Pages)</p>
            )}
            {remainingAccessSeconds !== null && (
              <span className="bg-rose-500 text-white font-mono font-bold text-xs px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm animate-pulse">
                <i className="fas fa-stopwatch"></i> {remainingAccessSeconds}s
              </span>
            )}
          </div>

          {/* Reading Toolbar */}
          <div className="flex justify-center items-center gap-1.5 sm:gap-3">
             <button title="Zoom Out" onClick={() => handleZoom('out')} className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"><i className="fas fa-search-minus text-slate-600 dark:text-slate-300 text-sm"></i></button>
             <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 w-10 text-center">{(scale * 100).toFixed(0)}%</span>
             <button title="Zoom In" onClick={() => handleZoom('in')} className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"><i className="fas fa-search-plus text-slate-600 dark:text-slate-300 text-sm"></i></button>
             
             <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1"></div>
             
             <button title="Light Theme" onClick={() => setTheme('light')} className={`w-7 h-7 rounded-full bg-white border-2 ${theme === 'light' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-300 dark:border-slate-600'}`}></button>
             <button title="Sepia Theme" onClick={() => setTheme('sepia')} className={`w-7 h-7 rounded-full bg-[#fbf0d9] border-2 ${theme === 'sepia' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-300 dark:border-slate-600'}`}></button>
             <button title="Dark Theme" onClick={() => setTheme('dark')} className={`w-7 h-7 rounded-full bg-gray-800 border-2 ${theme === 'dark' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-300 dark:border-slate-600'}`}></button>
             
             <div className="w-px h-5 bg-slate-200 dark:bg-slate-600 mx-1"></div>
             
             {speechStatus !== 'unavailable' && (
                <>
                <button title={speechStatus === 'speaking' ? 'Pause' : 'Listen'} onClick={handlePlayPauseSpeech} disabled={!extractedText || isLoading} className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors disabled:opacity-50"><i className={`fas ${speechStatus === 'speaking' ? 'fa-pause' : 'fa-play'} text-slate-600 dark:text-slate-300 text-sm`}></i></button>
                {(speechStatus === 'speaking' || speechStatus === 'paused') && <button title="Stop" onClick={handleStopSpeech} className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"><i className="fas fa-stop text-slate-600 dark:text-slate-300 text-sm"></i></button>}
                </>
             )}
          </div>
          
          <div className="flex justify-end items-center gap-2 sm:gap-3">
            {!hasFullAccess && book && (
              <button
                onClick={() => {
                  handleCloseModal();
                  window.dispatchEvent(new CustomEvent('requestbookpurchase', { detail: { bookId: book.id } }));
                }}
                className="px-3 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-teal-800 shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer transform active:scale-95"
              >
                <i className="fas fa-shopping-cart"></i>
                <span>Buy Book (${book.price?.toLocaleString()} AFN)</span>
              </button>
            )}

            {hasFullAccess && (
              <>
                <button
                  onClick={() => setUseNativeViewer(!useNativeViewer)}
                  className="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Switch Viewer Mode"
                >
                  <i className="fas fa-sync-alt"></i>
                  <span className="hidden sm:inline">{useNativeViewer ? 'Canvas Mode' : 'Native Mode'}</span>
                </button>

                <button
                  onClick={() => {
                    if (!book) return;
                    const absoluteViewUrl = `${window.location.origin}${viewUrl}`;
                    const tgWebApp = (window as any).Telegram?.WebApp;
                    if (tgWebApp && typeof tgWebApp.openLink === 'function') {
                      tgWebApp.openLink(absoluteViewUrl);
                    } else {
                      window.open(absoluteViewUrl, '_blank');
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-800/50 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Open PDF in new tab"
                >
                  <i className="fas fa-external-link-alt"></i>
                  <span className="hidden sm:inline">New Tab</span>
                </button>
              </>
            )}

            <button onClick={handleToggleFullScreen} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors p-1.5" title="Toggle Fullscreen">
                <i className={`fas ${isFullScreen ? 'fa-compress' : 'fa-expand'} text-lg`}></i>
            </button>
            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors p-1.5" title="Close Reader">
                <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-grow flex relative overflow-hidden">
          <main className={`flex-grow overflow-y-auto p-4 transition-colors duration-300 ${themeClasses[theme]}`}>
            {isLoading && (
              <div className="flex justify-center items-center h-full text-center">
                <div>
                  <i className="fas fa-spinner fa-spin text-4xl text-indigo-500 dark:text-indigo-400 mb-4"></i>
                  <p className="text-slate-600 dark:text-slate-300 font-semibold text-lg">Opening Book...</p>
                  <p className="text-slate-400 text-xs mt-1">Please wait a moment</p>
                </div>
              </div>
            )}

            {useNativeViewer ? (
              <div className="w-full h-full min-h-[75vh] flex flex-col items-center">
                <div className="w-full max-w-5xl mb-3 flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    📖 Online Native PDF Embedded Reader
                  </span>
                  <button
                    onClick={() => {
                      if (!book) return;
                      const absDownloadUrl = `${window.location.origin}${downloadUrl}`;
                      const tgWebApp = (window as any).Telegram?.WebApp;
                      if (tgWebApp && typeof tgWebApp.openLink === 'function') {
                        tgWebApp.openLink(absDownloadUrl);
                      } else {
                        const a = document.createElement('a');
                        a.href = absDownloadUrl;
                        a.setAttribute('download', book.pdfFileName || `${book.title}.pdf`);
                        a.target = '_blank';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }
                    }}
                    className="px-3 py-1.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-500 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fas fa-download"></i> Download PDF
                  </button>
                </div>
                <iframe
                  src={viewUrl}
                  className="w-full max-w-5xl h-[80vh] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white shadow-lg"
                  title={book?.title || 'PDF Reader'}
                />
              </div>
            ) : (
              <>
                {error && (
                  <div className="flex flex-col items-center justify-center w-full max-w-4xl mx-auto p-4 space-y-4">
                    <div className="w-full p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <i className="fas fa-book-open text-amber-600 dark:text-amber-400 text-3xl"></i>
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Online Reading & Download Center</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">The book is available directly below:</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => {
                            if (!book) return;
                            const absDownloadUrl = `${window.location.origin}${downloadUrl}`;
                            const tgWebApp = (window as any).Telegram?.WebApp;
                            if (tgWebApp && typeof tgWebApp.openLink === 'function') {
                              tgWebApp.openLink(absDownloadUrl);
                            } else {
                              const a = document.createElement('a');
                              a.href = absDownloadUrl;
                              a.setAttribute('download', book.pdfFileName || `${book.title}.pdf`);
                              a.target = '_blank';
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            }
                          }}
                          className="flex-1 sm:flex-initial px-3.5 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-500 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <i className="fas fa-download"></i> Download
                        </button>
                        <a
                          href={viewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 sm:flex-initial px-3.5 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-500 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <i className="fas fa-external-link-alt"></i> Read Online (New Tab)
                        </a>
                      </div>
                    </div>

                    <iframe
                      src={viewUrl}
                      className="w-full h-[75vh] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white shadow-md"
                      title={book?.title || 'Book Preview'}
                    />
                  </div>
                )}
                <div ref={canvasContainerRef} className={`flex flex-col items-center max-w-4xl mx-auto ${canvasFilterClass}`}>
                  {/* PDF page wrappers and canvases appended here */}
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default BookPreviewModal;

