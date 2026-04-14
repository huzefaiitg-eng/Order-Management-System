import { useState, useCallback } from 'react';
import { Package, ChevronLeft, ChevronRight } from 'lucide-react';

function parseImageUrls(productImages) {
  if (!productImages || typeof productImages !== 'string') return [];
  return productImages.split(',').map(u => u.trim()).filter(Boolean);
}

export default function ProductImage({ productImages, productName, variant = 'card', iconSize = 32, className = '' }) {
  const urls = parseImageUrls(productImages);
  const [current, setCurrent] = useState(0);
  const [failedUrls, setFailedUrls] = useState(new Set());

  const validUrls = urls.filter(u => !failedUrls.has(u));
  const safeIndex = current >= validUrls.length ? 0 : current;

  const handleError = useCallback((url) => {
    setFailedUrls(prev => new Set(prev).add(url));
  }, []);

  const prev = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrent(i => (i - 1 + validUrls.length) % validUrls.length);
  }, [validUrls.length]);

  const next = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrent(i => (i + 1) % validUrls.length);
  }, [validUrls.length]);

  const goTo = useCallback((e, idx) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrent(idx);
  }, []);

  const wrapperBase = variant === 'card'
    ? 'w-full aspect-[4/3] rounded-t-xl'
    : variant === 'detail'
    ? 'w-14 h-14 rounded-lg'
    : 'w-full aspect-square rounded-xl';

  // Placeholder when no valid images
  if (validUrls.length === 0) {
    return (
      <div className={`${wrapperBase} bg-terracotta-50 flex items-center justify-center ${className}`}>
        <Package size={iconSize} className="text-terracotta-300" />
      </div>
    );
  }

  // Single image — no carousel controls
  if (validUrls.length === 1) {
    return (
      <div className={`${wrapperBase} bg-gray-100 overflow-hidden ${className}`}>
        <img src={validUrls[0]} alt={productName} className="w-full h-full object-cover"
          onError={() => handleError(validUrls[0])} loading="lazy" />
      </div>
    );
  }

  // Detail variant — small thumbnail, just show count badge
  if (variant === 'detail') {
    return (
      <div className={`${wrapperBase} bg-gray-100 overflow-hidden relative ${className}`}>
        <img src={validUrls[0]} alt={productName} className="w-full h-full object-cover"
          onError={() => handleError(validUrls[0])} loading="lazy" />
        <span className="absolute bottom-0 right-0 text-[8px] bg-black/60 text-white px-1 rounded-tl-md leading-snug">
          +{validUrls.length - 1}
        </span>
      </div>
    );
  }

  // Multi-image carousel (card and gallery variants)
  return (
    <div className={`${wrapperBase} bg-gray-100 overflow-hidden relative group ${className}`}>
      <img
        src={validUrls[safeIndex]}
        alt={`${productName} ${safeIndex + 1}`}
        className="w-full h-full object-cover transition-opacity duration-200"
        onError={() => handleError(validUrls[safeIndex])}
        loading="lazy"
      />

      {/* Arrows — visible on hover */}
      <button onClick={prev}
        className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white">
        <ChevronLeft size={14} />
      </button>
      <button onClick={next}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white">
        <ChevronRight size={14} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-1.5 inset-x-0 flex items-center justify-center gap-1">
        {validUrls.map((_, i) => (
          <button key={i} onClick={(e) => goTo(e, i)}
            className={`rounded-full transition-all ${
              i === safeIndex ? 'w-2 h-2 bg-white shadow' : 'w-1.5 h-1.5 bg-white/60'
            }`} />
        ))}
      </div>
    </div>
  );
}
