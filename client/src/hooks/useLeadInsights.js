import { useMemo } from 'react';

const LEAD_STATUSES = ['New Lead', 'Contacted', 'Interested', 'Follow-up', 'Converted', 'Lost'];

function todayDateString() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return false;
  const now = new Date();
  return parseInt(parts[1]) === now.getMonth() + 1 && parseInt(parts[2]) === now.getFullYear();
}

export function useLeadInsights(leads = []) {
  return useMemo(() => {
    const today = todayDateString();
    const totalLeads = leads.length;
    const newThisMonth = leads.filter(l => isThisMonth(l.leadDate)).length;

    const convertedCount = leads.filter(l => l.leadStatus === 'Converted').length;
    const conversionRate = totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0;

    // Pipeline value: sum of budgets for active leads (not Lost, not Converted)
    const pipelineLeads = leads.filter(l => l.leadStatus !== 'Lost' && l.leadStatus !== 'Converted');
    const totalPipelineValue = pipelineLeads.reduce((sum, l) => sum + (l.budget || 0), 0);
    const avgBudget = pipelineLeads.length > 0
      ? Math.round(totalPipelineValue / pipelineLeads.length)
      : 0;

    // Follow-ups due today
    const followUpsDueToday = leads.filter(l =>
      l.followUpDate === today &&
      l.leadStatus !== 'Converted' &&
      l.leadStatus !== 'Lost'
    );

    // By status (in funnel order)
    const byStatus = LEAD_STATUSES.map(status => ({
      status,
      count: leads.filter(l => l.leadStatus === status).length,
    }));

    // By source
    const sourceMap = {};
    leads.forEach(l => {
      const src = l.leadSource || 'Unknown';
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
    const bySource = Object.entries(sourceMap)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalLeads,
      newThisMonth,
      conversionRate,
      convertedCount,
      totalPipelineValue,
      avgBudget,
      followUpsDueToday,
      byStatus,
      bySource,
    };
  }, [leads]);
}
