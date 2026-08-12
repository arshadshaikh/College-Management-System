import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';
import Toggle from '../../components/Toggle';

export default function CmsBannerForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '', subtitle: '', link_url: '', button_text: '',
    sort_order: 0, is_active: true,
  });
  const [imageFile, setImageFile] = useState(null);
  const [currentImage, setCurrentImage] = useState(null);   // existing image URL in edit
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/cms/banners/${id}`)
      .then(({ data }) => {
        setForm({
          title: data.title ?? '',
          subtitle: data.subtitle ?? '',
          link_url: data.link_url ?? '',
          button_text: data.button_text ?? '',
          sort_order: data.sort_order ?? 0,
          is_active: data.is_active,
        });
        setCurrentImage(data.image_url ?? null);
      })
      .catch(() => toast.error('Could not load banner.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const pickImage = (e) => {
    const file = e.target.files[0] ?? null;
    if (file && file.size > 4 * 1024 * 1024) {
      toast.error('Image must be under 4 MB.');
      e.target.value = '';
      return;
    }
    setImageFile(file);
    setErrors((er) => ({ ...er, image: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!isEdit && !imageFile) {
      setErrors({ image: ['Please choose a banner image.'] });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''));
      // Booleans as 1/0 for multipart.
      fd.set('is_active', form.is_active ? '1' : '0');
      if (imageFile) fd.append('image', imageFile);

      if (isEdit) {
        // Laravel needs POST + _method=PUT to receive multipart on an update.
        fd.append('_method', 'PUT');
        await api.post(`/cms/banners/${id}`, fd);
        toast.success('Banner updated.');
      } else {
        await api.post('/cms/banners', fd);
        toast.success('Banner created.');
      }
      navigate(`${PORTAL}/cms/banners`);
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
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to={`${PORTAL}/cms/banners`} className="text-sm text-gray-500 hover:underline">← Banners</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">{isEdit ? 'Edit' : 'New'} Banner</h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Image {!isEdit && <span className="text-red-500">*</span>}
          </label>
          {isEdit && currentImage && (
            <img src={currentImage} alt="current" className="h-24 rounded border border-gray-200 mb-2 object-cover" />
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickImage} className="text-sm" />
          {imageFile && <p className="text-xs text-green-600 mt-1">✓ {imageFile.name}</p>}
          {isEdit && <p className="text-xs text-gray-400 mt-1">Leave empty to keep the current image.</p>}
          {errors.image && <p className="text-xs text-red-600 mt-1">{errors.image[0]}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={form.title} onChange={set('title')} className={inputCls(errors.title)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subtitle</label>
            <input type="text" value={form.subtitle} onChange={set('subtitle')} className={inputCls(errors.subtitle)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
            <input type="text" value={form.button_text} onChange={set('button_text')} placeholder="e.g. Apply Now" className={inputCls(errors.button_text)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link URL</label>
            <input type="text" value={form.link_url} onChange={set('link_url')} placeholder="/admissions" className={inputCls(errors.link_url)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
            <input type="number" min="0" value={form.sort_order} onChange={set('sort_order')} className={inputCls()} />
          </div>
        </div>

        <Toggle checked={form.is_active} onChange={(on) => setForm((f) => ({ ...f, is_active: on }))} label="Active" />

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
          <Link to={`${PORTAL}/cms/banners`} className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}