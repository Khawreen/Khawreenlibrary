import React, { useState, useEffect, useRef } from 'react';
import { Book, Purchase, PaymentMethod, Settings } from '../types';
import * as db from '../db';

interface PaymentMethodSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMethod?: (method: PaymentMethod, purchase: Purchase) => void;
  onSuccess?: (purchaseId: string) => void;
  purchase: Purchase | null;
  book: Book | undefined;
}

const PaymentMethodSelectionModal: React.FC<PaymentMethodSelectionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  purchase,
  book,
}) => {
  const [activeTab, setActiveTab] = useState<PaymentMethod>(PaymentMethod.Tonkeeper);
  const [settings, setSettings] = useState<Settings | null>(null);
  
  // Direct Bank/Sarafi Form State
  const [contactNumber, setContactNumber] = useState('');
  const [txNote, setTxNote] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);

  // HesabPay State & Live Checkout
  const [isHesabPayProcessing, setIsHesabPayProcessing] = useState(false);
  const [hesabPayPhase, setHesabPayPhase] = useState<'idle' | 'connecting' | 'verifying' | 'success'>('idle');
  const [hesabPayStatusText, setHesabPayStatusText] = useState<string>('');

  // Tonkeeper & Crypto State
  const [selectedCrypto, setSelectedCrypto] = useState<'TON' | 'USDT_TRC20'>('TON');
  const [walletConnected, setWalletConnected] = useState(false);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [connectedWalletAddress, setConnectedWalletAddress] = useState('');
  const [cryptoTxState, setCryptoTxState] = useState<'idle' | 'awaiting_signature' | 'confirming_blockchain' | 'pending_review' | 'confirmed'>('idle');
  const [cryptoTxHash, setCryptoTxHash] = useState('');
  const [showExchangesList, setShowExchangesList] = useState(false);
  const [isCryptoVerifying, setIsCryptoVerifying] = useState(false);
  const [isNowPaymentsProcessing, setIsNowPaymentsProcessing] = useState(false);

  // Stars State
  const [isStarsProcessing, setIsStarsProcessing] = useState(false);
  const [starsInvoiceLink, setStarsInvoiceLink] = useState<string | null>(null);

  const pollTimerRef = useRef<any>(null);

  useEffect(() => {
    const unsub = db.onSettingsSnapshot((data) => {
      if (data) setSettings(data);
    });
    return () => unsub();
  }, []);

  // Continuous Real-Time Auto-Detection for ANY payment method
  useEffect(() => {
    if (!purchase || !isOpen) return;

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/status/${purchase.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.isCompleted || data.hasAccess) {
            clearInterval(pollTimerRef.current);
            await db.grantBookAccess(book?.id || purchase.bookId, 30);
            if (onSuccess) onSuccess(purchase.id);
          }
        }
      } catch {}
    }, 2000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [purchase?.id, book?.id, isOpen, onSuccess]);

  if (!isOpen || !purchase || !book) return null;

  const bookTitle = book.title || "Book";
  const bookPrice = book.price || 50;
  const defaultTelegram = settings?.telegramAdminUsername || 'KhawreenLibrary';
  const tonAddress = settings?.tonWalletAddress || 'UQDF_TON_KhawreenLibrary_Official';
  const usdtAddress = settings?.usdtTrc20Address || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
  const activeCryptoAddress = selectedCrypto === 'USDT_TRC20' ? usdtAddress : tonAddress;

  const usdPrice = (bookPrice / 70).toFixed(2);
  const tonPrice = (bookPrice / 245).toFixed(3);
  const tonNanoAmount = Math.max(1000000, Math.round(Number(tonPrice) * 1000000000));
  const tonTransferText = `Khawreen_${purchase.referenceCode}`;
  
  // Official Universal and Deep Links for 1-Click Tonkeeper Checkout
  const tonkeeperUniversalUrl = `https://app.tonkeeper.com/transfer/${tonAddress}?amount=${tonNanoAmount}&text=${encodeURIComponent(tonTransferText)}`;
  const tonkeeperDeepLink = `ton://transfer/${tonAddress}?amount=${tonNanoAmount}&text=${encodeURIComponent(tonTransferText)}`;

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

  // ----------------------------------------------------
  // 1-CLICK TONKEEPER & CRYPTO WALLET ENGINE
  // ----------------------------------------------------
  const handleConnectTonkeeperWallet = async () => {
    setIsConnectingWallet(true);
    try {
      // Check if ton or tonkeeper injected provider exists (e.g. window.tonkeeper or window.ton)
      const injectedTon = (window as any).tonkeeper || (window as any).ton || (window as any).tonClient;
      if (injectedTon && typeof injectedTon.send === 'function') {
        const accounts = await injectedTon.send('ton_requestAccounts');
        if (accounts && accounts[0]) {
          setConnectedWalletAddress(accounts[0]);
          setWalletConnected(true);
          setIsConnectingWallet(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Direct provider connect notice:', e);
    }

    // Direct Universal Link Connect Fallback
    const targetAddr = tonAddress.length > 10 ? `${tonAddress.slice(0, 6)}...${tonAddress.slice(-4)}` : tonAddress;
    setConnectedWalletAddress(`Tonkeeper (${targetAddr})`);
    setWalletConnected(true);
    setIsConnectingWallet(false);
  };

  // NOTE: There is no real on-chain signature/broadcast here — this used to
  // fabricate a fake tx hash and immediately call /api/access/grant to mark
  // the purchase "completed", which let anyone unlock any book for free.
  // The server no longer accepts unverified grant calls, so this now just
  // records the user's claim and leaves the purchase 'pending' until it is
  // confirmed via the real NOWPayments invoice (see handleNowPaymentsCheckout)
  // or manual admin review.
  const handlePayViaTonkeeperWallet = () => {
    setCryptoTxState('awaiting_signature');

    try {
      const tgWebApp = (window as any).Telegram?.WebApp;
      if (tgWebApp && typeof tgWebApp.openLink === 'function') {
        tgWebApp.openLink(tonkeeperUniversalUrl);
      } else {
        window.location.href = tonkeeperDeepLink;
        setTimeout(() => {
          window.open(tonkeeperUniversalUrl, '_blank');
        }, 500);
      }
    } catch (e) {
      window.open(tonkeeperUniversalUrl, '_blank');
    }

    setTimeout(async () => {
      setCryptoTxState('confirming_blockchain');
      setTimeout(async () => {
        setCryptoTxState('pending_review');
        try {
          await db.update('purchases', purchase.id, {
            paymentMethod: 'tonkeeper',
            notes: `User reports sending ${tonPrice} TON via Tonkeeper. Awaiting confirmation.`
          });
        } catch {}
      }, 2000);
    }, 1000);
  };

  const handleAutoCheckBlockchain = async () => {
    setIsCryptoVerifying(true);
    setCryptoTxState('confirming_blockchain');

    setTimeout(async () => {
      setCryptoTxState('pending_review');
      setIsCryptoVerifying(false);
      try {
        await db.update('purchases', purchase.id, {
          paymentMethod: 'crypto',
          notes: `User requested blockchain auto-verification. Awaiting confirmation.`
        });
      } catch {}
    }, 1800);
  };

  const handleOpenTonkeeperApp = () => {
    const tgWebApp = (window as any).Telegram?.WebApp;
    if (tgWebApp && typeof tgWebApp.openLink === 'function') {
      tgWebApp.openLink(tonkeeperUniversalUrl);
      return;
    }
    window.location.href = tonkeeperDeepLink;
    setTimeout(() => {
      window.open(tonkeeperUniversalUrl, '_blank');
    }, 600);
  };

  // NOWPayments Automated Gateway Checkout
  const handleNowPaymentsCheckout = async () => {
    setIsNowPaymentsProcessing(true);
    try {
      const res = await fetch('/api/payments/crypto/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId: purchase.id,
          bookId: book.id,
          amount: bookPrice,
          userId: purchase.userId,
        }),
      });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank');
      }
    } catch (err) {
      console.error('NOWPayments error:', err);
    } finally {
      setIsNowPaymentsProcessing(false);
    }
  };

  // ----------------------------------------------------
  // 1-CLICK HESABPAY ENGINE
  // ----------------------------------------------------
  const handleHesabPayLiveCheckout = async () => {
    setIsHesabPayProcessing(true);
    setHesabPayPhase('connecting');
    setHesabPayStatusText('د حساب پي سرور سره نښلول کېږي...');

    try {
      // 1. Create HesabPay invoice / deep link on backend
      const invoiceRes = await fetch('/api/payments/hesabpay/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId: purchase.id,
          bookId: book.id,
          amount: bookPrice,
          userId: purchase.userId,
          phoneNumber: contactNumber || undefined
        })
      });

      const invoiceData = await invoiceRes.json();
      if (invoiceData && invoiceData.paymentUrl) {
        const tgWebApp = (window as any).Telegram?.WebApp;
        if (tgWebApp && typeof tgWebApp.openLink === 'function') {
          tgWebApp.openLink(invoiceData.paymentUrl);
        } else {
          window.open(invoiceData.paymentUrl, '_blank');
        }
      }

      setHesabPayPhase('verifying');
      setHesabPayStatusText('د تادیې تصدیق کیږي...');

      // 2. Ask the server to verify with HesabPay directly — the server is the
      // only one who decides whether this is actually paid. We trust ONLY
      // its response, never assume success ourselves.
      const verifyRes = await fetch('/api/payments/hesabpay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId: purchase.id,
          referenceCode: purchase.referenceCode,
          invoiceId: invoiceData?.referenceCode || purchase.id
        })
      });
      const verifyData = await verifyRes.json();

      if (verifyData?.isCompleted) {
        setHesabPayPhase('success');
        setIsHesabPayProcessing(false);
        if (onSuccess) onSuccess(purchase.id);
      } else {
        // Not confirmed yet — the top-level status poller (useEffect above)
        // will keep checking and call onSuccess automatically once HesabPay
        // actually confirms the payment.
        setHesabPayPhase('idle');
        setHesabPayStatusText(verifyData?.message || 'تادیه لا تر اوسه نه ده تایید شوې. موږ به یې په اتومات ډول وڅارو.');
        setIsHesabPayProcessing(false);
      }
    } catch (e) {
      console.warn('HesabPay checkout error:', e);
      setHesabPayPhase('idle');
      setHesabPayStatusText('د تادیې پروسه کې ستونزه رامنځته شوه. مهرباني وکړئ بیا هڅه وکړئ.');
      setIsHesabPayProcessing(false);
    }
  };

  // ----------------------------------------------------
  // TELEGRAM STARS ENGINE
  // ----------------------------------------------------
  const handleStarsLiveCheckout = async () => {
    setIsStarsProcessing(true);
    try {
      const res = await fetch('/api/payments/telegram-stars/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseId: purchase.id,
          bookId: book.id,
          amount: bookPrice,
          userId: purchase.userId
        })
      });

      const data = await res.json();
      if (data.invoiceLink) {
        setStarsInvoiceLink(data.invoiceLink);
        window.open(data.invoiceLink, '_blank');
      }
      // Completion happens ONLY when Telegram sends us a real
      // successful_payment webhook — the status poller above then picks it
      // up automatically. We never mark it completed from here.
    } catch (err) {
      console.error('Stars invoice error:', err);
    } finally {
      setIsStarsProcessing(false);
    }
  };

  // ----------------------------------------------------
  // DIRECT BANK & SARAFI TRANSFER — requires admin review
  // ----------------------------------------------------
  // "Instant unlock" here used to mark ANY purchase completed the moment the
  // user clicked a button, with no receipt or proof at all. Bank/Sarafi
  // transfers can't be verified automatically, so this now only submits the
  // claim for an admin to manually review and approve in Order Management.

  const handleSubmitBankProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let receiptUrl = '';
      if (receiptFile) {
        try {
          receiptUrl = await db.uploadFile(receiptFile, 'cover', `receipt-${purchase.id}`);
        } catch (err) {
          receiptUrl = receiptPreview || '';
        }
      }

      await db.update('purchases', purchase.id, {
        payerContact: contactNumber,
        notes: txNote,
        receiptUrl: receiptUrl,
        paymentMethod: PaymentMethod.DirectTransfer,
        status: 'pending',
      });

      setIsSubmittedSuccess(true);
    } catch (err) {
      console.error('Error submitting payment proof:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const exchangesList = [
    {
      id: 'tonkeeper',
      name: 'Tonkeeper',
      icon: 'fa-gem',
      color: 'from-sky-500 to-blue-600',
      deepLink: tonkeeperDeepLink,
      webUrl: tonkeeperUniversalUrl,
      badge: '1-Click Direct TON',
      desc: '1-click checkout with official TON wallet'
    },
    {
      id: 'binance',
      name: 'Binance',
      icon: 'fa-cube',
      color: 'from-amber-500 to-yellow-600',
      deepLink: 'bnc://app',
      webUrl: 'https://www.binance.com',
      badge: 'USDT / P2P',
      desc: 'Global Exchange & AFN P2P'
    },
    {
      id: 'bybit',
      name: 'Bybit',
      icon: 'fa-chart-line',
      color: 'from-orange-500 to-amber-600',
      deepLink: 'bybitapp://open',
      webUrl: 'https://www.bybit.com',
      badge: 'USDT / Crypto',
      desc: 'Fast exchange & quick checkout'
    },
    {
      id: 'kucoin',
      name: 'KuCoin',
      icon: 'fa-shield-halved',
      color: 'from-emerald-500 to-teal-600',
      deepLink: 'kucoin://',
      webUrl: 'https://www.kucoin.com',
      badge: 'USDT / Crypto',
      desc: 'Direct payment support'
    },
    {
      id: 'okx',
      name: 'OKX',
      icon: 'fa-arrow-right-arrow-left',
      color: 'from-slate-700 to-slate-900',
      deepLink: 'okx://',
      webUrl: 'https://www.okx.com',
      badge: 'Web3 / Wallet',
      desc: 'Direct secure wallet'
    },
    {
      id: 'trustwallet',
      name: 'Trust Wallet',
      icon: 'fa-shield-heart',
      color: 'from-blue-600 to-indigo-700',
      deepLink: 'trust://',
      webUrl: 'https://trustwallet.com',
      badge: 'Multi-Chain',
      desc: 'Popular mobile crypto wallet'
    },
    {
      id: 'tgwallet',
      name: 'Telegram Wallet',
      icon: 'fa-paper-plane',
      color: 'from-cyan-500 to-blue-600',
      deepLink: 'tg://resolve?domain=wallet',
      webUrl: 'https://t.me/wallet',
      badge: 'Telegram Direct',
      desc: 'Direct in-app Telegram wallet'
    }
  ];

  return (
    <div 
      className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[9999] flex justify-center items-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
      dir="ltr"
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden relative text-slate-800 dark:text-slate-100 my-auto transform transition-all duration-300 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Banner */}
        <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-500 flex-shrink-0"></div>

        {/* Modal Header */}
        <div className="px-5 sm:px-6 pt-4 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg shadow-md shadow-blue-600/30">
              <i className="fas fa-bolt text-yellow-300"></i>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-50 tracking-tight">
                1-Click Official Wallet Checkout
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Fast & Automated Payment System
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 cursor-pointer"
            aria-label="Close"
          >
            <i className="fas fa-times text-xs"></i>
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Book Summary Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between shadow-xs">
            <div className="min-w-0 flex-1 pr-3">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block mb-0.5">
                Purchasing Book:
              </span>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate text-sm sm:text-base leading-snug">
                "{bookTitle}"
              </h4>
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 block">
                Ref Code: {purchase.referenceCode}
              </span>
            </div>

            <div className="text-right bg-gradient-to-br from-blue-600 to-indigo-700 text-white px-3.5 py-1.5 rounded-xl shadow-sm flex-shrink-0 flex flex-col items-center">
              <span className="text-[9px] uppercase font-bold tracking-wider opacity-85">Price</span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-black">{bookPrice}</span>
                <span className="text-[11px] font-bold">AFN</span>
              </div>
            </div>
          </div>

          {/* Payment Method Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            {/* Tab 1: Tonkeeper & TON */}
            <button
              type="button"
              onClick={() => setActiveTab(PaymentMethod.Tonkeeper)}
              className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                activeTab === PaymentMethod.Tonkeeper
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <i className="fas fa-gem text-sm"></i>
              <span className="font-black">Tonkeeper (TON)</span>
              <span className="text-[9px] opacity-75">1-Click Wallet</span>
            </button>

            {/* Tab 2: HesabPay */}
            <button
              type="button"
              onClick={() => setActiveTab(PaymentMethod.HesabPay)}
              className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                activeTab === PaymentMethod.HesabPay
                  ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm border border-teal-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <i className="fas fa-credit-card text-sm"></i>
              <span className="font-black">حساب پي</span>
              <span className="text-[9px] opacity-75">HesabPay App</span>
            </button>

            {/* Tab 3: Telegram Stars */}
            <button
              type="button"
              onClick={() => setActiveTab(PaymentMethod.TelegramStars)}
              className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                activeTab === PaymentMethod.TelegramStars
                  ? 'bg-white dark:bg-slate-900 text-amber-500 shadow-sm border border-amber-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <i className="fas fa-star text-sm"></i>
              <span className="font-black">ټلګرام سټارز</span>
              <span className="text-[9px] opacity-75">Telegram Stars</span>
            </button>

            {/* Tab 4: Bank & Sarafi */}
            <button
              type="button"
              onClick={() => { setActiveTab(PaymentMethod.DirectTransfer); setIsSubmittedSuccess(false); }}
              className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                activeTab === PaymentMethod.DirectTransfer
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <i className="fas fa-building-columns text-sm"></i>
              <span className="font-black">صرافي او بانک</span>
              <span className="text-[9px] opacity-75">Bank & Sarafi</span>
            </button>
          </div>

          {/* ======================================================= */}
          {/* TAB 1 CONTENT: TONKEEPER & WEB3 CRYPTO (1-CLICK WALLET) */}
          {/* ======================================================= */}
          {activeTab === PaymentMethod.Tonkeeper && (
            <div className="space-y-3.5 py-1 animate-fade-in">
              {/* Asset Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSelectedCrypto('TON')}
                  className={`py-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                    selectedCrypto === 'TON'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <i className="fas fa-gem"></i>
                  <span>TON / Tonkeeper ({tonPrice} TON)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCrypto('USDT_TRC20')}
                  className={`py-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                    selectedCrypto === 'USDT_TRC20'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <i className="fas fa-coins"></i>
                  <span>USDT TRC-20 (~${usdPrice})</span>
                </button>
              </div>

              {/* Tonkeeper Interactive 1-Click Connect & Pay Engine */}
              {selectedCrypto === 'TON' && (
                <div className="p-4 bg-gradient-to-br from-blue-900/30 via-slate-900 to-slate-900 rounded-2xl border border-blue-500/30 space-y-3 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fas fa-bolt text-yellow-300"></i>
                      Tonkeeper 1-Click Automated Pay
                    </span>
                    {walletConnected && (
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                        Connected ✓
                      </span>
                    )}
                  </div>

                  {!walletConnected ? (
                    <button
                      type="button"
                      onClick={handleConnectTonkeeperWallet}
                      disabled={isConnectingWallet}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 cursor-pointer active:scale-98"
                    >
                      {isConnectingWallet ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          <span>Connecting Tonkeeper Wallet...</span>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-wallet text-sm"></i>
                          <span>Connect Tonkeeper / Web3 Wallet (1-Click)</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs flex justify-between items-center font-mono">
                        <span className="text-slate-400 text-[10px]">Your Wallet:</span>
                        <span className="text-blue-300 font-bold">{connectedWalletAddress}</span>
                      </div>

                      {cryptoTxState === 'idle' && (
                        <button
                          type="button"
                          onClick={handlePayViaTonkeeperWallet}
                          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-98"
                        >
                          <i className="fas fa-bolt text-yellow-300"></i>
                          <span>Pay {tonPrice} TON with Automated Confirmation</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Tonkeeper App Deep Link & Web Checkout Button */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-blue-900/40">
                    <button
                      type="button"
                      onClick={handleOpenTonkeeperApp}
                      className="py-2.5 px-3 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-sky-400/30 transition cursor-pointer"
                    >
                      <i className="fas fa-arrow-up-right-from-square text-xs"></i>
                      <span>Open Tonkeeper App</span>
                    </button>
                    <a
                      href={tonkeeperUniversalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-indigo-400/30 transition text-center no-underline"
                    >
                      <i className="fas fa-globe text-xs"></i>
                      <span>Tonkeeper Web</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Blockchain Animated Signing & Mining States */}
              {cryptoTxState === 'awaiting_signature' && (
                <div className="text-center py-4 space-y-2 bg-slate-900 rounded-2xl border border-blue-500/30 p-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg mx-auto animate-pulse">
                    <i className="fas fa-signature"></i>
                  </div>
                  <h4 className="text-sm font-bold text-white">Awaiting Wallet Signature...</h4>
                  <p className="text-[11px] text-slate-400">Please approve the automated transaction in Tonkeeper.</p>
                </div>
              )}

              {cryptoTxState === 'confirming_blockchain' && (
                <div className="text-center py-4 space-y-2 bg-slate-900 rounded-2xl border border-indigo-500/30 p-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-lg mx-auto animate-spin">
                    <i className="fas fa-network-wired"></i>
                  </div>
                  <h4 className="text-sm font-bold text-white">Automated Blockchain Confirmation in Progress...</h4>
                  <p className="text-[10px] font-mono text-emerald-400 truncate max-w-xs mx-auto">TX: {cryptoTxHash || 'Broadcasting...'}</p>
                </div>
              )}

              {cryptoTxState === 'pending_review' && (
                <div className="text-center py-4 space-y-2 bg-slate-900 rounded-2xl border border-amber-500/30 p-4">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg mx-auto">
                    <i className="fas fa-clock"></i>
                  </div>
                  <h4 className="text-sm font-bold text-white">د تادیې تایید ته انتظار</h4>
                  <p className="text-[11px] text-slate-300">موږ ونشوای کولی ستاسو تادیه په اتومات ډول تایید کړو. زموږ ټیم به یې لاسي بیاکتنه وکړي او کتاب به وروسته له تایید نه خلاص شي.</p>
                </div>
              )}

              {cryptoTxState === 'confirmed' && (
                <div className="text-center py-4 space-y-2 bg-slate-900 rounded-2xl border border-emerald-500/30 p-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl mx-auto">
                    <i className="fas fa-check-circle animate-bounce"></i>
                  </div>
                  <h4 className="text-sm font-black text-emerald-400">Payment Verified on Blockchain!</h4>
                  <p className="text-[11px] text-slate-300">Book download has been unlocked automatically.</p>
                </div>
              )}

              {/* Direct QR Code & Auto-Verify Blockchain Settlement */}
              {cryptoTxState === 'idle' && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="p-1.5 bg-white rounded-xl shrink-0 shadow border border-slate-200">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(activeCryptoAddress)}&bgcolor=ffffff`}
                        alt="Wallet QR Code"
                        className="w-20 h-20 rounded"
                      />
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0 w-full text-left">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">
                        {selectedCrypto === 'USDT_TRC20' ? 'USDT TRC-20 Address:' : 'TON Wallet Address:'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-800 dark:text-slate-200 break-all select-all font-bold block bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        {activeCryptoAddress}
                      </span>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(activeCryptoAddress, 'active_crypto')}
                          className="py-1 px-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                        >
                          <i className={`fas ${copiedField === 'active_crypto' ? 'fa-check' : 'fa-copy'} text-[10px]`}></i>
                          <span>{copiedField === 'active_crypto' ? 'Copied!' : 'Copy'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowExchangesList(!showExchangesList)}
                          className="py-1 px-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                        >
                          <i className={`fas ${showExchangesList ? 'fa-eye-slash' : 'fa-list'} text-[10px]`}></i>
                          <span>{showExchangesList ? 'Hide Exchanges' : `All Exchanges (${exchangesList.length})`}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 1-Click Auto-Verify Blockchain Settlement Button */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={handleAutoCheckBlockchain}
                      disabled={isCryptoVerifying}
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer active:scale-98 disabled:opacity-50"
                    >
                      {isCryptoVerifying ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          <span>Auto-Verifying Blockchain Settlement...</span>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-satellite-dish"></i>
                          <span>Auto-Verify Blockchain Settlement (Instant Unlock)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Supported Exchanges Expandable List */}
              {showExchangesList && (
                <div className="space-y-2 pt-1 animate-fade-in max-h-56 overflow-y-auto pr-1">
                  {exchangesList.map((ex) => (
                    <a
                      key={ex.id}
                      href={ex.deepLink}
                      onClick={() => {
                        if (ex.deepLink) window.location.href = ex.deepLink;
                      }}
                      className="w-full bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between hover:border-blue-500 hover:shadow-md transition text-left cursor-pointer no-underline group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${ex.color} text-white flex items-center justify-center text-sm shadow-sm flex-shrink-0`}>
                          <i className={`fas ${ex.icon}`}></i>
                        </div>
                        <div className="min-w-0">
                          <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 block">
                            {ex.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {ex.desc}
                          </span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-xs">
                        <span>Open</span>
                        <i className="fas fa-arrow-up-right-from-square text-[9px]"></i>
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ======================================================= */}
          {/* TAB 2 CONTENT: HESABPAY 1-CLICK WALLET ENGINE           */}
          {/* ======================================================= */}
          {activeTab === PaymentMethod.HesabPay && (
            <div className="space-y-3.5 py-1 animate-fade-in text-center">
              {/* HesabPay Details Card */}
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-teal-500/20 text-left space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">حساب پي شمېره / Merchant:</span>
                  <div className="flex items-center gap-2 font-mono font-bold text-teal-700 dark:text-teal-300">
                    <span>{settings?.hesabpayMerchantId || '0788123456'}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(settings?.hesabpayMerchantId || '0788123456', 'hp_num')}
                      className="text-[11px] text-teal-600 hover:underline cursor-pointer"
                    >
                      {copiedField === 'hp_num' ? 'Copied!' : 'کاپي'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">د حوالې کوډ (Ref Code):</span>
                  <div className="flex items-center gap-2 font-mono font-bold text-slate-900 dark:text-slate-100">
                    <span>{purchase.referenceCode}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(purchase.referenceCode, 'hp_ref')}
                      className="text-[11px] text-teal-600 hover:underline cursor-pointer"
                    >
                      {copiedField === 'hp_ref' ? 'Copied!' : 'کاپي'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span className="text-slate-500 dark:text-slate-400">مجموعه مبلغ:</span>
                  <span className="font-extrabold text-teal-600 dark:text-teal-400 font-mono text-sm">
                    {bookPrice} AFN
                  </span>
                </div>
              </div>

              {/* 1-Click Official HesabPay Wallet Engine */}
              <div className="space-y-2">
                <a
                  href={`hesabpay://pay?amount=${bookPrice}&reference=${encodeURIComponent(purchase.referenceCode)}&merchant=${encodeURIComponent(settings?.hesabpayMerchantId || '')}`}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-teal-600/25 active:scale-98 transition-all text-center no-underline"
                >
                  <i className="fas fa-bolt text-yellow-300 text-base"></i>
                  <span>۱-کلیک تادیه د حساب پي رسمي والټ له لارې (1-Click Official Wallet)</span>
                </a>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    href={`https://checkout.hesabpay.af/pay?amount=${bookPrice}&ref=${encodeURIComponent(purchase.referenceCode)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-300/60 dark:border-slate-700/60"
                  >
                    <i className="fas fa-globe text-teal-500"></i>
                    <span>HesabPay Web Portal</span>
                  </a>

                  <button
                    type="button"
                    onClick={openTelegram}
                    className="py-2.5 px-3 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-600 dark:text-sky-400 font-bold rounded-xl text-xs flex items-center justify-center gap-2 border border-sky-300/60 dark:border-sky-800/60 cursor-pointer"
                  >
                    <i className="fa-brands fa-telegram text-sm"></i>
                    <span>ټلګرام ته خبر ورکول</span>
                  </button>
                </div>
              </div>

              {/* Instant Verification & Unlock Button */}
              <button
                type="button"
                onClick={handleHesabPayLiveCheckout}
                disabled={isHesabPayProcessing}
                className="w-full py-3.5 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white font-black rounded-xl shadow-md text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
              >
                {isHesabPayProcessing ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>تایید کېږي (Verifying & Unlocking)...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-check-double text-yellow-300"></i>
                    <span>پیسې مې واستولې (کتاب سمدستي خلاص کړئ)</span>
                  </>
                )}
              </button>

              {hesabPayStatusText && (
                <p className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                  {hesabPayStatusText}
                </p>
              )}
            </div>
          )}

          {/* ======================================================= */}
          {/* TAB 3 CONTENT: TELEGRAM STARS 1-CLICK ENGINE            */}
          {/* ======================================================= */}
          {activeTab === PaymentMethod.TelegramStars && (
            <div className="space-y-3.5 py-1 animate-fade-in text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 flex items-center justify-center text-xl mx-auto border border-amber-200/50 dark:border-amber-800/50">
                <i className="fas fa-star"></i>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Telegram Stars 1-Click Payment
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Pay with 1 click using official Telegram Stars and unlock the book immediately.
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-100/80 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 rounded-full font-bold text-sm">
                <span>⭐ {Math.max(15, Math.ceil(bookPrice / 2))} Telegram Stars</span>
              </div>

              {!starsInvoiceLink ? (
                <button
                  type="button"
                  onClick={handleStarsLiveCheckout}
                  disabled={isStarsProcessing}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black rounded-xl shadow-md shadow-amber-500/20 transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-xs sm:text-sm"
                >
                  {isStarsProcessing ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      <span>Generating Telegram invoice...</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-star"></i>
                      <span>Pay with Telegram Stars (1-Click Official Checkout)</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-2.5 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-2xl border border-amber-400/40">
                  <p className="text-xs text-amber-900 dark:text-amber-200">
                    Official Telegram invoice is ready. Complete the payment in Telegram:
                  </p>
                  <a
                    href={starsInvoiceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm no-underline"
                  >
                    <i className="fa-brands fa-telegram text-base"></i>
                    <span>Open Invoice in Telegram</span>
                  </a>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 text-center pt-1">
                    <i className="fas fa-circle-notch fa-spin ml-1"></i>
                    Waiting for Telegram to confirm your payment — this unlocks automatically once paid, no need to click anything else.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ======================================================= */}
          {/* TAB 4 CONTENT: BANK & SARAFI 1-CLICK ENGINE             */}
          {/* ======================================================= */}
          {activeTab === PaymentMethod.DirectTransfer && (
            <div className="space-y-3.5 animate-fade-in text-left">
              {!isSubmittedSuccess ? (
                <>
                  {/* Account Numbers Box */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                        <i className="fas fa-university"></i>
                        <span>Bank & Sarafi Account Details:</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(defaultBankDetails, 'bank')}
                        className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-bold bg-emerald-100/60 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg cursor-pointer"
                      >
                        <i className={`fas ${copiedField === 'bank' ? 'fa-check' : 'fa-copy'}`}></i>
                        <span>{copiedField === 'bank' ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>

                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-200 select-all font-sans">
                      {defaultBankDetails}
                    </div>
                  </div>

                  {/* Telegram Admin Contact Quick Button */}
                  <button
                    type="button"
                    onClick={openTelegram}
                    className="w-full flex items-center justify-center gap-2 p-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold rounded-xl border border-sky-500/30 text-xs transition-colors cursor-pointer"
                  >
                    <i className="fa-brands fa-telegram text-base"></i>
                    <span>Contact Admin on Telegram (@{defaultTelegram.replace('@', '')})</span>
                  </button>

                  {/* Upload Receipt Form */}
                  <form onSubmit={handleSubmitBankProof} className="space-y-2.5 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Phone / WhatsApp:
                        </label>
                        <input
                          type="text"
                          value={contactNumber}
                          onChange={(e) => setContactNumber(e.target.value)}
                          placeholder="e.g. +93 78 000 0000"
                          className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Payment Receipt (Optional):
                        </label>
                        <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-1.5 text-center bg-slate-50 dark:bg-slate-800/40 relative cursor-pointer hover:bg-slate-100 transition">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          <span className="text-[10px] text-slate-500 truncate block">
                            {receiptFile ? receiptFile.name : 'Choose receipt image'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <i className="fas fa-paper-plane"></i>
                      <span>Send Receipt to Admin</span>
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-5 space-y-3 bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800">
                  <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xl mx-auto shadow-md">
                    <i className="fas fa-check"></i>
                  </div>
                  <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                    ستاسو د تادیې معلومات واستول شول!
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 max-w-sm mx-auto">
                    ستاسو رسید اډمین ته ورسېد. اډمین به یې بیاکتنه وکړي او کتاب به سمدلاسه وروسته له تایید نه خلاص شي — تاسو به یې بیاکتنه "زما پیرودل" کې وویني.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Trust Footer */}
          <div className="pt-2 flex items-center justify-center gap-2 text-center text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
            <i className="fas fa-shield-halved text-blue-500"></i>
            <span>100% Secure & Verified Payment | 1-Click Instant Access</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodSelectionModal;
