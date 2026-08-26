import React, { useState, useMemo } from 'react';
import { Book, User, Review, Section } from '../types';
import StarRating from './StarRating';
import { useAuth } from '../AuthContext';
import * as db from '../db';

const Highlight: React.FC<{ text: string; highlight: string; }> = ({ text, highlight }) => {
  if (!highlight.trim()) {
    return <>{text}</>;
  }
  const regex = new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/50 text-slate-900 dark:text-slate-100 rounded px-0.5 py-0">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

interface BookCardProps {
  book: Book;
  reviews: Review[];
  onAddReview: (bookId: string, rating: number, comment: string) => void;
  onDelete: (id: string) => void;
  onPurchase: (id: string) => void;
  onDownload?: (id: string) => void;
  showStatus?: boolean;
  onApprove?: (id: string) => void;
  onRequestSummary?: (id: string) => void;
  onRequestEdit?: (id: string) => void;
  onRequestPreview?: (id: string) => void;
  onNavigate?: (section: Section) => void;
  highlightQuery?: string;
}

const ReviewForm: React.FC<{
  bookId: string;
  onAddReview: (bookId: string, rating: number, comment: string) => void;
}> = ({ bookId, onAddReview }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please select a rating.');
      return;
    }
    if (!comment.trim()) {
      setError('Please write a comment.');
      return;
    }
    onAddReview(bookId, rating, comment);
    setRating(0);
    setComment('');
    setError('');
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
      <h4 className="font-bold text-slate-700 dark:text-slate-200">Leave a Review</h4>
      <div>
          <StarRating rating={rating} onRatingChange={setRating} isInteractive={true} />
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Write your comment..."
        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
        rows={3}
      ></textarea>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" className="self-start bg-indigo-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-indigo-500 dark:hover:bg-indigo-700 transition-all">
        Submit
      </button>
    </form>
  );
};


