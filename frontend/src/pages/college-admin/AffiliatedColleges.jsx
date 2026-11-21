import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';
import DataTable from '../../components/DataTable';
import { useAuth } from '../../context/AuthContext';

// Colleges affiliated with this university. Exam enrolments pick from this list.
const EMPTY = { code: '', name: '', city: '' };

export default function AffiliatedColleges() {
  const { hasPrv } = useAuth();
  const canAdd = hasPrv('affiliated-colleges.store');
  const canEdit = hasPrv('affiliated-colleges.update');
  const canDelete = hasPrv('affiliated-colleges.destroy');

  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);

  const reload = () => setRefreshKey((k) => k + 1);
  const resetForm = () => { setForm(EMPTY); setEditingId(null); setErrors({}); };

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setForm({ code: c.code, name: c.name, city: c.city ?? '' });
    setErrors({});
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const payload = { code: form.code, name: form.name, city: form.city || null };
    try {
      if (editingId) {
        await api.put(`/affiliated-colleges/${editingId}`, payload);
        toast.success('College updated.');
      } else {
        await api.post('/affiliated-colleges', payload);
        toast.success('College added.');
      }
      resetForm();
      reload();
    } catch (err) {
      if (err.response?.status === 422) setErrors(err.response.data.errors ?? {});
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c) => {
    try {
      await api.put(`/affiliated-colleges/${c.id}`, { code: c.code, name: c.name, city: c.city, is_active: !c.is_active });
      reload();
    } catch { /* api.js shows the error */ }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.code} ${c.name}?`)) return;
    try {
      await api.delete(`/affiliated-colleges/${c.id}`);
      toast.success('College deleted.');
      if (editingId === c.id) resetForm();
      reload();
    } catch (err) {
      if (err.response?.status === 422) toast.error(err.response.data.message);
    }
  };

  const columns = [
    { key: 'code', label: 'Code', sortable: true,
      render: (c) => <span className="font-mono text-gray-900">{c.code}</span> },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'city', label: 'City', sortable: true, render: (c) => c.city || '—' },
    { key: 'is_active', label: 'Status', sortable: true,
      csv: (c) => (c.is_active ? 'Active' : 'Inactive'),
      render: (c) => (
        <button type="button" disabled={!canEdit} onClick={() => toggleActive(c)}
          title={canEdit ? 'Click to change' : undefined}
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active
            ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {c.is_active ? 'Active' : 'Inactive'}
        </button>
      ) },
  ];

  const actions = (canEdit || canDelete) ? (c) => (
    <>
      {canEdit && (
        <button type="button" onClick={() => startEdit(c)} className="text-indigo-600 hover:underline">Edit</button>
      )}
      {canDelete && (
        <button type="button" onClick={() => remove(c)} className="text-red-600 hover:underline">Delete</button>
      )}
    </>
  ) : undefined;

  const fieldErr = (k) => errors[k]?.[0];
  const inputCls = (k) => `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
    fieldErr(k) ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`;

  return (
    <div className="space-y-6">
      <DataTable
        title="Affiliated Colleges"
        endpoint="/affiliated-colleges"
        columns={columns}
        actions={actions}
        refreshKey={refreshKey}
        csvName="affiliated-colleges"
      />

      {(editingId ? canEdit : canAdd) && (
        <form ref={formRef} onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-4 max-w-4xl">
          <h2 className="font-semibold text-gray-900">{editingId ? 'Edit college' : 'Add a college'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
              <input value={form.code} onChange={set('code')} placeholder="120" maxLength={20} className={inputCls('code')} />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input value={form.name} onChange={set('name')} placeholder="Govt. Degree College, Hyderabad" maxLength={191} className={inputCls('name')} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
              <input value={form.city} onChange={set('city')} placeholder="Hyderabad" maxLength={100} className={inputCls('city')} />
            </div>
          </div>
          {['code', 'name', 'city'].map((k) => fieldErr(k) && (
            <p key={k} className="text-xs text-red-600">{fieldErr(k)}</p>
          ))}
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add college'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
