import React, { useState, useEffect } from 'react';
import { Section } from '../types';
import * as db from '../db';

interface ForgotPasswordFormProps {
  onNavigate: (section: Section) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onNavigate, showToast }) => {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [previewCode, setPreviewCode] = useState<string | null>(null);

  // Countdown timer for resend
  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: Send Verification Code to Email
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      showToast('Please enter your email address.', 'error');
      return;
    }

    setIsLoading(true);
    setPreviewCode(null);
    try {
      const res = await db.requestPasswordResetCode(cleanEmail);
      if (res.success) {
        showToast(res.message || 'A 6-digit verification code has been sent to your email.', 'success');
        if (res.previewCode) {
          setPreviewCode(res.previewCode);
        }
        setStep('verify');
        setResendCooldown(60);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to send verification code.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify Code and Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    if (!cleanCode || cleanCode.length < 4) {
      showToast('Please enter the 6-digit verification code.', 'error');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      showToast('Password must be at least 6 characters long.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await db.verifyPasswordResetCode(cleanEmail, cleanCode, newPassword);
      if (res.success) {
        showToast(res.message || 'Password reset successfully! You can now sign in.', 'success');
        onNavigate(Section.Login);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reset password.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-3">
            <i className="fas fa-shield-alt text-indigo-500"></i>
            <span>{step === 'request' ? 'Reset Password' : 'Enter Verification Code'}</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {step === 'request' 
              ? 'Enter your registered email to receive a 6-digit verification code.'
              : `Enter the 6-digit code sent to ${email} and your new password.`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate(Section.Login)}
          className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition"
        >
          <i className="fas fa-arrow-left"></i>
          <span>Back to Sign In</span>
        </button>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
          step === 'request' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
        }`}>
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
          <span>Email Address</span>
        </div>
        <i className="fas fa-chevron-right text-xs text-slate-400"></i>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
          step === 'verify' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
        }`}>
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
          <span>Code & Password</span>
        </div>
      </div>

      {/* Step 1: Request Code Form */}
      {step === 'request' && (
        <form onSubmit={handleSendCode} className="flex flex-col gap-5">
          <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 p-4 rounded-xl flex items-start gap-3">
            <i className="fas fa-envelope-open-text text-xl text-indigo-600 dark:text-indigo-400 mt-0.5"></i>
            <div className="text-sm text-indigo-900 dark:text-indigo-200">
              <p className="font-semibold">Verification Code Delivery:</p>
              <p className="mt-0.5 text-xs text-indigo-700 dark:text-indigo-300">
                To verify ownership of your account, a 6-digit security code will be sent to your email.
              </p>
            </div>
          </div>

          <div className="form-group flex flex-col gap-2">
            <label htmlFor="reset-email" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Email Address</span>
              <span className="text-xs text-slate-400">Required *</span>
            </label>
            <div className="relative">
              <input
                type="email"
                id="reset-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                required
                className="w-full p-3.5 pl-10 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 transition bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm"
              />
              <i className="fas fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="w-full bg-indigo-600 text-white font-bold py-3.5 px-6 rounded-xl hover:bg-indigo-500 dark:hover:bg-indigo-700 transition-all duration-300 hover:shadow-lg dark:shadow-indigo-900/50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md mt-2"
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin text-lg"></i>
                <span>Sending Code...</span>
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane text-lg"></i>
                <span>Send Verification Code</span>
              </>
            )}
          </button>

          <div className="text-center mt-2">
            <button
              type="button"
              onClick={() => onNavigate(Section.Login)}
              className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition"
            >
              Remembered your password? Sign In
            </button>
          </div>
        </form>
      )}

      {/* Step 2: Verify Code & Set New Password */}
      {step === 'verify' && (
        <form onSubmit={handleResetPassword} className="flex flex-col gap-5">
          {/* Target Email Badge */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <i className="fas fa-user-check text-emerald-500"></i>
              <span>Sent to: <strong className="text-indigo-600 dark:text-indigo-400">{email}</strong></span>
            </div>
            <button
              type="button"
              onClick={() => setStep('request')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Change Email
            </button>
          </div>

          {/* Preview Code Alert if in dev/preview mode */}
          {previewCode && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                <i className="fas fa-info-circle text-sm"></i>
                <span>Your verification code: <strong className="font-mono text-sm tracking-widest bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-amber-300">{previewCode}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => setCode(previewCode)}
                className="text-xs bg-amber-600 text-white font-bold px-2.5 py-1 rounded-lg hover:bg-amber-700 transition"
              >
                Auto Fill
              </button>
            </div>
          )}

          {/* 6-Digit Code Input */}
          <div className="form-group flex flex-col gap-2">
            <label htmlFor="reset-code" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>6-Digit Verification Code</span>
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">6 digits</span>
            </label>
            <div className="relative">
              <input
                type="text"
                id="reset-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                required
                autoFocus
                className="w-full p-3.5 pl-10 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 transition bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-xl tracking-[0.3em] text-center shadow-sm"
              />
              <i className="fas fa-key absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            </div>
          </div>

          {/* New Password */}
          <div className="form-group flex flex-col gap-2">
            <label htmlFor="reset-new-password" className="font-semibold text-slate-700 dark:text-slate-300">
              New Password
            </label>
            <div className="relative flex items-center border border-slate-300 dark:border-slate-600 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-600 transition bg-white dark:bg-slate-700 shadow-sm">
              <input
                type={showPassword ? 'text' : 'password'}
                id="reset-new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                minLength={6}
                className="w-full p-3.5 pl-10 pr-12 border-none bg-transparent focus:ring-0 text-slate-800 dark:text-slate-200"
              />
              <i className="fas fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="form-group flex flex-col gap-2">
            <label htmlFor="reset-confirm-password" className="font-semibold text-slate-700 dark:text-slate-300">
              Confirm New Password
            </label>
            <div className="relative flex items-center border border-slate-300 dark:border-slate-600 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-600 transition bg-white dark:bg-slate-700 shadow-sm">
              <input
                type={showPassword ? 'text' : 'password'}
                id="reset-confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                minLength={6}
                className="w-full p-3.5 pl-10 pr-12 border-none bg-transparent focus:ring-0 text-slate-800 dark:text-slate-200"
              />
              <i className="fas fa-check-double absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <i className="fas fa-exclamation-circle"></i>
                <span>Passwords do not match.</span>
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !code || code.length < 6 || !newPassword || newPassword !== confirmPassword}
            className="w-full bg-emerald-600 hover:bg-emerald-500 dark:hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-300 hover:shadow-lg dark:shadow-emerald-900/50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md mt-2"
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin text-lg"></i>
                <span>Resetting password...</span>
              </>
            ) : (
              <>
                <i className="fas fa-check-circle text-lg"></i>
                <span>Reset Password</span>
              </>
            )}
          </button>

          {/* Resend Code & Back Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-sm">
            <button
              type="button"
              onClick={handleSendCode}
              disabled={resendCooldown > 0 || isLoading}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium disabled:opacity-50 disabled:no-underline flex items-center gap-1.5"
            >
              <i className="fas fa-redo-alt text-xs"></i>
              <span>
                {resendCooldown > 0 
                  ? `Resend in (${resendCooldown}s)`
                  : 'Didn\'t receive code? Resend Code'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate(Section.Login)}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              Back to Sign In
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ForgotPasswordForm;
