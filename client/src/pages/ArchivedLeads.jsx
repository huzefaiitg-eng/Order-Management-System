import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Search, RefreshCw, Target, Phone, Mail,
  RotateCcw, Trash2, X, Package,
} from 'lucide-react';
import { fetchArchivedLeads, unarchiveLead, deleteLead } from '../services/api';
import { StatusBadge } from './Leads';
import Loader from '../components/Loader';

function parseProducts(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

export default function ArchivedLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // leadId + '_action'

  function load() {
    setLoading(true);
    setError(null);
    fetchArchivedLeads()
      .then(setLeads)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.customerName.toLowerCase().includes(q) ||
      l.customerPhone.includes(q) ||
      l.productsInterested.toLowerCase().includes(q)
    );
  });

  async function handleUnarchive(lead) {
    if (!window.confirm(`Restore "${lead.customerName}" back to the active leads list?`)) return;
    setActionLoading(lead.leadId + '_unarchive');
    try {
      await unarchiveLead(lead.leadId);
      setLeads(prev => prev.filter(l => l.leadId !== lead.leadId));
    } catch (err) {
      alert('Failed to unarchive: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(lead) {
    if (!window.confirm(`Permanently delete "${lead.customerName}"? This cannot be undone and removes the row from the sheet.`)) return;
    setActionLoading(lead.leadId + '_delete');
    try {
      await deleteLead(lead.leadId);
      setLeads(prev => prev.filter(l => l.leadId !== lead.leadId));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5">
      {/* Back link */}
      <Link
        to="/leads"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
      >
        <ArrowLeft size={16} />
        Back to Active Leads
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Archived Leads</h1>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-terracotta-50 text-terracotta-700 rounded-lg hover:bg-terracotta-100 transition-colors font-medium"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {/* Info banner */}
      {!loading && !error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <Target size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            {leads.length} archived lead{leads.length !== 1 ? 's' : ''}.
            Unarchive to restore to the active list, or permanently delete.
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative w-72">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search archived leads…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20"><Loader /></div>
      )}

      {error && (
        <div className="text-center py-12 text-red-500 text-sm">{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Products</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Lead Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(lead => (
                    <tr key={lead.leadId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 truncate max-w-[160px]">{lead.customerName}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                          <Phone size={11} />
                          <span className="font-mono">{lead.customerPhone}</span>
                        </div>
                        {lead.customerEmail && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                            <Mail size={11} />
                            <span className="truncate max-w-[140px]">{lead.customerEmail}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={lead.leadStatus} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">{lead.leadSource || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {parseProducts(lead.productsInterested).slice(0, 2).map((p, i) => (
                            <span key={i} className="text-[11px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium max-w-[90px] truncate">
                              {p}
                            </span>
                          ))}
                          {parseProducts(lead.productsInterested).length > 2 && (
                            <span className="text-[11px] text-gray-400">
                              +{parseProducts(lead.productsInterested).length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{lead.leadDate}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUnarchive(lead)}
                            disabled={!!actionLoading}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
                          >
                            <RotateCcw size={13} />
                            {actionLoading === lead.leadId + '_unarchive' ? 'Restoring…' : 'Unarchive'}
                          </button>
                          <button
                            onClick={() => handleDelete(lead)}
                            disabled={!!actionLoading}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            <Trash2 size={13} />
                            {actionLoading === lead.leadId + '_delete' ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                        {search ? 'No matching archived leads.' : 'No archived leads yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
              {filtered.length} of {leads.length} archived lead{leads.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(lead => (
              <div key={lead.leadId} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{lead.customerName}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5 font-mono">
                      <Phone size={11} />{lead.customerPhone}
                    </div>
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

                <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                  {lead.leadSource && <span>{lead.leadSource}</span>}
                  <span>Added {lead.leadDate}</span>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                  <button
                    onClick={() => handleUnarchive(lead)}
                    disabled={!!actionLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50"
                  >
                    <RotateCcw size={13} />
                    {actionLoading === lead.leadId + '_unarchive' ? 'Restoring…' : 'Unarchive'}
                  </button>
                  <button
                    onClick={() => handleDelete(lead)}
                    disabled={!!actionLoading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                    {actionLoading === lead.leadId + '_delete' ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                {search ? 'No matching archived leads.' : 'No archived leads yet.'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
