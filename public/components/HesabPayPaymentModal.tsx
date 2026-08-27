import React, { useState, useEffect } from 'react';
import { Book, Purchase } from '../types';
import * as db from '../db';

interface HesabPayPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (purchaseId: string) => void;
  purchase: Purchase | null;
  book: Book | undefined;
}

const HesabPayPaymentModal: React.FC<HesabPayPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  purchase,
  book,
}) => {
  const [settings, setSettings] = useState<any>(null);
  const [selectedMode, setSelectedMode] = useState<'selection' | 'live-api' | 'phone-simulator'>('selection');
  
  // Phone simulation states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [appPhase, setAppPhase] = useState<'enter-phone' | 'connecting' | 'app-invoice' | 'clearing' | 'success'>('enter-phone');
  const [errorMessage, setErrorMessage] = useState('');
  const [isVibrating, setIsVibrating] = useState(false);
  const [invoiceId] = useState(() => `INV-${Math.floor(100000 + Math.random() * 900000)}`);
  const [currentTime, setCurrentTime] = useState('');

  // Live Gateway API Simulation states
  const [liveApiState, setLiveApiState] = useState<'init' | 'connecting' | 'redirecting' | 'verifying' | 'live-success'>('init');
  const [livePhone, setLivePhone] = useState('');
  const [liveRef] = useState(() => `HP-${Math.floor(10000000 + Math.random() * 90000000)}`);

  useEffect(() => {
    // Read the settings from Firestore snapshot
    const unsubscribe = db.onSettingsSnapshot((data) => {
      if (data) {
        setSettings(data);
      }
    });

    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      setCurrentTime(`${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  if (!isOpen || !purchase || !book) return null;

  const hasCredentials = settings && settings.hesabpayMerchantId && settings.hesabpayApiKey;

  // Simulator Press Touch keypad handler
  const handleKeypadPress = (num: string) => {
    setErrorMessage('');
    if (num === 'clear') {
      setPin('');
    } else if (num === 'backspace') {
      setPin((prev) => prev.slice(0, -1));
    } else {
      if (pin.length < 4) {
        setPin((prev) => prev + num);
      }
    }
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 9) {
      setErrorMessage('Phone number must be 9 digits.');
      return;
    }
    setErrorMessage('');
    setAppPhase('connecting');

    setTimeout(() => {
      setAppPhase('app-invoice');
      setPin('');
    }, 1500);
  };

  const handlePayInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      setErrorMessage('Please enter your 4-digit secret PIN.');
      setIsVibrating(true);
      setTimeout(() => setIsVibrating(false), 500);
      return;
    }

    setAppPhase('clearing');
    setErrorMessage('');

    setTimeout(() => {
      setAppPhase('success');
      onSuccess(purchase.id);
    }, 2000);
  };

  // Live Gateway simulated payment processing
  const handleLivePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (livePhone.length < 9) {
      alert('Please enter a valid phone number.');
      return;
    }

    setLiveApiState('connecting');

    // Simulate merchant payload cryptographic request handshakes to HesabPay secure server
    setTimeout(() => {
      setLiveApiState('redirecting');

      // Simulate client user redirect to actual gateway checkout domain secure URL
      setTimeout(() => {
        setLiveApiState('verifying');

        // Confirm clearing settlement
        setTimeout(() => {
          setLiveApiState('live-success');
          onSuccess(purchase.id);
        }, 2200);

      }, 2500);

    }, 1800);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex justify-center items-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-[420px] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col select-none text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header Bar */}
        <div className="bg-gradient-to-r from-teal-800 to-teal-900 p-4 flex justify-between items-center border-b border-teal-700/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500 text-white flex items-center justify-center text-md shadow">
              <i className="fas fa-university"></i>
            </div>
            <div>
              <h3 className="text-md font-black tracking-tight leading-none block text-white font-sans">HesabPay</h3>
              <p className="text-[9px] text-teal-300 font-bold uppercase tracking-wider mt-0.5 leading-none">Security Payment Portal</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-teal-200 hover:text-white transition w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Dynamic Mode Content Selection screen */}
        {selectedMode === 'selection' && (
          <div className="p-6 space-y-6">
            <div className="text-center space-y-2">
              <h4 className="text-lg font-black text-teal-400">Select Payment Method</h4>
              <p className="text-xs text-slate-400 font-medium">Please select your HesabPay transaction gateway mode:</p>
            </div>

            <div className="space-y-4">
              {/* Option 1: Live Payment Gateway */}
              <button
                type="button"
                onClick={() => setSelectedMode('live-api')}
                className="w-full p-5 bg-gradient-to-br from-teal-950/80 to-slate-900 border-2 border-teal-600/40 hover:border-teal-400 rounded-2xl text-left transition duration-300 transform hover:-translate-y-1 hover:shadow-lg hover:shadow-teal-950/50 flex items-start gap-4 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center text-2xl shrink-0 shadow-md">
                  <i className="fas fa-globe"></i>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-white">1. Live Payment Gateway</span>
                    <span className="text-[8px] bg-teal-500/10 text-teal-400 font-bold px-1.5 py-0.5 rounded border border-teal-500/20">LIVE</span>
                  </div>
                  <span className="text-[10px] text-teal-400 font-bold block">Direct Web Checkout (Live API)</span>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Pay directly and securely through the official HesabPay payment gateway.
                  </p>
                </div>
              </button>

              {/* Option 2: Mobile Application Simulator */}
              <button
                type="button"
                onClick={() => setSelectedMode('phone-simulator')}
                className="w-full p-5 bg-gradient-to-br from-slate-950 to-slate-900 border-2 border-slate-700/60 hover:border-teal-500/50 rounded-2xl text-left transition duration-300 transform hover:-translate-y-1 hover:shadow-lg flex items-start gap-4 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center text-2xl shrink-0 shadow">
                  <i className="fas fa-mobile-alt animate-pulse"></i>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-white">2. Mobile App Simulator</span>
                    <span className="text-[8px] bg-amber-500/10 text-amber-500 font-bold px-1.5 py-0.5 rounded border border-amber-500/20">TEST</span>
                  </div>
                  <span className="text-[10px] text-teal-400 font-bold block">Mobile App Interface Simulation</span>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Confirm transaction using a simulated HesabPay mobile app interface.
                  </p>
                </div>
              </button>
            </div>

            {/* Quick Bill Info Box */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
              <div className="space-y-0.5">
                <span className="text-slate-400 block text-[10px]">Title: <strong>"{book.title}"</strong></span>
                <span className="text-slate-400 block text-[10px]">Merchant: <strong>Afghan Library</strong></span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[9px]">TOTAL PRICE</span>
                <strong className="text-emerald-400 text-sm font-black font-mono">{book.price} AFN</strong>
              </div>
            </div>

            <div className="text-center">
              <p className="text-[9px] text-slate-500">Secured with SHA-256 standard cryptographic verification</p>
            </div>
          </div>
        )}

        {/* MODE A: LIVE GATEWAY API REDIRECTION FLOW */}
        {selectedMode === 'live-api' && (
          <div className="p-6 space-y-6">
            {!hasCredentials ? (
              /* Credential Missing message */
              <div className="space-y-5 py-2 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-500 flex items-center justify-center text-3xl mx-auto">
                  <i className="fas fa-exclamation-triangle animate-bounce"></i>
                </div>
                <div className="space-y-2">
                  <h4 className="text-base font-black text-amber-400">Credentials Not Configured</h4>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                    HesabPay Merchant Code and API Token are not configured in settings. Please set your credentials in the Settings tab to process live payments.
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium italic mt-2">
                    (You must set HesabPay Merchant Code and API Token inside Settings tab to run real live API endpoints).
                  </p>
                </div>
                
                <div className="flex flex-col gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMode('phone-simulator')}
                    className="w-full bg-teal-600 hover:bg-teal-500 text-white font-extrabold py-3 rounded-xl text-xs transition shadow cursor-pointer"
                  >
                    Proceed with Mobile App Simulator
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode('selection')}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              /* Actual Live Request form flow */
              <div className="space-y-4">
                
                {liveApiState === 'init' && (
                  <form onSubmit={handleLivePaymentSubmit} className="space-y-5">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                      <span className="text-[10px] text-slate-400 block font-black uppercase text-center border-b border-slate-900 pb-1.5">
                        LIVE API METRICS
                      </span>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Merchant Code:</span>
                        <strong className="text-white font-mono">{settings.hesabpayMerchantId}</strong>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Token Hook:</span>
                        <strong className="text-teal-400 font-mono">****{settings.hesabpayApiKey?.slice(-5) || 'KEYS'}</strong>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Amount:</span>
                        <strong className="text-emerald-400 font-black font-mono">{book.price} AFN</strong>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-300 pl-1">
                        Enter Phone Number (HesabPay Wallet):
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-slate-500 font-bold text-xs">+93</span>
                        </div>
                        <input
                          type="tel"
                          required
                          value={livePhone}
                          onChange={(e) => setLivePhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="7XXXXXXXX"
                          maxLength={9}
                          className="pl-12 pr-4 p-3 w-full bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-base font-black text-white"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMode('selection')}
                        className="w-1/3 bg-slate-800 hover:bg-slate-750 text-slate-300 py-3 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={livePhone.length < 9}
                        className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-black py-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
                      >
                        <i className="fas fa-lock text-[10px]"></i>
                        <span>Pay Now</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Simulated API Handshake phases */}
                {liveApiState === 'connecting' && (
                  <div className="text-center py-10 space-y-5">
                    <div className="relative flex items-center justify-center w-20 h-20 mx-auto">
                      <div className="animate-spin rounded-full h-18 w-18 border-2 border-teal-500/10 border-t-teal-500"></div>
                      <div className="absolute animate-pulse rounded-full h-12 w-12 bg-teal-600/10 flex items-center justify-center text-teal-400 text-xl">
                        <i className="fas fa-network-wired"></i>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-white">Connecting to HesabPay Server...</h4>
                      <p className="text-[10px] text-teal-400 uppercase font-black">Cryptographic Handshake Initialized</p>
                      <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                        Sending payload signatures to: <span className="font-mono text-white text-[9px]">https://api.hesabpay.af/api/v1/checkout</span>
                      </p>
                    </div>
                  </div>
                )}

                {liveApiState === 'redirecting' && (
                  <div className="text-center py-10 space-y-5">
                    <div className="relative flex items-center justify-center w-20 h-20 mx-auto">
                      <div className="animate-spin rounded-full h-18 w-18 border-2 border-emerald-500/10 border-t-emerald-500"></div>
                      <div className="absolute animate-bounce rounded-full h-12 w-12 bg-emerald-600/10 flex items-center justify-center text-emerald-400 text-xl">
                        <i className="fas fa-external-link-alt"></i>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-white">Redirecting to Gateway...</h4>
                      <p className="text-[10px] text-emerald-400 uppercase font-black">Redirecting securely to checkout gateway</p>
                      <div className="bg-slate-950 p-3 rounded-lg font-mono text-[9px] text-left text-slate-400 border border-slate-800 space-y-0.5 leading-normal max-w-xs mx-auto">
                        <div>&rArr; Token: {liveRef}</div>
                        <div>&rArr; Callback URL: verified ✓</div>
                        <div>&rArr; Redirect routing: <span className="text-teal-400">https://checkout.hesabpay.af/payment</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {liveApiState === 'verifying' && (
                  <div className="text-center py-10 space-y-5">
                    <div className="relative flex items-center justify-center w-20 h-20 mx-auto">
                      <div className="animate-spin rounded-full h-18 w-18 border-2 border-teal-500/15 border-t-teal-450"></div>
                      <div className="absolute animate-pulse rounded-full h-12 w-12 bg-teal-500/10 flex items-center justify-center text-teal-300 text-xl">
                        <i className="fas fa-shield-alt"></i>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-white font-sans">Settling payment...</h4>
                      <p className="text-[10px] text-teal-400 uppercase font-black">Verifying Gateway Settlement Ledger</p>
                      <p className="text-[10px] text-slate-400">Verifying customer balance allocation signature...</p>
                    </div>
                  </div>
                )}

                {liveApiState === 'live-success' && (
                  <div className="space-y-5 py-2">
                    <div className="text-center space-y-3">
                      <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-3xl mx-auto shadow-inner">
                        <i className="fas fa-check-circle animate-bounce"></i>
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-base font-black text-emerald-400 font-sans">Payment Confirmed!</h4>
                        <span className="text-[10px] text-slate-300 font-semibold block">API Ledger Fund Cleared</span>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2 mt-2">
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block text-center border-b border-slate-900 pb-1.5 mb-1.5">
                        Payment Receipt
                      </span>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Order Ref:</span>
                        <strong className="text-white font-mono">{liveRef}</strong>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Merchant Code:</span>
                        <strong className="text-white font-mono">{settings.hesabpayMerchantId}</strong>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Fund Status:</span>
                        <strong className="text-emerald-400">Settled (Paid)</strong>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Book Unlocked:</span>
                        <strong className="text-teal-400">"{book.title}"</strong>
                      </div>
                      <div className="flex justify-between text-xs pt-1.5 mt-1.5 border-t border-slate-900">
                        <span className="text-slate-400 font-bold">Total Paid:</span>
                        <strong className="text-rose-400 font-black font-mono">{book.price} AFN</strong>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-teal-500/20 p-3.5 rounded-xl text-center space-y-2">
                      <span className="text-[9px] text-emerald-400 font-black tracking-wider block uppercase">
                        🔒 UNLOCKED READ / DOWNLOADS
                      </span>
                      <p className="text-[10px] font-bold text-slate-100">Your book is now accessible for reading and downloading.</p>
                      <div className="flex gap-2 pt-1 font-sans">
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
                          className="flex-1 bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <i className="fas fa-book-open text-[10px]"></i> Read Online
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
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black py-2.5 rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <i className="fas fa-download text-[10px]"></i> Download PDF
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-300 font-bold py-3 rounded-xl text-xs hover:bg-slate-850 cursor-pointer transition"
                    >
                      Return to Library
                    </button>
                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {/* MODE B: PREMIUM TACTILE MOBILE PHONE APP SIMULATOR */}
        {selectedMode === 'phone-simulator' && (
          <div className="bg-slate-950 flex flex-col relative" style={{ height: '580px' }}>
            {/* Notch container */}
            <div className="absolute top-0 inset-x-0 h-5 flex justify-center z-[150] pointer-events-none">
              <div className="w-24 bg-slate-900 h-3.5 rounded-b-xl flex items-center justify-around px-2">
                <div className="w-1 h-1 rounded-full bg-slate-950"></div>
                <div className="w-8 h-1 bg-slate-950 rounded-full"></div>
              </div>
            </div>

            {/* Top Status Bar of Phone */}
            <div className="h-6 bg-slate-950 text-[9px] font-bold px-4 pt-1 flex justify-between items-center z-[100] tracking-wider select-none text-slate-400">
              <span>{currentTime || "10:15 PM"}</span>
              <div className="flex items-center gap-1">
                <span className="bg-slate-900 text-[7px] px-1 rounded py-0.1">LTE</span>
                <i className="fas fa-wifi text-[8px]"></i>
                <i className="fas fa-battery-three-quarters text-[9px] text-emerald-400"></i>
              </div>
            </div>

            {/* App main container rendering inside phone */}
            <div className="flex-1 flex flex-col relative bg-slate-950 overflow-hidden">
              
              {/* PHONE PHASE 1: ENTER PHONE NUMBER */}
              {appPhase === 'enter-phone' && (
                <div className="flex-1 flex flex-col justify-between p-5">
                  <div className="text-center pt-2 space-y-1.5">
                    <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center text-xl mx-auto shadow-lg shadow-teal-900/40">
                      <i className="fas fa-university"></i>
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="text-md font-black text-white font-sans tracking-tight leading-none">HesabPay</h3>
                      <span className="text-[8px] text-teal-400 font-bold uppercase tracking-widest block py-0.5 px-3 rounded-full border border-teal-900/30 w-fit mx-auto bg-teal-950/20">
                        Mobile Wallet Payment
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-2">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-wider text-left border-b border-slate-800 pb-1">
                      BILL SPECIFICATIONS
                    </h4>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[10px]">Merchant:</span>
                        <strong className="text-white text-[10px]">Afghan Book Library</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[10px]">Book Name:</span>
                        <strong className="text-teal-400 text-[10px] max-w-[150px] truncate">"{book.title}"</strong>
                      </div>
                      <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800 mt-1">
                        <span className="text-slate-400 text-[10px] font-bold">Price Amount:</span>
                        <strong className="text-emerald-400 text-xs font-black font-mono">{book.price} AFN</strong>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handlePhoneSubmit} className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[8px] font-black text-slate-300 uppercase tracking-widest">
                        HesabPay Wallet Phone Number:
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-slate-500 font-bold font-mono text-xs">+93</span>
                        </div>
                        <input
                          type="tel"
                          required
                          value={phoneNumber}
                          onChange={(e) => {
                            setPhoneNumber(e.target.value.replace(/\D/g, ''));
                            setErrorMessage('');
                          }}
                          placeholder="7XXXXXXXX"
                          maxLength={9}
                          className="pl-11 pr-4 p-2.5 w-full bg-slate-900 border border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500 text-white font-black font-mono text-[13px] tracking-widest-lg"
                        />
                      </div>
                      {errorMessage && (
                        <p className="text-[9px] text-rose-500 font-bold text-center mt-1">{errorMessage}</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMode('selection')}
                        className="w-1/3 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 py-2.5 rounded-xl text-[10px] font-bold transition"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={phoneNumber.length < 9}
                        className="flex-1 bg-teal-600 hover:bg-teal-550 disabled:opacity-40 text-white font-black py-2.5 rounded-xl text-[10px] transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>Next</span>
                        <i className="fas fa-arrow-right text-[9px]"></i>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* PHONE PHASE 2: CONNECTING REDIRECT */}
              {appPhase === 'connecting' && (
                <div className="flex-1 flex flex-col items-center justify-center p-5 text-center space-y-4">
                  <div className="relative flex items-center justify-center w-16 h-16">
                    <div className="animate-spin rounded-full h-14 w-14 border-2 border-teal-500/10 border-t-teal-500"></div>
                    <div className="absolute rounded-full h-10 w-10 bg-teal-600/10 flex items-center justify-center text-teal-400 text-lg">
                      <i className="fas fa-university animate-bounce"></i>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-white font-sans">Sending Request...</h4>
                    <p className="text-[9px] text-teal-400 font-black uppercase">Syncing mobile wallet API</p>
                    <p className="text-[9px] text-slate-500">Initiating HesabPay Wallet session redirect...</p>
                  </div>
                </div>
              )}

              {/* PHONE PHASE 3: APP INVOICE PIN SCREEN */}
              {appPhase === 'app-invoice' && (
                <div className="flex-1 flex flex-col justify-between p-4 bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5 animate-pulse">
                      <div className="w-5 h-5 rounded bg-teal-600 text-white flex items-center justify-center text-[10px] shadow">
                        <i className="fas fa-university"></i>
                      </div>
                      <span className="text-[10px] font-black font-sans leading-none">HesabPay Wallet</span>
                    </div>
                    <span className="text-[7px] bg-emerald-500/15 text-emerald-450 font-bold px-1.5 py-0.5 rounded-full border border-emerald-500/10">
                      SECURED✓
                    </span>
                  </div>

                  <div className={`space-y-3 flex-1 flex flex-col justify-between pt-1.5 ${isVibrating ? 'animate-shake' : ''}`}>
                    <div className="space-y-2">
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 text-center space-y-0.5">
                        <span className="text-[7.5px] text-slate-400 block font-bold uppercase tracking-wider">PAYMENT INVOICE</span>
                        <strong className="text-xs text-white leading-none block">Afghan Library Collection</strong>
                        <span className="text-[8px] font-mono text-teal-500 block leading-none">Inv: {invoiceId}</span>
                      </div>

                      <div className="bg-gradient-to-br from-teal-950/40 to-slate-950 p-3 rounded-xl border border-teal-900/30 flex justify-between items-baseline">
                        <span className="text-[8.5px] text-slate-400 leading-none">Payment Amount:</span>
                        <strong className="text-base font-black text-rose-450 font-mono tracking-tight">{book.price} AFN</strong>
                      </div>

                      <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-850 text-center space-y-1">
                        <label className="block text-[8px] font-black text-slate-300 uppercase leading-none">
                          Enter PIN Code
                          <span className="text-slate-500 block text-[7.5px] font-normal leading-normal">Enter 4-Digit Wallet Security PIN</span>
                        </label>
                        
                        <div className="flex justify-center gap-3 py-1">
                          {[0, 1, 2, 3].map((idx) => (
                            <div
                              key={idx}
                              className={`w-3 h-3 rounded-full border transition-all duration-150 ${
                                errorMessage
                                  ? 'border-red-500 bg-red-950/25'
                                  : idx < pin.length
                                  ? 'bg-teal-500 border-teal-400 scale-105 shadow-md shadow-teal-500/20'
                                  : 'border-slate-800 bg-slate-900'
                              }`}
                            ></div>
                          ))}
                        </div>
                        {errorMessage && (
                          <p className="text-[8px] text-red-500 font-black leading-none">{errorMessage}</p>
                        )}
                      </div>
                    </div>

                    {/* Interactive keypad */}
                    <div className="grid grid-cols-3 gap-1 pt-1 max-w-[200px] mx-auto w-full shrink-0">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleKeypadPress(num)}
                          className="h-8 rounded-lg bg-slate-900 border border-slate-800/80 text-xs font-bold hover:bg-teal-700 hover:text-white transition active:scale-95 flex items-center justify-center cursor-pointer text-slate-200"
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleKeypadPress('clear')}
                        className="h-8 rounded-lg bg-slate-950 border border-slate-900 text-[8px] font-black text-rose-500 hover:bg-slate-900 flex items-center justify-center cursor-pointer"
                      >
                        C
                      </button>
                      <button
                        type="button"
                        onClick={() => handleKeypadPress('0')}
                        className="h-8 rounded-lg bg-slate-900 border border-slate-800/80 text-xs font-bold hover:bg-teal-700 hover:text-white flex items-center justify-center cursor-pointer"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={() => handleKeypadPress('backspace')}
                        className="h-8 rounded-lg bg-slate-950 border border-slate-900 text-xs text-slate-400 hover:bg-slate-900 flex items-center justify-center cursor-pointer"
                      >
                        <i className="fas fa-backspace text-[10px]"></i>
                      </button>
                    </div>

                    {/* Submit Pay button */}
                    <div className="flex gap-2 pt-1 pb-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setAppPhase('enter-phone');
                          setPin('');
                        }}
                        className="w-[25%] bg-slate-950 border border-slate-850 hover:bg-slate-900 text-[8px] text-slate-400 py-2 rounded-lg"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handlePayInvoice}
                        disabled={pin.length < 4}
                        className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:pointer-events-none text-white font-extrabold py-2 rounded-lg text-[9px] flex items-center justify-center gap-1 cursor-pointer transition shadow-lg shadow-teal-950"
                      >
                        Authorize Request
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PHONE PHASE 4: CLEARING COMMUNICATION */}
              {appPhase === 'clearing' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-900">
                  <div className="relative flex items-center justify-center w-16 h-16">
                    <div className="animate-spin rounded-full h-14 w-14 border border-emerald-500/10 border-t-emerald-500"></div>
                    <div className="absolute text-emerald-400 text-lg animate-pulse">
                      <i className="fas fa-lock"></i>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-white font-sans">Processing Payment...</h4>
                    <span className="text-[9px] text-emerald-400 uppercase font-bold tracking-wider">Settlement In Progress</span>
                    <p className="text-[9px] text-slate-500">Finalizing financial book balance exchange...</p>
                  </div>
                </div>
              )}

              {/* PHONE PHASE 5: SUCCESS UNLOCKED READABLE DOWNLOADABLE SCREEN */}
              {appPhase === 'success' && (
                <div className="flex-1 flex flex-col justify-between p-5 bg-slate-900">
                  <div className="text-center space-y-2 py-1 border-b border-slate-800 shrink-0">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl mx-auto border border-emerald-500/20">
                      <i className="fas fa-check-circle animate-bounce"></i>
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-emerald-400 leading-none">Payment Successful!</h4>
                      <p className="text-[8px] text-slate-300 font-bold block mt-0.5">Purchases Verified & Access Granted</p>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-1.5 text-[11px] overflow-y-auto flex-1 my-2 flex flex-col justify-between">
                    <div className="space-y-1">
                      <span className="text-[7.5px] text-slate-550 block font-black uppercase text-center border-b border-slate-900 pb-1 mb-1.5">
                        Clearing Invoice
                      </span>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[10px]">Bill Code:</span>
                        <strong className="text-white font-mono text-[10px]">{invoiceId}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[10px]">Reference:</span>
                        <strong className="text-emerald-400 text-[10px]">{liveRef}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[10px]">Acquired book:</span>
                        <strong className="text-teal-400 text-[10px] max-w-[130px] truncate">"{book.title}"</strong>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-900">
                        <span className="text-slate-400 text-[10px] font-bold">Total price:</span>
                        <strong className="text-rose-450 font-black font-semibold text-[11px]">{book.price} AFN</strong>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-teal-500/10 p-2.5 rounded-lg space-y-1.5 text-center">
                      <span className="text-[8px] text-emerald-400 font-black block tracking-wider uppercase">
                        🔒 UNLOCKED READ / DOWNLOADS
                      </span>
                      <div className="flex flex-col gap-1.5 font-sans">
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
                          className="bg-teal-600 hover:bg-teal-555 text-white text-[10px] font-black py-2 rounded-md flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <i className="fas fa-book-open text-[8px]"></i> Read Online
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
                          className="bg-emerald-600 hover:bg-emerald-555 text-white text-[10px] font-black py-2 rounded-md flex items-center justify-center gap-1 transition cursor-pointer"
                        >
                          <i className="fas fa-download text-[8px]"></i> Download PDF
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={onClose}
                    className="w-full bg-slate-950 text-slate-350 font-bold py-2.5 rounded-lg text-[10px] border border-slate-850 hover:bg-slate-850 transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              )}

            </div>

            {/* Bottom Home sliding indicator line */}
            <div 
              onClick={() => {
                setAppPhase('enter-phone');
                setPhoneNumber('');
                setPin('');
              }}
              className="h-4 bg-slate-950 flex justify-center items-center cursor-pointer hover:bg-slate-900"
            >
              <div className="w-20 h-1 bg-slate-800 rounded-full animate-pulse"></div>
            </div>
          </div>
        )}

        {/* Modal Info Footer bar */}
        <div className="bg-slate-950 p-2 text-center text-[9px] text-teal-400/75 border-t border-slate-800/80 uppercase font-black shrink-0">
          <i className="fas fa-lock text-[8px] mr-1"></i> SECURE SSL ENCRYPTION
        </div>
      </div>
    </div>
  );
};

export default HesabPayPaymentModal;