const BookCard: React.FC<BookCardProps> = ({ book, reviews, onAddReview, onDelete, onPurchase, onDownload, showStatus = false, onApprove, onRequestSummary, onRequestEdit, onRequestPreview, onNavigate, highlightQuery = '' }) => {
  const { currentUser } = useAuth();
  const [showReviews, setShowReviews] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const cleanBookId = book.id.replace(/^book-/, '');
  const isOwner = Boolean(
    currentUser?.email && 
    book.uploadedBy && 
    currentUser.email.toLowerCase().trim() === book.uploadedBy.toLowerCase().trim()
  );
  const isAdmin = currentUser?.role === 'admin';
  // Accurate check if book is paid/for-sale
  const isForSale = Boolean((book.isForSale || (book.price && Number(book.price) > 0)) && Number(book.price || 0) > 0);

  const hasTemporaryAccess = timeLeft !== null && timeLeft > 0;

  // Can read/download only if it is a free book, or if the user is the owner, admin, or has active temporary 30s access
  const canRead = !isForSale || isOwner || isAdmin || hasTemporaryAccess;
  const canEdit = (isOwner || isAdmin) && onRequestEdit;
  const canDelete = isOwner || isAdmin;
  const canApprove = isAdmin && book.status === 'pending' && onApprove;

  React.useEffect(() => {
    const updateAccess = () => {
      const remaining = db.getBookAccessRemainingSeconds(book.id);
      setTimeLeft(remaining > 0 ? remaining : null);
    };

    updateAccess();
    const interval = setInterval(updateAccess, 1000);
    return () => clearInterval(interval);
  }, [currentUser, book.id, isForSale]);
  
  const bookReviews = useMemo(() => 
    reviews.filter(r => r.bookId === book.id).sort((a,b) => b.createdAt - a.createdAt),
    [reviews, book.id]
  );
  
  const averageRating = useMemo(() => {
    if (bookReviews.length === 0) return 0;
    const total = bookReviews.reduce((sum, review) => sum + review.rating, 0);
    return total / bookReviews.length;
  }, [bookReviews]);
  
  const statusBadge = {
    pending: <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-yellow-900/50 dark:text-yellow-300">Pending Approval</span>,
    approved: <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-green-900/50 dark:text-green-300">Approved</span>,
  };

  const hasActions = canEdit || canDelete || canApprove;
  
  const userHasReviewed = currentUser && bookReviews.some(r => r.username === currentUser.email);

  const [isDownloading, setIsDownloading] = useState(false);

  const dispatchToast = (message: string, type: 'success' | 'error' = 'success') => {
    window.dispatchEvent(new CustomEvent('showtoast', { detail: { message, type } }));
  };

  const handleReadOnline = () => {
    if (isForSale && !canRead) {
      dispatchToast('🔒 This book is premium. Please purchase first to read online.', 'error');
      onPurchase(book.id);
      return;
    }

    if (onDownload) {
      onDownload(book.id);
    }
    dispatchToast(`📖 Opening "${book.title}"...`, 'success');
    if (onRequestPreview) {
      onRequestPreview(book.id);
    } else {
      const userParam = currentUser?.email ? `?user=${encodeURIComponent(currentUser.email)}` : '';
      const viewUrl = book.pdfUrl && book.pdfUrl.startsWith('data:') ? book.pdfUrl : `/api/files/view/${book.id}${userParam}`;
      const absoluteViewUrl = viewUrl.startsWith('http') ? viewUrl : `${window.location.origin}${viewUrl}`;
      const tgWebApp = (window as any).Telegram?.WebApp;
      if (tgWebApp && typeof tgWebApp.openLink === 'function') {
        tgWebApp.openLink(absoluteViewUrl);
      } else {
        window.open(absoluteViewUrl, '_blank');
      }
    }
  };

  const handleDownloadFile = async () => {
    if (isForSale && !canRead) {
      dispatchToast('🔒 To download this book, please purchase it first.', 'error');
      onPurchase(book.id);
      return;
    }

    if (onDownload) {
      onDownload(book.id);
    }
    setIsDownloading(true);
    dispatchToast(`📥 Downloading "${book.title}"...`, 'success');
    try {
      const fileName = book.pdfFileName || `${book.title}.pdf`;
      const userParam = currentUser?.email ? `?user=${encodeURIComponent(currentUser.email)}` : '';
      const absoluteDownloadUrl = `${window.location.origin}/api/files/download/${book.id}${userParam}`;
      const tgWebApp = (window as any).Telegram?.WebApp;

      if (tgWebApp && typeof tgWebApp.openLink === 'function') {
        tgWebApp.openLink(absoluteDownloadUrl);
        return;
      }

      if (book.pdfUrl && book.pdfUrl.startsWith('data:')) {
        const tempLink = document.createElement('a');
        tempLink.href = book.pdfUrl;
        tempLink.setAttribute('download', fileName);
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        return;
      }

      // Standard browser download
      const a = document.createElement('a');
      a.href = absoluteDownloadUrl;
      a.setAttribute('download', fileName);
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        window.location.href = absoluteDownloadUrl;
      }, 300);

    } catch (err) {
      console.error('Download error:', err);
      const userParam = currentUser?.email ? `?user=${encodeURIComponent(currentUser.email)}` : '';
      const fallbackUrl = `${window.location.origin}/api/files/download/${book.id}${userParam}`;
      const tgWebApp = (window as any).Telegram?.WebApp;
      if (tgWebApp && typeof tgWebApp.openLink === 'function') {
        tgWebApp.openLink(fallbackUrl);
      } else {
        window.location.href = fallbackUrl;
      }
    } finally {
      setTimeout(() => setIsDownloading(false), 1200);
    }
  };

  const handleShare = async () => {
    const cleanOrigin = window.location.origin;
    const cleanUrl = `${cleanOrigin}/?book=${book.id}`;
    const textMessage = `📚 Read and download "${book.title}" (Author: ${book.author || 'Unknown'}) from Khawreen Digital Library:\n${cleanUrl}`;
    
    const tgWebApp = (window as any).Telegram?.WebApp;
    
    if (tgWebApp) {
      const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(cleanUrl)}&text=${encodeURIComponent(`📚 ${book.title} - ${book.author || 'Khawreen Library'}`)}`;
      if (tgWebApp.openTelegramLink) {
        tgWebApp.openTelegramLink(tgShareUrl);
        dispatchToast('Link shared to Telegram!', 'success');
        return;
      } else if (tgWebApp.openLink) {
        tgWebApp.openLink(tgShareUrl);
        dispatchToast('Link opened!', 'success');
        return;
      }
    }

    const shareData = {
      title: book.title,
      text: `📚 "${book.title}" from Khawreen Library:`,
      url: cleanUrl,
    };

    const fallbackCopyToClipboard = () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(textMessage).then(() => {
            dispatchToast('✅ Book link and details copied!', 'success');
          }).catch(() => {
            legacyCopy();
          });
          return;
        }
      } catch (e) {}
      legacyCopy();
    };

    const legacyCopy = () => {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = textMessage;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          dispatchToast('✅ Book link and details copied!', 'success');
          return;
        }
      } catch (e) {}
      dispatchToast(`Book link: ${cleanUrl}`, 'success');
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        dispatchToast('Successfully shared!', 'success');
      } catch (error) {
        if (error instanceof DOMException && error.name !== 'AbortError') {
          fallbackCopyToClipboard();
        }
      }
    } else {
      fallbackCopyToClipboard();
    }
  };


  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-slate-900/50">
      <div className="flex flex-col md:flex-row">
        <img src={book.coverUrl} alt={book.title} className="w-full h-48 md:h-auto md:w-40 object-contain bg-slate-100 dark:bg-slate-700" />
        <div className="p-5 flex flex-col flex-grow w-full">
          <div className="flex justify-between items-start mb-2">
              <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100"><Highlight text={book.title} highlight={highlightQuery} /></h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">by <Highlight text={book.author} highlight={highlightQuery} /></p>
              </div>
              {showStatus && statusBadge[book.status]}
          </div>

          <div className="flex items-center gap-2 mb-2">
              <StarRating rating={averageRating} />
              <span className="text-xs text-slate-500 dark:text-slate-400">({bookReviews.length} review{bookReviews.length !== 1 ? 's' : ''})</span>
          </div>

          <div className="flex flex-wrap gap-2 mb-4 items-center">
            {isForSale ? (
              <span className="text-xs font-bold bg-amber-100 text-amber-950 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                <i className="fas fa-tag text-amber-600 dark:text-amber-400"></i>
                <span>{book.price.toLocaleString()} AFN</span>
              </span>
            ) : (
              <span className="text-xs font-bold bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                <i className="fas fa-gift text-emerald-600 dark:text-emerald-400"></i>
                <span>Free Book</span>
              </span>
            )}
            {isAdmin && (
              <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full">
                🛡️ Admin
              </span>
            )}
            <span className="text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-2 py-1 rounded-full">{book.language}</span>
            <span className="text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-2 py-1 rounded-full flex items-center gap-1">
                <i className="fas fa-download"></i>
                {book.downloadCount || 0}
            </span>
            {book.tags?.map(tag => (
              <span key={tag} className="text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-1 rounded-full"><Highlight text={tag} highlight={highlightQuery} /></span>
            ))}
          </div>
          
          <div className="flex-grow"></div>

          {timeLeft !== null && (
            <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 rounded-xl text-xs font-semibold border border-amber-200 dark:border-amber-800/50 flex flex-col items-center justify-center gap-1.5 animate-pulse w-full shadow-sm">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
                <i className="fas fa-stopwatch fa-spin"></i>
                <span>Online Access: {timeLeft}s remaining</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 text-center leading-relaxed">
                💡 You can download the PDF to your device now for permanent access. Online access will lock after 30 seconds.
              </p>
            </div>
          )}

          <div className="flex flex-col space-y-2.5 mt-auto">
            {canRead ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button 
                  onClick={handleReadOnline} 
                  className="flex-1 bg-gradient-to-r from-sky-500 to-sky-600 text-white font-bold py-2.5 px-4 rounded-xl hover:from-sky-600 hover:to-sky-700 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-sky-500/20 transform active:scale-95 hover:-translate-y-0.5"
                >
                    <i className="fas fa-book-open"></i> <span>Read Online</span>
                </button>
                <button 
                  onClick={handleDownloadFile} 
                  disabled={isDownloading} 
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-2.5 px-4 rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-500/20 transform active:scale-95 hover:-translate-y-0.5 disabled:opacity-50"
                >
                    <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-download'}`}></i> <span>{isDownloading ? 'Downloading...' : 'Download PDF'}</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <button 
                  onClick={() => onPurchase(book.id)} 
                  className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold py-3 px-5 rounded-xl shadow-lg shadow-emerald-600/30 transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer transform active:scale-95 hover:-translate-y-0.5 text-base"
                >
                  <i className="fas fa-shopping-cart text-lg text-emerald-200"></i>
                  <span>Buy Book — {book.price.toLocaleString()} AFN</span>
                </button>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => onRequestPreview && onRequestPreview(book.id)}
                    className="flex-1 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800 font-bold py-2 px-3 rounded-xl transition text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <i className="fas fa-eye text-sky-500"></i>
                    <span>Free Sample (2 Pages)</span>
                  </button>
                  <button 
                    onClick={() => onPurchase(book.id)}
                    className="flex-1 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 font-semibold py-2 px-3 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Please purchase via HesabPay or Crypto to unlock full reading and downloading"
                  >
                    <i className="fas fa-lock text-rose-500"></i>
                    <span>Download (Locked)</span>
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={handleShare} title="Share Book" className="flex-1 min-w-[100px] bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-bold py-2 px-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 flex items-center justify-center gap-1.5 text-xs sm:text-sm transform active:scale-95 shadow-sm">
                  <i className="fas fa-share-alt text-indigo-500"></i> <span>Share</span>
              </button>

              {onRequestSummary && (
                  <button onClick={() => onRequestSummary(book.id)} title="Summarize with AI" className="flex-1 min-w-[100px] bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-bold py-2 px-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 flex items-center justify-center gap-1.5 text-xs sm:text-sm transform active:scale-95 shadow-sm">
                      <i className="fas fa-magic text-amber-500"></i> <span>AI Summary</span>
                  </button>
              )}
              
              <button onClick={() => setShowReviews(!showReviews)} title="View Reviews" className="flex-1 min-w-[100px] bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-bold py-2 px-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 flex items-center justify-center gap-1.5 text-xs sm:text-sm transform active:scale-95 shadow-sm">
                <i className={`fas ${showReviews ? 'fa-comment-slash' : 'fa-comments'} text-purple-500`}></i> <span>Reviews</span>
              </button>
            </div>
          </div>

          {hasActions && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2">
              {canApprove && <button onClick={() => onApprove(book.id)} className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 py-1 px-3 rounded text-sm font-semibold hover:bg-green-200 dark:hover:bg-green-800/60">Approve</button>}
              {canEdit && <button onClick={() => onRequestEdit(book.id)} className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 py-1 px-3 rounded text-sm font-semibold hover:bg-blue-200 dark:hover:bg-blue-800/60">Edit</button>}
              {canDelete && <button onClick={() => onDelete(book.id)} className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 py-1 px-3 rounded text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-800/60">Delete</button>}
            </div>
          )}
        </div>
      </div>
      
      {showReviews && (
        <div className="p-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 animate-fade-in">
          <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3">{bookReviews.length > 0 ? 'Reviews' : 'No reviews yet'}</h4>
          <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
            {bookReviews.map(review => (
              <div key={review.id} className="pb-4 border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{review.username}</span>
                    <StarRating rating={review.rating} />
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{review.comment}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{new Date(review.createdAt).toLocaleDateString()}</p>
              </div>
            ))}
          </div>

          {currentUser && canRead && !userHasReviewed &&
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <ReviewForm bookId={book.id} onAddReview={onAddReview} />
            </div>
          }
          {!currentUser && onNavigate && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    <a href="#" onClick={(e) => { e.preventDefault(); onNavigate(Section.Login); }} className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Login</a> to leave a review.
                </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BookCard;