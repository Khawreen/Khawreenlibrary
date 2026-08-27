import React, { useState, useEffect } from 'react';
import { Book } from '../types';
import { useAuth } from '../AuthContext';

interface EditBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book | null;
  onUpdate: (bookId: string, updates: Partial<Pick<Book, 'title' | 'author' | 'language' | 'isForSale' | 'price' | 'tags'>>) => void;
}

const EditBookModal: React.FC<EditBookModalProps> = ({ isOpen, onClose, book, onUpdate }) => {
  const { currentUser } = useAuth();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [language, setLanguage] = useState('');
  const [isForSale, setIsForSale] = useState(false);
  const [price, setPrice] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (book) {
      setTitle(book.title);
      setAuthor(book.author);
      setLanguage(book.language || 'Pashto');
      setIsForSale(book.isForSale);
      setPrice(book.price > 0 ? String(book.price) : '');
      setTags(book.tags || []);
    }
  }, [book]);

  if (!isOpen || !book) return null;

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const newTag = tagInput.trim().replace(/,/g, '');
        if (newTag && !tags.includes(newTag)) {
            setTags([...tags, newTag]);
        }
        setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) {
      alert("Title and Author cannot be empty.");
      return;
    }
     if (isForSale && (!price || Number(price) <= 0)) {
        alert('Please enter a valid price for the book.');
        return;
    }
    const updates: Partial<Pick<Book, 'title' | 'author' | 'language' | 'isForSale' | 'price' | 'tags'>> = {
        title,
        author,
        language,
        isForSale,
        price: isForSale ? Number(price) : 0,
        tags,
    };
    onUpdate(book.id, updates);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 dark:bg-opacity-75 z-[90] flex justify-center items-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-modal-title"
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 sm:p-8 w-full max-w-lg transform transition-all duration-300 ease-out animate-fade-in-up overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-200 dark:border-slate-700">
          <h2 id="edit-modal-title" className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Edit Book Details</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">
            <i className="fas fa-times text-2xl"></i>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="form-group flex flex-col gap-2">
                <label htmlFor="edit-title" className="font-semibold text-slate-700 dark:text-slate-300">Book Title</label>
                <input
                    type="text"
                    id="edit-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 focus:border-indigo-600 transition bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
            </div>
            <div className="form-group flex flex-col gap-2">
                <label htmlFor="edit-author" className="font-semibold text-slate-700 dark:text-slate-300">Author Name</label>
                <input
                    type="text"
                    id="edit-author"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    required
                    className="p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 focus:border-indigo-600 transition bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
            </div>
            
            <div className="form-group flex flex-col gap-2">
              <label htmlFor="edit-language" className="font-semibold text-slate-700 dark:text-slate-300">Language</label>
              <div className="relative">
                <select
                  id="edit-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  required
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 focus:border-indigo-600 transition bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 appearance-none"
                >
                  <option value="Pashto">Pashto</option>
                  <option value="Dari">Dari</option>
                  <option value="English">English</option>
                  <option value="Other">Other</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 dark:text-slate-400">
                    <i className="fas fa-chevron-down h-5 w-5"></i>
                </div>
              </div>
            </div>

             <div className="form-group flex flex-col gap-2">
              <label htmlFor="edit-tags" className="font-semibold text-slate-700 dark:text-slate-300">Tags (Keywords)</label>
              <div className="flex flex-wrap gap-2 p-2 border border-slate-300 dark:border-slate-600 rounded-lg focus-within:ring-2 focus-within:ring-indigo-300 dark:focus-within:ring-indigo-500 bg-white dark:bg-slate-700">
                {tags.map(tag => (
                  <span key={tag} className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 text-sm font-medium px-2.5 py-1 rounded-full flex items-center gap-2 animate-fade-in">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 font-bold" aria-label={`Remove ${tag}`}>
                      &times;
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  id="edit-tags"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder={tags.length === 0 ? "Add tags..." : "Add more..."}
                  className="flex-grow p-1 border-none bg-transparent focus:ring-0 min-w-[120px] text-slate-800 dark:text-slate-200"
                />
              </div>
               <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Add relevant keywords for your book. Press Enter or comma to add a tag.</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="edit-isForSale"
                        checked={isForSale}
                        onChange={(e) => setIsForSale(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-200 dark:bg-slate-600"
                    />
                    <label htmlFor="edit-isForSale" className="font-semibold text-slate-700 dark:text-slate-300">This book is for sale</label>
                </div>
                {isForSale && (
                    <div className="mt-4 animate-fade-in">
                        <label htmlFor="edit-price" className="font-semibold text-slate-700 dark:text-slate-300 block mb-2">Price (AFN)</label>
                        <input
                            type="number"
                            id="edit-price"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="e.g., 500"
                            min="0"
                            step="1"
                            required
                            className="p-3 w-full border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                        />
                    </div>
                )}
            </div>

            <div className="mt-4 flex justify-end gap-3">
                <button 
                    type="button"
                    onClick={onClose} 
                    className="bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-bold py-2 px-6 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all duration-300"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-500 dark:hover:bg-indigo-700 transition-all duration-300 flex items-center justify-center gap-2"
                >
                    <i className="fas fa-save"></i>
                    Save Changes
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default EditBookModal;
