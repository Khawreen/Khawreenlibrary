import React, { useState, useEffect } from 'react';
import { Book, Purchase, Settings } from '../types';
import * as db from '../db';

interface DirectPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (purchaseId: string) => void;
  purchase: Purchase | null;
  book: Book | undefined;
}

const DirectPaymentModal: React.FC<DirectPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  purchase,
  book,
}) => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [contactNumber, setContactNumber] = useState('');
  const [txNote, setTxNote] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [step, setStep] = useState<'details' | 'submitted'>('details');

  useEffect(() => {
    const unsub = db.onSettingsSnapshot((data) => {
      if (data) setSettings(data);
    });
    return () => unsub();
  }, []);

  if (!isOpen || !purchase || !book) return null;

  const defaultTelegram = settings?.telegramAdminUsername || 'KhawreenLibrary';
  const defaultBankDetails = settings?.bankAccountDetails || `• Kabul Bank Account: 1001-002345-001
• Azizi Bank Account: 0101-987654-002
• Sarafi Transfer: Payable to "Khawreen Digital Library" in Kabul / Kandahar / Jalalabad`;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setReceiptPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const openTelegram = () => {
    const cleanUser = defaultTelegram.replace('@', '');
    const message = `Hello! I would like to purchase a book:\n📚 Title: ${book.title}\n💰 Price: ${book.price} AFN\n🔢 Reference Code: ${purchase.referenceCode}\n📧 My Email: ${purchase.userId}`;
    const url = `https://t.me/${cleanUser}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let receiptUrl = '';
      if (receiptFile) {
        try {
          receiptUrl = await db.uploadFile(receiptFile, 'cover', `receipt-${purchase.id}`);
        } catch (err) {
          console.warn('Could not upload receipt binary, saving base64 fallback', err);
          receiptUrl = receiptPreview || '';
        }
      }

      await db.update('purchases', purchase.id, {
        payerContact: contactNumber,
        notes: txNote,
        receiptUrl: receiptUrl,
        status: 'pending',
      });

      setStep('submitted');
    } catch (err) {
      console.error('Error submitting payment proof:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex justify-center items-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
      dir="ltr"
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200/80 dark:border-slate-800/80 overflow-hidden relative text-slate-800 dark:text-slate-100 my-auto transform transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Decorative Bar */}
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600"></div>

        {/* Modal Header Bar */}
        <div className="px-6 pt-6 pb-4 relative border-b border-slate-100 dark:border-slate-800/60">
          <button 
            onClick={onClose} 
            className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95"
            aria-label="Close"
          >
            <i className="fas fa-times text-sm"></i>
          </button>
          
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-xl shadow-md shadow-emerald-600/20 flex-shrink-0">
              <i className="fas fa-building-columns"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
                Bank Transfer & Direct Payment
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pay via Bank Account, Sarafi, or send receipt for instant approval
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Order Snapshot Card */}
          <div className="bg-gradient-to-br from-slate-50 to-emerald-50/40 dark:from-slate-800/80 dark:to-emerald-950/20 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 flex items-center justify-between shadow-sm">
            <div className="min-w-0 flex-1 pr-3">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block mb-0.5">
                Selected Book:
              </span>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm sm:text-base">
                {book.title}
              </h4>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 block">
                Ref Code: {purchase.referenceCode}
              </span>
            </div>
            <div className="text-right bg-gradient-to-br from-emerald-600 to-teal-700 text-white px-4 py-2 rounded-2xl shadow-md shadow-emerald-600/20 flex-shrink-0 flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">Total Amount</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black">{book.price}</span>
                <span className="text-xs font-semibold">AFN</span>
              </div>
            </div>
          </div>

          {step === 'details' ? (
            <>
              {/* Telegram Contact Option */}
              <button
                type="button"
                onClick={openTelegram}
                className="w-full flex items-center justify-center gap-2.5 p-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold rounded-2xl shadow-md shadow-sky-500/20 transition-all active:scale-[0.99] text-sm"
              >
                <i className="fa-brands fa-telegram text-xl"></i>
                <span>Direct Admin Support on Telegram (@{defaultTelegram.replace('@', '')})</span>
              </button>

              {/* Bank & Sarafi Account Details Box */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                    <i className="fas fa-university"></i>
                    <span>Bank & Payment Account Details:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(defaultBankDetails, 'bank')}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-bold bg-emerald-100/60 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <i className={`fas ${copiedField === 'bank' ? 'fa-check text-emerald-600 dark:text-emerald-400' : 'fa-copy'}`}></i>
                    <span>{copiedField === 'bank' ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>

                <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 font-sans text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-200 select-all shadow-inner">
                  {defaultBankDetails}
                </div>
              </div>

              {/* Upload Receipt / Proof Form */}
              <form onSubmit={handleSubmitProof} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Contact Phone / WhatsApp (Optional):
                  </label>
                  <input
                    type="text"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="e.g. +93 78 000 0000"
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Upload Payment Receipt or Screenshot:
                  </label>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-center bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition relative cursor-pointer group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    {receiptPreview ? (
                      <div className="flex items-center justify-center gap-3">
                        <img src={receiptPreview} alt="Receipt" className="w-16 h-16 object-cover rounded-xl border-2 border-emerald-500 shadow-md" />
                        <div className="text-left">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">Receipt selected successfully!</span>
                          <span className="text-[11px] text-slate-400">Click to change file</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 py-1">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg mb-0.5 group-hover:scale-110 transition-transform">
                          <i className="fas fa-camera"></i>
                        </div>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Upload Receipt Screenshot</span>
                        <span className="text-[11px] text-slate-400">PNG, JPG, or screenshot</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Transaction ID or Notes (Optional):
                  </label>
                  <input
                    type="text"
                    value={txNote}
                    onChange={(e) => setTxNote(e.target.value)}
                    placeholder="e.g. Sent from Azizi Bank..."
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-2xl shadow-lg shadow-emerald-600/30 transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-base"
                >
                  {isSubmitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      <span>Submitting proof...</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check-circle"></i>
                      <span>Submit Payment Proof</span>
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* Submission Confirmation Screen */
            <div className="text-center py-6 space-y-4 animate-fade-in">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center text-4xl mx-auto shadow-inner border border-emerald-500/30">
                <i className="fas fa-check"></i>
              </div>
              <h4 className="text-xl font-extrabold text-slate-900 dark:text-slate-50">
                Payment Proof Submitted!
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
                Our library admin will review and verify your payment shortly, and full access to the book will be added to your account.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={openTelegram}
                  className="flex-1 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-md shadow-sky-500/20"
                >
                  <i className="fa-brands fa-telegram text-lg"></i>
                  <span>Message on Telegram</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-2xl text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DirectPaymentModal;
