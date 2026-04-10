/**
 * Dashboard aggregation helpers.
 *
 * Pure, framework-agnostic functions that take raw orders and (optionally) a
 * filter object, and produce the data shapes each dashboard card renders.
 *
 * These mirror the aggregation logic that used to live in
 * `server/routes/dashboard.js`. Moving them to the client lets us fetch orders
 * once on page load and re-filter/re-aggregate per card without extra network
 * round-trips.
 */

/**
 * Parses a DD/MM/YYYY date string into a Date. Returns null on bad input.
 */
export function parseOrderDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map(p => parseInt(p, 10));
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(yyyy, mm - 1, dd);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Given a preset key + optional custom range, returns { start, end } as Date
 * objects, or { start: null, end: null } for "all time".
 */
export function resolveTimeRange(preset, customRange = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  switch (preset) {
    case 'today':
      return { start: today, end: endOfToday };
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yEnd = new Date(y);
      yEnd.setHours(23, 59, 59, 999);
      return { start: y, end: yEnd };
    }
    case 'last7': {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      return { start: s, end: endOfToday };
    }
    case 'last30': {
      const s = new Date(today);
      s.setDate(s.getDate() - 29);
      return { start: s, end: endOfToday };
    }
    case 'custom': {
      if (!customRange.startDate || !customRange.endDate) return { start: null, end: null };
      const s = new Date(customRange.startDate);
      s.setHours(0, 0, 0, 0);
      const e = new Date(customRange.endDate);
      e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    case 'all':
    default:
      return { start: null, end: null };
  }
}

/**
 * Filters an orders array against the given filter object.
 *
 * filters = {
 *   timePreset: 'all' | 'today' | ... | 'custom',
 *   customRange: { startDate, endDate },
 *   sources: string[],                 // matches orderFrom
 *   customerPhones: string[],          // matches customerPhone
 *   productNames: string[],            // matches any productLine's productName
 * }
 */
export function filterOrders(orders, filters = {}) {
  if (!Array.isArray(orders)) return [];
  const { timePreset = 'all', customRange, sources = [], customerPhones = [], productNames = [] } = filters;

  const { start, end } = resolveTimeRange(timePreset, customRange);
  const srcSet = sources.length ? new Set(sources.map(s => s.toLowerCase())) : null;
  const phoneSet = customerPhones.length ? new Set(customerPhones.map(p => String(p).trim())) : null;
  const productSet = productNames.length ? new Set(productNames.map(p => p.toLowerCase())) : null;

  return orders.filter(o => {
    if (start || end) {
      const d = parseOrderDate(o.orderDate);
      if (!d) return false;
      if (start && d < start) return false;
      if (end && d > end) return false;
    }
    if (srcSet && !srcSet.has((o.orderFrom || '').toLowerCase())) return false;
    if (phoneSet && !phoneSet.has(String(o.customerPhone || '').trim())) return false;
    if (productSet) {
      const lines = Array.isArray(o.productLines) ? o.productLines : [];
      const hit = lines.some(l => productSet.has((l.productName || '').toLowerCase()));
      if (!hit) return false;
    }
    return true;
  });
}

/**
 * KPI block: total orders, revenue, profit, avg order value, return rate.
 */
