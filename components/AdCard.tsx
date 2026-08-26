import React from 'react';
import { Ad } from '../types';

interface AdCardProps {
  ad: Ad;
}

const AdCard: React.FC<AdCardProps> = ({ ad }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-amber-300 dark:border-amber-500/50 overflow-hidden flex flex-col md:flex-row transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-slate-900/50">
      <div className="relative w-full h-48 md:h-auto md:w-40 bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
        <span className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded">Ad</span>
        <img 
            src={ad.imageUrl}
            alt={ad.title} 
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/150x200.png?text=Image+Not+Found'; }}
        />
      </div>
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">{ad.title}</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
          {ad.description}
        </p>
        <div className="flex-grow"></div>
        <a 
          href={ad.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-auto text-center bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-600 dark:hover:bg-indigo-400 transition-all duration-300"
        >
          Learn More
        </a>
      </div>
    </div>
  );
};

export default AdCard;