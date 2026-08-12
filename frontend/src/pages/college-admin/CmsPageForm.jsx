import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';

const EMPTY = {
  title: '', slug: '', content: '',
  meta_title: '', meta_description: '',
  is_published: true, sort_order: 0,
};

export default function CmsPageForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/cms/pages/${id}`)
      .then(({ data }) => setForm({
        title: data.title ?? '',
        slug: data.slug ?? '',
        content: data.content ?? '',
        meta_title: data.meta_title ?? '',
        meta_description: data.meta_description ?? '',
        is_published: data.is_published,
        sort_order: data.sort_order ?? 0,
      }))
      .catch(() => toast.error('Could not load page.'))
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
    try {
      if (isEdit) {
        await api.put(`/cms/pages/${id}`, form);
        toast.success('Page updated.');
      } else {
        await api.post('/cms/pages', form);
        toast.success('Page created.');
      }
      navigate(`${PORTAL}/cms/pages`);
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

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to={`${PORTAL}/cms/pages`} className="text-sm text-gray-500 hover:underline">← Pages</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{isEdit ? 'Edit' : 'New'} Page</h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
            <input type="text" value={form.title} onChange={set('title')} className={inputCls(errors.title)} />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title[0]}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug <span className="text-red-500">*</span></label>
            <input type="text" value={form.slug} onChange={set('slug')} placeholder="e.g. about" className={inputCls(errors.slug)} />
            {errors.slug && <p className="text-xs text-red-600 mt-1">{errors.slug[0]}</p>}
            <p className="text-xs text-gray-400 mt-1">The URL path for this page on your public site.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Content <span className="text-red-500">*</span></label>
          <textarea rows={10} value={form.content} onChange={set('content')}
            placeholder="HTML content…" className={`font-mono ${inputCls(errors.content)}`} />
          {errors.content && <p className="text-xs text-red-600 mt-1">{errors.content[0]}</p>}
          <p className="text-xs text-gray-400 mt-1">HTML is allowed. A rich editor can be added later.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meta Title</label>
            <input type="text" value={form.meta_title} onChange={set('meta_title')} className={inputCls(errors.meta_title)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
            <input type="number" min="0" value={form.sort_order} onChange={set('sort_order')} className={inputCls()} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
          <textarea rows={2} value={form.meta_description} onChange={set('meta_description')} className={inputCls(errors.meta_description)} />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.is_published} onChange={set('is_published')} className="rounded" />
          Published (visible on the public site)
        </label>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Update Page' : 'Create Page'}
          </button>
          <Link to={`${PORTAL}/cms/pages`} className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}