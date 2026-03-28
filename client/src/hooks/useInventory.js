import { useState, useEffect, useCallback } from 'react';
import { fetchInventory } from '../services/api';

export function useInventory(filters = {}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filterKey = JSON.stringify(filters);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchInventory(filters);
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterKey]);

  useEffect(() => { load(); }, [load]);

  return { products, loading, error, refresh: load };
}
