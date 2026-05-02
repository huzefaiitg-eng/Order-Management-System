import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Target, TrendingUp, DollarSign, CalendarClock,
  Plus, LayoutList, Columns3, Search, X, SlidersHorizontal,
  Phone, Package, AlertCircle, RefreshCw, Lightbulb,
  Flame, Zap, Snowflake, ArrowRight, TrendingDown, ArrowUpRight, Archive,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useLeads } from '../hooks/useLeads';
import { useLeadInsights } from '../hooks/useLeadInsights';
import { addLead, updateLead, deleteLead, archiveLead, fetchInventory, fetchCustomers, addCustomer } from '../services/api';
import { resolveTimeRange } from '../utils/dashboardAggregations';
import KpiCard from '../components/KpiCard';
import InsightSection from '../components/InsightSection';
import SearchableDropdown from '../components/SearchableDropdown';
import TimePresetPicker from '../components/TimePresetPicker';
import Loader from '../components/Loader';
import ConfirmModal from '../components/ConfirmModal';

// ── Constants ─────────────────────────────────────────────────

export const LEAD_STATUSES = ['New Lead', 'Contacted', 'Interested', 'Converted', 'Lost'];
const LEAD_SOURCES = ['WhatsApp', 'Instagram', 'Facebook', 'Referral', 'Walk-in/Offline'];

