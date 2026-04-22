import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Pencil, X, Check, Trash2, Phone, Mail,
  Package, IndianRupee, CalendarClock, Target,
  AlertCircle, ExternalLink, ShoppingBag,
} from 'lucide-react';
import { fetchLeadById, updateLead, deleteLead, fetchInventory } from '../services/api';
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

function isFollowUpOverdue(followUpDate) {
  if (!followUpDate) return false;
  const parts = followUpDate.split('/');
  if (parts.length !== 3) return false;
  const d = new Date(parts[2], parts[1] - 1, parts[0]);
  return d < new Date(new Date().setHours(0, 0, 0, 0));
}

export default function LeadDetail() {
  const { leadId } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState(null);
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
      .then(setLead)
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
      followUpDate: lead.followUpDate || '',
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
        followUpDate: editForm.followUpDate,
        budget: editForm.budget ? parseFloat(editForm.budget) : 0,
        notes: editForm.notes,
      };
      const updated = await updateLead(leadId, updates);
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

  function handleCreateOrder() {
    // Store prefill data for the Orders page AddOrderModal
    sessionStorage.setItem('lead_order_prefill', JSON.stringify({
      customerName: lead.customerName,
      customerPhone: lead.customerPhone,
      productName: parseProducts(lead.productsInterested)[0] || '',
      leadId: lead.leadId,
    }));
    navigate('/orders?tab=details&openAdd=1');
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

  return (
    <DetailOverlay fallback="/leads?tab=list" title={lead.customerName}>
    <div className="px-4 sm:px-6 py-6 space-y-6 max-w-4xl mx-auto">

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* Left: customer info */}
          <div className="flex items-start gap-4 min-w-0">
            {/* Avatar */}
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

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <CalendarClock size={14} />
            <span className="text-xs font-medium">Follow-up</span>
          </div>
          {editing ? (
            <input
              type="date"
              defaultValue={
                editForm.followUpDate
                  ? (() => { const p = editForm.followUpDate.split('/'); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : ''; })()
                  : ''
              }
              onChange={e => {
                const v = e.target.value;
                if (!v) { setEditForm(f => ({ ...f, followUpDate: '' })); return; }
                const [y, m, d] = v.split('-');
                setEditForm(f => ({ ...f, followUpDate: `${d}/${m}/${y}` }));
              }}
              className="text-sm border-b border-gray-300 focus:outline-none focus:border-terracotta-500 w-full"
            />
          ) : (
            <p className={`text-lg font-bold ${
              lead.followUpDate
                ? isFollowUpOverdue(lead.followUpDate) ? 'text-red-600' : 'text-gray-900'
                : 'text-gray-300'
            }`}>
              {lead.followUpDate || '—'}
            </p>
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
