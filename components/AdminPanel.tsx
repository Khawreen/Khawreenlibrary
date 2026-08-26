

import React, { useState, useEffect } from 'react';
import { Book, Review, Section, TelegramUser } from '../types';
import BookCard from './BookCard';
import { useAuth } from '../AuthContext';
import { onSnapshot } from '../db';

interface AdminPanelProps {
  books: Book[];
  reviews: Review[];
  onAddReview: (bookId: string, rating: number, comment: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRequestSummary: (id: string) => void;
  onRequestEdit: (id: string) => void;
  onRequestPreview: (id: string) => void;
  onNavigate: (section: Section) => void;
  onDownload: (id: string) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ books, onApprove, onReject, onRequestSummary, onRequestEdit, onRequestPreview, reviews, onAddReview, onNavigate, onDownload }) => {
  const { currentUser } = useAuth();
  const [telegramUsers, setTelegramUsers] = useState<TelegramUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'submissions' | 'telegram_users'>('submissions');

  useEffect(() => {
    const unsubscribe = onSnapshot<TelegramUser>('telegram_users', (data) => {
      setTelegramUsers(data || []);
      setLoadingUsers(false);
    });
    return () => unsubscribe();
  }, []);

  const now = Date.now();
  const fiveMinsAgo = now - 5 * 60 * 1000;
  const onlineCount = telegramUsers.filter(u => u.lastActive && u.lastActive >= fiveMinsAgo).length;
  const activeTodayCount = telegramUsers.filter(u => u.lastActive && u.lastActive >= (now - 24 * 60 * 60 * 1000)).length;

  const filteredUsers = telegramUsers.filter(u => {
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
    const handle = (u.username || '').toLowerCase();
    const idStr = String(u.telegramId || '');
    const term = searchTerm.toLowerCase().trim();
    return !term || fullName.includes(term) || handle.includes(term) || idStr.includes(term);
  }).sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));

  return (
    <div className="space-y-8">
      {/* Tab Header */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('submissions')}
          className={`py-3 px-6 font-semibold border-b-2 text-sm sm:text-base transition-colors flex items-center gap-2 ${
            activeTab === 'submissions'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <i className="fas fa-tasks"></i>
          Approve Submissions ({books.length})
        </button>
        <button
          onClick={() => setActiveTab('telegram_users')}
          className={`py-3 px-6 font-semibold border-b-2 text-sm sm:text-base transition-colors flex items-center gap-2 ${
            activeTab === 'telegram_users'
              ? 'border-sky-500 text-sky-600 dark:text-sky-400 dark:border-sky-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <i className="fab fa-telegram"></i>
          Telegram Members ({telegramUsers.length})
          {onlineCount > 0 && (
            <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
              {onlineCount} online
            </span>
          )}
        </button>
      </div>

      {activeTab === 'submissions' && (
        <>
          <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-2 flex items-center gap-3">
            <i className="fas fa-user-shield"></i>
            Approve Submissions
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm sm:text-base">
            Review all books currently pending approval below. To manage your own uploads, you can also go to the "My Books" section.
          </p>
          <div className="flex flex-col gap-6">
            {books.length > 0 ? (
              books.map(book => (
                <BookCard 
                  key={book.id}
                  book={book}
                  onDelete={onReject}
                  onApprove={onApprove}
                  onPurchase={() => {}}
                  onDownload={onDownload}
                  onRequestSummary={onRequestSummary}
                  onRequestEdit={onRequestEdit}
                  onRequestPreview={onRequestPreview}
                  reviews={reviews}
                  onAddReview={onAddReview}
                  showStatus={true}
                  onNavigate={onNavigate}
                />
              ))
            ) : (
              <div className="text-center py-10 px-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <i className="fas fa-inbox text-4xl text-slate-400 dark:text-slate-500 mb-4"></i>
                <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-300">No submissions to review</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1">There are currently no books pending approval.</p>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'telegram_users' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-sky-600 dark:text-sky-400 flex items-center gap-3">
                <i className="fab fa-telegram-plane"></i>
                Telegram Bot Members Database
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                All registered Telegram bot users and their activity status.
              </p>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/30 dark:to-blue-900/30 border border-sky-200 dark:border-sky-800 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-semibold text-sm">Total Members</span>
                <i className="fas fa-users text-sky-500 text-xl"></i>
              </div>
              <div className="text-3xl font-black text-sky-700 dark:text-sky-300 mt-2">{telegramUsers.length}</div>
            </div>

            <div className="p-5 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-semibold text-sm">Online Now</span>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </div>
              <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300 mt-2">{onlineCount}</div>
            </div>

            <div className="p-5 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/30 dark:to-violet-900/30 border border-indigo-200 dark:border-indigo-800 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-semibold text-sm">Active Today</span>
                <i className="fas fa-calendar-day text-indigo-500 text-xl"></i>
              </div>
              <div className="text-3xl font-black text-indigo-700 dark:text-indigo-300 mt-2">{activeTodayCount}</div>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <i className="fas fa-search absolute left-4 top-3.5 text-slate-400"></i>
            <input
              type="text"
              placeholder="Search by name, @username, or Telegram ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-400 outline-none transition"
            />
          </div>

          {/* Members Table */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
            {loadingUsers ? (
              <div className="p-8 text-center text-slate-500">
                <i className="fas fa-spinner fa-spin text-2xl mr-2 text-sky-500"></i>
                Loading members data...
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 font-bold uppercase text-xs">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">Username</th>
                      <th className="p-4">Telegram ID</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Last Active</th>
                      <th className="p-4 text-center">Messages</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-700 dark:text-slate-200">
                    {filteredUsers.map((u) => {
                      const isOnline = u.lastActive && u.lastActive >= fiveMinsAgo;
                      const displayName = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'User';
                      const lastActiveDate = u.lastActive ? new Date(u.lastActive).toLocaleString('en-US') : '—';

                      return (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                          <td className="p-4 font-semibold flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-300 font-bold flex items-center justify-center text-xs">
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                            {displayName}
                          </td>
                          <td className="p-4 text-sky-600 dark:text-sky-400 font-mono">
                            {u.username ? `@${u.username}` : '—'}
                          </td>
                          <td className="p-4 font-mono text-slate-500 dark:text-slate-400">
                            {u.telegramId}
                          </td>
                          <td className="p-4">
                            {isOnline ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                Offline
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-xs text-slate-500 dark:text-slate-400">
                            {lastActiveDate}
                          </td>
                          <td className="p-4 text-center font-bold text-slate-800 dark:text-slate-200">
                            {u.messagesCount || 1}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                <i className="fab fa-telegram text-4xl mb-3 text-slate-300 dark:text-slate-600"></i>
                <p className="font-semibold">No Telegram users found.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
