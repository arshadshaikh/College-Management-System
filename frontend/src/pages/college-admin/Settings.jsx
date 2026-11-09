import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';
import Toggle from '../../components/Toggle';

export default function Settings() {
  const [values, setValues] = useState({});
  const [levels, setLevels] = useState([]);   // education level catalog (config/admission.php)
  const [docTypes, setDocTypes] = useState([]); // applicant documents: master list + this college's choices
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => {
        setValues(data.settings ?? {});
        setLevels(data.education_levels ?? []);
        setDocTypes(data.document_types ?? []);
      })
      .catch(() => toast.error('Could not load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const set = (key, value) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [`settings.${key}`]: undefined }));
  };

  // required_education_levels is stored as a comma list of level keys, in catalog order.
  const requiredLevels = (values.required_education_levels ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const toggleLevel = (key, on) => {
    const next = on ? [...requiredLevels, key] : requiredLevels.filter((k) => k !== key);
    set('required_education_levels', levels.map((l) => l.key).filter((k) => next.includes(k)).join(','));
  };

  // One dropdown per document: off / optional / required.
  const docMode = (d) => (!d.is_active ? 'off' : d.is_required ? 'required' : 'optional');
  const setDocMode = (id, mode) =>
    setDocTypes((list) => list.map((d) => (d.id === id
      ? { ...d, is_active: mode !== 'off', is_required: mode === 'required' } : d)));

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
          require_complete_profile: values.require_complete_profile ?? 'true',
          required_education_levels: values.required_education_levels ?? '',
          auto_generate_challan: values.auto_generate_challan ?? 'true',
          late_fee_mode: values.late_fee_mode ?? 'off',
          late_fee_amount: values.late_fee_amount ?? '0',
          late_fee_partial: values.late_fee_partial ?? 'from_day_one',
        },
        // Certificates follow the education levels, so they are not sent.
        document_types: docTypes.filter((d) => !d.is_certificate)
          .map(({ id, is_active, is_required }) => ({ id, is_active, is_required })),
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

          <Toggle
            checked={(values.require_complete_profile ?? 'true') === 'true'}
            onChange={(on) => set('require_complete_profile', on ? 'true' : 'false')}
            label="Require a complete profile before applying"
            description="When on, a student can only apply once their admission profile (personal details, required education and required documents) is 100% complete."
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Required Education Levels</label>
            <p className="text-xs text-gray-500 mb-2">
              Applicants must enter these levels and upload their certificates. Other levels stay optional.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {levels.map((l) => (
                <label key={l.key} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="h-4 w-4"
                    checked={requiredLevels.includes(l.key)}
                    onChange={(e) => toggleLevel(l.key, e.target.checked)} />
                  {l.label}
                </label>
              ))}
            </div>
            {err('required_education_levels') && <p className="text-xs text-red-600 mt-1">{err('required_education_levels')}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Applicant Documents</label>
            <p className="text-xs text-gray-500 mb-2">
              Choose which documents applicants upload to their profile. Education certificates follow the
              required education levels above (and each program's extra levels).
            </p>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
              {docTypes.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <span className="text-sm text-gray-800">{d.name}</span>
                  {d.is_certificate ? (
                    <span className="text-xs text-gray-400">Follows education levels</span>
                  ) : (
                    <select value={docMode(d)} onChange={(e) => setDocMode(d.id, e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="required">Required</option>
                      <option value="optional">Optional</option>
                      <option value="off">Not asked</option>
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Fees */}
        <section className="bg-white rounded-xl shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Fees &amp; Challans</h2>

          <Toggle
            checked={values.auto_generate_challan === 'true'}
            onChange={(on) => set('auto_generate_challan', on ? 'true' : 'false')}
            label="Auto-generate first challan on approval"
            description="When on, approving an application automatically creates its first-semester challan. When off, an admin creates the challan manually."
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Late Fee</label>
            <select
              value={values.late_fee_mode ?? 'off'}
              onChange={(e) => set('late_fee_mode', e.target.value)}
              className={inputCls('late_fee_mode')}>
              <option value="off">No late fee</option>
              <option value="flat">Flat amount (charged once)</option>
              <option value="per_week">Per week overdue</option>
              <option value="per_month">Per month overdue</option>
            </select>
            {err('late_fee_mode') && <p className="text-xs text-red-600 mt-1">{err('late_fee_mode')}</p>}
            <p className="text-xs text-gray-400 mt-1">
              Applied automatically to overdue unpaid challans when viewed.
            </p>
          </div>

          {values.late_fee_mode && values.late_fee_mode !== 'off' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Late Fee Amount (Rs.)
                  {values.late_fee_mode === 'per_week' && ' — per week'}
                  {values.late_fee_mode === 'per_month' && ' — per month'}
                </label>
                <input type="number" min="0" step="1"
                  value={values.late_fee_amount ?? '0'}
                  onChange={(e) => set('late_fee_amount', e.target.value)}
                  className={inputCls('late_fee_amount')} />
                {err('late_fee_amount') && <p className="text-xs text-red-600 mt-1">{err('late_fee_amount')}</p>}
              </div>

              {(values.late_fee_mode === 'per_week' || values.late_fee_mode === 'per_month') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Partial Period</label>
                  <select
                    value={values.late_fee_partial ?? 'from_day_one'}
                    onChange={(e) => set('late_fee_partial', e.target.value)}
                    className={inputCls('late_fee_partial')}>
                    <option value="from_day_one">Charge from day one (any overdue = 1 full period)</option>
                    <option value="full_period">Only completed periods (charge after each full period)</option>
                  </select>
                  {err('late_fee_partial') && <p className="text-xs text-red-600 mt-1">{err('late_fee_partial')}</p>}
                </div>
              )}
            </>
          )}
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
