import React, { useState, useEffect } from 'react';
import { Settings } from '../types';

interface PaymentSettingsProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
}

const PaymentSettings: React.FC<PaymentSettingsProps> = ({ settings, onSave }) => {
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [telegramAdminUsername, setTelegramAdminUsername] = useState('');
  const [bankAccountDetails, setBankAccountDetails] = useState('');
  const [hesabpayMerchantId, setHesabpayMerchantId] = useState('');
  const [hesabpayApiKey, setHesabpayApiKey] = useState('');
  const [hesabpaySandboxMode, setHesabpaySandboxMode] = useState(true);
  const [usdtTrc20Address, setUsdtTrc20Address] = useState('');
  const [tonWalletAddress, setTonWalletAddress] = useState('');
  const [nowpaymentsApiKey, setNowpaymentsApiKey] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramPaymentProviderToken, setTelegramPaymentProviderToken] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [saveMessage, setSaveMessage] = useState(false);

  useEffect(() => {
    setWhatsappNumber(settings.whatsappNumber || '+93700000000');
    setTelegramAdminUsername(settings.telegramAdminUsername || 'KhawreenLibrary');
    setBankAccountDetails(settings.bankAccountDetails || `• Kabul Bank Account: 1001-002345-001\n• Azizi Bank Account: 0101-987654-002\n• Sarafi Transfer: Payable to "Khawreen Digital Library" in Kabul / Kandahar / Jalalabad`);
    setHesabpayMerchantId(settings.hesabpayMerchantId || '');
    setHesabpayApiKey(settings.hesabpayApiKey || '');
    setHesabpaySandboxMode(settings.hesabpaySandboxMode !== false);
    setUsdtTrc20Address(settings.usdtTrc20Address || '');
    setTonWalletAddress(settings.tonWalletAddress || '');
    setNowpaymentsApiKey(settings.nowpaymentsApiKey || '');
    setTelegramBotToken(settings.telegramBotToken || '');
    setTelegramPaymentProviderToken(settings.telegramPaymentProviderToken || '');
    setWebsiteUrl(settings.websiteUrl || '');
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: 'main',
      whatsappNumber,
      telegramAdminUsername,
      bankAccountDetails,
      hesabpayMerchantId,
      hesabpayApiKey,
      hesabpaySandboxMode,
      usdtTrc20Address,
      tonWalletAddress,
      nowpaymentsApiKey,
      telegramBotToken,
      telegramPaymentProviderToken,
      websiteUrl,
    });
    setSaveMessage(true);
    setTimeout(() => setSaveMessage(false), 3000);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-3">
            <i className="fas fa-cog"></i>
            Payment Gateways & Configurations
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your HesabPay, Tonkeeper, Telegram Stars, NOWPayments, and Direct Bank credentials.
          </p>
        </div>
        {saveMessage && (
          <div className="bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-500 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
            <i className="fas fa-check-circle text-sm"></i>
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* 1. Direct Transfer: Bank Accounts & Sarafi */}
        <div className="p-6 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border-2 border-emerald-500/60 dark:border-emerald-700/60 shadow-sm">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-2xl shadow-md">
              <i className="fas fa-university"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">1. Bank & Sarafi Account Details</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Specify your library's bank accounts, Sarafi transfer info, and admin usernames for manual direct transfers.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="form-group flex flex-col gap-2">
              <label htmlFor="telegramAdminUsername" className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                Telegram Admin Username (@Username)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">@</span>
                <input
                  type="text"
                  id="telegramAdminUsername"
                  value={telegramAdminUsername}
                  onChange={(e) => setTelegramAdminUsername(e.target.value.replace(/^@/, ''))}
                  placeholder="KhawreenLibrary"
                  className="pl-8 p-3 w-full border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-400 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm"
                />
              </div>
            </div>

            <div className="form-group flex flex-col gap-2">
              <label htmlFor="whatsappNumber" className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                WhatsApp Support Number
              </label>
              <input
                type="text"
                id="whatsappNumber"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+93700000000"
                className="p-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-400 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm"
              />
            </div>
          </div>

          <div className="form-group flex flex-col gap-2">
            <label htmlFor="bankAccountDetails" className="font-bold text-slate-700 dark:text-slate-300 text-sm">
              Bank & Sarafi Account Instructions
            </label>
            <textarea
              id="bankAccountDetails"
              value={bankAccountDetails}
              onChange={(e) => setBankAccountDetails(e.target.value)}
              rows={4}
              placeholder="e.g. Kabul Bank, Azizi Bank, and Sarafi transfer details..."
              className="p-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-400 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm leading-relaxed"
            />
          </div>
        </div>

        {/* 2. HesabPay Integration Section */}
        <div className="p-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-teal-500/30 dark:border-teal-700/50 shadow-sm">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 text-white flex items-center justify-center text-2xl shadow-md">
              <i className="fas fa-credit-card"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">2. HesabPay Payment Gateway (AFN)</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Automated payment settings for Afghan Afghani (AFN), mobile wallets, and national bank cards.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="form-group flex flex-col gap-2">
              <label htmlFor="hesabpayMerchantId" className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                HesabPay Merchant Code / ID
              </label>
              <input
                type="text"
                id="hesabpayMerchantId"
                value={hesabpayMerchantId}
                onChange={(e) => setHesabpayMerchantId(e.target.value)}
                placeholder="Ex. MC-12345 or 5-digit merchant code"
                className="p-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-sm"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Fallback env: <code>HESABPAY_MERCHANT_ID</code></span>
            </div>

            <div className="form-group flex flex-col gap-2">
              <label htmlFor="hesabpayApiKey" className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                HesabPay API Key / Secret Token
              </label>
              <input
                type="password"
                id="hesabpayApiKey"
                value={hesabpayApiKey}
                onChange={(e) => setHesabpayApiKey(e.target.value)}
                placeholder="Enter your HesabPay Merchant API Key"
                className="p-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-teal-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-sm"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Fallback env: <code>HESABPAY_API_KEY</code></span>
            </div>
          </div>

          <div className="form-group flex items-center gap-3 bg-white dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <input
              type="checkbox"
              id="hesabpaySandboxMode"
              checked={hesabpaySandboxMode}
              onChange={(e) => setHesabpaySandboxMode(e.target.checked)}
              className="w-4 h-4 text-teal-600 focus:ring-teal-500 rounded border-gray-300 cursor-pointer"
            />
            <div>
              <label htmlFor="hesabpaySandboxMode" className="font-bold text-slate-700 dark:text-slate-200 text-sm cursor-pointer">
                Enable HesabPay Sandbox Test Mode
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                When enabled, checkout executes safely using the sandbox environment without deducting real money.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Tonkeeper & Web3 Crypto Wallets */}
        <div className="p-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-indigo-500/30 dark:border-indigo-700/50 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center text-2xl shadow-md">
              <i className="fas fa-coins"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">3. Tonkeeper & Web3 Crypto Wallets</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Direct wallet addresses for 1-click Tonkeeper, Binance, Bybit, OKX, and USDT TRC-20 transfers.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="form-group flex flex-col gap-2">
                <label htmlFor="tonWalletAddress" className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                  TON / Tonkeeper Wallet Address
                </label>
                <input
                  type="text"
                  id="tonWalletAddress"
                  value={tonWalletAddress}
                  onChange={(e) => setTonWalletAddress(e.target.value)}
                  placeholder="UQ... or EQ..."
                  className="p-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-sm"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Fallback env: <code>TON_WALLET_ADDRESS</code> or <code>TONKEEPER_WALLET_ADDRESS</code></span>
              </div>

              <div className="form-group flex flex-col gap-2">
                <label htmlFor="usdtTrc20Address" className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                  USDT (TRC-20) Wallet Address
                </label>
                <input
                  type="text"
                  id="usdtTrc20Address"
                  value={usdtTrc20Address}
                  onChange={(e) => setUsdtTrc20Address(e.target.value)}
                  placeholder="T..."
                  className="p-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-sm"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Fallback env: <code>USDT_TRC20_ADDRESS</code></span>
              </div>
            </div>

            {/* Dynamic QR Code preview */}
            <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">QR Code Preview</span>
              {tonWalletAddress || usdtTrc20Address ? (
                <div className="text-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(tonWalletAddress || usdtTrc20Address)}&bgcolor=ffffff`}
                    alt="Wallet QR Code"
                    className="w-32 h-32 mx-auto rounded-lg border-2 border-indigo-500 shadow-sm"
                  />
                  <span className="text-[10px] font-mono text-slate-600 dark:text-slate-300 mt-2 block truncate max-w-[180px]">
                    {tonWalletAddress || usdtTrc20Address}
                  </span>
                </div>
              ) : (
                <div className="w-32 h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center text-slate-400">
                  <i className="fas fa-qrcode text-3xl mb-1 opacity-50"></i>
                  <span className="text-[10px]">Enter address to view QR</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. NOWPayments Automated Crypto Gateway */}
        <div className="p-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-blue-500/30 dark:border-blue-700/50 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 text-white flex items-center justify-center text-2xl shadow-md">
              <i className="fas fa-bolt"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">4. NOWPayments Automated Crypto Gateway</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Automatic blockchain payment invoices, instant multi-coin processing, and IPN webhook settlements.</p>
            </div>
          </div>

          <div className="form-group flex flex-col gap-2">
            <label htmlFor="nowpaymentsApiKey" className="font-bold text-slate-700 dark:text-slate-300 text-sm">
              NOWPayments API Key
            </label>
            <input
              type="password"
              id="nowpaymentsApiKey"
              value={nowpaymentsApiKey}
              onChange={(e) => setNowpaymentsApiKey(e.target.value)}
              placeholder="Enter your NOWPayments API Key"
              className="p-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-sm"
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-1 mt-1">
              <span>Fallback env: <code>NOWPAYMENTS_API_KEY</code> & <code>NOWPAYMENTS_IPN_SECRET</code></span>
              <a href="https://account.nowpayments.io" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline font-bold">
                Get API Key on nowpayments.io &rarr;
              </a>
            </div>
          </div>
        </div>

        {/* 5. Telegram Bot & Telegram Stars */}
        <div className="p-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-amber-500/30 dark:border-amber-700/50 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-500 text-slate-950 flex items-center justify-center text-2xl shadow-md">
              <i className="fa-brands fa-telegram text-2xl"></i>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">5. Telegram Bot & Telegram Stars</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Telegram Bot Token and Telegram Stars invoice processing credentials.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="form-group flex flex-col gap-2">
              <label htmlFor="telegramBotToken" className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                Telegram Bot Token
              </label>
              <input
                type="password"
                id="telegramBotToken"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                placeholder="Ex. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                className="p-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-sm"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Fallback env: <code>TELEGRAM_BOT_TOKEN</code></span>
            </div>

            <div className="form-group flex flex-col gap-2">
              <label htmlFor="telegramPaymentProviderToken" className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                Telegram Payment Provider Token (Optional)
              </label>
              <input
                type="password"
                id="telegramPaymentProviderToken"
                value={telegramPaymentProviderToken}
                onChange={(e) => setTelegramPaymentProviderToken(e.target.value)}
                placeholder="Leave empty for Telegram Stars (XTR)"
                className="p-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-sm"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Fallback env: <code>TELEGRAM_PAYMENT_PROVIDER_TOKEN</code> (Leave empty for Stars)</span>
            </div>
          </div>

          <div className="form-group flex flex-col gap-2">
            <label htmlFor="websiteUrl" className="font-bold text-slate-700 dark:text-slate-300 text-sm">
              Public Application URL
            </label>
            <input
              type="url"
              id="websiteUrl"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://your-library-app.run.app"
              className="p-3 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm"
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Fallback env: <code>APP_URL</code></span>
          </div>
        </div>

        {/* Submit Action */}
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-10 rounded-2xl transition duration-300 flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-indigo-600/30 text-base"
          >
            <i className="fas fa-save"></i>
            <span>Save All Payment Gateway Settings</span>
          </button>
        </div>
      </form>
    </>
  );
};

export default PaymentSettings;
