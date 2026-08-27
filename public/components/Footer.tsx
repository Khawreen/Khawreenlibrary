import React from 'react';
import { Section } from '../types';

interface FooterProps {
  onNavigate: (section: Section) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const currentYear = new Date().getFullYear();

  const handleAboutClick = (e: React.MouseEvent) => {
    e.preventDefault();
    alert('Khawreen Library is a digital book haven created to promote Pashto literature and reading culture.');
  };

  return (
    <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 mt-auto py-8 px-4 sm:px-8">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left">
          &copy; {currentYear} Khawreen Library. All Rights Reserved.
        </p>
        <nav>
          <ul className="flex flex-wrap justify-center list-none gap-4 sm:gap-6 m-0 p-0">
            <li>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); onNavigate(Section.Books); }}
                className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                Books
              </a>
            </li>
            <li>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); onNavigate(Section.Upload); }}
                className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                Upload
              </a>
            </li>
             <li>
              <a
                href="#"
                onClick={handleAboutClick}
                className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                About
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
