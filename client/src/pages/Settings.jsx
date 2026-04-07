import { useState } from 'react';
import { Settings as SettingsIcon, ChevronDown, ChevronRight, Plus, X, Loader2, AlertTriangle } from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import { addCategorySettingApi, deleteCategorySettingApi, deleteCategoryAllApi } from '../services/api';

export default function Settings() {
  const { categories, categorySubCategories, loading, error, refresh } = useCategories();
  const [expandedCats, setExpandedCats] = useState({});
  const [newCatName, setNewCatName] = useState('');
  const [newSubInputs, setNewSubInputs] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'category'|'sub', category, subCategory? }
  const [actionError, setActionError] = useState('');

  const toggleExpand = (cat) => {
    setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    setSaving(true);
    setActionError('');
    try {
      await addCategorySettingApi({ category: name, subCategory: 'Sub Category 1' });
      setNewCatName('');
      setExpandedCats(prev => ({ ...prev, [name]: true }));
      await refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSubCategory = async (category) => {
    const name = (newSubInputs[category] || '').trim();
    if (!name) return;
    setSaving(true);
    setActionError('');
    try {
      await addCategorySettingApi({ category, subCategory: name });
      setNewSubInputs(prev => ({ ...prev, [category]: '' }));
      await refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubCategory = async (category, subCategory) => {
    setSaving(true);
    setActionError('');
    setDeleteConfirm(null);
    try {
      await deleteCategorySettingApi({ category, subCategory });
      await refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (category) => {
    setSaving(true);
    setActionError('');
    setDeleteConfirm(null);
    try {
      await deleteCategoryAllApi(category);
      await refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-terracotta-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-3">
          <AlertTriangle size={24} className="text-red-500 mx-auto" />
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={refresh} className="text-sm text-terracotta-600 hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-terracotta-50 text-terracotta-600 flex items-center justify-center">
          <SettingsIcon size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">Manage your application preferences</p>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center justify-between">
          {actionError}
          <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* Categories & Sub-Categories */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Categories & Sub-Categories</h2>
          <p className="text-xs text-gray-500 mt-0.5">Define product categories and their sub-categories for inventory</p>
        </div>

        <div className="divide-y divide-gray-100">
          {categories.map(cat => {
            const subs = categorySubCategories[cat] || [];
            const isExpanded = expandedCats[cat];

            return (
              <div key={cat}>
                {/* Category header */}
                <div className="flex items-center gap-2 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <button onClick={() => toggleExpand(cat)} className="flex items-center gap-2 flex-1 text-left">
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                    <span className="text-sm font-medium text-gray-900">{cat}</span>
                    <span className="text-xs text-gray-400">({subs.length} sub-categories)</span>
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ type: 'category', category: cat })}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1"
                    title="Delete category"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Sub-categories */}
                {isExpanded && (
                  <div className="bg-gray-50 px-5 py-3 space-y-2">
                    {subs.map(sub => (
                      <div key={sub} className="flex items-center justify-between py-1.5 px-3 bg-white rounded-lg border border-gray-100">
                        <span className="text-sm text-gray-700">{sub}</span>
                        <button
                          onClick={() => setDeleteConfirm({ type: 'sub', category: cat, subCategory: sub })}
                          className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}

                    {/* Add sub-category input */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={newSubInputs[cat] || ''}
                        onChange={e => setNewSubInputs(prev => ({ ...prev, [cat]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && handleAddSubCategory(cat)}
                        placeholder="New sub-category name"
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 bg-white"
                      />
                      <button
                        onClick={() => handleAddSubCategory(cat)}
                        disabled={saving || !(newSubInputs[cat] || '').trim()}
                        className="px-3 py-1.5 text-xs font-medium bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-40 flex items-center gap-1 transition-colors"
                      >
                        <Plus size={12} /> Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {categories.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No categories defined yet</div>
          )}
        </div>

        {/* Add category */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
              placeholder="New category name"
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 bg-white"
            />
            <button
              onClick={handleAddCategory}
              disabled={saving || !newCatName.trim()}
              className="px-4 py-2 text-sm font-medium bg-terracotta-600 text-white rounded-lg hover:bg-terracotta-700 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add Category
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-sm w-full space-y-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900">Confirm Delete</h3>
            <p className="text-sm text-gray-600">
              {deleteConfirm.type === 'category'
                ? `Are you sure you want to delete "${deleteConfirm.category}" and all its sub-categories? This cannot be undone.`
                : `Delete "${deleteConfirm.subCategory}" from "${deleteConfirm.category}"?`
              }
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => deleteConfirm.type === 'category'
                  ? handleDeleteCategory(deleteConfirm.category)
                  : handleDeleteSubCategory(deleteConfirm.category, deleteConfirm.subCategory)
                }
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
