import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Reusable confirmation modal.
 *
 * Props:
 *   title        – heading text
 *   message      – body text (explains consequences)
 *   confirmLabel – label for the primary action button  (default 'Confirm')
 *   variant      – 'danger' (red)  | 'warning' (amber)  (default 'danger')
 *   onConfirm    – async () => void  — throw to show inline error
 *   onClose      – () => void
 */
export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
  onConfirm,
  onClose,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
    // On success the parent unmounts this component (sets confirmModal → null),
    // so we intentionally leave loading=true to avoid a flash.
  };

  const isDanger = variant === 'danger';

  const iconClass  = isDanger ? 'bg-red-100 text-red-600'    : 'bg-amber-100 text-amber-600';
  const btnClass   = isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={!loading ? onClose : undefined}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          {/* Icon + heading + message */}
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconClass}`}>
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{message}</p>
            </div>
          </div>

          {/* Inline error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`flex-1 px-4 py-2.5 text-sm rounded-lg font-medium text-white disabled:opacity-50 transition-colors ${btnClass}`}
            >
              {loading ? 'Please wait…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
