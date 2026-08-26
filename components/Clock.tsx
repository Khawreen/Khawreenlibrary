import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const Clock: React.FC = () => {
  const [date, setDate] = useState(new Date());
  const [cycle, setCycle] = useState(0);
  const [showBook, setShowBook] = useState(false);

  useEffect(() => {
    const timerId = setInterval(() => setDate(new Date()), 1000);
    return () => {
      clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    // Each orbit/loop takes exactly 3 seconds
    const intervalId = setInterval(() => {
      setCycle((prev) => {
        const next = prev + 1;
        if (next >= 5) {
          setShowBook(true);
          // Show the open book for 4.5 seconds, then return to clock
          setTimeout(() => {
            setShowBook(false);
          }, 4500);
          return 0; // Reset cycle count
        }
        return next;
      });
    }, 3000);

    return () => clearInterval(intervalId);
  }, []);

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  const displayHours = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';

  const formattedHours = String(displayHours).padStart(2, '0');
  const formattedMinutes = String(minutes).padStart(2, '0');
  const formattedSeconds = String(seconds).padStart(2, '0');

  // Smooth floating motion for numbers, scaled down slightly
  const textFloat = (delay: number) => ({
    y: {
      duration: 2.2,
      repeat: Infinity,
      repeatType: "reverse" as const,
      ease: "easeInOut",
      delay: delay
    }
  });

  return (
    <div className="relative flex items-center justify-center p-0.5 select-none scale-90 sm:scale-100">
      
      {/* 
        SNAKE-LIKE ORBITING BORDER (MAR SHAN DEWE RE WAHAL)
        Optimized to be extremely narrow, compact, and perfectly fitted (w-fit).
      */}
      <div className="relative flex items-center justify-center bg-white rounded-lg px-3 py-1.5 shadow-md border border-slate-150 w-fit min-w-[155px] min-h-[38px] overflow-visible transition-all duration-300">
        
        {/* SVG Border Chase Animation (The orbiting snake line) */}
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0 }}
        >
          {/* We define a rounded rect with matching compact dimensions */}
          <rect
            x="0.5"
            y="0.5"
            width="99.5%"
            height="99.5%"
            rx="8"
            fill="none"
            stroke="transparent"
          />
          
          {/* Black/Gold Snake Trail */}
          <motion.rect
            x="0.75"
            y="0.75"
            width="99%"
            height="99%"
            rx="7.5"
            fill="none"
            stroke={showBook ? "#d97706" : "#18181b"} // Swaps to Golden/Amber when library matches
            strokeWidth="1.8"
            strokeLinecap="round"
            initial={{ strokeDasharray: "25 120", strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: -145 }}
            transition={{
              duration: showBook ? 1.5 : 3, // Spins faster when book is active!
              repeat: Infinity,
              ease: "linear"
            }}
          />

          {/* Red/Gold Snake Trail */}
          <motion.rect
            x="0.75"
            y="0.75"
            width="99%"
            height="99%"
            rx="7.5"
            fill="none"
            stroke={showBook ? "#fbbf24" : "#dc2626"} 
            strokeWidth="1.8"
            strokeLinecap="round"
            initial={{ strokeDasharray: "25 120", strokeDashoffset: -48 }}
            animate={{ strokeDashoffset: -193 }}
            transition={{
              duration: showBook ? 1.5 : 3,
              repeat: Infinity,
              ease: "linear"
            }}
          />

          {/* Green/Gold Snake Trail */}
          <motion.rect
            x="0.75"
            y="0.75"
            width="99%"
            height="99%"
            rx="7.5"
            fill="none"
            stroke={showBook ? "#f59e0b" : "#10b981"} 
            strokeWidth="1.8"
            strokeLinecap="round"
            initial={{ strokeDasharray: "25 120", strokeDashoffset: -96 }}
            animate={{ strokeDashoffset: -241 }}
            transition={{
              duration: showBook ? 1.5 : 3,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        </svg>

        <AnimatePresence mode="wait">
          {!showBook ? (
            /* Inner aesthetic clock text - displaying with elegant floating animation */
            <motion.span 
              key="clock"
              initial={{ opacity: 0, scale: 0.9, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -5 }}
              transition={{ duration: 0.3 }}
              className="relative z-10 font-mono font-bold text-sm tracking-wider flex items-center tabular-nums gap-0.5"
            >
              {/* Hours - Midnight Slate Dark */}
              <motion.span 
                animate={{ y: [-1.2, 1.2] }}
                transition={textFloat(0)}
                className="text-zinc-950 font-black text-center px-0.5" 
                title="Hour"
              >
                {formattedHours}
              </motion.span>
              
              {/* Separator - Amber */}
              <motion.span 
                animate={{ y: [-1.2, 1.2] }}
                transition={textFloat(0.15)}
                className="text-amber-500 font-sans font-black select-none px-0.5"
              >
                :
              </motion.span>
              
              {/* Minutes - Crimson Red */}
              <motion.span 
                animate={{ y: [1.2, -1.2] }}
                transition={textFloat(0.35)}
                className="text-red-600 font-black text-center px-0.5" 
                title="Minute"
              >
                {formattedMinutes}
              </motion.span>
              
              {/* Separator - Amber */}
              <motion.span 
                animate={{ y: [-1.2, 1.2] }}
                transition={textFloat(0.5)}
                className="text-amber-500 font-sans font-black select-none px-0.5"
              >
                :
              </motion.span>
              
              {/* Seconds - Emerald Green */}
              <motion.span 
                animate={{ y: [-1.2, 1.2] }}
                transition={textFloat(0.7)}
                className="text-emerald-600 font-black text-center px-0.5" 
                title="Second"
              >
                {formattedSeconds}
              </motion.span>
              
              {/* AM/PM - Gold / White Accent Badge */}
              <motion.span 
                animate={{ y: [0.8, -0.8] }}
                transition={textFloat(0.95)}
                className="text-[9px] text-amber-500 font-sans ml-1 bg-amber-50 px-1 py-0.2 rounded leading-none font-black border border-amber-200/40 flex-shrink-0"
              >
                {ampm}
              </motion.span>
            </motion.span>
          ) : (
            /* Opened Book with "Khawreen Library" in the center */
            <motion.div
              key="book"
              initial={{ opacity: 0, scale: 0.8, rotateY: -90 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.8, rotateY: 90 }}
              transition={{ type: 'spring', damping: 15, stiffness: 100 }}
              className="relative z-10 flex items-center justify-center gap-1.5 px-0.5"
              dir="ltr"
            >
              {/* Opened Book Icon Vector Illustration in native pure css */}
              <div className="relative flex items-center w-4 h-3.5 gap-[1px] flex-shrink-0">
                {/* Left Page */}
                <motion.div 
                  initial={{ rotateY: -80, originX: '100%' }}
                  animate={{ rotateY: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="w-1/2 h-full bg-amber-50 border border-amber-200 rounded-l-sm shadow-xs origin-right"
                />
                {/* Right Page */}
                <motion.div 
                  initial={{ rotateY: 80, originX: '0%' }}
                  animate={{ rotateY: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="w-1/2 h-full bg-amber-50 border border-amber-200 rounded-r-sm shadow-xs origin-left"
                />
                {/* Bookmark/Spine line */}
                <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-red-500/80" />
              </div>

              {/* Text: Khawreen Library */}
              <motion.span 
                initial={{ opacity: 0, x: 5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className="text-[11px] font-black text-amber-800 tracking-wide font-sans select-none antialiased leading-none"
              >
                Khawreen Library
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default Clock;
