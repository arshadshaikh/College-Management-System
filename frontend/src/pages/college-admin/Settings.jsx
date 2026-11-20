import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';
import Toggle from '../../components/Toggle';
import { Link } from 'react-router-dom';
import { PORTAL } from '../../config/app';
import TimetableSettings, { withKeys } from './TimetableSettings';
import FeeTypesEditor from './FeeTypesEditor';

// Picks an image from the Media Library (images only) and stores its URL in a setting (`logo`, `favicon`).
function LogoPicker({ value, onChange, label = 'Logo', help, small = false }) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState(null);

  const openPicker = () => {
    setOpen(true);
    if (images === null) {
      api.get('/cms/media', { params: { media_type: 'image', per_page: 100 } })
        .then(({ data }) => setImages(data.data ?? data))
        .catch(() => { setImages([]); toast.error('Could not load the Media Library.'); });
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-4">
        <div className={`${small ? 'w-10 h-10 rounded-lg' : 'w-16 h-16 rounded-xl'} border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden`}>
          {value ? <img src={value} alt={label} className="w-full h-full object-contain" />
                 : <span className="text-xs text-gray-400">None</span>}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={openPicker}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            {value ? 'Change' : 'Choose from Media Library'}
          </button>
          {value && (
            <button type="button" onClick={() => onChange('')}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg">Remove</button>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-1">
        {help ?? 'Shown on the login, sign-up and portal pages. A square PNG with a transparent background looks best.'}
      </p>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Choose {label.toLowerCase()}</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <div className="p-5 overflow-y-auto">
              {images === null ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : images.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No images yet. Upload one in the{' '}
                  <Link to={`${PORTAL}/cms/media`} className="text-indigo-600 font-medium">Media Library</Link>, then come back.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {images.map((m) => (
                    <button type="button" key={m.id} title={m.original_name}
                      onClick={() => { onChange(m.public_url); setOpen(false); }}
                      className={`aspect-square rounded-lg border-2 overflow-hidden bg-gray-50 hover:border-indigo-500 ${
                        value === m.public_url ? 'border-indigo-600' : 'border-gray-200'}`}>
                      <img src={m.public_url} alt={m.alt_text || m.original_name} className="w-full h-full object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const [values, setValues] = useState({});
  const [levels, setLevels] = useState([]);   // education level catalog (config/admission.php)
  const [openFieldOptions, setOpenFieldOptions] = useState([]); // profile fields a college may reopen after approval
  const [docTypes, setDocTypes] = useState([]); // applicant documents: master list + this college's choices
  const [periods, setPeriods] = useState([]);   // timetable periods (all shifts)
  const [terms, setTerms] = useState([]);       // academic terms
  const [feeTypes, setFeeTypes] = useState([]); // this college's fee types
  const [shiftOptions, setShiftOptions] = useState([]);
  const [dayOptions, setDayOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => {
        setValues(data.settings ?? {});
        setLevels(data.education_levels ?? []);
        setOpenFieldOptions(data.post_approval_field_options ?? []);
        setDocTypes(data.document_types ?? []);
        setPeriods(withKeys(data.timetable_periods ?? []));
        setTerms(withKeys(data.academic_terms ?? []));
        setFeeTypes(withKeys(data.fee_types ?? []));
        setShiftOptions(data.shift_options ?? []);
        setDayOptions(data.day_options ?? []);
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

  // post_approval_editable_fields: comma list of profile field keys, in catalog order.
  const openFields = (values.post_approval_editable_fields ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const toggleOpenField = (key, on) => {
    const next = on ? [...openFields, key] : openFields.filter((k) => k !== key);
    set('post_approval_editable_fields', openFieldOptions.map((f) => f.key).filter((k) => next.includes(k)).join(','));
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
          logo: values.logo ?? '',
          favicon: values.favicon ?? '',
          show_login_link: values.show_login_link ?? 'true',
          contact_email: values.contact_email ?? '',
          contact_phone: values.contact_phone ?? '',
          admission_open: values.admission_open ?? 'false',
          allow_multiple_admissions: values.allow_multiple_admissions ?? 'false',
          require_complete_profile: values.require_complete_profile ?? 'true',
          required_education_levels: values.required_education_levels ?? '',
          post_approval_editable_fields: values.post_approval_editable_fields ?? '',
          auto_generate_challan: values.auto_generate_challan ?? 'true',
          late_fee_mode: values.late_fee_mode ?? 'off',
          late_fee_amount: values.late_fee_amount ?? '0',
          late_fee_partial: values.late_fee_partial ?? 'from_day_one',
          service_challan_due_days: values.service_challan_due_days ?? '7',
          shifts: values.shifts || 'morning',
          timetable_days: values.timetable_days ?? '',
        },
        // Timetable periods of every shift (the full list; removed rows are deleted).
        timetable_periods: periods.map(({ id, shift, name, start_time, end_time, is_break }) =>
          ({ id, shift, name, start_time, end_time, is_break: !!is_break })),
        // Academic terms (the full list; removed rows are deleted with their timetables).
        academic_terms: terms.map(({ id, name, start_date, end_date, is_current }) =>
          ({ id, name, start_date, end_date, is_current: !!is_current })),
        // Fee types (the full list, in display order; unused removed rows are deleted, used ones switched off).
        fee_types: feeTypes.map(({ id, name, is_active, service_amount }) =>
          ({ id, name, is_active: !!is_active, service_amount: service_amount === '' || service_amount == null ? null : service_amount })),
        // Every applicant document, certificates included (Required / Optional / Not asked).
        document_types: docTypes
          .map(({ id, is_active, is_required }) => ({ id, is_active, is_required })),

      };
      const { data } = await api.put('/settings', payload);
      setValues(data.settings ?? values);
      if (data.timetable_periods) setPeriods(withKeys(data.timetable_periods));
      if (data.academic_terms) setTerms(withKeys(data.academic_terms));
      if (data.fee_types) setFeeTypes(withKeys(data.fee_types));
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
          <LogoPicker value={values.logo ?? ''} onChange={(url) => set('logo', url)} />
          {err('logo') && <p className="text-xs text-red-600 mt-1">{err('logo')}</p>}
          <LogoPicker
            label="Favicon"
            small
            value={values.favicon ?? ''}
            onChange={(url) => set('favicon', url)}
            help="The small icon in the browser tab. Use a square PNG or ICO (for example 64 × 64). If none is chosen, the logo is used."
          />
          {err('favicon') && <p className="text-xs text-red-600 mt-1">{err('favicon')}</p>}
          <Toggle
            checked={values.show_login_link !== 'false'}
            onChange={(on) => set('show_login_link', on ? 'true' : 'false')}
            label="Show login link on the public website"
            description="When off, the Portal login button is hidden from the website header and footer. The login page still works at /login for anyone who knows the address."
          />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Editable after approval</label>
            <p className="text-xs text-gray-500 mb-2">
              Once a student's application is approved, their profile is locked except these fields. Changes are recorded in the audit log. Untick all to lock everything.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {openFieldOptions.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="h-4 w-4"
                    checked={openFields.includes(f.key)}
                    onChange={(e) => toggleOpenField(f.key, e.target.checked)} />
                  {f.label}
                </label>
              ))}
            </div>
            {err('post_approval_editable_fields') && <p className="text-xs text-red-600 mt-1">{err('post_approval_editable_fields')}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Applicant Documents</label>
            <p className="text-xs text-gray-500 mb-2">
              Choose which documents applicants upload to their profile. Education certificates count only when their level is required, here or by a program.
            </p>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
              {docTypes.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <span className="text-sm text-gray-800">
                    {d.name}
                    {d.is_certificate && <span className="block text-xs text-gray-400">Counts only when its education level is required</span>}
                  </span>
                  <select value={docMode(d)} onChange={(e) => setDocMode(d.id, e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="required">Required</option>
                    <option value="optional">Optional</option>
                    <option value="off">Not asked</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Fees */}
        <section className="bg-white rounded-xl shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Fees &amp; Challans</h2>

          <FeeTypesEditor feeTypes={feeTypes} setFeeTypes={setFeeTypes} errors={errors} />

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service challans due in (days)</label>
            <input type="number" min="1" max="90" step="1"
              value={values.service_challan_due_days ?? '7'}
              onChange={(e) => set('service_challan_due_days', e.target.value)}
              className={inputCls('service_challan_due_days')} />
            {err('service_challan_due_days') && <p className="text-xs text-red-600 mt-1">{err('service_challan_due_days')}</p>}
            <p className="text-xs text-gray-400 mt-1">
              Due date of a challan a student makes for a service, such as a transcript, counted from the day they make it.
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

        <TimetableSettings
          values={values} set={set}
          periods={periods} setPeriods={setPeriods}
          terms={terms} setTerms={setTerms}
          shiftOptions={shiftOptions} dayOptions={dayOptions}
          errors={errors}
        />

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
