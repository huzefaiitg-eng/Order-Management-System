import { useState, useEffect, useMemo } from 'react';
import {
  Target, DollarSign, SlidersHorizontal, X,
  Flame, ArrowUpRight, Boxes, Trophy,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useLeads } from '../hooks/useLeads';
import { useLeadInsights } from '../hooks/useLeadInsights';
import { fetchInventory, fetchOrders } from '../services/api';
import { resolveTimeRange } from '../utils/dashboardAggregations';
import TimePresetPicker from '../components/TimePresetPicker';
import { useAuth } from '../context/AuthContext';
import { LeadsInsightsSkeleton } from '../components/Skeletons';
import { STATUS_CONFIG } from './Leads';

const LEAD_SOURCES = ['WhatsApp', 'Instagram', 'Facebook', 'Referral', 'Walk-in/Offline'];

function formatCrore(v) {
  if (!v) return '₹0';
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`;
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}k`;
  return `₹${v}`;
}

function LeadSourceFilterModal({ open, onClose, applied, onApply }) {
  const [pending, setPending] = useState(applied);
  useEffect(() => { if (open) setPending(applied); }, [open, applied]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;

  function toggle(src) {
    setPending(prev => prev.includes(src) ? prev.filter(s => s !== src) : [...prev, src]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Filter by Source</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-2 mb-5">
          {LEAD_SOURCES.map(src => (
            <label key={src} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={pending.includes(src)}
                onChange={() => toggle(src)}
                className="accent-terracotta-600"
              />
              <span className="text-sm text-gray-700">{src}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setPending([])} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Clear</button>
          <button
            onClick={() => { onApply(pending); onClose(); }}
            className="px-4 py-1.5 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function SourceFilterableCard({ title, icon: Icon, iconBg, sources, onRemoveSource, onOpenFilter, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <div className={`p-1.5 rounded-lg ${iconBg || 'bg-gray-50 text-gray-600'}`}>
              <Icon size={15} className="opacity-80" />
            </div>
          )}
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onOpenFilter}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <SlidersHorizontal size={13} />
          <span className="hidden sm:inline">Source</span>
          {sources.length > 0 && (
            <span className="bg-terracotta-600 text-white text-[10px] font-semibold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
              {sources.length}
            </span>
          )}
        </button>
      </div>
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {sources.map(s => (
            <span
              key={s}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full font-medium border bg-terracotta-50 text-terracotta-700 border-terracotta-200"
            >
              {s}
              <button onClick={() => onRemoveSource(s)} className="hover:opacity-70" aria-label={`Remove ${s}`}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

function Stat({ label, value, color }) {
  const colorClass = color === 'green' ? 'text-green-600'
    : color === 'red' ? 'text-red-600'
    : 'text-gray-900';
  return (
    <div>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value ?? '—'}</p>
    </div>
  );
}

export default function LeadDashboard() {
  const { user } = useAuth();
  const hasInventoryAccess = !!user?.hasInventoryAccess;

  const { leads, loading, error } = useLeads();

  const [timePreset, setTimePreset] = useState('all');
  const [customRange, setCustomRange] = useState({ startDate: '', endDate: '' });
  const timeRange = useMemo(() => resolveTimeRange(timePreset, customRange), [timePreset, customRange]);

  const [overviewSources, setOverviewSources] = useState([]);
  const [pipelineSources, setPipelineSources] = useState([]);
  const [overviewModalOpen, setOverviewModalOpen] = useState(false);
  const [pipelineModalOpen, setPipelineModalOpen] = useState(false);

  const [convertedOrdersMap, setConvertedOrdersMap] = useState(null);
  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    let alive = true;
    fetchOrders()
      .then(res => {
        if (!alive) return;
        const map = new Map();
        (res.data || []).forEach(o => {
          if (o.rowIndex) map.set(o.rowIndex, o);
        });
        setConvertedOrdersMap(map);
      })
      .catch(() => alive && setConvertedOrdersMap(new Map()));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!hasInventoryAccess) return;
    let alive = true;
    fetchInventory()
      .then(res => alive && setInventory(res.data || []))
      .catch(() => {});
    return () => { alive = false; };
  }, [hasInventoryAccess]);

  const overviewInsights = useLeadInsights(leads, timeRange, {
    sourceFilter: overviewSources, convertedOrdersMap, inventory,
  });
  const pipelineInsights = useLeadInsights(leads, timeRange, {
    sourceFilter: pipelineSources, convertedOrdersMap, inventory,
  });
  const globalInsights = useLeadInsights(leads, timeRange, {
    convertedOrdersMap, inventory,
  });

  const { leadsVsInventory, byStatus, sourcePerformance } = globalInsights;
  const totalDemand = leadsVsInventory.matchedDemand + leadsVsInventory.customDemand;

  if (loading) return <div className="px-4 sm:px-6 py-6"><LeadsInsightsSkeleton /></div>;
  if (error) return <div className="text-center py-20 text-red-500 text-sm">{error}</div>;

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900">Lead Dashboard</h1>

      {/* Page-level time filter */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 pt-3 pb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Time Range <span className="font-normal text-gray-400 normal-case tracking-normal">— applies to all cards</span>
        </p>
        <TimePresetPicker
          preset={timePreset}
          customRange={customRange}
          onChange={({ preset, customRange: cr }) => { setTimePreset(preset); setCustomRange(cr); }}
        />
      </div>

      {/* 1. Lead Overview */}
      <SourceFilterableCard
        title="Lead Overview"
        icon={Target}
        iconBg="bg-terracotta-50 text-terracotta-600"
        sources={overviewSources}
        onRemoveSource={(s) => setOverviewSources(prev => prev.filter(x => x !== s))}
        onOpenFilter={() => setOverviewModalOpen(true)}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Total Leads" value={overviewInsights.filteredLeadCount} />
          <Stat
            label="Converted"
            value={<>{overviewInsights.filteredConvertedCount} <span className="text-base font-semibold text-gray-400">({overviewInsights.filteredConversionRate}%)</span></>}
            color="green"
          />
          <Stat label="Realized Revenue" value={formatCrore(overviewInsights.realizedRevenue)} color="green" />
          <Stat label="Realized Profit" value={formatCrore(overviewInsights.realizedProfit)} color="green" />
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <span className="text-gray-500">Avg Budget <span className="font-semibold text-gray-900 ml-1">{formatCrore(overviewInsights.avgBudget)}</span></span>
          <span className="text-gray-500">Hot Lead Potential <span className="font-semibold text-red-600 ml-1">{formatCrore(overviewInsights.hotLeadRevenuePotential)}</span></span>
        </div>
      </SourceFilterableCard>

      {/* 2. Pipeline Value */}
      <SourceFilterableCard
        title="Pipeline Value"
        icon={DollarSign}
        iconBg="bg-blue-50 text-blue-600"
        sources={pipelineSources}
        onRemoveSource={(s) => setPipelineSources(prev => prev.filter(x => x !== s))}
        onOpenFilter={() => setPipelineModalOpen(true)}
      >
        <div className="flex items-end gap-2 mb-3">
          <p className="text-3xl font-bold text-gray-900">{formatCrore(pipelineInsights.totalPipelineValue)}</p>
          <p className="text-sm text-gray-400 mb-1">total active pipeline</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowUpRight size={14} className="text-green-600" />
              <p className="text-xs font-medium text-green-700">Est. revenue at current rate</p>
            </div>
            <p className="text-xl font-bold text-green-700">{formatCrore(pipelineInsights.estimatedRevenue)}</p>
            <p className="text-xs text-green-600 mt-0.5">If {pipelineInsights.filteredConversionRate}% of pipeline converts</p>
          </div>
          <div className="bg-terracotta-50 border border-terracotta-200 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Flame size={14} className="text-terracotta-600" />
              <p className="text-xs font-medium text-terracotta-700">If all hot leads convert</p>
            </div>
            <p className="text-xl font-bold text-terracotta-700">{formatCrore(pipelineInsights.hotLeadRevenuePotential)}</p>
            <p className="text-xs text-terracotta-600 mt-0.5">{pipelineInsights.hotLeads.length} hot lead{pipelineInsights.hotLeads.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {/* Status breakdown */}
        <div className="space-y-2">
          {pipelineInsights.pipelineByStatus.filter(s => s.count > 0).map(s => {
            const pct = pipelineInsights.totalPipelineValue > 0 ? Math.round((s.value / pipelineInsights.totalPipelineValue) * 100) : 0;
            return (
              <div key={s.status} className="flex items-center gap-3 text-xs">
                <span className="w-20 text-gray-600 shrink-0">{s.status}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: STATUS_CONFIG[s.status]?.color || '#94A3B8',
                    }}
                  />
                </div>
                <span className="text-gray-500 w-12 text-right">{s.count}</span>
                <span className="text-gray-900 font-medium w-16 text-right">{formatCrore(s.value)}</span>
              </div>
            );
          })}
          {pipelineInsights.pipelineByStatus.every(s => s.count === 0) && (
            <p className="text-xs text-gray-400 text-center py-2">No active pipeline</p>
          )}
        </div>
      </SourceFilterableCard>

      {/* 3. What customers want — Leads vs Inventory */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Boxes size={15} className="opacity-80" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">What Customers Want</h3>
          {hasInventoryAccess && totalDemand > 0 && (
            <span className="ml-auto text-xs text-gray-500">
              <span className="font-semibold text-indigo-600">{leadsVsInventory.matchedPct}%</span> demand met by inventory
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Inventory matches */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">In Inventory</p>
              <span className="text-xs text-gray-500">{leadsVsInventory.matchedDemand} requests</span>
            </div>
            {leadsVsInventory.topMatched.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">No inventory matches yet</p>
            ) : (
              <ul className="space-y-1.5">
                {leadsVsInventory.topMatched.slice(0, 10).map((p, i) => (
                  <li key={p.name} className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-gray-400 w-5 shrink-0">#{i + 1}</span>
                    <span className="text-gray-900 truncate flex-1">{p.name}</span>
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                      {p.leadCount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Custom requests */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Custom Requests</p>
              <span className="text-xs text-gray-500">{leadsVsInventory.customDemand} requests</span>
            </div>
            {leadsVsInventory.topCustom.length === 0 ? (
              <p className="text-sm text-gray-400 py-3">No custom requests</p>
            ) : (
              <ul className="space-y-1.5">
                {leadsVsInventory.topCustom.slice(0, 10).map((p, i) => (
                  <li key={p.name} className="flex items-center gap-2 text-sm">
                    <span className="text-xs text-gray-400 w-5 shrink-0">#{i + 1}</span>
                    <span className="text-gray-900 truncate flex-1">{p.name}</span>
                    <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                      {p.leadCount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {!hasInventoryAccess && (
          <p className="mt-3 text-xs text-gray-400 italic">Enable Inventory module to cross-reference lead demand against your stock.</p>
        )}
      </div>

      {/* 4. Lead Pipeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Lead Pipeline</h3>
        {byStatus.every(s => s.count === 0) ? (
          <p className="text-sm text-gray-400 py-12 text-center">No leads in selected time range</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byStatus} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} width={72} />
              <Tooltip formatter={(v) => [v, 'Leads']} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {byStatus.map(entry => (
                  <Cell key={entry.status} fill={STATUS_CONFIG[entry.status]?.color || '#94A3B8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 5. Source Performance — combined chart + table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-green-50 text-green-700">
            <Trophy size={15} className="opacity-80" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Source Performance</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4 ml-9">Which channel is worth doubling down on. Sorted by realized revenue.</p>
        {sourcePerformance.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No source data in selected time range</p>
        ) : (() => {
          const maxCount = Math.max(...sourcePerformance.map(s => s.leadCount), 1);
          return (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-5 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium text-right">Leads</th>
                    <th className="px-3 py-2 font-medium text-right">Conv %</th>
                    <th className="px-3 py-2 font-medium text-right">Avg Budget</th>
                    <th className="px-3 py-2 font-medium text-right">Revenue</th>
                    <th className="px-5 py-2 font-medium text-right">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {sourcePerformance.map(s => (
                    <tr key={s.source} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-2.5">
                        <span className="font-medium text-gray-900">{s.source}</span>
                        <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-terracotta-400"
                            style={{ width: `${Math.round((s.leadCount / maxCount) * 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{s.leadCount}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                          s.conversionRate >= 30 ? 'bg-green-100 text-green-700'
                          : s.conversionRate >= 10 ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>
                          {s.conversionRate}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{formatCrore(s.avgBudget)}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-green-700">{formatCrore(s.revenue)}</td>
                      <td className="px-5 py-2.5 text-right font-semibold text-green-700">{formatCrore(s.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* Source filter modals */}
      <LeadSourceFilterModal
        open={overviewModalOpen}
        onClose={() => setOverviewModalOpen(false)}
        applied={overviewSources}
        onApply={setOverviewSources}
      />
      <LeadSourceFilterModal
        open={pipelineModalOpen}
        onClose={() => setPipelineModalOpen(false)}
        applied={pipelineSources}
        onApply={setPipelineSources}
      />
    </div>
  );
}
