import { useMemo } from 'react';
import { resolveTimeRange, parseOrderDate } from '../utils/dashboardAggregations';

const LEAD_STATUSES = ['New Lead', 'Contacted', 'Interested', 'Follow-up', 'Converted', 'Lost'];

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
 * useLeadInsights(leads, timeRange)
 *
 * Pure memoised analytics over the leads array.
 * timeRange = { start: Date|null, end: Date|null }  — from resolveTimeRange()
 */
export function useLeadInsights(leads = [], timeRange = { start: null, end: null }) {
  return useMemo(() => {
    const todayStr = todayDateString();
    const todayMidnight = todayDate();

    // ── FILTERED totals (respect timeRange on leadDate) ──────────────────────
    const filteredLeads = timeRange.start || timeRange.end
      ? leads.filter(l => {
          const d = parseLeadDate(l.leadDate);
          if (!d) return false;
          if (timeRange.start && d < timeRange.start) return false;
          if (timeRange.end && d > timeRange.end) return false;
          return true;
        })
      : leads;

    const filteredLeadCount = filteredLeads.length;
    const filteredConvertedCount = filteredLeads.filter(l => l.leadStatus === 'Converted').length;
    const filteredConversionRate = filteredLeadCount > 0
      ? Math.round((filteredConvertedCount / filteredLeadCount) * 100)
      : 0;

    // ── GLOBAL totals ─────────────────────────────────────────────────────────
    const totalLeads = leads.length;
    const newThisMonth = leads.filter(l => isThisMonth(l.leadDate)).length;
    const convertedCount = leads.filter(l => l.leadStatus === 'Converted').length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0;

    // Active = not Converted / not Lost
    const activeLeads = leads.filter(l => l.leadStatus !== 'Converted' && l.leadStatus !== 'Lost');

    // ── PIPELINE VALUE ────────────────────────────────────────────────────────
    const totalPipelineValue = activeLeads.reduce((sum, l) => sum + (l.budget || 0), 0);
    const avgBudget = activeLeads.length > 0
      ? Math.round(totalPipelineValue / activeLeads.length)
      : 0;

    // Estimated revenue at current conversion rate
    const estimatedRevenue = Math.round(totalPipelineValue * (conversionRate / 100));

    // ── CLASSIFICATION ────────────────────────────────────────────────────────
    // HOT: Active + (Follow-up | Interested) + followUpDate is today or overdue
    // WARM: Active + has a future followUpDate (next 1–14 days) OR status = Interested/Follow-up without overdue
    // COLD: Active + status = New Lead | Contacted + no followUpDate + leadAge > 30 days
    // Everything else = Warm

    const in30Days = new Date(todayMidnight);
    in30Days.setDate(in30Days.getDate() + 14);

    const hotLeads = [];
    const warmLeads = [];
    const coldLeads = [];

    activeLeads.forEach(lead => {
      const followUpD = parseLeadDate(lead.followUpDate);
      const leadD = parseLeadDate(lead.leadDate);
      const leadAgeMs = leadD ? todayMidnight - leadD : 0;
      const leadAgeDays = Math.floor(leadAgeMs / (1000 * 60 * 60 * 24));

      const isEngaged = lead.leadStatus === 'Follow-up' || lead.leadStatus === 'Interested';
      const isFollowUpTodayOrOverdue = followUpD && followUpD <= todayMidnight;
      const hasFutureFollowUp = followUpD && followUpD > todayMidnight && followUpD <= in30Days;
      const isColdCandidate =
        (lead.leadStatus === 'New Lead' || lead.leadStatus === 'Contacted') &&
        !followUpD &&
        leadAgeDays > 30;

      if (isEngaged && isFollowUpTodayOrOverdue) {
        hotLeads.push(lead);
      } else if (hasFutureFollowUp || (isEngaged && !isFollowUpTodayOrOverdue)) {
        warmLeads.push(lead);
      } else if (isColdCandidate) {
        coldLeads.push(lead);
      } else {
        warmLeads.push(lead); // default bucket
      }
    });

    // Estimated revenue if all hot leads convert
    const hotLeadRevenuePotential = hotLeads.reduce((sum, l) => sum + (l.budget || 0), 0);

    // ── FOLLOW-UP BUCKETS ─────────────────────────────────────────────────────
    const tomorrow = new Date(todayMidnight);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const in5Days = new Date(todayMidnight);
    in5Days.setDate(in5Days.getDate() + 5);

    const overdueFollowUps = activeLeads.filter(l => {
      const d = parseLeadDate(l.followUpDate);
      return d && d < todayMidnight;
    });

    const followUpsTodayList = activeLeads.filter(l => l.followUpDate === todayStr);

    const followUpsNext5Days = activeLeads.filter(l => {
      const d = parseLeadDate(l.followUpDate);
      return d && d >= tomorrow && d <= in5Days;
    });

    // Legacy alias
    const followUpsDueToday = followUpsTodayList;

    // ── PRODUCT DEMAND ────────────────────────────────────────────────────────
    const productMap = {}; // { productName: { leadCount, convertedCount, pipelineValue } }

    leads.forEach(lead => {
      const products = parseProducts(lead.productsInterested);
      const isConverted = lead.leadStatus === 'Converted';
      const isActive = lead.leadStatus !== 'Converted' && lead.leadStatus !== 'Lost';

      products.forEach(name => {
        if (!productMap[name]) {
          productMap[name] = { name, leadCount: 0, convertedCount: 0, pipelineValue: 0 };
        }
        productMap[name].leadCount += 1;
        if (isConverted) productMap[name].convertedCount += 1;
        if (isActive) productMap[name].pipelineValue += (lead.budget || 0);
      });
    });

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.leadCount - a.leadCount)
      .slice(0, 8);

    const maxProductLeadCount = topProducts.length > 0 ? topProducts[0].leadCount : 1;

    // ── BY STATUS / SOURCE ────────────────────────────────────────────────────
    const byStatus = LEAD_STATUSES.map(status => ({
      status,
      count: leads.filter(l => l.leadStatus === status).length,
    }));

    const sourceMap = {};
    leads.forEach(l => {
      const src = l.leadSource || 'Unknown';
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
    const bySource = Object.entries(sourceMap)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    return {
      // Global
      totalLeads,
      newThisMonth,
      conversionRate,
      convertedCount,
      totalPipelineValue,
      avgBudget,
      estimatedRevenue,

      // Time-filtered
      filteredLeadCount,
      filteredConvertedCount,
      filteredConversionRate,

      // Classification
      hotLeads,
      warmLeads,
      coldLeads,
      hotLeadRevenuePotential,

      // Follow-up buckets
      overdueFollowUps,
      followUpsTodayList,
      followUpsNext5Days,
      followUpsDueToday, // legacy

      // Product demand
      topProducts,
      maxProductLeadCount,

      // Charts
      byStatus,
      bySource,
    };
  }, [leads, timeRange]);
}
