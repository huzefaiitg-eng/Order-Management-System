import { useMemo } from 'react';
import { resolveTimeRange, parseOrderDate } from '../utils/dashboardAggregations';

const LEAD_STATUSES = ['New Lead', 'Contacted', 'Interested', 'Converted', 'Lost'];
const LEAD_SOURCES = ['WhatsApp', 'Instagram', 'Facebook', 'Referral', 'Walk-in/Offline'];
const ACTIVE_STATUSES = ['New Lead', 'Contacted', 'Interested'];

/** Parse a DD/MM/YYYY string into a midnight Date. Returns null on bad input. */
function parseLeadDate(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map(p => parseInt(p, 10));
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(yyyy, mm - 1, dd);
  d.setHours(0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

/** DD/MM/YYYY string for today (midnight). */
function todayDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function todayDateString() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return false;
  const now = new Date();
  return parseInt(parts[1]) === now.getMonth() + 1 && parseInt(parts[2]) === now.getFullYear();
}

/** Parse comma-separated products string into a trimmed array. */
function parseProducts(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * useLeadInsights(leads, timeRange, options)
 *
 * Pure memoised analytics over the leads array.
 * timeRange = { start: Date|null, end: Date|null }  — from resolveTimeRange()
 * options.sourceFilter = string[] — limit aggregations to these sources (empty = all)
 * options.convertedOrdersMap = Map<rowIndex, order> — for realized revenue/profit
 * options.inventory = array of inventory products — for leads-vs-inventory breakdown
 */
export function useLeadInsights(leads = [], timeRange = { start: null, end: null }, options = {}) {
  const { sourceFilter = [], convertedOrdersMap = null, inventory = [] } = options;

  return useMemo(() => {
    const todayStr = todayDateString();
    const todayMidnight = todayDate();

    // ── Apply time + source filters together ────────────────────────────────
    const sourceSet = sourceFilter.length ? new Set(sourceFilter) : null;
    const passesFilter = (l) => {
      if (sourceSet && !sourceSet.has(l.leadSource)) return false;
      if (timeRange.start || timeRange.end) {
        const d = parseLeadDate(l.leadDate);
        if (!d) return false;
        if (timeRange.start && d < timeRange.start) return false;
        if (timeRange.end && d > timeRange.end) return false;
      }
      return true;
    };

    const filteredLeads = leads.filter(passesFilter);

    const filteredLeadCount = filteredLeads.length;
    const filteredConvertedCount = filteredLeads.filter(l => l.leadStatus === 'Converted').length;
    const filteredConversionRate = filteredLeadCount > 0
      ? Math.round((filteredConvertedCount / filteredLeadCount) * 100)
      : 0;

    // ── Realized revenue / profit (from converted leads' linked orders) ─────
    let realizedRevenue = 0;
    let realizedProfit = 0;
    if (convertedOrdersMap) {
      filteredLeads.forEach(l => {
        if (l.leadStatus !== 'Converted') return;
        const rowIdx = parseInt(l.convertedOrderRow, 10);
        if (!rowIdx) return;
        const order = convertedOrdersMap.get(rowIdx);
        if (!order) return;
        const pricePaid = Number(order.pricePaid) || 0;
        const cost = Number(order.productCost) || 0;
        realizedRevenue += pricePaid;
        realizedProfit += (pricePaid - cost);
      });
    }

    // ── GLOBAL totals ─────────────────────────────────────────────────────────
    const totalLeads = leads.length;
    const newThisMonth = leads.filter(l => isThisMonth(l.leadDate)).length;
    const convertedCount = leads.filter(l => l.leadStatus === 'Converted').length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0;

    // Active = not Converted / not Lost
    const activeLeads = leads.filter(l => l.leadStatus !== 'Converted' && l.leadStatus !== 'Lost');
    const filteredActiveLeads = filteredLeads.filter(l => l.leadStatus !== 'Converted' && l.leadStatus !== 'Lost');

    // ── PIPELINE VALUE (filtered by source/time) ──────────────────────────────
    const totalPipelineValue = filteredActiveLeads.reduce((sum, l) => sum + (l.budget || 0), 0);
    const avgBudget = filteredActiveLeads.length > 0
      ? Math.round(totalPipelineValue / filteredActiveLeads.length)
      : 0;

    // Estimated revenue at current conversion rate
    const estimatedRevenue = Math.round(totalPipelineValue * (filteredConversionRate / 100));

    // Pipeline by status (for the Pipeline Value card breakdown)
    const pipelineByStatus = ACTIVE_STATUSES.map(status => ({
      status,
      count: filteredActiveLeads.filter(l => l.leadStatus === status).length,
      value: filteredActiveLeads.filter(l => l.leadStatus === status).reduce((s, l) => s + (l.budget || 0), 0),
    }));

    // ── CLASSIFICATION (uses ALL leads — not filtered) ──────────────────────
    const in14Days = new Date(todayMidnight);
    in14Days.setDate(in14Days.getDate() + 14);

    const hotLeads = [];
    const warmLeads = [];
    const coldLeads = [];

    activeLeads.forEach(lead => {
      const nextFuDate = parseLeadDate(lead.nextFollowUp?.date);
      const leadD = parseLeadDate(lead.leadDate);
      const leadAgeMs = leadD ? todayMidnight - leadD : 0;
      const leadAgeDays = Math.floor(leadAgeMs / (1000 * 60 * 60 * 24));

      const isEngaged = lead.leadStatus === 'Interested';
      const isFollowUpTodayOrOverdue = nextFuDate && nextFuDate <= todayMidnight;
      const hasFutureFollowUp = nextFuDate && nextFuDate > todayMidnight && nextFuDate <= in14Days;
      const isColdCandidate =
        (lead.leadStatus === 'New Lead' || lead.leadStatus === 'Contacted') &&
        !nextFuDate &&
        leadAgeDays > 30;

      if (isEngaged && isFollowUpTodayOrOverdue) {
        hotLeads.push(lead);
      } else if (hasFutureFollowUp || (isEngaged && !isFollowUpTodayOrOverdue)) {
        warmLeads.push(lead);
      } else if (isColdCandidate) {
        coldLeads.push(lead);
      } else {
        warmLeads.push(lead);
      }
    });

    const hotLeadRevenuePotential = hotLeads.reduce((sum, l) => sum + (l.budget || 0), 0);

    // ── FOLLOW-UP BUCKETS ─────────────────────────────────────────────────────
    const tomorrow = new Date(todayMidnight);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const in5Days = new Date(todayMidnight);
    in5Days.setDate(in5Days.getDate() + 5);

    const overdueFollowUps = activeLeads.filter(l => {
      const d = parseLeadDate(l.nextFollowUp?.date);
      return d && d < todayMidnight;
    });

    const followUpsTodayList = activeLeads.filter(l => l.nextFollowUp?.date === todayStr);

    const followUpsNext5Days = activeLeads.filter(l => {
      const d = parseLeadDate(l.nextFollowUp?.date);
      return d && d >= tomorrow && d <= in5Days;
    });

    const followUpsDueToday = followUpsTodayList;

    // ── PRODUCT DEMAND ────────────────────────────────────────────────────────
    // Use productLines when present (contains articleId for inventory match);
    // fall back to productsInterested string for legacy leads.
    const productMap = {};

    leads.forEach(lead => {
      const isConverted = lead.leadStatus === 'Converted';
      const isActive = lead.leadStatus !== 'Converted' && lead.leadStatus !== 'Lost';

      if (Array.isArray(lead.productLines) && lead.productLines.length > 0) {
        lead.productLines.forEach(line => {
          const name = (line.productName || '').trim();
          if (!name) return;
          if (!productMap[name]) {
            productMap[name] = {
              name,
              leadCount: 0,
              convertedCount: 0,
              pipelineValue: 0,
              totalQty: 0,
              articleId: line.articleId || '',
              isInventory: !!line.articleId,
            };
          }
          productMap[name].leadCount += 1;
          productMap[name].totalQty += Number(line.quantity) || 0;
          if (isConverted) productMap[name].convertedCount += 1;
          if (isActive) productMap[name].pipelineValue += (lead.budget || 0);
          // Promote to inventory if any line linked it
          if (line.articleId) {
            productMap[name].articleId = line.articleId;
            productMap[name].isInventory = true;
          }
        });
      } else {
        const products = parseProducts(lead.productsInterested);
        products.forEach(name => {
          if (!productMap[name]) {
            productMap[name] = {
              name, leadCount: 0, convertedCount: 0, pipelineValue: 0, totalQty: 0,
              articleId: '', isInventory: false,
            };
          }
          productMap[name].leadCount += 1;
          if (isConverted) productMap[name].convertedCount += 1;
          if (isActive) productMap[name].pipelineValue += (lead.budget || 0);
        });
      }
    });

    const allProducts = Object.values(productMap);
    const topProducts = [...allProducts].sort((a, b) => b.leadCount - a.leadCount).slice(0, 8);
    const maxProductLeadCount = topProducts.length > 0 ? topProducts[0].leadCount : 1;

    // ── LEADS vs INVENTORY breakdown ──────────────────────────────────────────
    // If we have inventory data, cross-check product names too (legacy leads
    // may have matching names without articleId).
    const inventoryNameSet = new Set((inventory || []).map(p => (p.productName || '').toLowerCase()));
    const leadsVsInventory = (() => {
      let matchedDemand = 0;
      let customDemand = 0;
      const matchedList = [];
      const customList = [];
      allProducts.forEach(p => {
        const isMatched = p.isInventory || inventoryNameSet.has(p.name.toLowerCase());
        if (isMatched) {
          matchedDemand += p.leadCount;
          matchedList.push({ ...p, isInventory: true });
        } else {
          customDemand += p.leadCount;
          customList.push({ ...p, isInventory: false });
        }
      });
      const total = matchedDemand + customDemand;
      const matchedPct = total > 0 ? Math.round((matchedDemand / total) * 100) : 0;
      return {
        matchedDemand,
        customDemand,
        matchedPct,
        topMatched: matchedList.sort((a, b) => b.leadCount - a.leadCount).slice(0, 10),
        topCustom: customList.sort((a, b) => b.leadCount - a.leadCount).slice(0, 10),
      };
    })();

    // ── BY STATUS / SOURCE ────────────────────────────────────────────────────
    const byStatus = LEAD_STATUSES.map(status => ({
      status,
      count: filteredLeads.filter(l => l.leadStatus === status).length,
    }));

    const sourceMap = {};
    filteredLeads.forEach(l => {
      const src = l.leadSource || 'Unknown';
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
    const bySource = Object.entries(sourceMap)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    // ── SOURCE PERFORMANCE — per-source decision matrix ───────────────────────
    const sourcePerformance = LEAD_SOURCES.map(src => {
      const srcLeads = filteredLeads.filter(l => l.leadSource === src);
      const converted = srcLeads.filter(l => l.leadStatus === 'Converted');
      let revenue = 0;
      let profit = 0;
      if (convertedOrdersMap) {
        converted.forEach(l => {
          const rowIdx = parseInt(l.convertedOrderRow, 10);
          if (!rowIdx) return;
          const order = convertedOrdersMap.get(rowIdx);
          if (!order) return;
          const pricePaid = Number(order.pricePaid) || 0;
          const cost = Number(order.productCost) || 0;
          revenue += pricePaid;
          profit += (pricePaid - cost);
        });
      }
      const avgBudget = srcLeads.length > 0
        ? Math.round(srcLeads.reduce((s, l) => s + (l.budget || 0), 0) / srcLeads.length)
        : 0;
      return {
        source: src,
        leadCount: srcLeads.length,
        convertedCount: converted.length,
        conversionRate: srcLeads.length > 0 ? Math.round((converted.length / srcLeads.length) * 100) : 0,
        avgBudget,
        revenue,
        profit,
      };
    }).filter(s => s.leadCount > 0).sort((a, b) => b.revenue - a.revenue || b.leadCount - a.leadCount);

    // ── STALE LEADS ───────────────────────────────────────────────────────────
    // Active status, no follow-up scheduled, and createdAt > 7 days ago.
    const sevenDaysAgo = new Date(todayMidnight);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const staleLeads = activeLeads.filter(l => {
      if (l.nextFollowUp?.date) return false;
      const created = l.createdAt ? new Date(l.createdAt) : parseLeadDate(l.leadDate);
      return created && created < sevenDaysAgo;
    }).sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt) : parseLeadDate(a.leadDate) || new Date(0);
      const db = b.createdAt ? new Date(b.createdAt) : parseLeadDate(b.leadDate) || new Date(0);
      return da - db; // oldest first
    });

    // ── RECENTLY LOST ─────────────────────────────────────────────────────────
    const thirtyDaysAgo = new Date(todayMidnight);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentlyLost = leads.filter(l => {
      if (l.leadStatus !== 'Lost') return false;
      const d = l.createdAt ? new Date(l.createdAt) : parseLeadDate(l.leadDate);
      return d && d >= thirtyDaysAgo;
    }).sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt) : parseLeadDate(a.leadDate) || new Date(0);
      const db = b.createdAt ? new Date(b.createdAt) : parseLeadDate(b.leadDate) || new Date(0);
      return db - da;
    }).slice(0, 10);

    // ── HIGH-VALUE LEADS NEEDING ATTENTION ────────────────────────────────────
    // Top quartile budget AND last contact (createdAt or leadDate) > 5 days ago.
    const fiveDaysAgo = new Date(todayMidnight);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const budgets = activeLeads.map(l => l.budget || 0).filter(b => b > 0).sort((a, b) => a - b);
    const q3Index = Math.floor(budgets.length * 0.75);
    const budgetThreshold = budgets.length > 0 ? budgets[q3Index] || budgets[budgets.length - 1] : 0;
    const highValueAttention = activeLeads.filter(l => {
      if ((l.budget || 0) < budgetThreshold || budgetThreshold === 0) return false;
      const d = l.createdAt ? new Date(l.createdAt) : parseLeadDate(l.leadDate);
      return d && d < fiveDaysAgo;
    }).sort((a, b) => (b.budget || 0) - (a.budget || 0));

    return {
      // Global
      totalLeads,
      newThisMonth,
      conversionRate,
      convertedCount,

      // Filtered (respects time + source)
      filteredLeadCount,
      filteredConvertedCount,
      filteredConversionRate,
      totalPipelineValue,
      avgBudget,
      estimatedRevenue,
      pipelineByStatus,
      realizedRevenue,
      realizedProfit,

      // Classification
      hotLeads,
      warmLeads,
      coldLeads,
      hotLeadRevenuePotential,

      // Follow-ups
      overdueFollowUps,
      followUpsTodayList,
      followUpsNext5Days,
      followUpsDueToday,

      // Product demand
      topProducts,
      maxProductLeadCount,
      leadsVsInventory,

      // Charts
      byStatus,
      bySource,

      // Source decision matrix
      sourcePerformance,

      // Operational triage
      staleLeads,
      recentlyLost,
      highValueAttention,
    };
  }, [leads, timeRange, sourceFilter, convertedOrdersMap, inventory]);
}
