

import React, { useState, useEffect } from 'react';
import { Section, User, Book, ToastMessage, Review, Ad, ChatMessage, Purchase, PaymentMethod, Settings } from './types';
import Header from './components/Header';
import RegisterForm from './components/RegisterForm';
import LoginForm from './components/LoginForm';
import UploadForm from './components/UploadForm';
import BookList from './components/BookList';
import AdminPanel from './components/AdminPanel';
import Toast from './components/Toast';
import MyBooks from './components/MyBooks';
import MyPurchases from './components/MyPurchases';
import SummarizeModal from './components/SummarizeModal';
import EditBookModal from './components/EditBookModal';
import AdManager from './components/AdManager';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import OrderManagement from './components/OrderManagement';
import PaymentSettings from './components/PaymentSettings';
import Chatbot from './components/Chatbot';
import Footer from './components/Footer';
import * as db from './db';

import PaymentMethodSelectionModal from './components/PaymentMethodSelectionModal';
import CleanPaymentModal from './components/CleanPaymentModal';
import DirectPaymentModal from './components/DirectPaymentModal';
import HesabPayPaymentModal from './components/HesabPayPaymentModal';
import TelegramStarsModal from './components/TelegramStarsModal';
import CryptoPaymentModal from './components/CryptoPaymentModal';
import BookPreviewModal from './components/BookPreviewModal';
import PublishGuideModal from './components/PublishGuideModal';
import GithubPublishGuideModal from './components/GithubPublishGuideModal';
import Profile from './components/Profile';
import InfoModal from './components/InfoModal';
import { useAuth } from './AuthContext';


// Extend the Window interface for TypeScript to recognize the deferredInstallPrompt
declare global {
  interface Window {
    deferredInstallPrompt: any;
  }
}

// Utility to convert a data URL string back to a File object for AI processing
async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], fileName, { type: blob.type });
}


// Utility to resize and convert an image file to a JPEG Blob for upload
const processAndResizeImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const MAX_WIDTH = 800; // Max width for the cover image
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            if (!event.target?.result) {
                return reject(new Error('Failed to read file for resizing.'));
            }
            img.src = event.target.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Could not get canvas context'));
                }

                let { width, height } = img;

                // Calculate new dimensions while maintaining aspect ratio
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to JPEG with a reasonable quality
                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Canvas to Blob conversion failed.'));
                    }
                }, 'image/jpeg', 0.85);
            };
            img.onerror = (error) => reject(new Error('Image could not be loaded. It might be corrupted or in an unsupported format.'));
        };
        reader.onerror = (error) => reject(error);
    });
};

interface SummarizeState {
    isOpen: boolean;
    book: Book | null;
    summary: string;
    isLoading: boolean;
    error: string;
}

interface EditState {
    isOpen: boolean;
    book: Book | null;
}

interface PreviewState {
    isOpen: boolean;
    book: Book | null;
    initialPage?: number;
}

interface PaymentFlowState {
    purchase: Purchase | null;
    book: Book | null;
    methodSelectionOpen: boolean;
    activeMethod: PaymentMethod | null;
}

type Theme = 'light' | 'dark';

