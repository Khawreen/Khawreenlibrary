import React, { useState } from 'react';
import { Section } from '../types';

interface RegisterFormProps {
  onRegister: (user: { name: string; email: string; password?: string }) => void;
  onNavigate?: (section: Section) => void;
  onTelegramLogin?: () => void;
  isLoading?: boolean;
}

const PasswordStrengthMeter: React.FC<{ password: string }> = ({ password }) => {
  const getStrength = (pass: string) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length >= 8) score++;
    if (pass.match(/[a-z]/)) score++;
    if (pass.match(/[A-Z]/)) score++;
    if (pass.match(/[0-9]/)) score++;
    if (pass.match(/[^a-zA-Z0-9]/)) score++;
    return score;
  };

  const strength = getStrength(password);
  const labels = ['Too Short', 'Weak', 'Medium', 'Strong', 'Very Strong'];
  const colors = ['bg-slate-300', 'bg-red-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
  const widths = ['w-0', 'w-1/5', 'w-2/5', 'w-3/5', 'w-4/5', 'w-full'];

  const strengthIndex = password.length === 0 ? 0 : (password.length < 6 ? 1 : strength);

  return (
    <div className="mt-1 h-4">
      {password.length > 0 && (
        <>
          <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all ${colors[strengthIndex]} ${widths[strengthIndex]}`}></div>
          </div>
          <p className="text-xs text-right mt-1 font-semibold text-slate-500 dark:text-slate-400">
            {labels[strengthIndex]}
          </p>
        </>
      )}
    </div>
  );
};

const RegisterForm: React.FC<RegisterFormProps> = ({ onRegister, onNavigate, onTelegramLogin, isLoading = false }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password) {
      setErrorMessage('Please fill in name, email, and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    onRegister({ name: cleanName, email: cleanEmail, password });
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-3">
            <i className="fas fa-user-plus text-indigo-500"></i>
            <span>Create Account</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Join Khawreen Digital Library to explore, read, and purchase books.
          </p>
        </div>

        {onTelegramLogin && (
          <button
            type="button"
            onClick={onTelegramLogin}
            className="flex items-center justify-center gap-2 bg-[#229ED9] hover:bg-[#1d8bc0] text-white font-medium px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 text-sm"
          >
            <i className="fab fa-telegram-plane text-lg"></i>
            <span>Sign in with Telegram</span>
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-sm text-red-600 dark:text-red-300">
          <i className="fas fa-exclamation-circle text-base"></i>
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Full Name */}
        <div className="form-group flex flex-col gap-2">
          <label htmlFor="name" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Full Name</span>
            <span className="text-xs text-slate-400">Required *</span>
          </label>
          <div className="relative">
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe / Mohammad Gul"
              required
              className="w-full p-3.5 pl-10 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 transition bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm"
            />
            <i className="fas fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          </div>
        </div>

        {/* Email */}
        <div className="form-group flex flex-col gap-2">
          <label htmlFor="email" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Email Address</span>
            <span className="text-xs text-slate-400">Required *</span>
          </label>
          <div className="relative">
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full p-3.5 pl-10 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 transition bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 shadow-sm"
            />
            <i className="fas fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          </div>
        </div>

        {/* Password */}
        <div className="form-group flex flex-col gap-2">
          <label htmlFor="password" className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Password</span>
            <span className="text-xs text-slate-400">At least 6 characters</span>
          </label>
          <div className="relative flex items-center border border-slate-300 dark:border-slate-600 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-600 transition bg-white dark:bg-slate-700 shadow-sm">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
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
          <PasswordStrengthMeter password={password} />
        </div>

        {/* Confirm Password */}
        <div className="form-group flex flex-col gap-2">
          <label htmlFor="confirm-password" className="font-semibold text-slate-700 dark:text-slate-300">
            Confirm Password
          </label>
          <div className="relative flex items-center border border-slate-300 dark:border-slate-600 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-600 transition bg-white dark:bg-slate-700 shadow-sm">
            <input
              type={showPassword ? 'text' : 'password'}
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              minLength={6}
              className="w-full p-3.5 pl-10 pr-12 border-none bg-transparent focus:ring-0 text-slate-800 dark:text-slate-200"
            />
            <i className="fas fa-check-double absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          </div>
        </div>

        {onNavigate && (
          <div className="flex items-center justify-between text-sm mt-1">
            <button
              type="button"
              onClick={() => onNavigate(Section.Login)}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              Already have an account? Sign In
            </button>
            <button
              type="button"
              onClick={() => onNavigate(Section.ForgotPassword)}
              className="text-slate-500 dark:text-slate-400 hover:underline text-xs"
            >
              Forgot Password?
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 dark:hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-300 hover:shadow-lg dark:shadow-indigo-900/50 flex items-center justify-center gap-2 cursor-pointer shadow-md mt-2 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <i className="fas fa-spinner fa-spin text-lg"></i>
              <span>Creating account...</span>
            </>
          ) : (
            <>
              <i className="fas fa-user-plus text-lg"></i>
              <span>Register Account</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default RegisterForm;
