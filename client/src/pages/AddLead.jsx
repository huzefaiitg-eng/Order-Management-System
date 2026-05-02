import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Plus, X, CheckCircle, Eye, ListChecks, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { addLead, fetchInventory, fetchCustomers, addCustomer } from '../services/api';
import DetailOverlay from '../components/DetailOverlay';
import ProductLineEditor from '../components/ProductLineEditor';
import CustomerSelector from '../components/CustomerSelector';
import NumberField from '../components/NumberField';
import { LEAD_STATUSES, StatusBadge } from './Leads';

const LEAD_SOURCES = ['WhatsApp', 'Instagram', 'Facebook', 'Referral', 'Walk-in/Offline'];

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500';

function emptyLine(forceCustom = false) {
  return {
    productName: '', productCost: 0, sellingPrice: 0, quantity: 1, articleId: '',
    ...(forceCustom ? { _mode: 'custom' } : {}),
  };
}

export default function AddLead() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasInventoryAccess = !!user?.hasInventoryAccess;

  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '',
    leadStatus: 'New Lead', leadSource: '',
    budget: '', notes: '',
  });

  const [lines, setLines] = useState(() => [emptyLine(!hasInventoryAccess)]);

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [addingNewCustomer, setAddingNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ customerName: '', customerPhone: '', customerAddress: '', customerEmail: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Confirmation step (mirrors AddOrder's pattern)
  const [step, setStep] = useState('form');           // 'form' | 'confirmation'
  const [createdLead, setCreatedLead] = useState(null);

  function resetForm() {
    setForm({
      customerName: '', customerPhone: '', customerEmail: '',
      leadStatus: 'New Lead', leadSource: '',
      budget: '', notes: '',
    });
    setLines([emptyLine(!hasInventoryAccess)]);
    setCreatedLead(null);
    setError('');
    setStep('form');
  }

  useEffect(() => {
    fetchCustomers('', 'Active').then(setCustomers).catch(() => {});
    if (hasInventoryAccess) {
      fetchInventory({ status: 'Active' }).then(setProducts).catch(() => {});
    }
  }, [hasInventoryAccess]);

  const handleCustomerSelect = (c) =>
    setForm(f => ({
      ...f,
      customerName: c.customerName,
      customerPhone: c.customerPhone,
      customerEmail: c.customerEmail || '',
    }));

  async function handleCreateNewCustomer() {
    if (!newCustomer.customerName.trim() || !newCustomer.customerPhone.trim()) {
      setError('Customer name and phone are required.'); return;
    }
    setSavingCustomer(true); setError('');
    try {
      const created = await addCustomer(newCustomer);
      setCustomers(prev => [...prev, created]);
      handleCustomerSelect(created);
      setAddingNewCustomer(false);
      setNewCustomer({ customerName: '', customerPhone: '', customerAddress: '', customerEmail: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingCustomer(false);
    }
  }

  // Totals (estimate; for leads we show pipeline value)
  const pipelineValue = lines.reduce((s, l) => s + (Number(l.sellingPrice) || 0) * (Number(l.quantity) || 1), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      setError('Customer name and phone are required.'); return;
    }
    const validLines = lines.filter(l => l.productName.trim());
    if (validLines.length === 0) {
      setError('Add at least one product of interest.'); return;
    }
    setSaving(true); setError('');
    try {
      const productLines = validLines.map(l => ({
        productName: l.productName.trim(),
        productCost: Number(l.productCost) || 0,
        sellingPrice: Number(l.sellingPrice) || 0,
        quantity: Math.max(1, Math.round(Number(l.quantity) || 1)),
        articleId: l.articleId || '',
      }));
      const saved = await addLead({
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerEmail: form.customerEmail.trim(),
        productLines,
        leadStatus: form.leadStatus,
        leadSource: form.leadSource,
        budget: form.budget ? parseFloat(form.budget) : 0,
        notes: form.notes,
      });
      // Attach the lines we just submitted so the confirmation card can
      // summarise them (the API echoes productLines but this is safer if
      // a network blip drops the payload mid-trip).
      setCreatedLead({ ...saved, productLines: saved.productLines || productLines });
      setStep('confirmation');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Confirmation step ─────────────────────────────────────────
  if (step === 'confirmation' && createdLead) {
    const lineCount    = (createdLead.productLines || []).length;
    const confirmedPV  = (createdLead.productLines || []).reduce(
      (s, l) => s + (Number(l.sellingPrice) || 0) * (Number(l.quantity) || 1),
      0
    );
    return (
      <DetailOverlay fallback="/leads?tab=list" title="Lead Created">
        <div className="p-6 max-w-xl mx-auto space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
              <CheckCircle size={24} className="text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Lead created successfully</h2>
            <p className="text-sm text-gray-500 mt-1">{createdLead.leadId}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div className="px-5 py-3 flex justify-between text-sm">
              <span className="text-gray-500">Customer</span>
              <span className="font-medium text-gray-900">{createdLead.customerName}</span>
            </div>
            <div className="px-5 py-3 flex justify-between text-sm">
              <span className="text-gray-500">Products</span>
              <span className="font-medium text-gray-900 inline-flex items-center gap-1.5">
                <Package size={13} />
                {lineCount} {lineCount === 1 ? 'item' : 'items'}
                {confirmedPV > 0 && <span className="text-gray-400 font-normal">· ₹{confirmedPV.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>}
              </span>
            </div>
            <div className="px-5 py-3 flex justify-between items-center text-sm">
              <span className="text-gray-500">Status</span>
              <StatusBadge status={createdLead.leadStatus} />
            </div>
            {createdLead.leadSource && (
              <div className="px-5 py-3 flex justify-between text-sm">
                <span className="text-gray-500">Source</span>
                <span className="font-medium text-gray-900">{createdLead.leadSource}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => navigate(`/leads/${createdLead.leadId}`)}
              className="w-full px-4 py-2.5 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 flex items-center justify-center gap-2 font-medium"
            >
              <Eye size={16} /> View Lead Details
            </button>
            <button
              onClick={resetForm}
              className="w-full px-4 py-2.5 text-sm border border-terracotta-300 text-terracotta-700 rounded-lg hover:bg-terracotta-50 flex items-center justify-center gap-2 font-medium"
            >
              <Plus size={16} /> Add Another Lead
            </button>
            <button
              onClick={() => navigate('/leads?tab=list')}
              className="w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-2"
            >
              <ListChecks size={14} /> Back to All Leads
            </button>
          </div>
        </div>
      </DetailOverlay>
    );
  }

  // ─── Form step ─────────────────────────────────────────────────
  return (
    <DetailOverlay fallback="/leads?tab=list" title="Add Lead">
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Lead Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Target size={16} className="text-terracotta-600" />
              <h2 className="text-sm font-semibold text-gray-900">Lead Information</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={form.leadStatus}
                  onChange={e => setForm(f => ({ ...f, leadStatus: e.target.value }))}
                  className={inputClass}
                >
                  {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Source</label>
                <select
                  value={form.leadSource}
                  onChange={e => setForm(f => ({ ...f, leadSource: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Select source</option>
                  {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <NumberField
                label="Budget (optional)"
                value={typeof form.budget === 'string' ? (parseFloat(form.budget) || 0) : (form.budget || 0)}
                onChange={(v) => setForm(f => ({ ...f, budget: v }))}
                placeholder="₹"
              />
            </div>
          </div>

          {/* Customer */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Customer</h2>
            {!addingNewCustomer ? (
              <CustomerSelector
                customers={customers}
                selected={form.customerName ? {
                  customerName:  form.customerName,
                  customerPhone: form.customerPhone,
                  customerEmail: form.customerEmail,
                } : null}
                onSelect={handleCustomerSelect}
                onClear={() => setForm(f => ({ ...f, customerName: '', customerPhone: '', customerEmail: '' }))}
                onAddNew={() => { setAddingNewCustomer(true); setError(''); }}
              />
            ) : (
              <div className="border border-terracotta-200 rounded-lg p-3 space-y-3 bg-terracotta-50/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-terracotta-700">New Customer</span>
                  <button type="button" onClick={() => { setAddingNewCustomer(false); setError(''); }}
                    className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                </div>
                <input type="text" value={newCustomer.customerName} onChange={e => setNewCustomer(p => ({ ...p, customerName: e.target.value }))} className={inputClass} placeholder="Name *" />
                <input type="text" value={newCustomer.customerPhone} onChange={e => setNewCustomer(p => ({ ...p, customerPhone: e.target.value }))} className={inputClass} placeholder="Phone *" />
                <input type="text" value={newCustomer.customerEmail} onChange={e => setNewCustomer(p => ({ ...p, customerEmail: e.target.value }))} className={inputClass} placeholder="Email (optional)" />
                <input type="text" value={newCustomer.customerAddress} onChange={e => setNewCustomer(p => ({ ...p, customerAddress: e.target.value }))} className={inputClass} placeholder="Address (optional)" />
                <button type="button" onClick={handleCreateNewCustomer} disabled={savingCustomer}
                  className="w-full px-3 py-2 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50">
                  {savingCustomer ? 'Creating…' : 'Create Customer'}
                </button>
              </div>
            )}
          </div>

          {/* Products of interest */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Products of Interest</h2>
              {!hasInventoryAccess && (
                <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-full">
                  Custom items only
                </span>
              )}
            </div>
            <ProductLineEditor
              lines={lines}
              onChange={setLines}
              inventory={products}
              hasInventoryAccess={hasInventoryAccess}
              sellingPriceLocked={false}
            />
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Notes</h2>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className={`${inputClass} min-h-[90px]`}
              placeholder="Conversation history, preferences, etc."
            />
          </div>

          {/* Pipeline value summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex justify-between text-sm">
            <span className="text-gray-500">Pipeline value (est.)</span>
            <span className="font-semibold text-gray-900">₹{pipelineValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pb-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-sm bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-50 font-medium flex items-center gap-2"
            >
              {saving ? 'Saving…' : <><Plus size={16} /> Create Lead</>}
            </button>
          </div>
        </form>
      </div>
    </DetailOverlay>
  );
}
