import React, { useState, useRef, useEffect } from 'react';
import { Section, User } from '../types';
import Clock from './Clock';
import { useAuth } from '../AuthContext';

interface HeaderProps {
  activeSection: Section;
  onNavigate: (section: Section) => void;
  onLogout: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  pendingApprovalCount: number;
  installPrompt: any;
  onInstallClick: () => void;
  onRequestPublishGuide: () => void;
  onRequestGithubPublishGuide: () => void;
}

const NavLink: React.FC<{
  onClick: () => void;
  icon: string;
  label: string;
  isActive: boolean;
  className?: string;
}> = ({ onClick, icon, label, isActive, className = '' }) => (
  <li>
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`font-semibold text-sm sm:text-base px-3 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 transform active:scale-95 hover:-translate-y-0.5 ${
        isActive
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25 dark:bg-indigo-600 dark:text-white'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 hover:text-indigo-600 dark:hover:text-indigo-400'
      } ${className}`}
       aria-current={isActive ? 'page' : undefined}
    >
      <i className={`fas ${icon} transition-transform duration-200 group-hover:scale-110`}></i>
      {label}
    </a>
  </li>
);

const Header: React.FC<HeaderProps> = ({ activeSection, onNavigate, onLogout, searchQuery, setSearchQuery, theme, toggleTheme, pendingApprovalCount, installPrompt, onInstallClick, onRequestPublishGuide, onRequestGithubPublishGuide }) => {
  const { currentUser } = useAuth();
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSearchVisible) {
      searchInputRef.current?.focus();
    }
  }, [isSearchVisible]);

  // If a search is initiated elsewhere (e.g. chatbot), show the search bar
  useEffect(() => {
    if (searchQuery) {
        setIsSearchVisible(true);
    }
  }, [searchQuery]);

  // Effect to close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const handleSearchBlur = () => {
    if (!searchQuery) {
      setIsSearchVisible(false);
    }
  };

  return (
    <header className="bg-white dark:bg-slate-800 shadow-md sticky top-0 z-50 p-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate(Section.Books)}>
        <h1 className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2 leading-tight">
          <i className="fas fa-book-open text-emerald-500"></i>
          <span>Khawreen Library</span>
        </h1>
        <Clock />
      </div>
      <div className="flex items-center flex-wrap justify-center gap-x-2 gap-y-2 sm:flex-nowrap">
        <nav>
          <ul className="flex flex-wrap justify-center list-none gap-1 sm:gap-2 m-0 p-0">
            <NavLink onClick={() => onNavigate(Section.Books)} icon="fa-book" label="Books" isActive={activeSection === Section.Books} />
            {currentUser && <NavLink onClick={() => onNavigate(Section.MyBooks)} icon="fa-folder-open" label="My Books" isActive={activeSection === Section.MyBooks} />}
            {currentUser && <NavLink onClick={() => onNavigate(Section.MyPurchases)} icon="fa-shopping-cart" label="My Purchases" isActive={activeSection === Section.MyPurchases} />}
            {currentUser && <NavLink onClick={() => onNavigate(Section.Upload)} icon="fa-upload" label="Upload" isActive={activeSection === Section.Upload} />}
            {currentUser?.role === 'admin' && (
              <>
                <li className="relative">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(Section.Admin);
                    }}
                    className={`font-semibold text-sm sm:text-base px-3 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 transform active:scale-95 hover:-translate-y-0.5 shadow-sm ${activeSection === Section.Admin ? 'bg-yellow-400 text-yellow-950 font-bold border border-yellow-500 shadow-md shadow-yellow-300/40 dark:bg-yellow-500 dark:text-yellow-950 dark:border-yellow-600' : 'bg-yellow-100 text-yellow-800 border border-yellow-300 hover:bg-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700 dark:hover:bg-yellow-800/60'}`}
                    aria-current={activeSection === Section.Admin ? 'page' : undefined}
                  >
                    <i className="fas fa-user-shield"></i>
                    Admin Panel
                  </a>
                  {pendingApprovalCount > 0 && (
                    <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white ring-2 ring-white dark:ring-slate-800 transform translate-x-1/2 -translate-y-1/2 animate-bounce">
                      {pendingApprovalCount}
                    </span>
                  )}
                </li>
                <NavLink
                  onClick={() => onNavigate(Section.Orders)}
                  icon="fa-receipt"
                  label="Orders"
                  isActive={activeSection === Section.Orders}
                  className={activeSection !== Section.Orders ? "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700" : "border border-emerald-400"}
                />
                <NavLink
                  onClick={() => onNavigate(Section.AdsManager)}
                  icon="fa-bullhorn"
                  label="Ads"
                  isActive={activeSection === Section.AdsManager}
                  className={activeSection !== Section.AdsManager ? "bg-cyan-100 text-cyan-800 border border-cyan-300 hover:bg-cyan-200 dark:bg-cyan-900/50 dark:text-cyan-300 dark:border-cyan-700 dark:hover:bg-cyan-800/60" : "border border-cyan-400"}
                />
              </>
            )}
          </ul>
        </nav>
        
        <div className="flex items-center gap-2">
            <div className={`flex items-center transition-all duration-300 ease-in-out ${isSearchVisible ? 'w-48 sm:w-64' : 'w-10'}`}>
                {isSearchVisible ? (
                     <div className="relative w-full">
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder='Search or use author:, tag:, lang:'
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onBlur={handleSearchBlur}
                            className="w-full py-2 pl-9 pr-3 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-full focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 focus:border-indigo-600 transition"
                        />
                         <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"></i>
                     </div>
                ) : (
                    <button onClick={() => setIsSearchVisible(true)} className="w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors" aria-label="Open search">
                        <i className="fas fa-search text-lg"></i>
                    </button>
                )}
            </div>

            {installPrompt && (
              <button 
                onClick={onInstallClick} 
                className="animate-fade-in-up bg-indigo-600 text-white font-semibold text-sm px-3 sm:px-4 py-2 rounded-full hover:bg-indigo-500 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:shadow-indigo-900/50 flex items-center gap-2"
                aria-label="Install App"
              >
                <i className="fas fa-download"></i>
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}
            
            <button onClick={toggleTheme} className="w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
                <i className={`fas ${theme === 'light' ? 'fa-moon' : 'fa-sun'} text-lg`}></i>
            </button>

            <div className="hidden md:block w-px h-8 bg-slate-200 dark:bg-slate-700"></div>

            <div className="flex items-center gap-3">
              {currentUser ? (
                <div className="relative" ref={userMenuRef}>
                  <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-2 font-semibold text-sm text-slate-700 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                    <i className="fas fa-user-circle text-lg hidden sm:inline"></i>
                    <span className="hidden sm:inline">{currentUser.name}</span>
                    <i className={`fas fa-chevron-down text-xs transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}></i>
                  </button>
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 z-50 animate-fade-in">
                      <div className="px-4 py-3">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{currentUser.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{currentUser.email}</p>
                          {currentUser.role === 'admin' && (
                            <span className="text-xs mt-1 inline-block font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full dark:bg-indigo-900/50 dark:text-indigo-300">ADMIN</span>
                          )}
                      </div>
                      
                      {currentUser?.role === 'admin' && (
                        <div className="py-1 border-t border-slate-200 dark:border-slate-700">
                            <a href="#" onClick={(e) => { e.preventDefault(); onNavigate(Section.Profile); setIsUserMenuOpen(false); }} className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                             <i className="fas fa-user-cog w-5 text-center"></i> My Profile
                           </a>
                           <a href="#" onClick={(e) => { e.preventDefault(); onRequestPublishGuide(); setIsUserMenuOpen(false); }} className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                             <i className="fas fa-rocket w-5 text-center"></i> Publish Guide (Netlify)
                           </a>
                           <a href="#" onClick={(e) => { e.preventDefault(); onRequestGithubPublishGuide(); setIsUserMenuOpen(false); }} className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                             <i className="fa-brands fa-github w-5 text-center"></i> Publish Guide (GitHub)
                           </a>
                        </div>
                      )}

                      {currentUser.role === 'admin' && (
                        <div className="py-1 border-t border-slate-200 dark:border-slate-700">
                           <a href="#" onClick={(e) => { e.preventDefault(); onNavigate(Section.Settings); setIsUserMenuOpen(false); }} className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                            <i className="fas fa-cog w-5 text-center"></i> Settings
                          </a>
                        </div>
                      )}

                       <div className="py-1 border-t border-slate-200 dark:border-slate-700">
                         <a href="#" onClick={(e) => { e.preventDefault(); onLogout(); setIsUserMenuOpen(false); }} className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                          <i className="fas fa-sign-out-alt w-5 text-center"></i> Logout
                        </a>
                       </div>
                    </div>
                  )}
                </div>
              ) : (
                 <ul className="flex flex-wrap justify-center list-none gap-2 sm:gap-4 m-0 p-0">
                    <NavLink onClick={() => onNavigate(Section.Register)} icon="fa-user-plus" label="Register" isActive={activeSection === Section.Register} />
                    <NavLink onClick={() => onNavigate(Section.Login)} icon="fa-sign-in-alt" label="Login" isActive={activeSection === Section.Login}/>
                 </ul>
              )}
            </div>
        </div>
      </div>
    </header>
  );
};

export default Header;