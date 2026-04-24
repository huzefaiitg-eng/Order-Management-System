import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Pencil, X, Check, Trash2, Phone, Mail,
  Package, IndianRupee, CalendarClock, Target,
  AlertCircle, ExternalLink, ShoppingBag, Plus,
  CheckCircle2, Clock, Archive,
} from 'lucide-react';
import {
  fetchLeadById, updateLead, deleteLead, archiveLead, fetchInventory,
  addLeadFollowUp, markLeadFollowUpDone,
} from '../services/api';
import { StatusBadge, LEAD_STATUSES, STATUS_CONFIG } from './Leads';
import SearchableDropdown from '../components/SearchableDropdown';
import DetailOverlay from '../components/DetailOverlay';
import Loader from '../components/Loader';

const LEAD_SOURCES_LIST = ['WhatsApp', 'Instagram', 'Facebook', 'Referral', 'Walk-in/Offline'];

function parseProducts(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

function formatBudget(v) {
  if (!v) return '—';
  return `₹${Number(v).toLocaleString('en-IN')}`;
}

function isFollowUpOverdue(dateStr) {
  if (!dateStr) return false;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return false;
  const d = new Date(parts[2], parts[1] - 1, parts[0]);
  return d < new Date(new Date().setHours(0, 0, 0, 0));
}

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Sort follow-ups: pending first (by date asc), then done (by date desc). */
function sortFollowUps(fus) {
  const pending = fus.filter(f => f.happened !== 'Yes').sort((a, b) => {
    const da = parseFuDate(a.scheduledDate);
    const db = parseFuDate(b.scheduledDate);
    if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
    return da - db;
  });
  const done = fus.filter(f => f.happened === 'Yes').sort((a, b) => {
    const da = parseFuDate(a.scheduledDate);
    const db = parseFuDate(b.scheduledDate);
    if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
    return db - da; // newest done first
  });
  return [...pending, ...done];
}

function parseFuDate(str) {
  if (!str) return null;
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map(Number);
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(yyyy, mm - 1, dd);
  d.setHours(0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

// ── FollowUpSection ──────────────────────────────────────────────

function FollowUpSection({ leadId, followUps, onFollowUpsChange, disabled }) {
  const [scheduling, setScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');       // YYYY-MM-DD (HTML date input)
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  const [expandedId, setExpandedId] = useState(null);         // followUpId open for "mark done"
  const [remarksText, setRemarksText] = useState('');
  const [savingDone, setSavingDone] = useState(false);

  const sorted = sortFollowUps(followUps);

  async function handleSchedule() {
    if (!scheduleDate) { setScheduleError('Please pick a date.'); return; }
    const [y, m, d] = scheduleDate.split('-');
    const ddmmyyyy = `${d}/${m}/${y}`;
    setSavingSchedule(true);
    setScheduleError('');
    try {
      const newFu = await addLeadFollowUp(leadId, { scheduledDate: ddmmyyyy });
      onFollowUpsChange(sortFollowUps([...followUps, newFu]));
      setScheduling(false);
      setScheduleDate('');
    } catch (err) {
      setScheduleError(err.message);
    } finally {
      setSavingSchedule(false);
    }
  }

  async function handleMarkDone(followUpId) {
    setSavingDone(true);
    try {
      const updated = await markLeadFollowUpDone(leadId, followUpId, { remarks: remarksText });
      onFollowUpsChange(sortFollowUps(followUps.map(f => f.followUpId === followUpId ? updated : f)));
      setExpandedId(null);
      setRemarksText('');
    } catch (err) {
      alert('Failed to mark follow-up done: ' + err.message);
    } finally {
      setSavingDone(false);
    }
  }

  function openMarkDone(id) {
    if (expandedId === id) { setExpandedId(null); setRemarksText(''); return; }
    setExpandedId(id);
    setRemarksText('');
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-amber-600" />
          <h3 className="text-sm font-semibold text-gray-900">Follow-ups</h3>
          {followUps.length > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
              {followUps.length}
            </span>
          )}
        </div>
        {!disabled && (
          <button
            onClick={() => { setScheduling(s => !s); setScheduleError(''); setScheduleDate(''); }}
            className="flex items-center gap-1.5 text-xs font-medium text-terracotta-600 hover:text-terracotta-700 border border-terracotta-200 bg-terracotta-50 px-2.5 py-1.5 rounded-lg hover:bg-terracotta-100 transition-colors"
          >
            <Plus size={13} />
            Schedule Follow-up
          </button>
        )}
      </div>

      {/* Schedule panel */}
      {scheduling && (
        <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/40">
          <p className="text-xs font-medium text-gray-700 mb-2">Pick a date for the follow-up:</p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={scheduleDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => { setScheduleDate(e.target.value); setScheduleError(''); }}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500"
            />
            <button
              onClick={handleSchedule}
              disabled={savingSchedule}
              className="px-3 py-1.5 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50 font-medium"
            >
              {savingSchedule ? 'Saving…' : 'Confirm'}
            </button>
            <button
              onClick={() => { setScheduling(false); setScheduleDate(''); setScheduleError(''); }}
              className="px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
          {scheduleError && (
            <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
              <AlertCircle size={12} /> {scheduleError}
            </p>
          )}
        </div>
      )}

      {/* List */}
      {sorted.length === 0 ? (
        <div className="px-5 py-6 text-center text-sm text-gray-400">
          <CalendarClock size={24} className="mx-auto mb-2 text-gray-200" />
          No follow-ups yet.{!disabled && ' Click "Schedule Follow-up" to add one.'}
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {sorted.map(fu => {
            const isDone = fu.happened === 'Yes';
            const isOverdue = !isDone && isFollowUpOverdue(fu.scheduledDate);
            const isToday = !isDone && fu.scheduledDate === todayStr();
            const isExpanded = expandedId === fu.followUpId;

            return (
              <div key={fu.followUpId} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Status icon */}
                    {isDone ? (
                      <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <Clock size={16} className={`mt-0.5 shrink-0 ${isOverdue ? 'text-red-500' : isToday ? 'text-amber-500' : 'text-gray-400'}`} />
                    )}
                    <div className="min-w-0">
                      <span className={`text-sm font-medium ${
                        isDone ? 'text-gray-400 line-through' :
                        isOverdue ? 'text-red-600' :
                        isToday  ? 'text-amber-700' :
                        'text-gray-800'
                      }`}>
                        {fu.scheduledDate}
                        {isOverdue && <span className="ml-1.5 text-xs font-normal text-red-500">(overdue)</span>}
                        {isToday   && <span className="ml-1.5 text-xs font-normal text-amber-600">(today)</span>}
                      </span>
                      {isDone && (
                        <span className="ml-2 text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                          Done
                        </span>
                      )}
                      {fu.remarks && (
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{fu.remarks}</p>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  {!isDone && !disabled && (
                    <button
                      onClick={() => openMarkDone(fu.followUpId)}
                      className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                        isExpanded
                          ? 'bg-gray-100 border-gray-200 text-gray-600'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {isExpanded ? 'Cancel' : 'Mark as Done'}
                    </button>
                  )}
                </div>

                {/* Mark done panel */}
                {isExpanded && !isDone && (
                  <div className="mt-2 ml-7 space-y-2">
                    <textarea
                      rows={2}
                      value={remarksText}
                      onChange={e => setRemarksText(e.target.value)}
                      placeholder="Remarks (optional) — what happened in this follow-up?"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 resize-none"
                    />
                    <button
                      onClick={() => handleMarkDone(fu.followUpId)}
                      disabled={savingDone}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                    >
                      <CheckCircle2 size={14} />
                      {savingDone ? 'Saving…' : 'Confirm — Mark Done'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── LeadDetail ────────────────────────────────────────────────────

export default function LeadDetail() {
  const { leadId } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState(null);
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [products, setProducts] = useState([]);

  // Status inline change
  const [statusChanging, setStatusChanging] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchLeadById(leadId)
      .then(data => {
        setLead(data);
        setFollowUps(sortFollowUps(data.followUps || []));
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => {
    if (editing) {
      fetchInventory({ status: 'Active' }).then(setProducts).catch(() => {});
    }
  }, [editing]);

  function startEditing() {
    setEditForm({
      customerName: lead.customerName,
      customerPhone: lead.customerPhone,
      customerEmail: lead.customerEmail || '',
      selectedProducts: parseProducts(lead.productsInterested).map(name => ({ productName: name, articleId: name })),
      leadStatus: lead.leadStatus,
      leadSource: lead.leadSource || '',
      budget: lead.budget || '',
      notes: lead.notes || '',
    });
    setEditing(true);
    setEditError('');
  }

  function cancelEditing() {
    setEditing(false);
    setEditError('');
  }

  async function handleSave() {
    if (!editForm.customerName || !editForm.customerPhone) {
      setEditError('Name and phone are required.');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      const updates = {
        customerName: editForm.customerName.trim(),
        customerPhone: editForm.customerPhone.trim(),
        customerEmail: editForm.customerEmail.trim(),
        productsInterested: editForm.selectedProducts.map(p => p.productName).join(','),
        leadStatus: editForm.leadStatus,
        leadSource: editForm.leadSource,
        budget: editForm.budget ? parseFloat(editForm.budget) : 0,
        notes: editForm.notes,
      };
      await updateLead(leadId, updates);
      setLead(prev => ({ ...prev, ...updates }));
      setEditing(false);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus) {
    if (statusChanging) return;
    setStatusChanging(true);
    try {
      await updateLead(leadId, { leadStatus: newStatus });
      setLead(prev => ({ ...prev, leadStatus: newStatus }));
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    } finally {
      setStatusChanging(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this lead? This cannot be undone.')) return;
    try {
      await deleteLead(leadId);
      navigate('/leads?tab=list');
    } catch (err) {
      alert('Failed to delete lead: ' + err.message);
    }
  }

  async function handleArchive() {
    if (!window.confirm('Archive this lead? You can restore it from the Archived Leads page.')) return;
    try {
      await archiveLead(leadId);
      navigate('/leads?tab=list');
    } catch (err) {
      alert('Failed to archive lead: ' + err.message);
    }
  }

  function handleCreateOrder() {
    navigate('/orders?tab=details&openAdd=1', {
      state: {
        prefill: {
          customerName: lead.customerName,
          customerPhone: lead.customerPhone,
          productName: parseProducts(lead.productsInterested)[0] || '',
          leadId: lead.leadId,
        },
      },
    });
  }

  if (loading) return (
    <DetailOverlay fallback="/leads?tab=list"><div className="flex items-center justify-center py-24"><Loader /></div></DetailOverlay>
  );

  if (error) return (
    <DetailOverlay fallback="/leads?tab=list"><div className="px-6 py-12 text-center text-red-500 text-sm">{error}</div></DetailOverlay>
  );

  if (!lead) return null;

  const cfg = STATUS_CONFIG[lead.leadStatus] || STATUS_CONFIG['New Lead'];
  const productList = parseProducts(lead.productsInterested);

  // Next pending follow-up
  const nextPendingFu = followUps.find(f => f.happened !== 'Yes');
  const isDisabled = lead.leadStatus === 'Converted' || lead.leadStatus === 'Lost';

  return (
    <DetailOverlay fallback="/leads?tab=list" title={lead.customerName}>
    <div className="px-4 sm:px-6 py-6 space-y-6 max-w-4xl mx-auto">

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* Left: customer info */}
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-full bg-terracotta-100 text-terracotta-700 font-bold text-lg flex items-center justify-center shrink-0">
              {lead.customerName?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              {editing ? (
                <input
                  value={editForm.customerName}
                  onChange={e => setEditForm(f => ({ ...f, customerName: e.target.value }))}
                  className="text-xl font-bold text-gray-900 border-b-2 border-terracotta-500 focus:outline-none w-full max-w-xs"
                />
              ) : (
                <h1 className="text-xl font-bold text-gray-900">{lead.customerName}</h1>
              )}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Phone size={14} />
                  {editing ? (
                    <input
                      value={editForm.customerPhone}
                      onChange={e => setEditForm(f => ({ ...f, customerPhone: e.target.value }))}
                      className="text-sm border-b border-gray-300 focus:outline-none focus:border-terracotta-500 w-32"
                    />
                  ) : (
                    <span className="font-mono">{lead.customerPhone}</span>
                  )}
                </div>
                {(lead.customerEmail || editing) && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Mail size={14} />
                    {editing ? (
                      <input
                        value={editForm.customerEmail}
                        onChange={e => setEditForm(f => ({ ...f, customerEmail: e.target.value }))}
                        placeholder="email (optional)"
                        className="text-sm border-b border-gray-300 focus:outline-none focus:border-terracotta-500 w-40"
                      />
                    ) : (
                      <span>{lead.customerEmail}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            {editing ? (
              <>
                <button onClick={cancelEditing} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                  <X size={18} />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50"
                >
                  <Check size={16} />
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={startEditing}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  <Pencil size={15} />
                  Edit
                </button>
                <button
                  onClick={handleArchive}
                  className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                  title="Archive lead"
                >
                  <Archive size={18} />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete lead"
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">{lead.leadId}</span>
          {editing ? (
            <select
              value={editForm.leadStatus}
              onChange={e => setEditForm(f => ({ ...f, leadStatus: e.target.value }))}
              className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            >
              {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <StatusBadge status={lead.leadStatus} />
          )}
          {editing ? (
            <select
              value={editForm.leadSource}
              onChange={e => setEditForm(f => ({ ...f, leadSource: e.target.value }))}
              className="text-xs border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-terracotta-500"
            >
              <option value="">Select source</option>
              {LEAD_SOURCES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : lead.leadSource && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-medium">{lead.leadSource}</span>
          )}
          <span className="text-xs text-gray-400 ml-auto">Added {lead.leadDate}</span>
        </div>

        {editError && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-600">{editError}</p>
          </div>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <IndianRupee size={14} />
            <span className="text-xs font-medium">Budget</span>
          </div>
          {editing ? (
            <input
              type="number"
              min="0"
              value={editForm.budget}
              onChange={e => setEditForm(f => ({ ...f, budget: e.target.value }))}
              className="text-lg font-bold text-gray-900 border-b border-gray-300 focus:outline-none focus:border-terracotta-500 w-full"
              placeholder="0"
            />
          ) : (
            <p className="text-lg font-bold text-gray-900">{formatBudget(lead.budget)}</p>
          )}
        </div>

        {/* Next Follow-up (read-only — scheduling happens in FollowUpSection) */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <CalendarClock size={14} />
            <span className="text-xs font-medium">Next Follow-up</span>
          </div>
          {nextPendingFu ? (
            <p className={`text-lg font-bold ${
              isFollowUpOverdue(nextPendingFu.scheduledDate) ? 'text-red-600' :
              nextPendingFu.scheduledDate === todayStr() ? 'text-amber-600' :
              'text-gray-900'
            }`}>
              {nextPendingFu.scheduledDate}
            </p>
          ) : (
            <p className="text-sm text-gray-300 mt-1">—</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Target size={14} />
            <span className="text-xs font-medium">Status</span>
          </div>
          <div className="mt-1">
            <StatusBadge status={lead.leadStatus} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <ShoppingBag size={14} />
            <span className="text-xs font-medium">Order</span>
          </div>
          {lead.convertedOrderRow ? (
            <Link
              to={`/orders/${lead.convertedOrderRow}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-terracotta-600 hover:underline"
            >
              View Order <ExternalLink size={12} />
            </Link>
          ) : (
            <p className="text-sm text-gray-400">Not converted</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Products Interested */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Package size={16} className="text-indigo-500" />
            Products Interested
          </h3>
          {editing ? (
            <SearchableDropdown
              placeholder="Search inventory…"
              items={products}
              displayFn={p => p.productName}
              keyFn={p => p.articleId || p.productName}
              multi
              selected={editForm.selectedProducts}
              onChange={sel => setEditForm(f => ({ ...f, selectedProducts: sel }))}
              chipClassName="bg-indigo-50 text-indigo-700"
            />
          ) : productList.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {productList.map((name, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">
                  <Package size={13} />
                  {name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No products listed</p>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Notes</h3>
          {editing ? (
            <textarea
              rows={4}
              value={editForm.notes}
              onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 resize-none"
              placeholder="Conversation history, preferences…"
            />
          ) : lead.notes ? (
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{lead.notes}</p>
          ) : (
            <p className="text-sm text-gray-400">No notes yet</p>
          )}
        </div>
      </div>

      {/* ── Follow-up Section ── */}
      <FollowUpSection
        leadId={lead.leadId}
        followUps={followUps}
        onFollowUpsChange={setFollowUps}
        disabled={isDisabled}
      />

      {/* Conversion section */}
      {lead.leadStatus === 'Converted' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <ShoppingBag size={18} className="text-green-700" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-green-900">Lead Converted</h3>
              {lead.convertedOrderRow ? (
                <div className="mt-2">
                  <p className="text-xs text-green-700 mb-2">This lead has been linked to an order.</p>
                  <Link
                    to={`/orders/${lead.convertedOrderRow}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium"
                  >
                    View Linked Order <ExternalLink size={14} />
                  </Link>
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-xs text-green-700 mb-3">
                    Create an order in OMS for this customer. The form will be pre-filled with their details.
                  </p>
                  <button
                    onClick={handleCreateOrder}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 font-medium"
                  >
                    <ShoppingBag size={15} />
                    Create Order in OMS
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick status change (not in edit mode) */}
      {!editing && lead.leadStatus !== 'Converted' && lead.leadStatus !== 'Lost' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Move to Next Stage</h3>
          <div className="flex flex-wrap gap-2">
            {LEAD_STATUSES.filter(s => s !== lead.leadStatus).map(s => {
              const c = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={statusChanging}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${c.bg} ${c.text} ${c.border} hover:opacity-80 disabled:opacity-50`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
    </DetailOverlay>
  );
}
