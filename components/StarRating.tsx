import React, { useState } from 'react';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  isInteractive?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({ rating, onRatingChange, isInteractive = false }) => {
  const [hoverRating, setHoverRating] = useState(0);
  
  return (
    <div 
      className="flex items-center gap-0.5"
      onMouseLeave={() => isInteractive && setHoverRating(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const displayRating = hoverRating || rating;
        
        let iconClass = 'fa-star text-slate-300 dark:text-slate-600'; // Default: Empty star

        if (displayRating >= star) {
          iconClass = 'fa-star text-amber-400'; // Full star
        } else if (displayRating > star - 1 && displayRating < star && !hoverRating) {
          // Only show half-star for the actual rating, not for hover state
          iconClass = 'fa-star-half-alt text-amber-400'; // Half star
        }
       
        return (
          <i
            key={star}
            className={`fas ${iconClass} ${isInteractive ? 'cursor-pointer transition-transform hover:scale-125' : ''}`}
            onClick={() => isInteractive && onRatingChange && onRatingChange(star)}
            onMouseEnter={() => isInteractive && setHoverRating(star)}
            role={isInteractive ? 'button' : 'img'}
            aria-label={isInteractive ? `Rate ${star} stars` : `${rating} out of 5 stars`}
          />
        );
      })}
    </div>
  );
};

export default StarRating;