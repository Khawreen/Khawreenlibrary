import React, { useState, useEffect } from 'react';
import { Ad } from '../types';

interface AdManagerProps {
  ads: Ad[];
  onAdd: (adData: Omit<Ad, 'id'>) => void;
  onUpdate: (adId: string, adData: Omit<Ad, 'id'>) => void;
  onDelete: (adId: string) => void;
}

const AdForm: React.FC<{
  onSubmit: (adData: Omit<Ad, 'id'>) => void;
  onCancel: () => void;
  initialData?: Ad;
}> = ({ onSubmit, onCancel, initialData }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description);
      setImageUrl(initialData.imageUrl);
      setLinkUrl(initialData.linkUrl);
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !imageUrl || !linkUrl) {
      alert('All fields are required.');
      return;
    }
    onSubmit({ title, description, imageUrl, linkUrl });
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col gap-4 animate-fade-in">
      <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">{initialData ? 'Edit Advertisement' : 'Create New Advertisement'}</h3>
      <input type="text" placeholder="Ad Title" value={title} onChange={e => setTitle(e.target.value)} required className="p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"/>
      <input type="url" placeholder="Image URL" value={imageUrl} onChange={e => setImageUrl(e.target.value)} required className="p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"/>
      <textarea placeholder="Ad Description" value={description} onChange={e => setDescription(e.target.value)} required className="p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200" rows={3}></textarea>
      <input type="url" placeholder="Link URL (e.g., https://example.com)" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} required className="p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"/>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-200 font-bold py-2 px-6 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Cancel</button>
        <button type="submit" className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-500 dark:hover:bg-indigo-700">{initialData ? 'Save Changes' : 'Create Ad'}</button>
      </div>
    </form>
  );
};

const AdManager: React.FC<AdManagerProps> = ({ ads, onAdd, onUpdate, onDelete }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | undefined>(undefined);

  const handleAddNew = () => {
    setEditingAd(undefined);
    setIsFormOpen(true);
  };
  
  const handleEdit = (ad: Ad) => {
    setEditingAd(ad);
    setIsFormOpen(true);
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingAd(undefined);
  };

  const handleSubmit = (adData: Omit<Ad, 'id'>) => {
    if (editingAd) {
      onUpdate(editingAd.id, adData);
    } else {
      onAdd(adData);
    }
    setIsFormOpen(false);
    setEditingAd(undefined);
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-3">
          <i className="fas fa-bullhorn"></i>
          Manage Advertisements
        </h2>
        {!isFormOpen && (
          <button onClick={handleAddNew} className="bg-emerald-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-emerald-600 transition-all flex items-center gap-2">
            <i className="fas fa-plus"></i> Add New
          </button>
        )}
      </div>

      {isFormOpen && <AdForm onSubmit={handleSubmit} onCancel={handleCancel} initialData={editingAd} />}

      <div className="mt-8 flex flex-col gap-4">
        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2">Current Ads</h3>
        {ads.length > 0 ? ads.map(ad => (
          <div key={ad.id} className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <img src={ad.imageUrl} alt={ad.title} className="w-16 h-16 object-cover rounded-md bg-slate-200 dark:bg-slate-700"/>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100">{ad.title}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-xs">{ad.description}</p>
                <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline">{ad.linkUrl}</a>
              </div>
            </div>
            <div className="flex-shrink-0 flex gap-2 self-end sm:self-center">
              <button onClick={() => handleEdit(ad)} className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 py-1 px-3 rounded text-sm font-semibold hover:bg-blue-200 dark:hover:bg-blue-800/60">Edit</button>
              <button onClick={() => onDelete(ad.id)} className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 py-1 px-3 rounded text-sm font-semibold hover:bg-red-200 dark:hover:bg-red-800/60">Delete</button>
            </div>
          </div>
        )) : (
          <p className="text-slate-500 dark:text-slate-400 text-center py-5">No advertisements have been created yet.</p>
        )}
      </div>
    </>
  );
};

export default AdManager;