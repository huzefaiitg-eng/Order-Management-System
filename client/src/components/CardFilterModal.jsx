import { useEffect } from 'react';
import { X, SlidersHorizontal, Info } from 'lucide-react';
import TimePresetPicker from './TimePresetPicker';
import SearchableDropdown from './SearchableDropdown';
import { ORDER_SOURCES } from '../utils/formatters';

/**
 * CardFilterModal
 * ---------------
 * Centered modal dialog with per-card filter controls.
 *
 * Props:
 *   open          — boolean
 *   onClose       — () => void
 *   title         — e.g. "Filter: Orders KPIs"
 *   fields        — { time, source, customer, product } booleans controlling
 *                   which sections render
 *   pending       — current pending filter state (from useCardFilters)
 *   setPending    — setter for pending state
 *   allCustomers  — array of customer objects (customerName, customerPhone)
 *   allProducts   — array of product objects (productName, articleId)
 *   multiSeriesHint — boolean, shows info note for Revenue&Profit card
 *   onApply, onClear
 */
export default function CardFilterModal({
  open,
  onClose,
  title,
  fields = { time: true, source: true, customer: true, product: true },
  pending,
  setPending,
  allCustomers = [],
  allProducts = [],
  multiSeriesHint = false,
  onApply,
  onClear,
}) {
  // Lock body scroll while modal open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  function toggleSource(src) {
    setPending(prev => ({
      ...prev,
      sources: prev.sources.includes(src)
        ? prev.sources.filter(s => s !== src)
        : [...prev.sources, src],
    }));
  }

  function handleTimeChange({ preset, customRange }) {
    setPending(prev => ({ ...prev, timePreset: preset, customRange }));
  }

  function handleCustomersChange(next) {
    setPending(prev => ({ ...prev, customers: next }));
  }

  function handleProductsChange(next) {
    setPending(prev => ({ ...prev, products: next }));
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50 animate-fade-in"
        onClick={onClose}
      />
      {/* Centered dialog */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div
          className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl pointer-events-auto max-h-[90vh] flex flex-col animate-slide-up"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-terracotta-600" />
              <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Body (scrollable) */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {multiSeriesHint && (
              <div className="flex gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                <Info size={14} className="shrink-0 mt-0.5" />
                <span>
                  Pick multiple values in a <strong>single</strong> dimension (source, customer, or product)
                  to see a multi-series comparison chart.
                </span>
              </div>
            )}

            {fields.time && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Time Range</p>
                <TimePresetPicker
                  preset={pending.timePreset}
                  customRange={pending.customRange}
                  onChange={handleTimeChange}
                />
              </div>
            )}

            {fields.source && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Source</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ORDER_SOURCES.map(src => {
                    const active = pending.sources.includes(src);
                    return (
                      <button
                        key={src}
                        type="button"
                        onClick={() => toggleSource(src)}
                        className={`px-2.5 py-1.5 text-xs sm:text-sm rounded-lg font-medium border transition-colors text-left ${
                          active
                            ? 'bg-terracotta-50 border-terracotta-300 text-terracotta-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {src}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {fields.customer && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Customer</p>
                <SearchableDropdown
                  placeholder="Search by name or phone..."
                  items={allCustomers}
                  displayFn={c => `${c.customerName} · ${c.customerPhone}`}
                  keyFn={c => c.customerPhone}
                  multi
                  selected={pending.customers}
                  onChange={handleCustomersChange}
                  chipClassName="bg-blue-50 text-blue-700"
                />
              </div>
            )}

            {fields.product && (
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Product</p>
                <SearchableDropdown
                  placeholder="Search product..."
                  items={allProducts}
                  displayFn={p => `${p.productName} (${p.articleId})`}
                  keyFn={p => p.productName}
                  multi
                  selected={pending.products}
                  onChange={handleProductsChange}
                  chipClassName="bg-amber-50 text-amber-700"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0 rounded-b-2xl">
            <button
              type="button"
              onClick={onClear}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={onApply}
              className="px-4 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 font-medium transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
