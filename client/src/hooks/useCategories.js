import { useState, useEffect, useCallback } from 'react';
import { fetchCategories } from '../services/api';

export function useCategories() {
  const [categories, setCategories] = useState([]);
  const [categorySubCategories, setCategorySubCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCategories();
      setCategories(data.categories || []);
      setCategorySubCategories(data.categorySubCategories || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { categories, categorySubCategories, loading, error, refresh: load };
}
