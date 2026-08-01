import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { DOCUMENT_SCOPES, DEFAULT_SCOPE } from '../../config/documentScopes';

const MIME_OPTIONS = [
  { value: 'image/jpeg',      label: 'JPG image' },
  { value: 'image/png',       label: 'PNG image' },
  { value: 'application/pdf', label: 'PDF document' },
];

const EMPTY = {
  scope: DEFAULT_SCOPE,
  name: '', is_mandatory: true, is_active: true, sort_order: 0,
  allowed_mime_types: ['image/jpeg', 'image/png', 'application/pdf'],
  max_size_mb: 4, max_dimension: '',
};

export default function DocumentTypeForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scopeFromUrl = searchParams.get('scope') || DEFAULT_SCOPE;

  const [form, setForm] = useState({ ...EMPTY, scope: scopeFromUrl });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    // No single-show endpoint; fetch all types and find this one (across any scope).
    api.get('/required-document-types')
      .then(({ data }) => {
        const rows = data.data ?? data;
        const d = rows.find((r) => String(r.id) === String(id));
        if (!d) { toast.error('Document type not found.'); return; }
        setForm({
          scope: d.scope,
          name: d.name,
          is_mandatory: d.is_mandatory,
          is_active: d.is_active,
          sort_order: d.sort_order ?? 0,
          allowed_mime_types: (d.allowed_mime_types || '').split(',').filter(Boolean),
          max_size_mb: d.max_size_kb ? Math.round(d.max_size_kb / 1024) : 4,
          max_dimension: d.max_dimension ?? '',
        });
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const toggleMime = (value) => {
    setForm((f) => ({
      ...f,
      allowed_mime_types: f.allowed_mime_types.includes(value)
        ? f.allowed_mime_types.filter((m) => m !== value)
        : [...f.allowed_mime_types, value],
    }));
    setErrors((e) => ({ ...e, allowed_mime_types: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.allowed_mime_types.length === 0) {
      setErrors({ allowed_mime_types: ['Select at least one file type.'] });
      return;
    }
    setSaving(true);
    setErrors({});

    const payload = {
      name: form.name,
      is_mandatory: form.is_mandatory,
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 0,
      allowed_mime_types: form.allowed_mime_types.join(','),
      max_size_kb: (Number(form.max_size_mb) || 4) * 1024,
      max_dimension: form.max_dimension ? Number(form.max_dimension) : null,
    };
    // Scope is set on create only; on edit it stays fixed (like the slug).
    if (!isEdit) payload.scope = form.scope;

    try {
      if (isEdit) {
        await api.put(`/required-document-types/${id}`, payload);
        toast.success('Document type updated.');
      } else {
        await api.post('/required-document-types', payload);
        toast.success('Document type created.');
      }
      navigate('/document-types');
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
        toast.error('Please fix the highlighted fields.');
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

  const scopeLabel = DOCUMENT_SCOPES.find((s) => s.value === form.scope)?.label ?? form.scope;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to="/document-types" className="text-sm text-gray-500 hover:underline">← Document Types</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{isEdit ? 'Edit' : 'Add'} Document Type</h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
          <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
            {scopeLabel}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Document Name <span className="text-red-500">*</span></label>
          <input type="text" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErrors((er) => ({ ...er, name: undefined })); }}
            placeholder="e.g. Registration Certificate" className={inputCls(errors.name)} />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name[0]}</p>}
          {isEdit && <p className="text-xs text-gray-400 mt-1">The internal slug is fixed once created and won't change.</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Allowed File Types <span className="text-red-500">*</span></label>
          <div className="flex flex-wrap gap-4">
            {MIME_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.allowed_mime_types.includes(opt.value)}
                  onChange={() => toggleMime(opt.value)} className="rounded" />
                {opt.label}
              </label>
            ))}
          </div>
          {errors.allowed_mime_types && <p className="text-xs text-red-600 mt-1">{errors.allowed_mime_types[0]}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Size (MB)</label>
            <input type="number" min="1" max="20" value={form.max_size_mb}
              onChange={(e) => setForm({ ...form, max_size_mb: e.target.value })} className={inputCls(errors.max_size_kb)} />
            {errors.max_size_kb && <p className="text-xs text-red-600 mt-1">{errors.max_size_kb[0]}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Dimension (px, images)</label>
            <input type="number" min="1" value={form.max_dimension}
              onChange={(e) => setForm({ ...form, max_dimension: e.target.value })}
              placeholder="e.g. 1200 (blank = no limit)" className={inputCls(errors.max_dimension)} />
            {errors.max_dimension && <p className="text-xs text-red-600 mt-1">{errors.max_dimension[0]}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
            <input type="number" min="0" value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className={inputCls()} />
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.is_mandatory} onChange={(e) => setForm({ ...form, is_mandatory: e.target.checked })} className="rounded" />
            Mandatory
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
            Active
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
          <Link to="/document-types" className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}