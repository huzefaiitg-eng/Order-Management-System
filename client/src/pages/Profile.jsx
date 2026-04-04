import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../services/api';
import { Loader2, Check } from 'lucide-react';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '',
    companyName: user?.companyName || '',
    phone: user?.phone || '',
    address: user?.address || '',
    website: user?.website || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const updated = await updateProfile(form);
      updateUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    { key: 'name', label: 'Full Name' },
    { key: 'companyName', label: 'Company Name' },
    { key: 'email', label: 'Email', disabled: true, value: user?.email },
    { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' },
    { key: 'website', label: 'Website' },
  ];

  return (
    <div className="px-6 py-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Profile</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {fields.map(({ key, label, disabled, value }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type="text"
                value={disabled ? value || '' : form[key]}
                onChange={disabled ? undefined : e => handleChange(key, e.target.value)}
                disabled={disabled}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent ${
                  disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''
                }`}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-terracotta-600 text-white rounded-lg text-sm font-medium hover:bg-terracotta-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <><Loader2 size={16} className="animate-spin" /> Saving...</>
            ) : saved ? (
              <><Check size={16} /> Saved!</>
            ) : (
              'Save Changes'
            )}
          </button>
        </form>

        <p className="mt-6 text-xs text-gray-400 text-center">
          Forgot your username or password? Contact admin at{' '}
          <a href="mailto:huzefa.iitg@gmail.com" className="text-terracotta-500 hover:underline">
            huzefa.iitg@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}
