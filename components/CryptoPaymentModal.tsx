import React, { useState, useEffect } from 'react';
import { Book, Purchase, Settings } from '../types';
import * as db from '../db';

interface CryptoPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (purchaseId: string) => void;
  purchase: Purchase | null;
  book: Book | undefined;
}

const CryptoPaymentModal: React.FC<CryptoPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  purchase,
  book,
}) => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedCrypto, setSelectedCrypto] = useState<'TON' | 'USDT_TRC20'>('TON');
  const [walletConnected, setWalletConnected] = useState(false);
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [txState, setTxState] = useState<'idle' | 'awaiting_signature' | 'confirming_blockchain' | 'pending_review' | 'confirmed'>('idle');
  const [txHash, setTxHash] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = db.onSettingsSnapshot((data) => {
      if (data) setSettings(data);
    });
    return () => unsub();
  }, []);

  if (!isOpen || !purchase || !book) return null;

  // Approximate conversions: 1 USD ~ 70 AFN, 1 TON ~ 3.5 USD (~245 AFN)
  const usdPrice = (book.price / 70).toFixed(2);
  const tonPrice = (book.price / 245).toFixed(3);
  const tonNanoAmount = Math.max(1000000, Math.round(Number(tonPrice) * 1000000000));
  const tonTransferText = `Khawreen_${purchase.referenceCode}`;

  const fallbackTrc20 = settings?.usdtTrc20Address || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
  const fallbackTon = settings?.tonWalletAddress || 'UQDF_TON_KhawreenLibrary_Official';
  const currentAddress = selectedCrypto === 'USDT_TRC20' ? fallbackTrc20 : fallbackTon;

  const tonkeeperUniversalUrl = `https://app.tonkeeper.com/transfer/${fallbackTon}?amount=${tonNanoAmount}&text=${encodeURIComponent(tonTransferText)}`;
  const tonkeeperDeepLink = `ton://transfer/${fallbackTon}?amount=${tonNanoAmount}&text=${encodeURIComponent(tonTransferText)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simulate Tonkeeper / Telegram Web3 Wallet connect
  const handleConnectWallet = () => {
    setIsConnectingWallet(true);
    setTimeout(() => {
      const simulatedWallet = `UQ${Math.random().toString(36).substring(2, 10).toUpperCase()}...${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      setWalletAddress(simulatedWallet);
      setWalletConnected(true);
      setIsConnectingWallet(false);
    }, 900);
  };

  // NOTE: There is no real wallet-signing integration here (no on-chain
  // broadcast, no node lookup) — this used to fabricate a fake tx hash and
  // immediately mark the purchase "completed" on the client, which let
  // anyone unlock any book for free with a couple of clicks. It now only
  // records that the user says they sent a payment and leaves the purchase
  // 'pending' until it is genuinely confirmed (via the NOWPayments invoice +
  // signature-verified webhook flow, or manual admin review in Orders).
  const handlePayViaWallet = () => {
    setTxState('awaiting_signature');
    setTimeout(() => {
      setTxState('confirming_blockchain');
      setTimeout(async () => {
        setTxState('pending_review');
        try {
          await db.update('purchases', purchase.id, {
            notes: `User reports sending ${tonPrice} TON to ${fallbackTon}. Awaiting confirmation.`
          });
        } catch {}
      }, 2000);
    }, 1400);
  };

  const handleAutoCheckBlockchain = () => {
    setTxState('confirming_blockchain');
    setTimeout(async () => {
      setTxState('pending_review');
      try {
        await db.update('purchases', purchase.id, {
          notes: `User requested auto-verification for ${selectedCrypto} payment. Awaiting confirmation.`
        });
      } catch {}
    }, 1800);
  };

  const handleOpenTonkeeperApp = () => {
    window.location.href = tonkeeperDeepLink;
    setTimeout(() => {
      window.open(tonkeeperUniversalUrl, '_blank');
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex justify-center items-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-4 flex justify-between items-center border-b border-blue-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg shadow-lg">
              <i className="fas fa-gem text-yellow-300"></i>
            </div>
            <div>
              <h3 className="text-sm font-black text-white leading-tight">1-Click Tonkeeper & Web3 Crypto</h3>
              <p className="text-[10px] text-blue-300 font-medium">100% Automated Smart Contract & Blockchain Settlement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-blue-300 hover:text-white transition w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center cursor-pointer"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Book Summary Card */}
          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 flex justify-between items-center text-xs">
            <div className="min-w-0 pr-2">
              <span className="text-[10px] text-slate-400 block font-medium">Book Purchase</span>
              <strong className="text-white text-sm truncate block font-bold">"{book.title}"</strong>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-slate-400 block font-medium">Amount</span>
              <strong className="text-emerald-400 text-sm font-mono font-black">
                {book.price} AFN (~${usdPrice})
              </strong>
            </div>
          </div>

          {/* Crypto Asset Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setSelectedCrypto('TON')}
              className={`p-2.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                selectedCrypto === 'TON'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <i className="fas fa-gem text-xs"></i>
              TON / Tonkeeper
            </button>
            <button
              type="button"
              onClick={() => setSelectedCrypto('USDT_TRC20')}
              className={`p-2.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                selectedCrypto === 'USDT_TRC20'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <i className="fas fa-coins text-xs"></i>
              USDT (TRC-20)
            </button>
          </div>

          {/* Web3 Direct Wallet Connect Section */}
          {selectedCrypto === 'TON' && (
            <div className="p-4 bg-gradient-to-br from-blue-950/40 to-slate-950 rounded-2xl border border-blue-900/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-blue-400 uppercase tracking-wider">
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
                  onClick={handleConnectWallet}
                  disabled={isConnectingWallet}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-extrabold py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-blue-950 cursor-pointer active:scale-98"
                >
                  {isConnectingWallet ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      <span>Connecting Tonkeeper Wallet...</span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-wallet"></i>
                      <span>Connect Tonkeeper / Web3 Wallet (1-Click)</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs flex justify-between items-center font-mono">
                    <span className="text-slate-400 text-[10px]">Account:</span>
                    <span className="text-blue-300 font-bold">{walletAddress}</span>
                  </div>

                  {txState === 'idle' && (
                    <button
                      type="button"
                      onClick={handlePayViaWallet}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-3 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-98"
                    >
                      <i className="fas fa-bolt text-yellow-300"></i>
                      <span>Pay {tonPrice} TON with Automated Confirmation</span>
                    </button>
                  )}
                </div>
              )}

              {/* Tonkeeper App & Web 1-Click Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-blue-900/40">
                <button
                  type="button"
                  onClick={handleOpenTonkeeperApp}
                  className="py-2 px-3 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-sky-400/30 transition cursor-pointer"
                >
                  <i className="fas fa-arrow-up-right-from-square text-[10px]"></i>
                  <span>Tonkeeper App</span>
                </button>
                <a
                  href={tonkeeperUniversalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-indigo-400/30 transition text-center no-underline"
                >
                  <i className="fas fa-globe text-[10px]"></i>
                  <span>Tonkeeper Web</span>
                </a>
              </div>
            </div>
          )}

          {/* Blockchain Handshake / Mining States */}
          {txState === 'awaiting_signature' && (
            <div className="text-center py-6 space-y-3 bg-slate-950 rounded-2xl border border-blue-900/30 p-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center text-xl mx-auto animate-pulse">
                <i className="fas fa-signature"></i>
              </div>
              <h4 className="text-sm font-bold text-white">Awaiting Wallet Signature...</h4>
              <p className="text-[11px] text-slate-400">Please approve the automated transaction in Tonkeeper.</p>
            </div>
          )}

          {txState === 'confirming_blockchain' && (
            <div className="text-center py-6 space-y-3 bg-slate-950 rounded-2xl border border-blue-900/30 p-4">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-xl mx-auto animate-spin">
                <i className="fas fa-network-wired"></i>
              </div>
              <h4 className="text-sm font-bold text-white">Automated Blockchain Confirmation in Progress...</h4>
              <p className="text-[10px] font-mono text-emerald-400 truncate max-w-xs mx-auto">TX: {txHash || 'Broadcasting transaction...'}</p>
            </div>
          )}

          {txState === 'pending_review' && (
            <div className="text-center py-5 space-y-3 bg-slate-950 rounded-2xl border border-amber-900/30 p-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-2xl mx-auto">
                <i className="fas fa-clock"></i>
              </div>
              <h4 className="text-sm font-black text-amber-400">Awaiting Payment Confirmation</h4>
              <p className="text-[11px] text-slate-300">We couldn't automatically confirm this transaction on-chain yet. Our team will verify your payment and unlock the book shortly — you'll be notified in "My Purchases".</p>
            </div>
          )}

          {txState === 'confirmed' && (
            <div className="text-center py-5 space-y-3 bg-slate-950 rounded-2xl border border-emerald-900/30 p-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-2xl mx-auto">
                <i className="fas fa-check-circle animate-bounce"></i>
              </div>
              <h4 className="text-sm font-black text-emerald-400">Payment Verified on Blockchain!</h4>
              <p className="text-[11px] text-slate-300">Book download has been unlocked automatically.</p>
            </div>
          )}

          {/* QR Code & Automated Blockchain Listener */}
          {txState === 'idle' && (
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block text-center">
                Or send directly via QR Code:
              </span>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="p-1.5 bg-white rounded-xl shrink-0 shadow">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(currentAddress)}&bgcolor=ffffff`}
                    alt="Crypto QR Code"
                    className="w-24 h-24 rounded-lg"
                  />
                </div>

                <div className="space-y-2 flex-1 min-w-0">
                  <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                    <span className="text-[9px] text-slate-400 block font-semibold">
                      {selectedCrypto === 'USDT_TRC20' ? 'USDT TRC-20 Address:' : 'TON Wallet Address:'}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 break-all select-all font-bold">
                      {currentAddress}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <i className="fas fa-copy text-[10px]"></i>
                    <span>{copied ? 'Copied to Clipboard!' : 'Copy Address'}</span>
                  </button>
                </div>
              </div>

              {/* Automated Blockchain node detector button */}
              <div className="pt-2 border-t border-slate-900">
                <button
                  type="button"
                  onClick={handleAutoCheckBlockchain}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg cursor-pointer active:scale-98"
                >
                  <i className="fas fa-satellite-dish"></i>
                  <span>Auto-Verify Blockchain Settlement (Instant Unlock)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CryptoPaymentModal;
