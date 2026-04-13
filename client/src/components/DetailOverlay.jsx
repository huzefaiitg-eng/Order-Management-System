import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';

export default function DetailOverlay({ fallback, children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClose = () => {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ESC key to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [location.key]);

  return (
    <div className="fixed inset-0 z-[55] bg-white flex flex-col animate-fade-in">
      {/* Sticky close bar */}
      <div className="flex items-center justify-end px-4 py-3 shrink-0 border-b border-gray-100">
        <button
          onClick={handleClose}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
