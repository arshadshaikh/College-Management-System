import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';

const EMPTY = { college_id: '', name: '', cnic_no: '', email: '', phone: '', password: '', is_active: true };

export default function CollegeAdminForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [colleges, setColleges] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // Approved colleges for the dropdown (create only).
  useEffect(() => {
    if (isEdit) return;
    api.get('/colleges', { params: { per_page: 1000, status: 'approved' } })
      .then(({ data }) => setColleges(data.data ?? data))
      .catch(() => {});
  }, [isEdit]);

  // Edit: load the admin (fetch list, find by id — no single-show endpoint).
  useEffect(() => {
    if (!isEdit) return;
    api.get('/college-admins')
      .then(({ data }) => {
        const rows = data.data ?? data;
        const u = rows.find((r) => String(r.id) === String(id));
        if (!u) { toast.error('Admin not found.'); return; }
        setForm({
          college_id: u.college_id ?? '',
          name: u.name ?? '',
          cnic_no: u.cnic_no ?? '',
          email: u.email ?? '',
          phone: u.phone ?? '',
          password: '',
          is_active: u.is_active ?? true,
        });
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      if (isEdit) {
        // Don't send an empty password on edit.
        const payload = { name: form.name, email: form.email, phone: form.phone, is_active: form.is_active };
        if (form.password) payload.password = form.password;
        await api.put(`/college-admins/${id}`, payload);
        toast.success('Admin updated.');
      } else {
        await api.post('/college-admins', form);
        toast.success('College admin created.');
      }
      navigate('/college-admins');
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
        const msg = err.response.data.message;
        if (msg && !err.response.data.errors) toast.error(msg);   // e.g. "college not approved"
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const inputCls = (err) =>
    `w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
      err ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'
    }`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to="/college-admins" className="text-sm text-gray-500 hover:underline">← College Admins</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{isEdit ? 'Edit' : 'Add'} College Admin</h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">College <span className="text-red-500">*</span></label>
            <select value={form.college_id} onChange={set('college_id')} className={inputCls(errors.college_id)}>
              <option value="">Choose an approved college…</option>
              {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.college_id && <p className="text-xs text-red-600 mt-1">{errors.college_id[0]}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={set('name')} className={inputCls(errors.name)} />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name[0]}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CNIC <span className="text-red-500">*</span></label>
            <input type="text" value={form.cnic_no} onChange={set('cnic_no')} maxLength={13}
              disabled={isEdit} className={inputCls(errors.cnic_no)} />
            {errors.cnic_no && <p className="text-xs text-red-600 mt-1">{errors.cnic_no[0]}</p>}
            {isEdit && <p className="text-xs text-gray-400 mt-1">CNIC can't be changed.</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={set('email')} className={inputCls(errors.email)} />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email[0]}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="text" value={form.phone} onChange={set('phone')} className={inputCls(errors.phone)} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password {isEdit ? <span className="font-normal text-gray-400">(leave blank to keep current)</span> : <span className="text-red-500">*</span>}
          </label>
          <input type="password" value={form.password} onChange={set('password')} className={inputCls(errors.password)} />
          {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password[0]}</p>}
          <p className="text-xs text-gray-400 mt-1">Min 8 chars, mixed case, with numbers.</p>
        </div>

        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
              Active (can log in)
          </label>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
          <Link to="/college-admins" className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}