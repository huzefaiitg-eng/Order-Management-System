import { useState } from 'react';
import { Package } from 'lucide-react';

function getFirstImageUrl(productImages) {
  if (!productImages || typeof productImages !== 'string') return null;
  const first = productImages.split(',')[0].trim();
  return first || null;
}

export default function ProductImage({ productImages, productName, variant = 'card', iconSize = 32, className = '' }) {
  const [imgError, setImgError] = useState(false);
  const url = getFirstImageUrl(productImages);

  const wrapperBase = variant === 'card'
    ? 'w-full aspect-[4/3] rounded-t-xl'
    : 'w-14 h-14 rounded-lg';

  if (!url || imgError) {
    return (
      <div className={`${wrapperBase} bg-terracotta-50 flex items-center justify-center ${className}`}>
        <Package size={iconSize} className="text-terracotta-300" />
      </div>
    );
  }

  return (
    <div className={`${wrapperBase} bg-gray-100 overflow-hidden ${className}`}>
      <img
        src={url}
        alt={productName}
        className="w-full h-full object-cover"
        onError={() => setImgError(true)}
        loading="lazy"
      />
    </div>
  );
}
