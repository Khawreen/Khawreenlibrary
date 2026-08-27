import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    setVisible(true);

    const timer = setTimeout(() => {
      // Animate out
      setVisible(false);
      // Allow time for animation before unmounting
      setTimeout(onClose, 500);
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bgColor = type === 'success' ? 'bg-emerald-500' : 'bg-red-500';
  const iconClass = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';

  return (
    <div
      className={`
        flex items-center gap-3 text-white font-semibold py-3 px-5 rounded-lg shadow-xl 
        transition-all duration-500 ease-in-out transform
        ${bgColor}
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}
      `}
    >
      <i className={`fas ${iconClass}`}></i>
      <span>{message}</span>
    </div>
  );
};

export default Toast;