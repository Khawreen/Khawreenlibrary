import React, { useMemo, useState } from 'react';
import { Book, Review, Ad, Section } from '../types';
import BookCard from './BookCard';
import AdCard from './AdCard';
import { useAuth } from '../AuthContext';

interface BookListProps {
  books: Book[];
  ads: Ad[];
  reviews: Review[];
  onAddReview: (bookId: string, rating: number, comment: string) => void;
  onDelete: (id: string) => void;
  onRequestSummary: (id: string) => void;
  onRequestEdit: (id: string) => void;
  onRequestPreview: (id: string) => void;
  onPurchase: (id: string) => void;
  onDownload: (id: string) => void;
  searchQuery: string;
  onNavigate: (section: Section) => void;
}

const BOOKS_PER_PAGE = 9;

const BookList: React.FC<BookListProps> = ({ books, ads, reviews, onAddReview, onDelete, onRequestSummary, onRequestEdit, onRequestPreview, onPurchase, onDownload, searchQuery, onNavigate }) => {
  const { currentUser } = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState('all');
  const [selectedAuthor, setSelectedAuthor] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);

  const { uniqueLanguages, uniqueAuthors, uniqueTags } = useMemo(() => {
    const languages = new Set<string>();
    const authors = new Set<string>();
    const tags = new Set<string>();
    books.forEach(book => {
      if (book.language) languages.add(book.language);
      if (book.author) authors.add(book.author);
      book.tags?.forEach(tag => tags.add(tag));
    });
    return {
      uniqueLanguages: ['all', ...Array.from(languages).sort()],
      uniqueAuthors: ['all', ...Array.from(authors).sort()],
      uniqueTags: ['all', ...Array.from(tags).sort()],
    };
  }, [books]);

  const regularBooks = books;


  const { filters: textFilters, generalQuery } = useMemo(() => {
    const filters: { type: 'author' | 'tag' | 'lang', value: string }[] = [];
    let remainingQuery = searchQuery.trim();

    const prefixes = [
        { key: 'author', type: 'author' as const },
        { key: 'tag', type: 'tag' as const }, { key: 'tags', type: 'tag' as const },
        { key: 'lang', type: 'lang' as const }, { key: 'language', type: 'lang' as const }
    ];

    prefixes.forEach(p => {
        const regex = new RegExp(`\\b${p.key}:(?:(?:"([^"]+)")|(\\S+))`, 'gi');
        remainingQuery = remainingQuery.replace(regex, (match, quotedValue, unquotedValue) => {
            const value = quotedValue || unquotedValue;
            if (value) {
                filters.push({ type: p.type, value: value.toLowerCase() });
            }
            return '';
        });
    });

    return { filters, generalQuery: remainingQuery.trim().toLowerCase() };
  }, [searchQuery]);

  const sortedAndFilteredBooks = useMemo(() => {
    let displayedBooks = regularBooks;

    if (selectedLanguage !== 'all') {
      displayedBooks = displayedBooks.filter(b => b.language === selectedLanguage);
    }
    if (selectedAuthor !== 'all') {
      displayedBooks = displayedBooks.filter(b => b.author === selectedAuthor);
    }
    if (selectedTag !== 'all') {
      displayedBooks = displayedBooks.filter(b => b.tags?.includes(selectedTag));
    }
    
    if (searchQuery.trim()) {
      displayedBooks = displayedBooks.filter(book => {
        const matchesTextFilters = textFilters.every(filter => {
          switch (filter.type) {
            case 'author': return book.author.toLowerCase().includes(filter.value);
            case 'tag': return book.tags?.some(tag => tag.toLowerCase().includes(filter.value));
            case 'lang': return book.language.toLowerCase().includes(filter.value);
            default: return true;
          }
        });
        if (!matchesTextFilters) return false;
        if (!generalQuery) return true;
        return book.title.toLowerCase().includes(generalQuery) ||
               book.author.toLowerCase().includes(generalQuery) ||
               (book.tags && book.tags.some(tag => tag.toLowerCase().includes(generalQuery)));
      });
    }

    // Sort the books
    const bookRatings = new Map<string, number>();
    displayedBooks.forEach(book => {
        const bookReviews = reviews.filter(r => r.bookId === book.id);
        const avgRating = bookReviews.length > 0 ? bookReviews.reduce((sum, r) => sum + r.rating, 0) / bookReviews.length : 0;
        bookRatings.set(book.id, avgRating);
    });

    displayedBooks.sort((a, b) => {
      switch (sortOrder) {
        case 'newest': return (b.createdAt || 0) - (a.createdAt || 0);
        case 'title-asc': return a.title.localeCompare(b.title);
        case 'title-desc': return b.title.localeCompare(a.title);
        case 'author-asc': return a.author.localeCompare(b.author);
        case 'author-desc': return b.author.localeCompare(a.author);
        case 'rating-desc': return (bookRatings.get(b.id) || 0) - (bookRatings.get(a.id) || 0);
        default: return (b.createdAt || 0) - (a.createdAt || 0);
      }
    });

    return displayedBooks;
  }, [regularBooks, searchQuery, selectedLanguage, selectedAuthor, selectedTag, textFilters, generalQuery, sortOrder, reviews]);

  const paginatedBooks = useMemo(() => {
    const startIndex = (currentPage - 1) * BOOKS_PER_PAGE;
    return sortedAndFilteredBooks.slice(startIndex, startIndex + BOOKS_PER_PAGE);
  }, [sortedAndFilteredBooks, currentPage]);

  const totalPages = Math.ceil(sortedAndFilteredBooks.length / BOOKS_PER_PAGE);

  const handleClearFilters = () => {
    setSelectedLanguage('all');
    setSelectedAuthor('all');
    setSelectedTag('all');
    setCurrentPage(1);
  };

  const isAnyFilterActive = selectedLanguage !== 'all' || selectedAuthor !== 'all' || selectedTag !== 'all';
  
  // Reset to page 1 if filters or search change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedLanguage, selectedAuthor, selectedTag, sortOrder]);


  const itemsWithAds = paginatedBooks.reduce((acc, book, index) => {
    acc.push(<BookCard key={book.id} book={book} reviews={reviews} onAddReview={onAddReview} onDelete={onDelete} onPurchase={onPurchase} onDownload={onDownload} onRequestSummary={onRequestSummary} onRequestEdit={onRequestEdit} onRequestPreview={onRequestPreview} onNavigate={onNavigate} highlightQuery={generalQuery} />);
    if (ads.length > 0 && (index + 1) % 3 === 0) {
      const adIndex = (Math.floor(index / 3) + (currentPage -1)) % ads.length;
      acc.push(<AdCard key={`ad-${index}`} ad={ads[adIndex]} />);
    }
    return acc;
  }, [] as React.ReactNode[]);

  return (
    <>
      <div className="flex justify-between items-start mb-6">
        <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-3">
          <i className="fas fa-book"></i>
          All Books
        </h2>
        {searchQuery && (
          <div className="text-sm text-slate-500 dark:text-slate-400 animate-fade-in">
            Showing results for: <span className="font-bold text-slate-700 dark:text-slate-200">"{searchQuery}"</span>
          </div>
        )}
      </div>

      <div className="p-4 mb-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
                <label htmlFor="lang-filter" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Language</label>
                <select id="lang-filter" value={selectedLanguage} onChange={e => setSelectedLanguage(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                    {uniqueLanguages.map(lang => <option key={lang} value={lang}>{lang === 'all' ? 'All Languages' : lang}</option>)}
                </select>
            </div>
             <div>
                <label htmlFor="author-filter" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Author</label>
                <select id="author-filter" value={selectedAuthor} onChange={e => setSelectedAuthor(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                     {uniqueAuthors.map(author => <option key={author} value={author}>{author === 'all' ? 'All Authors' : author}</option>)}
                </select>
            </div>
             <div>
                <label htmlFor="sort-order" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sort By</label>
                <select id="sort-order" value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  <option value="newest">Newest First</option>
                  <option value="title-asc">Title (A-Z)</option>
                  <option value="title-desc">Title (Z-A)</option>
                  <option value="author-asc">Author (A-Z)</option>
                  <option value="author-desc">Author (Z-A)</option>
                  <option value="rating-desc">Highest Rated</option>
                </select>
            </div>
            <div>
                {isAnyFilterActive && (
                  <button onClick={handleClearFilters} className="w-full p-2 bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors font-semibold">
                    Clear Filters
                  </button>
                )}
            </div>
        </div>
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tags</label>
            <div className="flex flex-wrap gap-2">
                {uniqueTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200 ${
                      selectedTag === tag
                        ? 'bg-indigo-600 text-white shadow-md ring-2 ring-offset-2 ring-indigo-500 ring-offset-slate-50 dark:ring-offset-slate-800'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {tag === 'all' ? 'All Tags' : tag}
                  </button>
                ))}
            </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {itemsWithAds.length > 0 ? (
          itemsWithAds
        ) : (books.length > 0) ? (
          <div className="text-center py-10 px-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <i className="fas fa-search text-4xl text-slate-400 dark:text-slate-500 mb-4"></i>
            <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-300">No books found</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Try adjusting your search or filter selections.</p>
          </div>
        ) : (
          <div className="text-center py-10 px-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <i className="fas fa-book-open text-4xl text-slate-400 dark:text-slate-500 mb-4"></i>
            <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-300">No books available yet</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Be the first to upload a book!</p>
          </div>
        )}
      </div>

       {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 sm:gap-4 mt-8" role="navigation" aria-label="Book list pagination">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold">
            <i className="fas fa-arrow-left mr-2"></i> Previous
          </button>
          <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold">
            Next <i className="fas fa-arrow-right ml-2"></i>
          </button>
        </div>
      )}
    </>
  );
};

export default BookList;
