export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  // Already in DD/MM/YYYY format from sheet
  return dateStr;
}

export function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

export const ORDER_STATUSES = [
  'Pending', 'Confirmed', 'Packed', 'Shipped',
  'Out for Delivery', 'Delivered', 'Returned', 'Cancelled', 'Refunded',
];

export const ORDER_SOURCES = ['Amazon', 'Flipkart', 'Meesho', 'Instagram', 'WhatsApp', 'Manual'];

export const PAYMENT_MODES = ['COD', 'UPI', 'Bank Transfer', 'Credit/Debit Card', 'Wallet', 'EMI'];

export const STATUS_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Confirmed: 'bg-blue-100 text-blue-800',
  Packed: 'bg-terracotta-100 text-terracotta-800',
  Shipped: 'bg-purple-100 text-purple-800',
  'Out for Delivery': 'bg-cyan-100 text-cyan-800',
  Delivered: 'bg-green-100 text-green-800',
  Returned: 'bg-red-100 text-red-800',
  Cancelled: 'bg-gray-100 text-gray-800',
  Refunded: 'bg-orange-100 text-orange-800',
};

export const CHART_COLORS = ['#C8956C', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];

export const STOCK_COLORS = {
  'Out of Stock': 'bg-red-100 text-red-800',
  'Low Stock': 'bg-amber-100 text-amber-800',
  'In Stock': 'bg-green-100 text-green-800',
};

export const LOW_STOCK_THRESHOLD = 5;

export function getStockStatus(quantity, minStock = LOW_STOCK_THRESHOLD) {
  if (quantity <= 0) return 'Out of Stock';
  if (quantity < minStock) return 'Low Stock';
  return 'In Stock';
}
