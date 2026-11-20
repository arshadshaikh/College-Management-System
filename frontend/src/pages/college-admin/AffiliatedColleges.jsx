import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

// Colleges affiliated with this university. Exam enrolments pick from this list.
const EMPTY = { code: '', name: '', city: '' };

export default function AffiliatedColleges() {
  const { hasPrv } = useAuth();
  const canAdd = hasPrv('affiliated-colleges.store');
  const canEdit = hasPrv('affiliated-colleges.update');
  const canDelete = hasPrv('affiliated-colleges.destroy');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (page = 1) => {
    try {
      const { data } = await api.get('/affiliated-colleges', { params: { page, search: search || undefined } });
      setRows(data.data ?? []);
      setMeta({ current_page: data.current_page, last_page: data.last_page, total: data.total });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
  }, [load]);

  const resetForm = () => { setForm(EMPTY); setEditingId(null); setErrors({}); };

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setForm({ code: c.code, name: c.name, city: c.city ?? '' });
    setErrors({});
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
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
      load(meta.current_page || 1);
    } catch (err) {
      if (err.response?.status === 422) setErrors(err.response.data.errors ?? {});
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c) => {
    try {
      await api.put(`/affiliated-colleges/${c.id}`, { code: c.code, name: c.name, city: c.city, is_active: !c.is_active });
      load(meta.current_page || 1);
    } catch { /* api.js shows the error */ }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.code} ${c.name}?`)) return;
    try {
      await api.delete(`/affiliated-colleges/${c.id}`);
      toast.success('College deleted.');
      if (editingId === c.id) resetForm();
      load(meta.current_page || 1);
    } catch (err) {
      if (err.response?.status === 422) toast.error(err.response.data.message);
    }
  };

  const fieldErr = (k) => errors[k]?.[0];
  const inputCls = (k) => `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
    fieldErr(k) ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Affiliated Colleges</h1>
        <p className="text-sm text-gray-500">Colleges affiliated with the university. Exam enrolments and challans use this list.</p>
      </div>

      <div className="flex items-center gap-3">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search code, name or city…"
          className="flex-1 max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <span className="ml-auto text-sm text-gray-500">{meta.total ?? 0} college(s)</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        {loading ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            {search ? 'No college matches your search.' : 'No affiliated colleges yet. Add the first one below.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="px-6 py-3 font-medium">Code</th>
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">City</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((c) => (
                <tr key={c.id} className={editingId === c.id ? 'bg-indigo-50' : ''}>
                  <td className="px-6 py-3 font-mono text-gray-900">{c.code}</td>
                  <td className="px-3 py-3 text-gray-800">{c.name}</td>
                  <td className="px-3 py-3 text-gray-600">{c.city || '—'}</td>
                  <td className="px-3 py-3">
                    <button type="button" disabled={!canEdit} onClick={() => toggleActive(c)}
                      title={canEdit ? 'Click to change' : undefined}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active
                        ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-3 text-right whitespace-nowrap">
                    {canEdit && (
                      <button type="button" onClick={() => startEdit(c)}
                        className="px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded-lg">Edit</button>
                    )}
                    {canDelete && (
                      <button type="button" onClick={() => remove(c)}
                        className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {meta.last_page > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {meta.current_page} of {meta.last_page}</p>
            <div className="flex gap-2">
              <button onClick={() => load(meta.current_page - 1)} disabled={meta.current_page <= 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40">Previous</button>
              <button onClick={() => load(meta.current_page + 1)} disabled={meta.current_page >= meta.last_page}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {(editingId ? canEdit : canAdd) && (
        <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
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
