/**
 * Parse a raw category/subCategory string (potentially comma-separated) into a clean array.
 * Handles both single values ("Men") and multi-values ("Men,Women").
 */
export function parseCategories(raw) {
  if (!raw) return [];
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Join an array of category values back into a comma-separated string for storage.
 * Falls back gracefully if given a plain string.
 */
export function joinCategories(arr) {
  if (!Array.isArray(arr)) return arr || '';
  return arr.filter(Boolean).join(',');
}