export const STATUS_CONFIG = {
  'New Lead':   { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-200',  color: '#94A3B8', dot: 'bg-slate-400' },
  'Contacted':  { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200',   color: '#3B82F6', dot: 'bg-blue-400' },
  'Interested': { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', color: '#6366F1', dot: 'bg-indigo-400' },
  'Converted':  { bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-200',  color: '#22C55E', dot: 'bg-green-500' },
  'Lost':       { bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200',    color: '#EF4444', dot: 'bg-red-400' },
};

export function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['New Lead'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function formatBudget(v) {
  if (!v) return '';
  return `₹${Number(v).toLocaleString('en-IN')}`;
}

function parseProducts(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function isFollowUpOverdue(followUpDate) {
  if (!followUpDate) return false;
  const parts = followUpDate.split('/');
  if (parts.length !== 3) return false;
  const d = new Date(parts[2], parts[1] - 1, parts[0]);
  return d < new Date(new Date().setHours(0, 0, 0, 0));
}

// ── Kanban Board ──────────────────────────────────────────────

function KanbanBoard({ leads, onStatusChange, onDelete, onArchive }) {
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);

  function handleDragStart(e, leadId) {
    setDraggedId(leadId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, status) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }

  function handleDrop(e, status) {
    e.preventDefault();
    if (draggedId) {
      const lead = leads.find(l => l.leadId === draggedId);
      if (lead && lead.leadStatus !== status) {
        onStatusChange(draggedId, status);
      }
    }
    setDraggedId(null);
    setDragOverStatus(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverStatus(null);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[60vh]">
      {LEAD_STATUSES.map(status => {
        const cfg = STATUS_CONFIG[status];
        const columnLeads = leads.filter(l => l.leadStatus === status);
        const isOver = dragOverStatus === status;
        return (
          <div
            key={status}
            onDragOver={e => handleDragOver(e, status)}
            onDrop={e => handleDrop(e, status)}
            onDragLeave={() => setDragOverStatus(null)}
            className={`flex flex-col rounded-xl border-2 transition-colors min-w-[220px] w-56 shrink-0 ${
              isOver ? 'border-terracotta-400 bg-terracotta-50/30' : 'border-gray-200 bg-gray-50'
            }`}
          >
            {/* Column header */}
            <div className={`flex items-center justify-between px-3 py-2.5 border-b border-gray-200`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <span className="text-xs font-semibold text-gray-700">{status}</span>
              </div>
              <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full px-1.5 py-0.5">
                {columnLeads.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
              {columnLeads.map(lead => (
                <div
                  key={lead.leadId}
                  draggable
                  onDragStart={e => handleDragStart(e, lead.leadId)}
                  onDragEnd={handleDragEnd}
                  className={`bg-white rounded-lg border border-gray-200 p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow transition-all ${
                    draggedId === lead.leadId ? 'opacity-40' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <p className="text-sm font-medium text-gray-900 leading-snug truncate">{lead.customerName}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        to={`/leads/${lead.leadId}`}
                        onClick={e => e.stopPropagation()}
                        className="text-[10px] text-terracotta-600 hover:underline"
                      >
                        View
                      </Link>
                      <button
                        onClick={e => { e.stopPropagation(); onArchive(lead.leadId, lead.customerName); }}
                        className="p-0.5 text-gray-300 hover:text-amber-500 rounded transition-colors"
                        title="Archive"
                      >
                        <Archive size={11} />
                      </button>
                    </div>
                  </div>

                  {parseProducts(lead.productsInterested).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {parseProducts(lead.productsInterested).slice(0, 2).map((p, i) => (
                        <span key={i} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium truncate max-w-[100px]">{p}</span>
                      ))}
                      {parseProducts(lead.productsInterested).length > 2 && (
                        <span className="text-[10px] text-gray-400">+{parseProducts(lead.productsInterested).length - 2}</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {lead.leadSource && (
                      <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{lead.leadSource}</span>
                    )}
                    {lead.nextFollowUp?.date && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        isFollowUpOverdue(lead.nextFollowUp.date)
                          ? 'bg-red-50 text-red-600 font-medium'
                          : lead.nextFollowUp.date === todayStr()
                          ? 'bg-amber-50 text-amber-600 font-medium'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        📅 {lead.nextFollowUp.date}
                      </span>
                    )}
                    {lead.budget > 0 && (
                      <span className="text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded font-medium">{formatBudget(lead.budget)}</span>
                    )}
                  </div>
                </div>
              ))}

              {columnLeads.length === 0 && (
                <div className={`flex items-center justify-center h-16 text-xs text-gray-400 ${isOver ? 'text-terracotta-500' : ''}`}>
                  {isOver ? 'Drop here' : 'No leads'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Lead Table ────────────────────────────────────────────────

function LeadTable({ leads, onStatusChange, onDelete, onArchive }) {
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [visibleCount, setVisibleCount] = useState(25);

  function parseDate(str) {
    if (!str) return new Date(0);
    const parts = str.split('/');
    if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
    return new Date(str);
  }

  const sorted = [...leads].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'date') cmp = parseDate(a.leadDate) - parseDate(b.leadDate);
    else if (sortBy === 'budget') cmp = (a.budget || 0) - (b.budget || 0);
    else if (sortBy === 'followUp') cmp = parseDate(a.nextFollowUp?.date) - parseDate(b.nextFollowUp?.date);
    else if (sortBy === 'name') cmp = a.customerName.localeCompare(b.customerName);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  }

  const SortIndicator = ({ col }) => sortBy === col
    ? <span className="ml-1 text-terracotta-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
    : null;

  if (leads.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <Target size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="font-medium">No leads yet</p>
        <p className="text-sm text-gray-400 mt-1">Add your first lead to get started</p>
      </div>
    );
  }

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <button onClick={() => toggleSort('name')} className="hover:text-gray-700">
                  Customer <SortIndicator col="name" />
                </button>
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <button onClick={() => toggleSort('date')} className="hover:text-gray-700">
                  Date Added <SortIndicator col="date" />
                </button>
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Products</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <button onClick={() => toggleSort('followUp')} className="hover:text-gray-700">
                  Next Follow-up <SortIndicator col="followUp" />
                </button>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <button onClick={() => toggleSort('budget')} className="hover:text-gray-700">
                  Budget <SortIndicator col="budget" />
                </button>
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.slice(0, visibleCount).map(lead => (
              <tr key={lead.leadId} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 truncate max-w-[140px]">{lead.customerName}</p>
                  <p className="text-xs text-gray-400 font-mono">{lead.customerPhone}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{lead.leadDate}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{lead.leadSource || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {parseProducts(lead.productsInterested).slice(0, 2).map((p, i) => (
                      <span key={i} className="text-[11px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium max-w-[100px] truncate">{p}</span>
                    ))}
                    {parseProducts(lead.productsInterested).length > 2 && (
                      <span className="text-[11px] text-gray-400">+{parseProducts(lead.productsInterested).length - 2}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  {lead.nextFollowUp?.date ? (
                    <span className={
                      isFollowUpOverdue(lead.nextFollowUp.date)
                        ? 'text-red-600 font-medium'
                        : lead.nextFollowUp.date === todayStr()
                        ? 'text-amber-600 font-medium'
                        : 'text-gray-600'
                    }>
                      {lead.nextFollowUp.date}
                    </span>
                  ) : <span className="text-gray-300 italic text-[11px]">No follow-up scheduled</span>}
                </td>
                <td className="px-4 py-3 text-right text-xs font-medium text-gray-700">
                  {lead.budget > 0 ? formatBudget(lead.budget) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge status={lead.leadStatus} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/leads/${lead.leadId}`}
                      className="text-xs text-terracotta-600 hover:text-terracotta-700 font-medium"
                    >
                      View →
                    </Link>
                    <button
                      onClick={() => onArchive(lead.leadId, lead.customerName)}
                      className="p-1 text-gray-300 hover:text-amber-500 hover:bg-amber-50 rounded transition-colors"
                      title="Archive lead"
                    >
                      <Archive size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {sorted.slice(0, visibleCount).map(lead => (
          <Link key={lead.leadId} to={`/leads/${lead.leadId}`}>
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2 hover:border-terracotta-300 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{lead.customerName}</p>
                  <p className="text-xs text-gray-400 font-mono">{lead.customerPhone}</p>
                </div>
                <StatusBadge status={lead.leadStatus} />
              </div>
              {parseProducts(lead.productsInterested).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {parseProducts(lead.productsInterested).map((p, i) => (
                    <span key={i} className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">{p}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                {lead.leadSource && <span>{lead.leadSource}</span>}
                {lead.budget > 0 && <span className="text-green-700 font-medium">{formatBudget(lead.budget)}</span>}
                {lead.nextFollowUp?.date && (
                  <span className={isFollowUpOverdue(lead.nextFollowUp.date) ? 'text-red-500 font-medium' : ''}>
                    📅 {lead.nextFollowUp.date}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Load more */}
      {visibleCount < sorted.length && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setVisibleCount(c => c + 25)}
            className="px-4 py-2 text-sm text-terracotta-600 border border-terracotta-200 rounded-lg hover:bg-terracotta-50"
          >
            Load more ({sorted.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

// ── Follow-up Lead Card ───────────────────────────────────────

function FollowUpLeadCard({ lead, urgency }) {
  const products = parseProducts(lead.productsInterested);
  // urgency: 'overdue' | 'today' | 'upcoming'
  const dateColor =
    urgency === 'overdue' ? 'text-red-600 bg-red-50 border-red-200' :
    urgency === 'today'   ? 'text-amber-700 bg-amber-50 border-amber-200' :
                            'text-gray-600 bg-gray-50 border-gray-200';

  return (
    <div className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 hover:shadow-sm transition-all">
      {/* Row 1 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-sm font-semibold text-gray-900 truncate">{lead.customerName}</span>
          <StatusBadge status={lead.leadStatus} />
          {lead.leadSource && (
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{lead.leadSource}</span>
          )}
        </div>
        <Link
          to={`/leads/${lead.leadId}`}
          className="flex items-center gap-1 text-xs text-terracotta-600 hover:text-terracotta-700 shrink-0 font-medium"
        >
          View <ArrowRight size={12} />
        </Link>
      </div>

      {/* Row 2: Products */}
      {products.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {products.map((p, i) => (
            <span key={i} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">{p}</span>
          ))}
        </div>
      )}

      {/* Row 3: Budget + Phone + Date */}
      <div className="flex items-center gap-2 flex-wrap">
        <a href={`tel:${lead.customerPhone}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-terracotta-600">
          <Phone size={11} />
          <span className="font-mono">{lead.customerPhone}</span>
        </a>
        {lead.budget > 0 && (
          <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
            {formatBudget(lead.budget)}
          </span>
        )}
        {lead.nextFollowUp?.date && (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${dateColor}`}>
            📅 {lead.nextFollowUp.date}
            {urgency === 'overdue' && ' (overdue)'}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Time Filter Mini-Modal ────────────────────────────────────

const TIME_LABELS = {
  all: 'All Time', today: 'Today', yesterday: 'Yesterday',
  last7: 'Last 7 Days', last30: 'Last 30 Days', custom: 'Custom Range',
};

function TimeFilterModal({ open, onClose, preset, customRange, onChange }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div
          className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl pointer-events-auto animate-slide-up"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-terracotta-600" />
              <h2 className="text-sm font-semibold text-gray-900">Time Range Filter</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
              <X size={16} />
            </button>
          </div>
          <div className="px-5 py-4">
            <TimePresetPicker preset={preset} customRange={customRange} onChange={onChange} />
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
            <button
              onClick={() => { onChange({ preset: 'all', customRange: { startDate: '', endDate: '' } }); onClose(); }}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Clear
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 font-medium"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Insights Tab ──────────────────────────────────────────────

const FOLLOWUP_PREVIEW = 5;

function InsightsTab({ leads }) {
  const navigate = useNavigate();
  const [timePreset, setTimePreset] = useState('all');
  const [customRange, setCustomRange] = useState({ startDate: '', endDate: '' });
  const [followUpFilter, setFollowUpFilter] = useState('today');
  const [timeFilterOpen, setTimeFilterOpen] = useState(false);

  const timeRange = resolveTimeRange(timePreset, customRange);
  const insights = useLeadInsights(leads, timeRange);

  const {
    filteredLeadCount, filteredConvertedCount, filteredConversionRate,
    totalPipelineValue, estimatedRevenue,
    hotLeads, warmLeads, coldLeads, hotLeadRevenuePotential,
    overdueFollowUps, followUpsTodayList, followUpsNext5Days,
    topProducts, maxProductLeadCount,
    byStatus, bySource,
    totalLeads,
    conversionRate,
  } = insights;

  // followUpsFilter tabs
  const followUpTabs = [
    { id: 'overdue', label: 'Overdue', list: overdueFollowUps },
    { id: 'today',   label: 'Today',   list: followUpsTodayList },
    { id: 'next5',   label: 'Next 5 Days', list: followUpsNext5Days },
  ];
  const activeFollowUps = followUpTabs.find(t => t.id === followUpFilter)?.list ?? [];
  const previewFollowUps = activeFollowUps.slice(0, FOLLOWUP_PREVIEW);
  const hiddenCount = activeFollowUps.length - FOLLOWUP_PREVIEW;

  const totalFollowUps = overdueFollowUps.length + followUpsTodayList.length + followUpsNext5Days.length;
  const isTimeFiltered = timePreset !== 'all';

  function formatCrore(v) {
    if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`;
    if (v >= 100_000)    return `₹${(v / 100_000).toFixed(1)}L`;
    if (v >= 1_000)      return `₹${(v / 1_000).toFixed(1)}k`;
    return `₹${v}`;
  }

  function goToList(cls) {
    navigate(`/leads?tab=list${cls ? `&class=${cls}` : ''}`);
  }

  return (
    <div className="space-y-5">

      {/* Time filter modal */}
      <TimeFilterModal
        open={timeFilterOpen}
        onClose={() => setTimeFilterOpen(false)}
        preset={timePreset}
        customRange={customRange}
        onChange={({ preset, customRange: cr }) => { setTimePreset(preset); setCustomRange(cr); }}
      />

      {/* ── Section 1: Combined Leads + Conversion with filter button ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {/* Card header — title left, filter button right */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Lead Overview</h3>
          <div className="flex items-center gap-2">
            {isTimeFiltered && (
              <button
                onClick={() => { setTimePreset('all'); setCustomRange({ startDate: '', endDate: '' }); }}
                className="flex items-center gap-1 text-xs text-terracotta-600 hover:text-terracotta-700 font-medium"
              >
                <X size={11} /> Clear
              </button>
            )}
            <button
              onClick={() => setTimeFilterOpen(true)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors ${
                isTimeFiltered
                  ? 'bg-terracotta-50 border-terracotta-300 text-terracotta-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <SlidersHorizontal size={14} />
              <span className="hidden sm:inline">
                {isTimeFiltered ? TIME_LABELS[timePreset] || 'Custom' : 'All Time'}
              </span>
            </button>
          </div>
        </div>

        {/* KPI numbers */}
        <div className="flex items-center gap-8">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">Total Leads</p>
            <p className="text-3xl font-bold text-gray-900">{filteredLeadCount}</p>
            {filteredConvertedCount > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{filteredConvertedCount} converted</p>
            )}
          </div>
          <div className="h-12 w-px bg-gray-100" />
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">Conversion Rate</p>
            <p className="text-3xl font-bold text-green-600">{filteredConversionRate}%</p>
            <p className="text-xs text-gray-400 mt-0.5">Leads → Orders</p>
          </div>
        </div>
      </div>

      {/* ── Section 2: Hot / Warm / Cold classification ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Hot */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-red-100 rounded-lg">
              <Flame size={16} className="text-red-500" />
            </div>
            <span className="text-sm font-semibold text-red-800">Hot Leads</span>
          </div>
          <p className="text-3xl font-bold text-red-600 mb-0.5">{hotLeads.length}</p>
          <p className="text-xs text-red-500 mb-2">Engaged + follow-up overdue or today</p>
          {hotLeads.length > 0 && (
            <p className="text-xs font-semibold text-red-700 mb-3">
              {formatCrore(hotLeads.reduce((s, l) => s + (l.budget || 0), 0))} potential
            </p>
          )}
          {hotLeads.length > 0 && (
            <button
              onClick={() => goToList('hot')}
              className="mt-auto flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 self-start"
            >
              View all <ArrowRight size={12} />
            </button>
          )}
        </div>

        {/* Warm */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-amber-100 rounded-lg">
              <Zap size={16} className="text-amber-500" />
            </div>
            <span className="text-sm font-semibold text-amber-800">Warm Leads</span>
          </div>
          <p className="text-3xl font-bold text-amber-600 mb-0.5">{warmLeads.length}</p>
          <p className="text-xs text-amber-600 mb-2">Follow-up scheduled or recently engaged</p>
          {warmLeads.length > 0 && (
            <p className="text-xs font-semibold text-amber-700 mb-3">
              {formatCrore(warmLeads.reduce((s, l) => s + (l.budget || 0), 0))} potential
            </p>
          )}
          {warmLeads.length > 0 && (
            <button
              onClick={() => goToList('warm')}
              className="mt-auto flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800 self-start"
            >
              View all <ArrowRight size={12} />
            </button>
          )}
        </div>

        {/* Cold */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-slate-100 rounded-lg">
              <Snowflake size={16} className="text-slate-400" />
            </div>
            <span className="text-sm font-semibold text-slate-700">Cold Leads</span>
          </div>
          <p className="text-3xl font-bold text-slate-500 mb-0.5">{coldLeads.length}</p>
          <p className="text-xs text-slate-500 mb-2">No engagement in 30+ days</p>
          {coldLeads.length > 0 && (
            <p className="text-xs text-slate-500 mb-3">Consider a re-engagement message</p>
          )}
          {coldLeads.length > 0 && (
            <button
              onClick={() => goToList('cold')}
              className="mt-auto flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-700 self-start"
            >
              View all <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── Section 3: Pipeline Value with revenue estimates ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-blue-50 rounded-lg border border-blue-200">
            <DollarSign size={16} className="text-blue-600" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Pipeline Value</h3>
        </div>

        <div className="flex items-end gap-2 mb-4">
          <p className="text-3xl font-bold text-gray-900">
            {totalPipelineValue > 0 ? formatCrore(totalPipelineValue) : '—'}
          </p>
          <p className="text-sm text-gray-400 mb-1">total active pipeline</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowUpRight size={14} className="text-green-600" />
              <p className="text-xs font-medium text-green-700">Est. revenue at current rate</p>
            </div>
            <p className="text-xl font-bold text-green-700">
              {estimatedRevenue > 0 ? formatCrore(estimatedRevenue) : '—'}
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              If {filteredConversionRate > 0 ? filteredConversionRate : conversionRate ?? 0}% of pipeline converts
            </p>
          </div>

          <div className="bg-terracotta-50 border border-terracotta-200 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Flame size={14} className="text-terracotta-600" />
              <p className="text-xs font-medium text-terracotta-700">If all hot leads convert</p>
            </div>
            <p className="text-xl font-bold text-terracotta-700">
              {hotLeadRevenuePotential > 0 ? formatCrore(hotLeadRevenuePotential) : '—'}
            </p>
            <p className="text-xs text-terracotta-600 mt-0.5">{hotLeads.length} hot lead{hotLeads.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* ── Section 4: Follow-ups ── */}
      <div className="bg-white rounded-xl border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
              <CalendarClock size={18} className="text-amber-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Follow-ups</h2>
            <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
              {totalFollowUps}
            </span>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
            {followUpTabs.map(({ id, label, list }) => (
              <button
                key={id}
                onClick={() => setFollowUpFilter(id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                  followUpFilter === id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{id === 'overdue' ? 'Late' : id === 'today' ? 'Today' : '+5d'}</span>
                {list.length > 0 && (
                  <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-semibold ${
                    followUpFilter === id
                      ? id === 'overdue' ? 'bg-red-100 text-red-600'
                        : id === 'today' ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-600'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {list.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Cards — preview 5, then "View all" */}
        <div className="divide-y divide-gray-50">
          {activeFollowUps.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-4">
              <CalendarClock size={18} className="text-gray-300 shrink-0" />
              <p className="text-sm text-gray-400">
                {followUpFilter === 'overdue' ? 'No overdue follow-ups — great job! 🎉' :
                 followUpFilter === 'today'   ? 'No follow-ups scheduled for today.' :
                 'No follow-ups in the next 5 days.'}
              </p>
            </div>
          ) : (
            <>
              {previewFollowUps.map(lead => (
                <div key={lead.leadId} className="px-5 py-3">
                  <FollowUpLeadCard
                    lead={lead}
                    urgency={followUpFilter === 'overdue' ? 'overdue' : followUpFilter === 'today' ? 'today' : 'upcoming'}
                  />
                </div>
              ))}
              {hiddenCount > 0 && (
                <div className="px-5 py-3">
                  <button
                    onClick={() => goToList()}
                    className="flex items-center gap-1.5 text-sm font-medium text-terracotta-600 hover:text-terracotta-700"
                  >
                    <ArrowRight size={15} />
                    View {hiddenCount} more in All Leads
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Section 5: Product Demand ── */}
      {topProducts.length > 0 && (
        <InsightSection icon={Package} title="What Customers Want" count={topProducts.length} color="purple">
          <div className="space-y-3">
            {topProducts.map((product, i) => {
              const barPct = Math.round((product.leadCount / (maxProductLeadCount || 1)) * 100);
              const convRate = product.leadCount > 0
                ? Math.round((product.convertedCount / product.leadCount) * 100)
                : 0;
              return (
                <div key={product.name} className="relative">
                  {/* Background bar */}
                  <div
                    className="absolute inset-y-0 left-0 bg-indigo-50 rounded-lg"
                    style={{ width: `${barPct}%` }}
                  />
                  {/* Content */}
                  <div className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg">
                    <span className="text-xs font-bold text-gray-400 w-5 shrink-0">#{i + 1}</span>
                    <p className="text-sm font-medium text-gray-900 flex-1 truncate">{product.name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500">{product.leadCount} lead{product.leadCount !== 1 ? 's' : ''}</span>
                      {convRate > 0 && (
                        <span className="text-xs font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                          {convRate}% conv
                        </span>
                      )}
                      {product.pipelineValue > 0 && (
                        <span className="text-xs font-semibold text-indigo-600">
                          ₹{(product.pipelineValue / 1000).toFixed(0)}k
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </InsightSection>
      )}

      {/* ── Section 6: Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funnel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Lead Pipeline</h3>
          {totalLeads === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No leads yet</p>
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

        {/* By Source */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Leads by Source</h3>
          {bySource.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No source data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bySource} margin={{ right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, 'Leads']} />
                <Bar dataKey="count" fill="#C8956C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Classification helper (mirrors useLeadInsights logic) ────

function classifyLeadAs(lead) {
  if (lead.leadStatus === 'Converted' || lead.leadStatus === 'Lost') return null;
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
  const tomorrow = new Date(todayMidnight); tomorrow.setDate(tomorrow.getDate() + 1);
  const in14Days = new Date(todayMidnight); in14Days.setDate(in14Days.getDate() + 14);

  function pd(str) {
    if (!str) return null;
    const [dd, mm, yyyy] = str.split('/').map(Number);
    if (!dd || !mm || !yyyy) return null;
    const d = new Date(yyyy, mm - 1, dd); d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  const nextFuDate = pd(lead.nextFollowUp?.date);
  const leadD = pd(lead.leadDate);
  const ageDays = leadD ? Math.floor((todayMidnight - leadD) / 86400000) : 0;
  const isEngaged = lead.leadStatus === 'Interested';
  const isHotFollowUp = nextFuDate && nextFuDate <= todayMidnight;
  const hasFutureFollowUp = nextFuDate && nextFuDate >= tomorrow && nextFuDate <= in14Days;

  if (isEngaged && isHotFollowUp) return 'hot';
  const isCold = (lead.leadStatus === 'New Lead' || lead.leadStatus === 'Contacted') && !nextFuDate && ageDays > 30;
  if (isCold) return 'cold';
  if (hasFutureFollowUp || isEngaged) return 'warm';
  return 'warm'; // default active
}

// ── Main Leads Page ───────────────────────────────────────────

export default function Leads() {
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = searchParams.get('tab') || 'insights';
  const listView = searchParams.get('view') || 'table';
  const classFilter = searchParams.get('class') || ''; // 'hot' | 'warm' | 'cold' | ''

  const [confirmModal, setConfirmModal] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');

  // Filter flap state (pending = in-progress inside the flap; applied = committed)
  const [filterOpen, setFilterOpen] = useState(false);
  const [appliedStatuses, setAppliedStatuses] = useState([]);
  const [appliedSources, setAppliedSources] = useState([]);
  const [pendingStatuses, setPendingStatuses] = useState([]);
  const [pendingSources, setPendingSources] = useState([]);

  const { leads, loading, error, refetch, setLeads } = useLeads();

  const totalApplied = appliedStatuses.length + appliedSources.length;

  // Pre-compute classified lead IDs when classFilter is active
  const classFilteredIds = useMemo(() => {
    if (!classFilter) return null;
    return new Set(leads.filter(l => classifyLeadAs(l) === classFilter).map(l => l.leadId));
  }, [leads, classFilter]);

  function clearClassFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete('class');
    setSearchParams(next);
  }

  function openFilterFlap() {
    setPendingStatuses([...appliedStatuses]);
    setPendingSources([...appliedSources]);
    setFilterOpen(true);
  }

  function applyFilters() {
    setAppliedStatuses([...pendingStatuses]);
    setAppliedSources([...pendingSources]);
    setFilterOpen(false);
  }

  function clearAllFilters() {
    setPendingStatuses([]);
    setPendingSources([]);
  }

  function togglePending(setter, current, value) {
    setter(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  }

  function removeChip(type, value) {
    if (type === 'status') setAppliedStatuses(prev => prev.filter(s => s !== value));
    if (type === 'source') setAppliedSources(prev => prev.filter(s => s !== value));
  }

  // Client-side filtered leads for list tab
  const filteredLeads = leads.filter(l => {
    if (classFilteredIds && !classFilteredIds.has(l.leadId)) return false;
    if (appliedStatuses.length && !appliedStatuses.includes(l.leadStatus)) return false;
    if (appliedSources.length && !appliedSources.includes(l.leadSource)) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (
        !l.customerName.toLowerCase().includes(q) &&
        !l.customerPhone.includes(q) &&
        !l.productsInterested.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  function setTab(t) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', t);
    setSearchParams(next);
  }

  function setView(v) {
    const next = new URLSearchParams(searchParams);
    next.set('view', v);
    setSearchParams(next);
  }

  async function applyStatusChange(leadId, newStatus) {
    try {
      const result = await updateLead(leadId, { leadStatus: newStatus });
      setLeads(prev => prev.map(l => l.leadId === leadId ? {
        ...l,
        leadStatus: newStatus,
        // Backend auto-closes pending follow-ups when transitioning to Converted/Lost.
        // Clear the local nextFollowUp marker so the kanban card stops showing it.
        nextFollowUp: (newStatus === 'Converted' || newStatus === 'Lost') ? null : l.nextFollowUp,
      } : l));
      return result;
    } catch (err) {
      console.error('Status update failed:', err.message);
      throw err;
    }
  }

  function handleStatusChange(leadId, newStatus) {
    // Terminal statuses get a confirmation modal that warns the user about
    // pending follow-ups being auto-closed (the backend does this — we just
    // surface the consequence).
    if (newStatus === 'Converted' || newStatus === 'Lost') {
      const lead = leads.find(l => l.leadId === leadId);
      const hasOpenFu = !!lead?.nextFollowUp;
      const followUpLine = hasOpenFu
        ? ' The open follow-up scheduled for this lead will be marked as done automatically.'
        : '';
      const verb = newStatus === 'Converted' ? 'mark as Converted' : 'mark as Lost';
      setConfirmModal({
        title: newStatus === 'Converted' ? 'Mark Lead as Converted' : 'Mark Lead as Lost',
        message: `Are you sure you want to ${verb} for ${lead?.customerName || 'this lead'}?${followUpLine}`,
        confirmLabel: newStatus === 'Converted' ? 'Mark Converted' : 'Mark Lost',
        variant: newStatus === 'Converted' ? 'warning' : 'danger',
        onConfirm: async () => {
          await applyStatusChange(leadId, newStatus);
          setConfirmModal(null);
        },
      });
      return;
    }
    applyStatusChange(leadId, newStatus);
  }

  function handleDelete(leadId, customerName) {
    setConfirmModal({
      title: 'Delete Lead',
      message: `Delete "${customerName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        await deleteLead(leadId);
        setLeads(prev => prev.filter(l => l.leadId !== leadId));
        setConfirmModal(null);
      },
    });
  }

  function handleArchive(leadId, customerName) {
    setConfirmModal({
      title: 'Archive Lead',
      message: `Archive "${customerName}"? You can restore it from the Archived Leads page.`,
      confirmLabel: 'Archive',
      variant: 'warning',
      onConfirm: async () => {
        await archiveLead(leadId);
        setLeads(prev => prev.filter(l => l.leadId !== leadId));
        setConfirmModal(null);
      },
    });
  }

  const isFiltered = totalApplied > 0 || filterSearch.length > 0 || !!classFilter;

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Lead Management</h1>
          <button
            onClick={refetch}
            className="p-1.5 rounded-lg text-gray-400 hover:text-terracotta-600 hover:bg-terracotta-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/leads/archived"
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            <Archive size={15} />
            <span className="hidden md:inline">Archived</span>
          </Link>
          <Link
            to="/leads/new"
            className="flex items-center gap-2 px-3 py-2 bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            <span className="hidden md:inline">Add Lead</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: 'insights', label: 'Insights',  icon: Lightbulb },
          { id: 'list',     label: `All Leads${leads.length > 0 ? ` (${leads.length})` : ''}`, icon: LayoutList },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-white text-terracotta-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader /></div>
      ) : error ? (
        <div className="text-center py-20 text-red-500 text-sm">{error}</div>
      ) : tab === 'insights' ? (
        <InsightsTab leads={leads} />
      ) : (
        /* ── List tab ── */
        <div className="space-y-3">

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 md:flex-none md:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="Search name, phone, product…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500"
              />
              {filterSearch && (
                <button onClick={() => setFilterSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter button */}
            <button
              onClick={openFilterFlap}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors shrink-0"
            >
              <SlidersHorizontal size={16} />
              <span className="hidden md:inline">Filters</span>
              {totalApplied > 0 && (
                <span className="bg-terracotta-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                  {totalApplied}
                </span>
              )}
            </button>

            {/* View toggle */}
            <div className="ml-auto flex items-center bg-gray-100 p-1 rounded-lg gap-0.5">
              <button
                onClick={() => setView('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  listView === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LayoutList size={14} />
                Table
              </button>
              <button
                onClick={() => setView('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  listView === 'kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Columns3 size={14} />
                Kanban
              </button>
            </div>
          </div>

          {/* Applied filter chips + result count */}
          {(totalApplied > 0 || isFiltered || classFilter) && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Classification chip */}
              {classFilter && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full font-medium ${
                  classFilter === 'hot'  ? 'bg-red-50 text-red-700' :
                  classFilter === 'warm' ? 'bg-amber-50 text-amber-700' :
                                          'bg-slate-100 text-slate-700'
                }`}>
                  {classFilter === 'hot' ? '🔥 Hot Leads' : classFilter === 'warm' ? '⚡ Warm Leads' : '🧊 Cold Leads'}
                  <button onClick={clearClassFilter} className="ml-0.5 hover:opacity-70"><X size={11} /></button>
                </span>
              )}
              {appliedStatuses.map(s => (
                <span key={`st-${s}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-terracotta-50 text-terracotta-700 text-xs rounded-full font-medium">
                  {s}
                  <button onClick={() => removeChip('status', s)} className="hover:text-terracotta-900 ml-0.5">
                    <X size={11} />
                  </button>
                </span>
              ))}
              {appliedSources.map(s => (
                <span key={`src-${s}`} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                  {s}
                  <button onClick={() => removeChip('source', s)} className="hover:text-blue-900 ml-0.5">
                    <X size={11} />
                  </button>
                </span>
              ))}
              <span className="text-xs text-gray-400">
                {filteredLeads.length} of {leads.length} leads
              </span>
            </div>
          )}

          {/* View */}
          {listView === 'kanban' ? (
            <KanbanBoard
              leads={filteredLeads}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onArchive={handleArchive}
            />
          ) : (
            <LeadTable
              leads={filteredLeads}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onArchive={handleArchive}
            />
          )}
        </div>
      )}

      {/* ── Filter Flap ── */}
      {filterOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setFilterOpen(false)} />
          <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-xl border-b border-gray-200 animate-slide-down">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">

              {/* Flap header */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Filters</h2>
                <button onClick={() => setFilterOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              {/* Status pills */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Status</h3>
                <div className="flex flex-wrap gap-2">
                  {LEAD_STATUSES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => togglePending(setPendingStatuses, pendingStatuses, s)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        pendingStatuses.includes(s)
                          ? 'bg-terracotta-50 border-terracotta-300 text-terracotta-700 font-medium'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Source pills */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Source</h3>
                <div className="flex flex-wrap gap-2">
                  {LEAD_SOURCES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => togglePending(setPendingSources, pendingSources, s)}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        pendingSources.includes(s)
                          ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
                <button
                  onClick={clearAllFilters}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={applyFilters}
                  className="px-6 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-colors font-medium"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {confirmModal && <ConfirmModal {...confirmModal} onClose={() => setConfirmModal(null)} />}
    </div>
  );
}