export function computeOrdersKpis(orders) {
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + (Number(o.pricePaid) || 0), 0);
  const totalProfit = orders.reduce((s, o) => s + (Number(o.profit) || 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const returned = orders.filter(o => o.orderStatus === 'Returned').length;
  const returnRate = totalOrders > 0 ? (returned / totalOrders) * 100 : 0;
  return { totalOrders, totalRevenue, totalProfit, avgOrderValue, returnRate };
}

/**
 * Orders grouped by source (orderFrom).
 */
export function computeOrdersBySource(orders) {
  const map = {};
  for (const o of orders) {
    const key = o.orderFrom || 'Unknown';
    map[key] = (map[key] || 0) + 1;
  }
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

/**
 * Orders grouped by status.
 */
export function computeStatusBreakdown(orders) {
  const map = {};
  for (const o of orders) {
    const key = o.orderStatus || 'Unknown';
    map[key] = (map[key] || 0) + 1;
  }
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

/**
 * Orders grouped by payment method.
 */
export function computePaymentDistribution(orders) {
  const map = {};
  for (const o of orders) {
    const key = o.modeOfPayment || 'Unknown';
    map[key] = (map[key] || 0) + 1;
  }
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

/**
 * Revenue & profit over time — single-series shape.
 *   → [{ date: 'DD/MM/YYYY', revenue, profit }, ...] sorted chronologically.
 */
export function computeRevenueOverTime(orders) {
  const rev = {};
  const prof = {};
  for (const o of orders) {
    const date = o.orderDate || 'Unknown';
    rev[date] = (rev[date] || 0) + (Number(o.pricePaid) || 0);
    prof[date] = (prof[date] || 0) + (Number(o.profit) || 0);
  }
  return Object.entries(rev)
    .map(([date, revenue]) => ({ date, revenue, profit: prof[date] || 0 }))
    .sort((a, b) => {
      const da = parseOrderDate(a.date);
      const db = parseOrderDate(b.date);
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });
}

/**
 * Revenue & profit over time — multi-series shape for comparison across
 * multiple entities in a single dimension (source / customer / product).
 *
 * Returns { data, seriesKeys } where:
 *   - seriesKeys = ['Amazon', 'Flipkart', ...] (up to cap)
 *   - data shape = [{ date: '01/04/2026', Amazon_rev: 1200, Amazon_profit: 300, Flipkart_rev: 800, ... }, ...]
 *
 * Params:
 *   orders        — filtered order list
 *   groupBy       — 'source' | 'customer' | 'product'
 *   selectedKeys  — array of entity identifiers (source names, phones, product names)
 *   displayKeyFn  — (entityKey) => string used for the data field name (defaults to identity)
 *   cap           — max number of series to render (default 5)
 *
 * Match rules per groupBy:
 *   - source: matches order.orderFrom
 *   - customer: matches order.customerPhone
 *   - product: matches if any productLine.productName equals the key
 */
export function computeMultiSeriesRevenueOverTime(orders, { groupBy, selectedKeys = [], displayKeyFn = k => k, cap = 5 } = {}) {
  const keys = selectedKeys.slice(0, cap).map(k => String(k));
  const keySet = new Set(keys.map(k => k.toLowerCase()));

  // dateKey → { [seriesKey]: { rev, profit } }
  const dayMap = {};

  function matchKeys(order) {
    // Returns array of series keys this order contributes to.
    if (groupBy === 'source') {
      const k = String(order.orderFrom || '').toLowerCase();
      return keySet.has(k) ? [keys.find(x => x.toLowerCase() === k)] : [];
    }
    if (groupBy === 'customer') {
      const k = String(order.customerPhone || '').toLowerCase();
      return keySet.has(k) ? [keys.find(x => x.toLowerCase() === k)] : [];
    }
    if (groupBy === 'product') {
      const lines = Array.isArray(order.productLines) ? order.productLines : [];
      const hits = new Set();
      for (const l of lines) {
        const pk = String(l.productName || '').toLowerCase();
        if (keySet.has(pk)) hits.add(keys.find(x => x.toLowerCase() === pk));
      }
      return Array.from(hits);
    }
    return [];
  }

  for (const o of orders) {
    const contributingKeys = matchKeys(o);
    if (!contributingKeys.length) continue;
    const date = o.orderDate || 'Unknown';
    if (!dayMap[date]) dayMap[date] = {};
    for (const k of contributingKeys) {
      if (!dayMap[date][k]) dayMap[date][k] = { rev: 0, profit: 0 };
      dayMap[date][k].rev += Number(o.pricePaid) || 0;
      dayMap[date][k].profit += Number(o.profit) || 0;
    }
  }

  const data = Object.entries(dayMap)
    .map(([date, bySeries]) => {
      const row = { date };
      for (const k of keys) {
        const display = displayKeyFn(k);
        row[`${display}_rev`] = bySeries[k]?.rev || 0;
        row[`${display}_profit`] = bySeries[k]?.profit || 0;
      }
      return row;
    })
    .sort((a, b) => {
      const da = parseOrderDate(a.date);
      const db = parseOrderDate(b.date);
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });

  return {
    data,
    seriesKeys: keys.map(displayKeyFn),
    truncated: selectedKeys.length > cap,
    truncatedCount: selectedKeys.length,
  };
}

/**
 * Count applied filter dimensions for a filters object.
 * Used to drive the little "2" badge on the filter button.
 */
export function countActiveFilters(filters = {}) {
  let n = 0;
  if (filters.timePreset && filters.timePreset !== 'all') n += 1;
  if (filters.sources?.length) n += 1;
  if (filters.customerPhones?.length) n += 1;
  if (filters.productNames?.length) n += 1;
  return n;
}
