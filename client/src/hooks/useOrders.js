import { useState, useEffect, useCallback } from 'react';
import { fetchOrders, updateOrderStatus as apiUpdateStatus } from '../services/api';

export function useOrders(filters = {}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchOrders(filters);
      setOrders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (rowIndex, newStatus) => {
    await apiUpdateStatus(rowIndex, newStatus);
    setOrders(prev =>
      prev.map(o => o.rowIndex === rowIndex ? { ...o, orderStatus: newStatus } : o)
    );
  };

  return { orders, loading, error, refresh: load, updateStatus };
}
