import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';

export default function CollegeRegister() {
  const navigate = useNavigate();
  const [docTypes, setDocTypes] = useState([]);
  const [form, setForm] = useState({ name: '', slug: '', email: '', phone: '', address: '', city: '', province: '' });
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Fetch the required document config (public endpoint, no auth).
  useEffect(() => {
    api.get('/public/required-documents', { params: { scope: 'college_registration' } })
      .then(({ data }) => setDocTypes(data))
      .catch(() => toast.error('Could not load registration requirements.'))
      .finally(() => setLoading(false));
  }, []);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const setFile = (slug) => (e) => {
    const file = e.target.files[0] ?? null;
    if (file && file.size > 4 * 1024 * 1024) {
      toast.error(`${file.name} exceeds 4 MB.`);
      e.target.value = '';
      return;
    }
    setFiles((f) => ({ ...f, [slug]: file }));
    setErrors((er) => ({ ...er, [`doc_${slug}`]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      docTypes.forEach((d) => { if (files[d.slug]) fd.append(`doc_${d.slug}`, files[d.slug]); });

      await api.post('/colleges/register', fd);
      setDone(true);
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
        toast.error('Please fix the highlighted fields.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-green-600 text-2xl">✓</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Registration Submitted</h1>
          <p className="text-sm text-gray-600 mb-6">
            Your college registration has been received and is pending review.
            You'll be notified once it's approved.
          </p>
          <Link to="/login" className="text-indigo-600 hover:underline text-sm">Go to Login</Link>
        </div>
      </div>
    );
  }

  const inputCls = (err) =>
    `w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
      err ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Register Your College</h1>
          <p className="text-sm text-gray-500 mt-1">Submit your details and required documents for review.</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">College Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={set('name')} className={inputCls(errors.name)} />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name[0]}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" value={form.address} onChange={set('address')} className={inputCls(errors.address)} />
            {errors.address && <p className="text-xs text-red-600 mt-1">{errors.address[0]}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subdomain <span className="text-red-500">*</span></label>
              <input type="text" value={form.slug} onChange={set('slug')} placeholder="e.g. iba" className={inputCls(errors.slug)} />
              {errors.slug && <p className="text-xs text-red-600 mt-1">{errors.slug[0]}</p>}
              <p className="text-xs text-gray-400 mt-1">Your portal will be at {form.slug || 'yourname'}.localhost</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
              <input type="email" value={form.email} onChange={set('email')} className={inputCls(errors.email)} />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email[0]}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="text" value={form.phone} onChange={set('phone')} className={inputCls(errors.phone)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input type="text" value={form.city} onChange={set('city')} className={inputCls(errors.city)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
              <input type="text" value={form.province} onChange={set('province')} className={inputCls(errors.province)} />
            </div>
          </div>

          {docTypes.length > 0 && (
            <div className="border-t pt-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Required Documents <span className="font-normal text-gray-500">(jpg/png/pdf, max 4 MB)</span></h2>
              <div className="space-y-4">
                {docTypes.map((d) => (
                  <div key={d.slug}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {d.name} {d.is_mandatory && <span className="text-red-500">*</span>}
                    </label>
                    <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={setFile(d.slug)} className="text-sm" />
                    {files[d.slug] && <p className="text-xs text-green-600 mt-1">✓ {files[d.slug].name}</p>}
                    {errors[`doc_${d.slug}`] && <p className="text-xs text-red-600 mt-1">{errors[`doc_${d.slug}`][0]}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Submitting…' : 'Submit Registration'}
            </button>
            <Link to="/login" className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Back to Login</Link>
          </div>
        </form>
      </div>
    </div>
  );
}