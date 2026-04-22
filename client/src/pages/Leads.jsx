import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Target, TrendingUp, DollarSign, CalendarClock,
  Plus, LayoutList, Columns3, Search, X, SlidersHorizontal,
  Phone, Package, AlertCircle, RefreshCw, Lightbulb,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useLeads } from '../hooks/useLeads';
import { useLeadInsights } from '../hooks/useLeadInsights';
import { addLead, updateLead, deleteLead, fetchInventory, fetchCustomers, addCustomer } from '../services/api';
import KpiCard from '../components/KpiCard';
import InsightSection from '../components/InsightSection';
import SearchableDropdown from '../components/SearchableDropdown';
import Loader from '../components/Loader';

// ── Constants ─────────────────────────────────────────────────

export const LEAD_STATUSES = ['New Lead', 'Contacted', 'Interested', 'Follow-up', 'Converted', 'Lost'];
const LEAD_SOURCES = ['WhatsApp', 'Instagram', 'Facebook', 'Referral', 'Walk-in/Offline'];

export const STATUS_CONFIG = {
  'New Lead':   { bg: 'bg-slate-100',  text: 'text-slate-700',  border: 'border-slate-200',  color: '#94A3B8', dot: 'bg-slate-400' },
  'Contacted':  { bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200',   color: '#3B82F6', dot: 'bg-blue-400' },
  'Interested': { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', color: '#6366F1', dot: 'bg-indigo-400' },
  'Follow-up':  { bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-200',  color: '#F59E0B', dot: 'bg-amber-400' },
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

// ── AddLeadModal ──────────────────────────────────────────────

const EMPTY_FORM = {
  customerName: '', customerPhone: '', customerEmail: '',
  selectedProducts: [], leadStatus: 'New Lead', leadSource: '',
  followUpDate: '', budget: '', notes: '',
};

const EMPTY_NEW_CUSTOMER = { customerName: '', customerPhone: '', customerAddress: '', customerEmail: '' };

function AddLeadModal({ onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [addingNewCustomer, setAddingNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState(EMPTY_NEW_CUSTOMER);
  const [savingCustomer, setSavingCustomer] = useState(false);

  useEffect(() => {
    fetchInventory({ status: 'Active' }).then(setProducts).catch(() => {});
    fetchCustomers('', 'Active').then(setCustomers).catch(() => {});
  }, []);

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleCustomerSelect(c) {
    setForm(f => ({
      ...f,
      customerName: c.customerName,
      customerPhone: c.customerPhone,
      customerEmail: c.customerEmail || '',
    }));
  }

  async function handleCreateNewCustomer() {
    if (!newCustomer.customerName.trim() || !newCustomer.customerPhone.trim()) {
      setError('Customer name and phone are required.');
      return;
    }
    setSavingCustomer(true);
    setError('');
    try {
      const created = await addCustomer(newCustomer);
      setCustomers(prev => [...prev, created]);
      handleCustomerSelect(created);
      setAddingNewCustomer(false);
      setNewCustomer(EMPTY_NEW_CUSTOMER);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingCustomer(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      setError('Customer name and phone are required.');
      return;
    }
    if (form.selectedProducts.length === 0) {
      setError('Please select at least one product of interest.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = await addLead({
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerEmail: form.customerEmail.trim(),
        productsInterested: form.selectedProducts.map(p => p.productName).join(','),
        leadStatus: form.leadStatus,
        leadSource: form.leadSource,
        followUpDate: form.followUpDate,
        budget: form.budget ? parseFloat(form.budget) : 0,
        notes: form.notes,
      });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Add New Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* ── Customer selection ── */}
          {!addingNewCustomer ? (
            <div>
              <SearchableDropdown
                label="Customer *"
                placeholder="Search by name or phone…"
                items={customers}
                displayFn={c => `${c.customerName} — ${c.customerPhone}`}
                keyFn={c => c.customerPhone}
                onSelect={handleCustomerSelect}
                onAddNew={() => { setAddingNewCustomer(true); setError(''); }}
                addNewLabel="Add new customer"
              />
              {form.customerName && (
                <p className="text-xs text-gray-500 mt-1">
                  Selected: <span className="font-medium text-gray-700">{form.customerName}</span> ({form.customerPhone})
                </p>
              )}
            </div>
          ) : (
            <div className="border border-terracotta-200 rounded-lg p-3 space-y-3 bg-terracotta-50/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-terracotta-700">New Customer</span>
                <button type="button" onClick={() => { setAddingNewCustomer(false); setError(''); }}
                  className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
              <input
                type="text"
                value={newCustomer.customerName}
                onChange={e => setNewCustomer(p => ({ ...p, customerName: e.target.value }))}
                className={inputClass}
                placeholder="Name *"
              />
              <input
                type="text"
                value={newCustomer.customerPhone}
                onChange={e => setNewCustomer(p => ({ ...p, customerPhone: e.target.value }))}
                className={inputClass}
                placeholder="Phone *"
              />
              <input
                type="text"
                value={newCustomer.customerEmail}
                onChange={e => setNewCustomer(p => ({ ...p, customerEmail: e.target.value }))}
                className={inputClass}
                placeholder="Email (optional)"
              />
              <input
                type="text"
                value={newCustomer.customerAddress}
                onChange={e => setNewCustomer(p => ({ ...p, customerAddress: e.target.value }))}
                className={inputClass}
                placeholder="Address (optional)"
              />
              <button
                type="button"
                onClick={handleCreateNewCustomer}
                disabled={savingCustomer}
                className="w-full px-3 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50"
              >
                {savingCustomer ? 'Creating…' : 'Create Customer'}
              </button>
            </div>
          )}

          {/* Email — editable after customer is selected */}
          {form.customerName && !addingNewCustomer && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                value={form.customerEmail}
                onChange={e => set('customerEmail', e.target.value)}
                className={inputClass}
                placeholder="customer@email.com"
              />
            </div>
          )}

          {/* Products */}
          <SearchableDropdown
            label="Products Interested *"
            placeholder="Search inventory…"
            items={products}
            displayFn={p => p.productName}
            keyFn={p => p.articleId}
            multi
            selected={form.selectedProducts}
            onChange={sel => set('selectedProducts', sel)}
            chipClassName="bg-indigo-50 text-indigo-700"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lead Status</label>
              <select
                value={form.leadStatus}
                onChange={e => set('leadStatus', e.target.value)}
                className={inputClass}
              >
                {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lead Source</label>
              <select
                value={form.leadSource}
                onChange={e => set('leadSource', e.target.value)}
                className={inputClass}
              >
                <option value="">Select source…</option>
                {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
              <input
                type="date"
                onChange={e => {
                  const v = e.target.value;
                  if (!v) { set('followUpDate', ''); return; }
                  const [y, m, d] = v.split('-');
                  set('followUpDate', `${d}/${m}/${y}`);
                }}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget ₹</label>
              <input
                type="number"
                min="0"
                value={form.budget}
                onChange={e => set('budget', e.target.value)}
                className={inputClass}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className={`${inputClass} resize-none`}
              placeholder="Conversation notes, preferences…"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Add Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Kanban Board ──────────────────────────────────────────────

function KanbanBoard({ leads, onStatusChange, onDelete }) {
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
                    <Link
                      to={`/leads/${lead.leadId}`}
                      onClick={e => e.stopPropagation()}
                      className="text-[10px] text-terracotta-600 hover:underline shrink-0"
                    >
                      View
                    </Link>
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
                    {lead.followUpDate && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        isFollowUpOverdue(lead.followUpDate)
                          ? 'bg-red-50 text-red-600 font-medium'
                          : lead.followUpDate === todayStr()
                          ? 'bg-amber-50 text-amber-600 font-medium'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        📅 {lead.followUpDate}
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

function LeadTable({ leads, onStatusChange, onDelete }) {
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
    else if (sortBy === 'followUp') cmp = parseDate(a.followUpDate) - parseDate(b.followUpDate);
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Products</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <button onClick={() => toggleSort('followUp')} className="hover:text-gray-700">
                  Follow-up <SortIndicator col="followUp" />
                </button>
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <button onClick={() => toggleSort('budget')} className="hover:text-gray-700">
                  Budget <SortIndicator col="budget" />
                </button>
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <button onClick={() => toggleSort('date')} className="hover:text-gray-700">
                  Added <SortIndicator col="date" />
                </button>
              </th>
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
                <td className="px-4 py-3"><StatusBadge status={lead.leadStatus} /></td>
                <td className="px-4 py-3 text-xs text-gray-600">{lead.leadSource || '—'}</td>
                <td className="px-4 py-3 text-xs">
                  {lead.followUpDate ? (
                    <span className={
                      isFollowUpOverdue(lead.followUpDate)
                        ? 'text-red-600 font-medium'
                        : lead.followUpDate === todayStr()
                        ? 'text-amber-600 font-medium'
                        : 'text-gray-600'
                    }>
                      {lead.followUpDate}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right text-xs font-medium text-gray-700">
                  {lead.budget > 0 ? formatBudget(lead.budget) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{lead.leadDate}</td>
                <td className="px-4 py-3">
                  <Link
                    to={`/leads/${lead.leadId}`}
                    className="text-xs text-terracotta-600 hover:text-terracotta-700 font-medium"
                  >
                    View →
                  </Link>
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
                {lead.followUpDate && (
                  <span className={isFollowUpOverdue(lead.followUpDate) ? 'text-red-500 font-medium' : ''}>
                    📅 {lead.followUpDate}
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

// ── Insights Tab ──────────────────────────────────────────────

function InsightsTab({ insights }) {
  const {
    totalLeads, newThisMonth, conversionRate, totalPipelineValue,
    followUpsDueToday, byStatus, bySource,
  } = insights;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Leads"
          value={totalLeads}
          subtitle={`${newThisMonth} added this month`}
          icon={Target}
          color="terracotta"
        />
        <KpiCard
          title="Conversion Rate"
          value={`${conversionRate}%`}
          subtitle="Leads converted to orders"
          icon={TrendingUp}
          color="green"
        />
        <KpiCard
          title="Pipeline Value"
          value={totalPipelineValue > 0 ? `₹${(totalPipelineValue / 1000).toFixed(1)}k` : '—'}
          subtitle="Sum of active lead budgets"
          icon={DollarSign}
          color="blue"
        />
        <KpiCard
          title="Follow-ups Due Today"
          value={followUpsDueToday.length}
          subtitle="Leads to follow up today"
          icon={CalendarClock}
          color={followUpsDueToday.length > 0 ? 'amber' : 'terracotta'}
        />
      </div>

      {/* Charts */}
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

      {/* Follow-ups due today */}
      {followUpsDueToday.length > 0 && (
        <InsightSection icon={CalendarClock} title="Follow-ups Due Today" count={followUpsDueToday.length} color="amber">
          <div className="divide-y divide-gray-100 -mx-5 px-5">
            {followUpsDueToday.map(lead => (
              <div key={lead.leadId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link to={`/leads/${lead.leadId}`} className="text-sm font-medium text-gray-900 hover:text-terracotta-600 truncate">
                      {lead.customerName}
                    </Link>
                    <StatusBadge status={lead.leadStatus} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Phone size={11} className="text-gray-400" />
                    <span className="text-xs text-gray-500 font-mono">{lead.customerPhone}</span>
                    {parseProducts(lead.productsInterested).length > 0 && (
                      <span className="text-xs text-gray-400">·</span>
                    )}
                    <span className="text-xs text-indigo-600 truncate">
                      {parseProducts(lead.productsInterested).join(', ')}
                    </span>
                  </div>
                </div>
                {lead.budget > 0 && (
                  <span className="text-xs font-semibold text-green-700 shrink-0">{formatBudget(lead.budget)}</span>
                )}
              </div>
            ))}
          </div>
        </InsightSection>
      )}
    </div>
  );
}

// ── Main Leads Page ───────────────────────────────────────────

export default function Leads() {
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = searchParams.get('tab') || 'insights';
  const listView = searchParams.get('view') || 'table';

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');

  // Filter flap state (pending = in-progress inside the flap; applied = committed)
  const [filterOpen, setFilterOpen] = useState(false);
  const [appliedStatuses, setAppliedStatuses] = useState([]);
  const [appliedSources, setAppliedSources] = useState([]);
  const [pendingStatuses, setPendingStatuses] = useState([]);
  const [pendingSources, setPendingSources] = useState([]);

  const { leads, loading, error, refetch, setLeads } = useLeads();
  const insights = useLeadInsights(leads);

  const totalApplied = appliedStatuses.length + appliedSources.length;

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

  function handleLeadAdded() {
    refetch();
    setAddModalOpen(false);
  }

  async function handleStatusChange(leadId, newStatus) {
    try {
      await updateLead(leadId, { leadStatus: newStatus });
      setLeads(prev => prev.map(l => l.leadId === leadId ? { ...l, leadStatus: newStatus } : l));
    } catch (err) {
      console.error('Status update failed:', err.message);
    }
  }

  async function handleDelete(leadId) {
    if (!window.confirm('Delete this lead? This cannot be undone.')) return;
    try {
      await deleteLead(leadId);
      setLeads(prev => prev.filter(l => l.leadId !== leadId));
    } catch (err) {
      console.error('Delete failed:', err.message);
    }
  }

  const isFiltered = totalApplied > 0 || filterSearch.length > 0;

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
        <button
          onClick={() => setAddModalOpen(true)}
          className="p-2 bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 transition-colors"
          title="Add Lead"
        >
          <Plus size={18} />
        </button>
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
        <InsightsTab insights={insights} />
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
          {(totalApplied > 0 || isFiltered) && (
            <div className="flex flex-wrap items-center gap-2">
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
            />
          ) : (
            <LeadTable
              leads={filteredLeads}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
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

      {addModalOpen && (
        <AddLeadModal
          onClose={() => setAddModalOpen(false)}
          onSaved={handleLeadAdded}
        />
      )}
    </div>
  );
}
