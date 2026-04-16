import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

/**
 * Toast notification component.
 *
 * Usage:
 *   const [toast, setToast] = useState(null);
 *   <Toast toast={toast} onClose={() => setToast(null)} />
 *   setToast({ type: 'success', message: 'Saved!' });
 *   setToast({ type: 'error', message: 'Something went wrong' });
 */
export default function Toast({ toast, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) { setVisible(false); return; }
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // wait for exit animation
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';

  return (
    <div className="fixed top-4 right-4 z-[100] pointer-events-none">
      <div
        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all duration-300 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        } ${
          isSuccess
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}
      >
        {isSuccess
          ? <CheckCircle2 size={18} className="shrink-0 text-green-600" />
          : <XCircle size={18} className="shrink-0 text-red-600" />
        }
        <p className="text-sm font-medium flex-1">{toast.message}</p>
        <button
          onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
          className="shrink-0 opacity-60 hover:opacity-100"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
