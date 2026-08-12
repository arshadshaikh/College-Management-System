import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';
import Toggle from '../../components/Toggle';

const EMPTY = {
  label: '', link_type: 'none', url: '', page_id: '',
  parent_id: '', sort_order: 0, is_active: true,
};

export default function CmsMenuForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [pages, setPages] = useState([]);
  const [parents, setParents] = useState([]);   // flat list of possible parents
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // Load CMS pages (for the page-link dropdown) and the menu tree (for parent options).
  useEffect(() => {
    api.get('/cms/pages', { params: { per_page: 100 } })
      .then(({ data }) => setPages(data.data ?? data)).catch(() => {});
    api.get('/cms/menus')
      .then(({ data }) => {
        const tree = Array.isArray(data) ? data : (data.data ?? []);
        // Flatten top-level items as candidate parents (one level of nesting).
        setParents(tree.map((t) => ({ id: t.id, label: t.label })));
      }).catch(() => {});
  }, []);

  // Edit: fetch the item.
  useEffect(() => {
    if (!isEdit) return;
    api.get(`/cms/menus/${id}`)
      .then(({ data }) => setForm({
        label: data.label ?? '',
        link_type: data.page_id ? 'page' : (data.url ? 'url' : 'none'),
        url: data.url ?? '',
        page_id: data.page_id ?? '',
        parent_id: data.parent_id ?? '',
        sort_order: data.sort_order ?? 0,
        is_active: data.is_active,
      }))
      .catch(() => toast.error('Could not load menu item.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (key) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: val }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    // Build payload: only one of url/page_id, based on link_type.
    const payload = {
      label: form.label,
      parent_id: form.parent_id || null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
      url: form.link_type === 'url' ? form.url : null,
      page_id: form.link_type === 'page' ? (form.page_id || null) : null,
    };

    try {
      if (isEdit) {
        await api.put(`/cms/menus/${id}`, payload);
        toast.success('Menu item updated.');
      } else {
        await api.post('/cms/menus', payload);
        toast.success('Menu item created.');
      }
      navigate(`${PORTAL}/cms/menus`);
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
        const msg = err.response.data.message;
        if (msg && !err.response.data.errors) toast.error(msg);   // e.g. self-parent guard
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

  // In edit mode, exclude self from parent options (can't be your own parent).
  const parentOptions = parents.filter((p) => String(p.id) !== String(id));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to={`${PORTAL}/cms/menus`} className="text-sm text-gray-500 hover:underline">← Menus</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{isEdit ? 'Edit' : 'New'} Menu Item</h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Label <span className="text-red-500">*</span></label>
          <input type="text" value={form.label} onChange={set('label')} className={inputCls(errors.label)} />
          {errors.label && <p className="text-xs text-red-600 mt-1">{errors.label[0]}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Parent</label>
          <select value={form.parent_id} onChange={set('parent_id')} className={inputCls(errors.parent_id)}>
            <option value="">None (top level)</option>
            {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {errors.parent_id && <p className="text-xs text-red-600 mt-1">{errors.parent_id[0]}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Links To</label>
          <select value={form.link_type} onChange={set('link_type')} className={inputCls()}>
            <option value="none">Nothing (container only)</option>
            <option value="page">A CMS Page</option>
            <option value="url">A custom URL</option>
          </select>
        </div>

        {form.link_type === 'page' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Page</label>
            <select value={form.page_id} onChange={set('page_id')} className={inputCls(errors.page_id)}>
              <option value="">Choose a page…</option>
              {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            {errors.page_id && <p className="text-xs text-red-600 mt-1">{errors.page_id[0]}</p>}
          </div>
        )}

        {form.link_type === 'url' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <input type="text" value={form.url} onChange={set('url')} placeholder="/about or https://…" className={inputCls(errors.url)} />
            {errors.url && <p className="text-xs text-red-600 mt-1">{errors.url[0]}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
            <input type="number" min="0" value={form.sort_order} onChange={set('sort_order')} className={inputCls()} />
          </div>
        </div>

        <Toggle
          checked={form.is_active}
          onChange={(on) => setForm((f) => ({ ...f, is_active: on }))}
          label="Active"
        />

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
          <Link to={`${PORTAL}/cms/menus`} className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}