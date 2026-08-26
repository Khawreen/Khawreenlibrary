import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import * as db from '../db';

interface ProfileProps {
  showToast: (message: string, type: 'success' | 'error') => void;
}

const Profile: React.FC<ProfileProps> = ({ showToast }) => {
  const { currentUser } = useAuth();
  const [name, setName] = useState(currentUser?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  if (!currentUser) {
    return <div>You must be logged in to view this page.</div>;
  }

  const handleNameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name cannot be empty.', 'error');
      return;
    }
    try {
      await db.updateProfile(currentUser.email, { name });
      showToast('Name updated successfully!', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      showToast(message, 'error');
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters long.', 'error');
        return;
    }
    try {
      await db.updateProfile(currentUser.email, { currentPassword, newPassword });
      showToast('Password updated successfully!', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred.';
      showToast(message, 'error');
    }
  };

  return (
    <>
      <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-6 flex items-center gap-3">
        <i className="fas fa-user-circle"></i>
        My Profile
      </h2>

      <div className="space-y-8">
        {/* Update Name Form */}
        <form onSubmit={handleNameUpdate} className="flex flex-col gap-4 p-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Update Your Name</h3>
          <div className="form-group flex flex-col gap-2">
            <label htmlFor="name" className="font-semibold text-slate-700 dark:text-slate-300">Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            />
          </div>
          <button type="submit" className="self-start bg-indigo-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-indigo-500 transition-all">
            Save Name
          </button>
        </form>

        {/* Update Password Form */}
        <form onSubmit={handlePasswordUpdate} className="flex flex-col gap-4 p-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">Change Password</h3>
          <div className="form-group flex flex-col gap-2">
            <label htmlFor="currentPassword" className="font-semibold text-slate-700 dark:text-slate-300">Current Password</label>
            <input
              type="password"
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            />
          </div>
           <div className="form-group flex flex-col gap-2">
            <label htmlFor="newPassword" className="font-semibold text-slate-700 dark:text-slate-300">New Password</label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            />
          </div>
           <div className="form-group flex flex-col gap-2">
            <label htmlFor="confirmPassword" className="font-semibold text-slate-700 dark:text-slate-300">Confirm New Password</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            />
          </div>
          <button type="submit" className="self-start bg-indigo-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-indigo-500 transition-all">
            Update Password
          </button>
        </form>
      </div>
    </>
  );
};

export default Profile;
