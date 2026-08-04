import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';
import Toggle from '../../components/Toggle';

export default function Settings() {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => setValues(data.settings ?? {}))
      .catch(() => toast.error('Could not load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const set = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [`settings.${key}`]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      // Send only the editable text settings (logo is a separate upload).
      const payload = {
        settings: {
          primary_color: values.primary_color ?? '',
          contact_email: values.contact_email ?? '',
          contact_phone: values.contact_phone ?? '',
          admission_open: values.admission_open ?? 'false',
          allow_multiple_admissions: values.allow_multiple_admissions ?? 'false',
        },
      };
      const { data } = await api.put('/settings', payload);
      setValues(data.settings ?? values);
      toast.success('Settings saved.');
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

  const err = (key) => errors[`settings.${key}`]?.[0];
  const inputCls = (key) =>
    `w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
      err(key) ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'
    }`;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">College Settings</h1>

      <form onSubmit={submit} className="space-y-6">
        {/* Branding */}
        <section className="bg-white rounded-xl shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Branding</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
            <div className="flex items-center gap-3">
              <input type="color"
                value={values.primary_color || '#1e40af'}
                onChange={(e) => set('primary_color', e.target.value)}
                className="h-10 w-14 rounded border border-gray-300 cursor-pointer" />
              <input type="text"
                value={values.primary_color ?? ''}
                onChange={(e) => set('primary_color', e.target.value)}
                placeholder="#1e40af" className={inputCls('primary_color')} />
            </div>
            {err('primary_color') && <p className="text-xs text-red-600 mt-1">{err('primary_color')}</p>}
          </div>
          <p className="text-xs text-gray-400">Logo upload is managed separately (coming with the media tools).</p>
        </section>

        {/* Contact */}
        <section className="bg-white rounded-xl shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Contact</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input type="email" value={values.contact_email ?? ''}
                onChange={(e) => set('contact_email', e.target.value)} className={inputCls('contact_email')} />
              {err('contact_email') && <p className="text-xs text-red-600 mt-1">{err('contact_email')}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
              <input type="text" value={values.contact_phone ?? ''}
                onChange={(e) => set('contact_phone', e.target.value)} className={inputCls('contact_phone')} />
              {err('contact_phone') && <p className="text-xs text-red-600 mt-1">{err('contact_phone')}</p>}
            </div>
          </div>
        </section>

        {/* Admissions */}
        <section className="bg-white rounded-xl shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Admissions</h2>

          <Toggle
            checked={values.admission_open === 'true'}
            onChange={(on) => set('admission_open', on ? 'true' : 'false')}
            label="Admissions Open"
            description="When on, students can submit new applications."
          />

          <Toggle
            checked={values.allow_multiple_admissions === 'true'}
            onChange={(on) => set('allow_multiple_admissions', on ? 'true' : 'false')}
            label="Allow Multiple Admissions"
            description="When on, a student may be admitted to more than one program. Only applies if the platform policy lets each college decide; otherwise the platform setting governs."
          />

        </section>

        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}