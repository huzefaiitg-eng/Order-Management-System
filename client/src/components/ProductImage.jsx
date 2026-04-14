import { useState, useRef } from 'react';
import { Package, ChevronLeft, ChevronRight } from 'lucide-react';

function parseImageUrls(productImages) {
  if (!productImages || typeof productImages !== 'string') return [];
  return productImages.split(',').map(u => u.trim()).filter(Boolean);
}

export default function ProductImage({ productImages, productName, variant = 'card', iconSize = 32, className = '' }) {
  const urls = parseImageUrls(productImages);
  const [current, setCurrent] = useState(0);
  const [failedSet, setFailedSet] = useState({});
  const touchStart = useRef(null);

  const validUrls = urls.filter(u => !failedSet[u]);
  const total = validUrls.length;
  const idx = current >= total ? 0 : current;

  const handleError = (url) => {
    setFailedSet(prev => ({ ...prev, [url]: true }));
  };

  const goPrev = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setCurrent(prev => (prev - 1 + total) % total);
  };

  const goNext = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setCurrent(prev => (prev + 1) % total);
  };

  const goTo = (e, i) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setCurrent(i);
  };

  // Touch swipe support
  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) goNext(); else goPrev();
    }
    touchStart.current = null;
  };

  // ── Variant sizing ──
  const wrapperClass =
    variant === 'card' ? 'w-full aspect-[4/3] rounded-t-xl' :
    variant === 'gallery' ? 'w-full aspect-[4/3] rounded-xl' :
    'w-14 h-14 rounded-lg'; // detail

  // ── Placeholder ──
  if (total === 0) {
    return (
      <div className={`${wrapperClass} bg-terracotta-50 flex items-center justify-center ${className}`}>
        <Package size={iconSize} className="text-terracotta-300" />
      </div>
    );
  }

  // ── Single image ──
  if (total === 1) {
    return (
      <div className={`${wrapperClass} bg-gray-100 overflow-hidden ${className}`}>
        <img src={validUrls[0]} alt={productName} className="w-full h-full object-cover"
          onError={() => handleError(validUrls[0])} loading="lazy" />
      </div>
    );
  }

  // ── Detail variant (small thumb) — just badge ──
  if (variant === 'detail') {
    return (
      <div className={`${wrapperClass} bg-gray-100 overflow-hidden relative ${className}`}>
        <img src={validUrls[0]} alt={productName} className="w-full h-full object-cover"
          onError={() => handleError(validUrls[0])} loading="lazy" />
        <span className="absolute bottom-0 right-0 text-[8px] bg-black/60 text-white px-1 rounded-tl-md leading-snug">
          +{total - 1}
        </span>
      </div>
    );
  }

  // ── Gallery variant — large carousel with thumbnail strip ──
  if (variant === 'gallery') {
    return (
      <div className={`space-y-2 ${className}`}>
        {/* Main image */}
        <div className="w-full aspect-[4/3] rounded-xl bg-gray-100 overflow-hidden relative group"
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <img src={validUrls[idx]} alt={`${productName} ${idx + 1}`}
            className="w-full h-full object-cover" onError={() => handleError(validUrls[idx])} loading="lazy" />

          <button type="button" onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-gray-700 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-gray-700 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
            <ChevronRight size={18} />
          </button>

          {/* Counter badge */}
          <span className="absolute top-2 right-2 text-xs bg-black/50 text-white px-2 py-0.5 rounded-full">
            {idx + 1} / {total}
          </span>
        </div>

        {/* Thumbnail strip */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {validUrls.map((url, i) => (
            <button key={i} type="button" onClick={(e) => goTo(e, i)}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                i === idx ? 'border-terracotta-500 ring-1 ring-terracotta-300' : 'border-transparent opacity-60 hover:opacity-100'
              }`}>
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Card variant — compact carousel ──
  return (
    <div className={`${wrapperClass} bg-gray-100 overflow-hidden relative group ${className}`}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <img src={validUrls[idx]} alt={`${productName} ${idx + 1}`}
        className="w-full h-full object-cover" onError={() => handleError(validUrls[idx])} loading="lazy" />

      {/* Arrows */}
      <button type="button" onClick={goPrev}
        className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-gray-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
        <ChevronLeft size={14} />
      </button>
      <button type="button" onClick={goNext}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-gray-700 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
        <ChevronRight size={14} />
      </button>

      {/* Dots — always visible */}
      <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-1.5 pointer-events-none">
        {validUrls.map((_, i) => (
          <button key={i} type="button" onClick={(e) => goTo(e, i)}
            className={`pointer-events-auto rounded-full transition-all ${
              i === idx
                ? 'w-2.5 h-2.5 bg-white shadow-md ring-1 ring-black/10'
                : 'w-1.5 h-1.5 bg-white/70 hover:bg-white'
            }`} />
        ))}
      </div>
    </div>
  );
}
