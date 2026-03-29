import { useState } from 'react';
import { ORDER_STATUSES } from '../utils/formatters';

export default function StatusSelect({ currentStatus, onUpdate }) {
  const [loading, setLoading] = useState(false);

  const handleChange = async (e) => {
    const newStatus = e.target.value;
    if (newStatus === currentStatus) return;
    setLoading(true);
    try {
      await onUpdate(newStatus);
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={loading}
      className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-terracotta-500 disabled:opacity-50"
    >
      {ORDER_STATUSES.map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
