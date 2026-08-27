import React, { useState, useEffect } from 'react';
import { Book, Purchase, Settings } from '../types';
import * as db from '../db';

interface TelegramStarsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (purchaseId: string) => void;
  purchase: Purchase | null;
  book: Book | undefined;
}

const TelegramStarsModal: React.FC<TelegramStarsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  purchase,
  book,
}) => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [starsState, setStarsState] = useState<'init' | 'processing' | 'bot_delivery' | 'success'>('init');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const unsub = db.onSettingsSnapshot((data) => {
      if (data) setSettings(data);
    });
    return () => unsub();
  }, []);

  if (!isOpen || !purchase || !book) return null;

  // Telegram Stars: roughly 1 Star = 0.02 USD = ~1.4 AFN.
  const starsAmount = Math.max(10, Math.round(book.price / 1.4));

  const handlePayWithStars = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStarsState('processing');

    const tgWebApp = (window as any).Telegram?.WebApp;

    // Real Telegram WebApp Stars invoice integration
    if (tgWebApp && typeof tgWebApp.openInvoice === 'function') {
      try {
        tgWebApp.openInvoice(`star_inv_${purchase.id}_${starsAmount}`, (status: string) => {
          if (status === 'paid') {
            setStarsState('bot_delivery');
            finalizePayment();
          } else if (status === 'cancelled') {
            setStarsState('init');
            setErrorMessage('Payment was cancelled in Telegram.');
          } else {
            // failed / unknown — do NOT treat as success
            setStarsState('init');
            setErrorMessage('Payment could not be completed. Please try again.');
          }
        });
        return;
      } catch (err) {
        console.warn('Telegram openInvoice error:', err);
      }
    }

    // Outside Telegram, there is no real way to charge Stars from a browser —
    // send them to the bot instead of faking a successful payment.
    setStarsState('init');
    setErrorMessage('Telegram Stars لومړی د Telegram اپلیکیشن کې خلاصیدو ته اړتیا لري. مهرباني وکړئ زموږ Telegram bot خلاص کړئ.');
  };

  // Completion is confirmed by our server after Telegram itself reports a
  // successful_payment webhook (see telegram-bot.ts) — this only reflects
  // that the request has been sent to Telegram; it never marks the purchase
  // completed itself, which is what previously let anyone "pay" for free by
  // simply opening this dialog in a normal browser.
  const finalizePayment = () => {
    setTimeout(async () => {
      try {
        try {
          await fetch('/api/telegram-notify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              purchaseId: purchase.id,
              bookId: book.id,
              username: telegramUsername || purchase.userId,
              stars: starsAmount,
            }),
          });
        } catch (ignored) {
          // Non-blocking notification
        }

        // Poll the server briefly for real confirmation from Telegram's webhook.
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          try {
            const res = await fetch(`/api/payments/status/${purchase.id}`);
            if (res.ok) {
              const data = await res.json();
              if (data.isCompleted) {
                clearInterval(poll);
                setStarsState('success');
                onSuccess(purchase.id);
                return;
              }
            }
          } catch {}
          if (attempts > 15) {
            clearInterval(poll);
          }
        }, 2000);
      } catch (e) {
        console.error('Error finalizing Stars payment:', e);
      }
    }, 500);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[9999] flex justify-center items-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 p-4 flex justify-between items-center text-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center text-lg shadow">
              <i className="fas fa-star animate-pulse"></i>
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight leading-tight font-sans">Telegram Stars</h3>
              <p className="text-[10px] text-amber-950 font-bold uppercase tracking-wider">Automated In-App Bot Payment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-950 hover:text-white transition w-7 h-7 rounded-full hover:bg-black/10 flex items-center justify-center cursor-pointer font-bold"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Order Snapshot */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex justify-between items-center text-xs">
            <div className="min-w-0 pr-2">
              <span className="text-[10px] text-slate-400 block font-medium">Book</span>
              <strong className="text-white text-sm truncate block font-bold">"{book.title}"</strong>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-slate-400 block font-medium">Price</span>
              <div className="flex items-center gap-1 text-amber-400 font-black text-sm">
                <i className="fas fa-star text-xs"></i>
                <span>{starsAmount} Stars</span>
              </div>
              <span className="text-[9px] text-slate-400 font-mono font-medium">({book.price} AFN)</span>
            </div>
          </div>

          {starsState === 'init' && (
            <form onSubmit={handlePayWithStars} className="space-y-4">
              <div className="p-4 bg-gradient-to-br from-amber-950/30 to-slate-950 rounded-2xl border border-amber-500/20 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                  <i className="fa-brands fa-telegram text-base"></i>
                  <span>Automatic Telegram Stars Payment</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  You can pay directly from your Telegram Stars balance. The payment will be verified instantly and your book will be unlocked immediately.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">
                  Telegram Username:
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    @
                  </div>
                  <input
                    type="text"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value.replace(/^@/, ''))}
                    placeholder="your_username"
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Required for direct file delivery via our Telegram Bot.
                </p>
              </div>

              {errorMessage && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-800 rounded-xl text-xs text-rose-300 text-center font-medium">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black py-3.5 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-amber-950 cursor-pointer"
              >
                <i className="fas fa-star text-sm"></i>
                <span>Pay {starsAmount} Telegram Stars Now</span>
              </button>
            </form>
          )}

          {starsState === 'processing' && (
            <div className="py-8 text-center space-y-4">
              <div className="relative flex items-center justify-center w-16 h-16 mx-auto">
                <div className="animate-spin rounded-full h-14 w-14 border-2 border-amber-500/20 border-t-amber-400"></div>
                <div className="absolute text-amber-400 text-xl animate-pulse">
                  <i className="fas fa-star"></i>
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-white">Verifying Telegram Stars...</h4>
                <p className="text-[11px] text-amber-400 uppercase font-bold">Verifying Telegram Stars API Charge</p>
                <p className="text-[10px] text-slate-400">Communicating with Telegram Stars ledger...</p>
              </div>
            </div>
          )}

          {starsState === 'bot_delivery' && (
            <div className="py-8 text-center space-y-4">
              <div className="relative flex items-center justify-center w-16 h-16 mx-auto">
                <div className="animate-spin rounded-full h-14 w-14 border-2 border-sky-500/20 border-t-sky-400"></div>
                <div className="absolute text-sky-400 text-xl animate-pulse">
                  <i className="fa-brands fa-telegram"></i>
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-white">Delivering Book...</h4>
                <p className="text-[11px] text-sky-400 uppercase font-bold">Delivering PDF File to Telegram Bot</p>
                <p className="text-[10px] text-slate-400">Generating secure one-time download link...</p>
              </div>
            </div>
          )}

          {starsState === 'success' && (
            <div className="space-y-4 py-2">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-2xl mx-auto shadow-inner">
                  <i className="fas fa-check-circle animate-bounce"></i>
                </div>
                <div>
                  <h4 className="text-sm font-black text-emerald-400">Payment Confirmed & Book Unlocked!</h4>
                  <p className="text-[11px] text-slate-300">Your book is now available for download.</p>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-center">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      db.recordBookDownloadTime(book.id);
                      const url = book.pdfUrl?.startsWith('http') ? book.pdfUrl : `${window.location.origin}/api/files/view/${book.id}`;
                      const tgWebApp = (window as any).Telegram?.WebApp;
                      if (tgWebApp && typeof tgWebApp.openLink === 'function') {
                        tgWebApp.openLink(url);
                      } else {
                        window.open(url, '_blank');
                      }
                    }}
                    className="flex-1 bg-teal-600 hover:bg-teal-500 text-white text-xs font-black py-2.5 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <i className="fas fa-book-open"></i> Read Online
                  </button>
                  <button
                    onClick={() => {
                      db.recordBookDownloadTime(book.id);
                      const url = `${window.location.origin}/api/files/download/${book.id}`;
                      const tgWebApp = (window as any).Telegram?.WebApp;
                      if (tgWebApp && typeof tgWebApp.openLink === 'function') {
                        tgWebApp.openLink(url);
                      } else {
                        const a = document.createElement('a');
                        a.href = url;
                        a.setAttribute('download', book.pdfFileName || `${book.title}.pdf`);
                        a.target = '_blank';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black py-2.5 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <i className="fas fa-download"></i> Download PDF
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full bg-slate-950 border border-slate-800 text-slate-300 font-bold py-2.5 rounded-xl text-xs hover:bg-slate-800 cursor-pointer transition"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TelegramStarsModal;
