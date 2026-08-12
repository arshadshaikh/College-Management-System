import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';

const EMPTY = { title: '', body: '', is_published: true };

export default function CmsAnnouncementForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/cms/announcements/${id}`)
      .then(({ data }) => setForm({
        title: data.title ?? '',
        body: data.body ?? '',
        is_published: data.is_published,
      }))
      .catch(() => toast.error('Could not load announcement.'))
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
        await api.put(`/cms/announcements/${id}`, form);
        toast.success('Announcement updated.');
      } else {
        await api.post('/cms/announcements', form);
        toast.success('Announcement created.');
      }
      navigate(`${PORTAL}/cms/announcements`);
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
        <Link to={`${PORTAL}/cms/announcements`} className="text-sm text-gray-500 hover:underline">← Announcements</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{isEdit ? 'Edit' : 'New'} Announcement</h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
          <input type="text" value={form.title} onChange={set('title')} className={inputCls(errors.title)} />
          {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title[0]}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Body <span className="text-red-500">*</span></label>
          <textarea rows={8} value={form.body} onChange={set('body')} className={inputCls(errors.body)} />
          {errors.body && <p className="text-xs text-red-600 mt-1">{errors.body[0]}</p>}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.is_published} onChange={set('is_published')} className="rounded" />
          Published
        </label>
        <p className="text-xs text-gray-400">Publishing stamps the date automatically if not already set.</p>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
          <Link to={`${PORTAL}/cms/announcements`} className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}