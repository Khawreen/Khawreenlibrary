import React, { useState } from 'react';
import { User, Section } from '../types';

interface LoginFormProps {
  onLogin: (credentials: { email: string; password?: string; }) => void;
  onNavigate: (section: Section) => void;
  onTelegramLogin?: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, onNavigate, onTelegramLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Email and password are required.");
      return;
    }
    onLogin({ email, password });
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-3">
          <i className="fas fa-sign-in-alt"></i>
          Sign In
        </h2>
        
        {onTelegramLogin && (
          <button
            type="button"
            onClick={onTelegramLogin}
            className="flex items-center justify-center gap-2 bg-[#229ED9] hover:bg-[#1d8bc0] text-white font-medium px-4 py-2.5 rounded-lg transition-all shadow-sm active:scale-95 text-sm"
          >
            <i className="fab fa-telegram-plane text-lg"></i>
            <span>Login with Telegram (1-Click)</span>
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="form-group flex flex-col gap-2">
          <label htmlFor="login-email" className="font-semibold text-slate-700 dark:text-slate-300">
            Email or Username
          </label>
          <input
            type="text"
            id="login-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com or telegram_user"
            required
            className="p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 focus:border-indigo-600 transition bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
          />
        </div>
        <div className="form-group flex flex-col gap-2">
          <label htmlFor="login-password" className="font-semibold text-slate-700 dark:text-slate-300">
            Password
          </label>
          <div className="flex items-center border border-slate-300 dark:border-slate-600 rounded-lg focus-within:ring-2 focus-within:ring-indigo-300 dark:focus-within:ring-indigo-500 focus-within:border-indigo-600 transition bg-white dark:bg-slate-700">
            <input
              type={showPassword ? 'text' : 'password'}
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="flex-1 p-3 border-none bg-transparent focus:ring-0 text-slate-800 dark:text-slate-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="px-4 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => onNavigate(Section.Register)}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            Don't have an account? Register
          </button>
          <a 
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate(Section.ForgotPassword);
            }}
            className="text-slate-500 dark:text-slate-400 hover:underline"
          >
            Forgot password?
          </a>
        </div>

        <button
          type="submit"
          className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-500 dark:hover:bg-indigo-700 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:shadow-indigo-900/50 flex items-center justify-center gap-2 mt-2"
        >
          <i className="fas fa-sign-in-alt"></i>
          Sign In
        </button>
      </form>
    </>
  );
};

export default LoginForm;