const App: React.FC = () => {
  const { currentUser, isInitialized } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>(Section.Books);
  const [users, setUsers] = useState<User[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [theme, setTheme] = useState<Theme>('light');
  
  const [summarizeState, setSummarizeState] = useState<SummarizeState>({ isOpen: false, book: null, summary: '', isLoading: false, error: '' });
  const [editState, setEditState] = useState<EditState>({ isOpen: false, book: null });
  const [previewState, setPreviewState] = useState<PreviewState>({ isOpen: false, book: null });
  const [forgotPasswordInfo, setForgotPasswordInfo] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });

  // New states for payment feature
  const [paymentExpiryTick, setPaymentExpiryTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setPaymentExpiryTick(prev => prev + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [settings, setSettings] = useState<Settings>({ id: 'main', binanceApiKey: '', binanceApiSecret: '', hesabpayMerchantId: '', hesabpayApiKey: '', hesabpaySandboxMode: true });
  const [paymentFlow, setPaymentFlow] = useState<PaymentFlowState>({
      purchase: null,
      book: null,
      methodSelectionOpen: false,
      activeMethod: null,
  });

  // Chatbot states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');

  // PWA Install Prompt State
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [canShowInstallButton, setCanShowInstallButton] = useState(false);

  // Publish Guide Modal State
  const [isPublishGuideOpen, setIsPublishGuideOpen] = useState(false);
  const [isGithubPublishGuideOpen, setIsGithubPublishGuideOpen] = useState(false);

  const handleRequestPublishGuide = () => {
    setIsPublishGuideOpen(true);
  };

  const handleClosePublishGuide = () => {
    setIsPublishGuideOpen(false);
  };

  const handleRequestGithubPublishGuide = () => {
    setIsGithubPublishGuideOpen(true);
  };

  const handleCloseGithubPublishGuide = () => {
    setIsGithubPublishGuideOpen(false);
  };


  useEffect(() => {
    const handleInstallPromptReady = (e: CustomEvent) => {
      setInstallPromptEvent(e.detail);
    };

    window.addEventListener('pwa-install-ready', handleInstallPromptReady as EventListener);

    if (window.deferredInstallPrompt) {
      setInstallPromptEvent(window.deferredInstallPrompt);
    }
    
    return () => {
      window.removeEventListener('pwa-install-ready', handleInstallPromptReady as EventListener);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
        setCanShowInstallButton(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleInstallClick = () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    installPromptEvent.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
            showToast('App installed successfully!', 'success');
        } else {
            showToast('Installation cancelled. You can install it later from your browser menu.', 'error');
        }
        setInstallPromptEvent(null);
        window.deferredInstallPrompt = null;
    });
  };


  // Theme initialization
  useEffect(() => {
    const savedTheme = localStorage.getItem('khawreen_theme') as Theme | null;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('khawreen_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    setChatMessages([{ role: 'model', text: 'Hello! How can I help you explore the Khawreen Library today?' }]);
  }, []);
  
  // Local DB Data Loading
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    const collections: (keyof typeof db.collections)[] = ['books', 'reviews', 'ads', 'purchases', 'users'];
    const setters: { [key: string]: React.Dispatch<React.SetStateAction<any>> } = {
        books: setBooks, reviews: setReviews, ads: setAds, purchases: setPurchases, users: setUsers
    };

    // Listen for data changes in each collection
    collections.forEach(collectionName => {
        const unsubscribe = db.onSnapshot(collectionName, (data) => {
            if(collectionName === 'books') {
                const booksWithDefaults = data.map((book: Book) => ({...book, downloadCount: book.downloadCount || 0, }));
                setBooks(booksWithDefaults);
            } else {
                setters[collectionName](data);
            }
        });
        unsubscribers.push(unsubscribe);
    });
    
    // Listen for settings changes
    const settingsUnsubscribe = db.onSettingsSnapshot((settingsData) => {
        if(settingsData) {
            setSettings(settingsData);
        }
    });
    unsubscribers.push(settingsUnsubscribe);

    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

  // Handle URL navigation parameters from Telegram WebApp
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const uploadParam = params.get('upload');
      const viewParam = (params.get('view') || params.get('section') || params.get('tab') || '').toLowerCase();
      const searchParam = params.get('search') || params.get('q');
      const bookParam = params.get('book');
      const focusParam = params.get('focus');

      if (uploadParam === 'true' || viewParam === 'upload') {
        setActiveSection(Section.Upload);
      } else if (viewParam === 'mybooks' || viewParam === 'my-books') {
        setActiveSection(Section.MyBooks);
      } else if (viewParam === 'admin' || viewParam === 'users' || viewParam === 'stats') {
        setActiveSection(Section.Admin);
      } else if (viewParam === 'register') {
        setActiveSection(Section.Register);
      } else if (viewParam === 'login') {
        setActiveSection(Section.Login);
      } else if (viewParam === 'books') {
        setActiveSection(Section.Books);
      } else if (viewParam === 'about') {
        setActiveSection(Section.Books);
      }

      if (searchParam) {
        setSearchQuery(searchParam);
        setActiveSection(Section.Books);
      }

      if (focusParam === 'search' || focusParam === 'categories') {
        setActiveSection(Section.Books);
      }

      if (bookParam && books.length > 0) {
        const targetBook = books.find(b => b.id === bookParam || b.id === `book-${bookParam}` || b.id.replace('book-', '') === bookParam.replace('book-', ''));
        if (targetBook) {
          setPreviewState({ isOpen: true, book: targetBook });
        }
      }
    }
  }, [books]);


    // --- Preview Modal Handlers ---
  const handleRequestPreview = (bookId: string, initialPage?: number) => {
      const bookToPreview = books.find(b => b.id === bookId);
      if (bookToPreview) {
          setPreviewState({ isOpen: true, book: bookToPreview, initialPage });
      }
  };

  // Effect to handle deep links for books from URL or Telegram Mini App start_param
  useEffect(() => {
    if (!isInitialized || books.length === 0) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const tgWebApp = (window as any).Telegram?.WebApp;
    const tgStartParam = tgWebApp?.initDataUnsafe?.start_param;

    let targetBookId = urlParams.get('book') || urlParams.get('startapp') || urlParams.get('tgWebAppStartParam') || tgStartParam;

    // Check hash parameter fallback
    if (!targetBookId && window.location.hash) {
      const hashMatch = window.location.hash.match(/(?:book|startapp)=([^&]+)/);
      if (hashMatch) {
        targetBookId = hashMatch[1];
      }
    }

    if (targetBookId) {
      const rawId = decodeURIComponent(targetBookId).trim();
      const cleanId = rawId.startsWith('book-') ? rawId : `book-${rawId}`;

      const matchedBook = books.find(b => 
        b.id === rawId || 
        b.id === cleanId || 
        b.id.replace('book-', '') === rawId.replace('book-', '')
      );

      if (matchedBook) {
        setActiveSection(Section.Books);
        setPreviewState({ isOpen: true, book: matchedBook });
        setSearchQuery(matchedBook.title);
        showToast(`Book "${matchedBook.title}" opened!`, 'success');

        // Clean query parameters from URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('book');
        newUrl.searchParams.delete('startapp');
        newUrl.searchParams.delete('tgWebAppStartParam');
        window.history.replaceState({}, '', newUrl.pathname + (newUrl.search ? newUrl.search : ''));
      }
    }
  }, [isInitialized, books]);

  // Effect to handle HesabPay automatic success route redirects
  useEffect(() => {
    if (!isInitialized || books.length === 0) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const bookId = urlParams.get('bookId');
    const purchaseId = urlParams.get('purchaseId');

    if (paymentStatus === 'success' && bookId && purchaseId) {
      const book = books.find(b => b.id === bookId);
      if (book) {
        const processUnlock = async () => {
          if (!currentUser) {
            showToast('Please sign in to unlock your purchased book.', 'error');
            setActiveSection(Section.Login);
            return;
          }
          // This URL is fully attacker-controllable (?payment=success&bookId=
          // ...&purchaseId=...) — it used to write status:'completed' to the
          // database purely because those params were present, which meant
          // anyone could unlock any book just by typing a URL. We now ask
          // the server to actually verify the purchase with HesabPay before
          // treating anything as paid.
          try {
            const verifyRes = await fetch('/api/payments/hesabpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ purchaseId })
            });
            const verifyData = await verifyRes.json();
            if (verifyData?.isCompleted) {
              showToast(`HesabPay Payment Approved! "${book.title}" added to your account.`, 'success');
              setActiveSection(Section.MyPurchases);
            } else {
              showToast('تادیه لا تر اوسه نه ده تایید شوې. مهرباني وکړئ لږ صبر وکړئ.', 'error');
            }
          } catch (e) {
            showToast('د تادیې د تایید کولو کې ستونزه رامنځته شوه.', 'error');
          }

          // Clear query params elegantly
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('payment');
          newUrl.searchParams.delete('bookId');
          newUrl.searchParams.delete('purchaseId');
          window.history.replaceState({}, '', newUrl.toString());
        };
        processUnlock();
      }
    }
  }, [isInitialized, books, currentUser]);


  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const newToast: ToastMessage = { id: Date.now(), message, type };
    setToasts(prevToasts => [...prevToasts, newToast]);
  };

  useEffect(() => {
    const handleShowToastEvent = (e: CustomEvent) => {
      if (e.detail && e.detail.message) {
        showToast(e.detail.message, e.detail.type || 'success');
      }
    };
    window.addEventListener('showtoast', handleShowToastEvent as EventListener);
    return () => window.removeEventListener('showtoast', handleShowToastEvent as EventListener);
  }, []);

  useEffect(() => {
    const handlePurchaseEvent = (e: CustomEvent) => {
      if (e.detail && e.detail.bookId) {
        handleRequestAcquisition(e.detail.bookId);
      }
    };
    window.addEventListener('requestbookpurchase', handlePurchaseEvent as EventListener);
    return () => window.removeEventListener('requestbookpurchase', handlePurchaseEvent as EventListener);
  }, [books, currentUser]);

  const closeToast = (id: number) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  };
  
  const [isRegistering, setIsRegistering] = useState(false);

  const handleRegister = async (userData: {name: string; email: string; password?: string;}) => {
    if (!userData.password) {
      showToast('پټ نوم (Password) اړین دی / Password is required.', 'error');
      return;
    }
    setIsRegistering(true);
    try {
        const isAdmin = userData.email.toLowerCase().trim() === 'mohammadgulkhawreen6@gmail.com';
        await db.register(userData.email, userData.password, userData.name, isAdmin);
        
        try {
          await db.login(userData.email, userData.password);
        } catch {}

        showToast(`ستاسو ګڼون په بریالیتوب سره جوړ شو! ښه راغلاست / Account created successfully! Welcome ${userData.name || ''}`, 'success');
        setActiveSection(Section.Books);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'د ګڼون په جوړولو کې تېروتنه رامنځته شوه / Registration error.';
        showToast(message, 'error');
    } finally {
        setIsRegistering(false);
    }
  };



  const handleLogin = async (credentials: { email: string; password?: string }) => {
     if (!credentials.password) {
        showToast('Password is required.', 'error');
        return;
    }
    try {
      const user = await db.login(credentials.email, credentials.password);
      showToast(`Welcome back, ${user.name || user.email}!`);
      setActiveSection(Section.Books);
    } catch (error) {
       const message = error instanceof Error ? error.message : 'An unknown error occurred.';
       showToast(message, 'error');
    }
  };

  const handleLogout = async () => {
    try {
        await db.logout();
        showToast('You have been logged out.', 'success');
        setActiveSection(Section.Books);
    } catch (error) {
        showToast('Failed to log out.', 'error');
    }
  };
  
 const handleForgotPasswordRequest = async (email: string) => {
    try {
        const tempPassword = await db.sendPasswordReset(email);
        if (tempPassword) {
            setForgotPasswordInfo({
                isOpen: true,
                message: `A secure temporary password has been generated for your account:\n\n${tempPassword}\n\nPlease use this password to log in, and remember to change your password under your Profile settings.`
            });
        } else {
            showToast("If an account exists for that email, recovery instructions have been prepared.", 'success');
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred.';
        showToast(message, 'error');
    }
  };

  const handleAddBook = async (title: string, author: string, language: string, coverFile: File, pdfFile: File, isForSale: boolean, price: number) => {
    if (!currentUser) {
        const errorMessage = 'You must be logged in to upload a book.';
        showToast(errorMessage, 'error');
        setActiveSection(Section.Login);
        throw new Error(errorMessage);
    }
    
    let coverBlob: Blob;
    try {
        coverBlob = await processAndResizeImage(coverFile);
    } catch (error) {
        const errorMessage = 'Failed to process cover image. It may be corrupted or in an unsupported format.';
        showToast(errorMessage, 'error');
        throw new Error(errorMessage);
    }

    try {
        const bookId = `book-${Date.now()}`;
        // Stream cover and PDF files directly to server storage endpoints
        const coverUrl = await db.uploadFile(coverBlob, 'cover', bookId);
        const pdfUrl = await db.uploadFile(pdfFile, 'pdf', bookId);

        let tags: string[] = [];
        try {
          const tagRes = await fetch('/api/ai/generate-tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title,
              author,
              language,
            })
          });
          if (tagRes.ok) {
            const tagData = await tagRes.json();
            if (Array.isArray(tagData?.tags) && tagData.tags.length > 0) {
              tags = tagData.tags;
              showToast('AI-powered tags generated!', 'success');
            }
          }
        } catch (e) {
          console.error("Failed to generate tags:", e);
        }
        
        const newBook: Book = {
          id: bookId, title, author, language, coverUrl, pdfUrl, pdfFileName: pdfFile.name,
          uploadedBy: currentUser.email, 
          status: 'approved', // Auto-approve so books immediately sync to both Website and Telegram Bot
          isForSale,
          price: isForSale ? price : 0, tags, downloadCount: 0,
        };
        
        await db.add('books', newBook, newBook.id);
        showToast('Book uploaded successfully and published!', 'success');
        setActiveSection(Section.Books);

    } catch (uploadError: any) {
        console.error("Failed to upload book:", uploadError);
        const errorMessage = uploadError?.message || 'Failed to process files for local storage.';
        showToast(`Upload failed: ${errorMessage}`, 'error');
        throw new Error(errorMessage);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    const bookToDelete = books.find(b => b.id === bookId);
    if(window.confirm('Are you sure you want to delete this book? This will also remove it from storage permanently.')) {
        if (bookToDelete && currentUser) {
          try {
            await db.deleteBook(bookToDelete, currentUser.email);
            showToast('Book removed successfully.', 'success');
          } catch (e: any) {
            showToast(e?.message || 'You are not allowed to delete this book.', 'error');
          }
        } else {
          showToast('Could not find book to delete.', 'error');
        }
    }
  };

  const handleDownloadBook = async (bookId: string) => {
    await db.recordBookDownloadTime(bookId);
    await db.incrementDownloadCount(bookId);
  };

  const handleApproveBook = async (bookId: string) => {
    await db.update('books', bookId, { status: 'approved', adminUserId: currentUser?.email });
    showToast('Book approved and published!', 'success');
  };
  
  const handleAddReview = async (bookId: string, rating: number, comment: string) => {
      if (!currentUser) {
        showToast('You must be logged in to leave a review.', 'error');
        setActiveSection(Section.Login);
        return;
      }
      const newReview: Review = {
        id: `review-${Date.now()}`, bookId, username: currentUser.email, rating, comment, createdAt: Date.now(),
      };
      await db.add('reviews', newReview, newReview.id);
      showToast('Your review has been submitted!', 'success');
  };

  const handleAcquireFreeBook = async (bookId: string) => {
    if (await db.addBookToUserLibrary(bookId)) {
      showToast('Book added to your library successfully!', 'success');
    } else {
      showToast('Could not add book to library.', 'error');
    }
  };
  
  const handleRequestAcquisition = async (bookId: string) => {
    if (!currentUser) {
      showToast('د کتاب ترلاسه کولو لپاره لومړی حساب ته ننوځئ.', 'error');
      setActiveSection(Section.Login);
      return;
    }
    const bookToAcquire = books.find(b => b.id === bookId);
    if (!bookToAcquire) return;

    // Check if user currently has active access (or is admin)
    const hasActiveAccess = db.checkBookAccess(bookId);
    if (hasActiveAccess && (currentUser.role === 'admin' || bookToAcquire.uploadedBy === currentUser.email)) {
      showToast('تاسو لا دمخه دې کتاب ته بشپړ لاسرسی لرئ.', 'success');
      setActiveSection(Section.MyPurchases);
      return;
    }

    if (!bookToAcquire.isForSale || bookToAcquire.price <= 0) {
      await handleAcquireFreeBook(bookId);
    } else {
      const referenceCode = `KHW-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const purchaseId = `purchase-${Date.now()}`;
      const newPurchase: Purchase = {
        id: purchaseId,
        bookId: bookToAcquire.id,
        userId: currentUser.email,
        amount: bookToAcquire.price,
        referenceCode: referenceCode,
        status: 'pending',
        paymentMethod: null,
        createdAt: Date.now(),
      };
      await db.add('purchases', newPurchase, purchaseId);
      setPaymentFlow({
        purchase: newPurchase,
        book: bookToAcquire,
        methodSelectionOpen: true,
        activeMethod: null,
      });
    }
  };

  const handleClosePaymentModals = () => {
    setPaymentFlow({ purchase: null, book: null, methodSelectionOpen: false, activeMethod: null });
  };
  
  const handleSelectPaymentMethod = async (method: PaymentMethod, purchase: Purchase) => {
    await db.update('purchases', purchase.id, { paymentMethod: method });
    setPaymentFlow(prev => ({ ...prev, methodSelectionOpen: false, activeMethod: method }));
  };
  
  // IMPORTANT: this used to unconditionally write status:'completed' straight
  // to the database and immediately trigger a download, no matter which
  // payment button called it — including fake/simulated ones. That single
  // line was the reason "payment" flows could hand out free books. Now we
  // ask the SERVER (the only trusted source of truth) whether the purchase
  // is really completed before doing anything else.
  const handleAdminApproveOrder = async (purchaseId: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/admin/purchases/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId, adminUserId: currentUser.email })
      });
      const data = await res.json();
      if (data?.success) {
        showToast('پیرودل تایید او کتاب خلاص شو.', 'success');
      } else {
        showToast(data?.error || 'تایید کول ناکام شول.', 'error');
      }
    } catch (e) {
      showToast('د تایید کولو کې ستونزه رامنځته شوه.', 'error');
    }
  };

  const handlePaymentSuccess = async (purchaseId: string) => {
    const purchase = (paymentFlow.purchase && paymentFlow.purchase.id === purchaseId)
        ? paymentFlow.purchase
        : purchases.find(p => p.id === purchaseId);

    if (!purchase) {
        showToast('ستونزه رامنځته شوه.', 'error');
        handleClosePaymentModals();
        return;
    }

    let isReallyCompleted = false;
    try {
      const statusRes = await fetch(`/api/payments/status/${purchase.id}`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        isReallyCompleted = !!statusData.isCompleted;
      }
    } catch (e) {
      console.warn('Payment status check failed:', e);
    }

    if (!isReallyCompleted) {
      handleClosePaymentModals();
      showToast('ستاسو تادیه لا تر اوسه نه ده تایید شوې. کله چې تایید شي، کتاب به اتومات خلاص شي — تاسو کولی شئ "زما پیرودل" کې حالت وګورئ.', 'error');
      setActiveSection(Section.MyPurchases);
      return;
    }

    const book = books.find(b => b.id === purchase.bookId || b.id === (purchase.bookId || '').replace(/^book-/, '') || b.id === `book-${(purchase.bookId || '').replace(/^book-/, '')}`);
    if (book) {
      // Trigger download immediately
      try {
        const downloadLink = document.createElement('a');
        downloadLink.href = `/api/files/download/${book.id}?user=${encodeURIComponent(currentUser?.email || '')}`;
        downloadLink.download = book.pdfFileName || `${book.title}.pdf`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        await db.recordBookDownloadTime(book.id);
        await db.incrementDownloadCount(book.id);
      } catch (dlErr) {
        console.error("Download error:", dlErr);
      }

      // Open reader modal immediately with active 30s timer
      setPreviewState({ isOpen: true, book });
    }

    handleClosePaymentModals();
    showToast('کتاب ترلاسه شو او ډاونلوډ پیل شو! تاسو ۳۰ ثانیې بشپړ لاسرسی لرئ.', 'success');
    setActiveSection(Section.Books);
  };

  const handleAddAd = async (adData: Omit<Ad, 'id'>) => {
    const adId = `ad-${Date.now()}`;
    const newAd: Ad = { id: adId, ...adData };
    await db.add('ads', newAd, adId);
    showToast('Advertisement created successfully!', 'success');
  };

  const handleUpdateAd = async (adId: string, adData: Omit<Ad, 'id'>) => {
    await db.update('ads', adId, adData);
    showToast('Advertisement updated successfully!', 'success');
  };

  const handleDeleteAd = async (adId: string) => {
    if (window.confirm('Are you sure you want to delete this advertisement?')) {
      await db.deleteItem('ads', adId);
      showToast('Advertisement deleted.', 'success');
    }
  };

  const handleSaveSettings = async (newSettings: Omit<Settings, 'id'>) => {
    await db.putSettings(newSettings);
    showToast('Settings saved successfully!', 'success');
    setActiveSection(Section.Admin);
  };
  
  const handleUpdateBookDetails = async (bookId: string, updates: Partial<Book>) => {
    await db.update('books', bookId, updates);
    setEditState({ isOpen: false, book: null });
    showToast('Book details updated successfully!', 'success');
  };

  const handleSendMessage = async (message: string) => {
    setIsChatLoading(true);
    const updatedMessages = [...chatMessages, { role: 'user' as const, text: message }];
    setChatMessages(updatedMessages);
    
    const bookListForContext = books
      .filter(b => b.status === 'approved')
      .map(b => ({ title: b.title, author: b.author, language: b.language, tags: b.tags, price: b.price }))
      .slice(0, 20);

    try {
        const res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                history: chatMessages,
                booksContext: bookListForContext
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get AI response.');

        const responseText = (data.text || '').trim();
        
        const navRegex = /\[NAVIGATE:(\w+(?:-\w+)*)\]/;
        const match = responseText.match(navRegex);

        if (match && match[1]) {
            const section = match[1] as Section;
            if (Object.values(Section).includes(section)) {
                setActiveSection(section);
                setIsChatOpen(false);
                showToast(`Navigating you to the ${section.replace('-',' ')} page.`, 'success');
            } else {
                setChatMessages(prev => [...prev, { role: 'model', text: `Sorry, I can't navigate to "${section}". It's not a valid section.` }]);
            }
        } else {
             setChatMessages(prev => [...prev, { role: 'model', text: responseText }]);
        }
    } catch (e) {
        console.error("Chat error:", e);
        setChatMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
        setIsChatLoading(false);
    }
  };
  
  const handleRequestSummary = async (bookId: string) => {
      const bookToSummarize = books.find(b => b.id === bookId);
      if (!bookToSummarize) return;

      setSummarizeState({ isOpen: true, book: bookToSummarize, summary: '', isLoading: true, error: '' });
      
      try {
          const res = await fetch('/api/ai/summarize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  bookId: bookToSummarize.id,
                  title: bookToSummarize.title,
                  author: bookToSummarize.author,
                  language: bookToSummarize.language,
                  description: bookToSummarize.description,
                  category: bookToSummarize.category,
                  pdfData: bookToSummarize.pdfUrl
              })
          });

          const data = await res.json();
          if (!res.ok) {
              throw new Error(data.error || 'Failed to generate summary.');
          }

          setSummarizeState(s => ({ ...s, summary: data.summary, isLoading: false }));
      } catch (e) {
          console.error("Summarization error:", e);
          const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
          setSummarizeState(s => ({ ...s, isLoading: false, error: `Failed to generate summary: ${errorMessage}` }));
      }
  };
  const handleCloseSummary = () => setSummarizeState({ isOpen: false, book: null, summary: '', isLoading: false, error: '' });

  const handleRequestEdit = (bookId: string) => {
    const bookToEdit = books.find(b => b.id === bookId);
    if (bookToEdit) {
      setEditState({ isOpen: true, book: bookToEdit });
    }
  };
  const handleCloseEdit = () => setEditState({ isOpen: false, book: null });
  
  const handleClosePreview = () => setPreviewState({ isOpen: false, book: null });

  const approvedBooks = books.filter(book => book.status === 'approved' || !book.status || book.status !== 'rejected');
  const pendingBooks = books.filter(book => book.status === 'pending');
  const myBooks = books.filter(book => currentUser && book.uploadedBy === currentUser.email);
  const myPurchasedBooks = books.filter(book => {
    if (!currentUser) return false;
    const isPaid = Boolean((book.isForSale || Number(book.price) > 0) && Number(book.price) > 0);
    if (!isPaid) return false; // Free books are in the main library

    const cleanId = book.id.replace(/^book-/, '');
    const userBookIds = currentUser.purchasedBookIds || [];
    const inUserList = userBookIds.some(id => {
      const clean = id.replace(/^book-/, '');
      return id === book.id || id === cleanId || clean === cleanId || id === `book-${cleanId}`;
    });
    const inPurchasesList = purchases.some(p => 
      p.userId?.toLowerCase().trim() === currentUser.email?.toLowerCase().trim() &&
      (p.bookId === book.id || p.bookId === cleanId || p.bookId === `book-${cleanId}`) &&
      p.status === 'completed'
    );

    return inUserList || inPurchasesList;
  });

  const pendingApprovalCount = currentUser?.role === 'admin' ? pendingBooks.length : 0;
  
  if (!isInitialized) {
      return <div className="flex justify-center items-center h-screen bg-slate-100 dark:bg-slate-900">
          <div className="text-center">
              <i className="fas fa-spinner fa-spin text-4xl text-indigo-500"></i>
              <p className="mt-4 text-lg font-semibold text-slate-700 dark:text-slate-200">Loading Library...</p>
          </div>
      </div>;
  }
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header
        activeSection={activeSection}
        onNavigate={setActiveSection}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        theme={theme}
        toggleTheme={toggleTheme}
        pendingApprovalCount={pendingApprovalCount}
        installPrompt={canShowInstallButton && installPromptEvent}
        onInstallClick={handleInstallClick}
        onRequestPublishGuide={handleRequestPublishGuide}
        onRequestGithubPublishGuide={handleRequestGithubPublishGuide}
      />
      <main className="flex-grow container mx-auto p-4 sm:p-6 md:p-8">
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
          {activeSection === Section.Register && <RegisterForm onRegister={handleRegister} onNavigate={setActiveSection} isLoading={isRegistering} />}
          {activeSection === Section.Login && <LoginForm onLogin={handleLogin} onNavigate={setActiveSection} />}
          {activeSection === Section.ForgotPassword && <ForgotPasswordForm onNavigate={setActiveSection} showToast={showToast} />}
          {activeSection === Section.Upload && <UploadForm onUpload={handleAddBook} showToast={showToast} />}
          {activeSection === Section.Books && <BookList books={approvedBooks} ads={ads} reviews={reviews} onAddReview={handleAddReview} onDelete={handleDeleteBook} onRequestSummary={handleRequestSummary} onRequestEdit={handleRequestEdit} onRequestPreview={handleRequestPreview} onPurchase={handleRequestAcquisition} onDownload={handleDownloadBook} searchQuery={searchQuery} onNavigate={setActiveSection} />}
          {activeSection === Section.Admin && currentUser?.role === 'admin' && <AdminPanel books={pendingBooks} reviews={reviews} onAddReview={handleAddReview} onApprove={handleApproveBook} onReject={handleDeleteBook} onRequestSummary={handleRequestSummary} onRequestEdit={handleRequestEdit} onRequestPreview={handleRequestPreview} onNavigate={setActiveSection} onDownload={handleDownloadBook} />}
          {activeSection === Section.MyBooks && <MyBooks books={myBooks} onDelete={handleDeleteBook} onApprove={handleApproveBook} onRequestSummary={handleRequestSummary} onRequestEdit={handleRequestEdit} onRequestPreview={handleRequestPreview} reviews={reviews} onAddReview={handleAddReview} onNavigate={setActiveSection} onDownload={handleDownloadBook} />}
          {activeSection === Section.MyPurchases && <MyPurchases books={myPurchasedBooks} reviews={reviews} onAddReview={handleAddReview} onRequestSummary={handleRequestSummary} onRequestPreview={handleRequestPreview} onNavigate={setActiveSection} onDownload={handleDownloadBook}/>}
          {activeSection === Section.AdsManager && currentUser?.role === 'admin' && <AdManager ads={ads} onAdd={handleAddAd} onUpdate={handleUpdateAd} onDelete={handleDeleteAd} />}
          {activeSection === Section.Orders && currentUser?.role === 'admin' && <OrderManagement purchases={purchases} books={books} users={users} onApproveOrder={handleAdminApproveOrder} />}
          {activeSection === Section.Settings && currentUser?.role === 'admin' && <PaymentSettings settings={settings} onSave={handleSaveSettings} />}
          {activeSection === Section.Profile && currentUser && <Profile showToast={showToast} />}
        </div>
      </main>
      <Footer onNavigate={setActiveSection} />
      <div className="fixed bottom-0 right-0 p-4 space-y-3 z-[100]">
        {toasts.map(toast => (
          <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => closeToast(toast.id)} />
        ))}
      </div>
      {summarizeState.isOpen && (
        <SummarizeModal
            isOpen={summarizeState.isOpen}
            onClose={handleCloseSummary}
            bookTitle={summarizeState.book?.title || ''}
            bookLanguage={summarizeState.book?.language || 'English'}
            summary={summarizeState.summary}
            isLoading={summarizeState.isLoading}
            error={summarizeState.error}
        />
      )}
      {editState.isOpen && (
        <EditBookModal
            isOpen={editState.isOpen}
            onClose={handleCloseEdit}
            book={editState.book}
            onUpdate={handleUpdateBookDetails}
        />
      )}
      {previewState.isOpen && (
        <BookPreviewModal
            isOpen={previewState.isOpen}
            onClose={handleClosePreview}
            book={previewState.book}
            initialPage={previewState.initialPage}
        />
       )}

      {paymentFlow.methodSelectionOpen && (
        <PaymentMethodSelectionModal
          isOpen={paymentFlow.methodSelectionOpen}
          onClose={handleClosePaymentModals}
          onSelectMethod={handleSelectPaymentMethod}
          onSuccess={handlePaymentSuccess}
          purchase={paymentFlow.purchase}
          book={books.find(b => b.id === paymentFlow.purchase?.bookId)}
        />
      )}
      {paymentFlow.activeMethod === PaymentMethod.DirectTransfer && (
        <DirectPaymentModal
          isOpen={true}
          onClose={handleClosePaymentModals}
          onSuccess={handlePaymentSuccess}
          purchase={paymentFlow.purchase}
          book={books.find(b => b.id === paymentFlow.purchase?.bookId)}
        />
      )}
      {paymentFlow.activeMethod === PaymentMethod.HesabPay && (
        <HesabPayPaymentModal
          isOpen={true}
          onClose={handleClosePaymentModals}
          onSuccess={handlePaymentSuccess}
          purchase={paymentFlow.purchase}
          book={books.find(b => b.id === paymentFlow.purchase?.bookId)}
        />
      )}
      {paymentFlow.activeMethod === PaymentMethod.TelegramStars && (
        <TelegramStarsModal
          isOpen={true}
          onClose={handleClosePaymentModals}
          onSuccess={handlePaymentSuccess}
          purchase={paymentFlow.purchase}
          book={books.find(b => b.id === paymentFlow.purchase?.bookId)}
        />
      )}
      {paymentFlow.activeMethod === PaymentMethod.Tonkeeper && (
        <CryptoPaymentModal
          isOpen={true}
          onClose={handleClosePaymentModals}
          onSuccess={handlePaymentSuccess}
          purchase={paymentFlow.purchase}
          book={books.find(b => b.id === paymentFlow.purchase?.bookId)}
        />
      )}
      
      <Chatbot isOpen={isChatOpen} onToggle={() => setIsChatOpen(!isChatOpen)} messages={chatMessages} onSendMessage={handleSendMessage} isLoading={isChatLoading} />

      <InfoModal
        isOpen={forgotPasswordInfo.isOpen}
        onClose={() => setForgotPasswordInfo({ isOpen: false, message: '' })}
        title="Password Recovery"
      >
        <p className="whitespace-pre-wrap font-mono bg-slate-100 dark:bg-slate-700 p-3 rounded-md text-center">{forgotPasswordInfo.message}</p>
      </InfoModal>

      <PublishGuideModal isOpen={isPublishGuideOpen} onClose={handleClosePublishGuide} />
      <GithubPublishGuideModal isOpen={isGithubPublishGuideOpen} onClose={handleCloseGithubPublishGuide} />
    </div>
  );
};

export default App;