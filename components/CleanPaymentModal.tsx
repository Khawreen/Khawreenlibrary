import React, { useState } from 'react';
import { Book, Purchase } from '../types';

interface CleanPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: Purchase | null;
  book: Book | undefined;
}

const CleanPaymentModal: React.FC<CleanPaymentModalProps> = ({ isOpen, onClose, purchase, book }) => {
  const [loadingMethod, setLoadingMethod] = useState<'hesabpay' | 'global' | null>(null);

  if (!isOpen || !purchase || !book) return null;

  const handleHesabPay = async () => {
    setLoadingMethod('hesabpay');
    try {
      const res = await fetch('/api/payments/hesabpay/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId: purchase.id,
          bookId: book.id,
          amount: book.price,
          userId: purchase.userId
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.checkoutUrl) {
          window.open(data.checkoutUrl, '_blank');
        }
        window.location.href = data.mobileDeepLink || `hesabpay://pay?invoice=${data.referenceCode}&amount=${book.price}`;
        onClose();
        window.dispatchEvent(new CustomEvent('showtoast', {
          detail: { message: '⚡ HesabPay opened! Complete payment to instantly unlock your book.', type: 'success' }
        }));
      } else {
        alert('Could not connect to HesabPay system: ' + (data.error || 'Server error'));
      }
    } catch (err) {
      alert('Network connection error.');
    } finally {
      setLoadingMethod(null);
    }
  };

  const handleGlobalPay = async () => {
    setLoadingMethod('global');
    try {
      const res = await fetch('/api/payments/crypto/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId: purchase.id,
          bookId: book.id,
          amount: book.price,
          userId: purchase.userId
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.checkoutUrl) {
          window.open(data.checkoutUrl, '_blank');
        }
        window.location.href = `bnc://app`;
        onClose();
        window.dispatchEvent(new CustomEvent('showtoast', {
          detail: { message: '🚀 Binance & Crypto gateway opened! Upon blockchain confirmation, your book unlocks automatically.', type: 'success' }
        }));
      } else {
        alert('Crypto payment gateway error: ' + (data.error || 'Unknown'));
      }
    } catch (err) {
      alert('Network error occurred.');
    } finally {
      setLoadingMethod(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-50 flex justify-center items-center p-4" dir="rtl">
      <div className="w-full max-w-[440px] bg-slate-900 border border-slate-800/80 rounded-[32px] p-6 text-slate-100 space-y-6 shadow-2xl relative overflow-hidden text-right">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center text-2xl mx-auto shadow-lg">
            <i className="fas fa-wallet"></i>
          </div>
          <div>
            <h3 className="text-xl font-black text-white">Instant Payment Center</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Pay in 1-click via your mobile app or wallet</p>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/50 p-4 rounded-2xl flex justify-between items-center">
          <div className="text-right">
            <span className="text-xs text-slate-500 block font-bold">Book Title</span>
            <span className="text-sm font-black text-slate-300 line-clamp-1">{book.title}</span>
          </div>
          <div className="text-left bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
            <span className="text-xs text-emerald-500 block font-bold text-center">Amount</span>
            <strong className="text-emerald-400 font-mono text-base font-black">{book.price} AFN</strong>
          </div>
        </div>

        <div className="space-y-3.5">
          <button
            type="button"
            onClick={handleHesabPay}
            disabled={loadingMethod !== null}
            className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 p-4 rounded-2xl transition-all cursor-pointer flex items-center justify-between group text-right"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-lg shrink-0">
                <i className="fas fa-mobile-alt"></i>
              </div>
              <div className="text-right">
                <span className="text-sm font-black block text-white">HesabPay App (1-Click Instant)</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Afghani Wallet, Local Bank Cards & App</span>
              </div>
            </div>
            <i className="fas fa-chevron-left text-xs text-slate-500 group-hover:text-slate-300"></i>
          </button>

          <button
            type="button"
            onClick={handleGlobalPay}
            disabled={loadingMethod !== null}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white p-4 rounded-2xl transition-all flex items-center justify-between group cursor-pointer text-right shadow-lg shadow-indigo-600/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center text-lg shrink-0">
                <i className="fas fa-coins"></i>
              </div>
              <div className="text-right">
                <span className="text-sm font-black block text-white">Binance & Crypto Web3 App</span>
                <span className="text-[11px] text-indigo-200 block mt-0.5">Instant USDT TRC-20 & Auto Blockchain Unlock</span>
              </div>
            </div>
            <i className="fas fa-chevron-left text-xs text-indigo-300 group-hover:text-white"></i>
          </button>
        </div>

        {loadingMethod && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col justify-center items-center space-y-2 rounded-[32px]">
            <div className="w-9 h-9 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-slate-300 font-bold">Connecting to payment gateway...</span>
          </div>
        )}

        <button 
          onClick={onClose} 
          disabled={loadingMethod !== null}
          className="text-xs text-slate-500 hover:text-slate-400 font-bold block mx-auto cursor-pointer pt-1"
        >
          Cancel & Close
        </button>
      </div>
    </div>
  );
};

export default CleanPaymentModal;
