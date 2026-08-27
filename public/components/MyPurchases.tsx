

import React from 'react';
import { Book, Review, Section } from '../types';
import BookCard from './BookCard';
import { useAuth } from '../AuthContext';

interface MyPurchasesProps {
  books: Book[];
  reviews: Review[];
  onAddReview: (bookId: string, rating: number, comment: string) => void;
  onRequestSummary: (id: string) => void;
  onRequestPreview: (id: string) => void;
  onNavigate: (section: Section) => void;
  onDownload: (id: string) => void;
}

const MyPurchases: React.FC<MyPurchasesProps> = ({ books, reviews, onAddReview, onRequestSummary, onRequestPreview, onNavigate, onDownload }) => {
  const { currentUser } = useAuth();
  
  return (
    <>
      <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mb-6 flex items-center gap-3">
        <i className="fas fa-shopping-cart"></i>
        My Purchased Books
      </h2>
      <div className="flex flex-col gap-6">
        {books.length > 0 ? (
          books.map(book => (
            <BookCard 
                key={book.id} 
                book={book} 
                onDelete={() => {}} // Cannot delete purchased books
                onPurchase={() => {}} // Already purchased
                onDownload={onDownload}
                onRequestSummary={onRequestSummary}
                onRequestPreview={onRequestPreview}
                reviews={reviews}
                onAddReview={onAddReview}
                onNavigate={onNavigate}
            />
          ))
        ) : (
          <div className="text-center py-10 px-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <i className="fas fa-shopping-bag text-4xl text-slate-400 dark:text-slate-500 mb-4"></i>
            <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-300">You haven't purchased any books yet.</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Explore the collection and find your next great read!</p>
          </div>
        )}
      </div>
    </>
  );
};

export default MyPurchases;
