import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';
import Toggle from '../../components/Toggle';
import { Link, useSearchParams } from 'react-router-dom';
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
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
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
              <h3 className="font-semibold text-gray-900">Choose {(label || 'an image').toLowerCase()}</h3>
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

// ── Layout pieces ────────────────────────────────────────────────────────────

const Icon = ({ d }) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
  </svg>
);

// Each tab: which settings keys and lists it owns (for the "unsaved" dot and for errors).
const TABS = [
  { key: 'general', label: 'General', hint: 'Branding and contact',
    intro: 'How your college looks on the website and the portal, and how people can reach you.',
    icon: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01',
    settings: ['primary_color', 'logo', 'favicon', 'show_login_link', 'contact_email', 'contact_phone', 'timezone'], lists: [] },
  { key: 'admissions', label: 'Admissions', hint: 'Who can apply and when',
    intro: 'Open or close admissions and decide what an applicant needs before they can apply.',
    icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.42A12.08 12.08 0 0118.82 17 11.95 11.95 0 0012 20.06 11.95 11.95 0 005.18 17a12.08 12.08 0 01.66-6.42L12 14z',
    settings: ['admission_open', 'allow_multiple_admissions', 'require_complete_profile', 'required_education_levels'], lists: [] },
  { key: 'profile', label: 'Profile & Documents', hint: 'What students upload',
    intro: 'The documents applicants upload, and what a student may still change after approval.',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.59a1 1 0 01.7.29l5.42 5.42a1 1 0 01.29.7V19a2 2 0 01-2 2z',
    settings: ['post_approval_editable_fields'], lists: ['docTypes', 'document_types'] },
  { key: 'fees', label: 'Fees & Challans', hint: 'Fee types, late fee',
    intro: 'The kinds of fees you charge, when challans are created, and how late fees work.',
    icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
    settings: ['auto_generate_challan', 'late_fee_mode', 'late_fee_amount', 'late_fee_partial', 'service_challan_due_days', 'max_installments'], lists: ['feeTypes', 'fee_types'] },
  { key: 'academic', label: 'Academic & Timetable', hint: 'Terms, shifts, periods',
    intro: 'Academic terms, the shifts and days you teach, and the periods of each shift.',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    settings: ['shifts', 'timetable_days'], lists: ['periods', 'terms', 'timetable_periods', 'academic_terms'] },
];

// A titled card. Rows inside are separated by thin lines.
function Card({ title, description, children, footer }) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {(title || description) && (
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          {title && <h3 className="font-semibold text-gray-900">{title}</h3>}
          {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
        </div>
      )}
      <div className="divide-y divide-gray-100">{children}</div>
      {footer && <div className="px-6 py-3 bg-gray-50 text-xs text-gray-500">{footer}</div>}
    </section>
  );
}

// One setting: label and help on the left, the control on the right (stacked on phones).
function Row({ label, help, error, children, wide = false }) {
  return (
    <div className={`px-6 py-5 ${wide ? 'space-y-3' : 'grid md:grid-cols-5 gap-3 md:gap-8'}`}>
      <div className={wide ? '' : 'md:col-span-2'}>
        <div className="text-sm font-medium text-gray-800">{label}</div>
        {help && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{help}</p>}
      </div>
      <div className={wide ? '' : 'md:col-span-3'}>
        {children}
        {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
      </div>
    </div>
  );
}

// A toggle as a full row: text on the left, switch on the right.
function SwitchRow({ label, help, checked, onChange }) {
  return (
    <div className="px-6 py-5 flex items-start justify-between gap-6">
      <div>
        <div className="text-sm font-medium text-gray-800">{label}</div>
        {help && <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-xl">{help}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// Checkbox chips (education levels, editable fields).
function Chips({ options, selected, onToggle, locked = [] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.key);
        return (
          <button type="button" key={o.key} onClick={() => onToggle(o.key, !on)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition ${
              on ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${on ? 'bg-indigo-600 text-white' : 'border border-gray-300'}`}>
              {on ? '✓' : ''}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const DOC_MODES = [
  { key: 'required', label: 'Required', on: 'bg-indigo-600 text-white shadow-sm' },
  { key: 'optional', label: 'Optional', on: 'bg-white text-gray-900 shadow-sm' },
  { key: 'off',      label: 'Not asked', on: 'bg-white text-gray-500 shadow-sm' },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const [values, setValues] = useState({});
  const [isPlatform, setIsPlatform] = useState(false);
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
  const [saved, setSaved] = useState(null);     // snapshot of the last loaded / saved state, per tab

  // The main site (super admin) only has a website, so only General applies there.
  const tabs = isPlatform ? TABS.filter((t) => t.key === 'general') : TABS;
  const tab = tabs.find((t) => t.key === params.get('tab')) ?? tabs[0];
  const goTo = (key) => setParams(key === tabs[0].key ? {} : { tab: key }, { replace: true });

  const state = { values, docTypes, periods, terms, feeTypes };
  // A tab's part of the state, as a string, to tell whether it changed since the last save.
  // (_k is a client-only row key, so it is left out.)
  const tabState = (t, s = state) => JSON.stringify([
    t.settings.map((k) => s.values[k] ?? ''),
    t.lists.filter((l) => s[l]).map((l) => s[l]),
  ], (k, v) => (k === '_k' ? undefined : v));
  const snapshot = (s) => Object.fromEntries(TABS.map((t) => [t.key, tabState(t, s)]));
  const changedTabs = saved ? tabs.filter((t) => saved[t.key] !== tabState(t)) : [];
  const dirty = changedTabs.length > 0;

  const apply = (data) => {
    const next = {
      values: data.settings ?? {},
      docTypes: data.document_types ?? [],
      periods: withKeys(data.timetable_periods ?? []),
      terms: withKeys(data.academic_terms ?? []),
      feeTypes: withKeys(data.fee_types ?? []),
    };
    setValues(next.values); setDocTypes(next.docTypes); setPeriods(next.periods);
    setTerms(next.terms); setFeeTypes(next.feeTypes);
    return next;
  };

  const [original, setOriginal] = useState(null); // last loaded / saved data, for Discard

  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => {
        const next = apply(data);
        setIsPlatform(!!data.is_platform);
        setLevels(data.education_levels ?? []);
        setOpenFieldOptions(data.post_approval_field_options ?? []);
        setShiftOptions(data.shift_options ?? []);
        setDayOptions(data.day_options ?? []);
        setOriginal(data);
        setSaved(snapshot(next));
      })
      .catch(() => toast.error('Could not load settings.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before closing or reloading the page with unsaved changes.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

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

  // One choice per document: off / optional / required.
  const docMode = (d) => (!d.is_active ? 'off' : d.is_required ? 'required' : 'optional');
  const setDocMode = (id, mode) =>
    setDocTypes((list) => list.map((d) => (d.id === id
      ? { ...d, is_active: mode !== 'off', is_required: mode === 'required' } : d)));

  // Tabs holding a validation error (from the last save).
  const errorTabs = tabs.filter((t) => Object.keys(errors).some((k) => errors[k] && (
    t.settings.some((s) => k === `settings.${s}`) || t.lists.some((l) => k.startsWith(`${l}.`) || k === l)
  )));

  const discard = () => {
    if (!original) return;
    apply(original);
    setErrors({});
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (saving) return;
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
          timezone: values.timezone || 'Asia/Karachi',
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
          max_installments: values.max_installments ?? '3',
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
        document_types: docTypes.map(({ id, is_active, is_required }) => ({ id, is_active, is_required })),
      };
      const { data } = await api.put('/settings', payload);
      const merged = {
        ...original,
        settings: data.settings ?? values,
        document_types: docTypes,
        timetable_periods: data.timetable_periods ?? periods,
        academic_terms: data.academic_terms ?? terms,
        fee_types: data.fee_types ?? feeTypes,
      };
      const next = apply(merged);
      setOriginal(merged);
      setSaved(snapshot(next));
      toast.success('Settings saved.');
    } catch (err) {
      if (err.response?.status === 422) {
        const errs = err.response.data.errors ?? {};
        setErrors(errs);
        // Open the first tab that has a problem.
        const first = tabs.find((t) => Object.keys(errs).some((k) =>
          t.settings.some((s) => k === `settings.${s}`) || t.lists.some((l) => k.startsWith(`${l}.`) || k === l)));
        if (first && first.key !== tab.key) goTo(first.key);
        toast.error(err.response.data.message && !Object.keys(errs).length ? err.response.data.message : 'Please fix the highlighted fields.');
      } else {
        toast.error('Could not save settings.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd + S saves.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty) submit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (loading) {
    return (
      <div className="max-w-6xl space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid lg:grid-cols-[250px_1fr] gap-6">
          <div className="h-72 bg-gray-100 rounded-xl" />
          <div className="h-96 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const err = (key) => errors[`settings.${key}`]?.[0];
  const inputCls = (key) =>
    `w-full px-3.5 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 ${
      err(key) ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'
    }`;

  const lateMode = values.late_fee_mode ?? 'off';
  const requiredDocs = docTypes.filter((d) => d.is_active && d.is_required).length;
  const askedDocs = docTypes.filter((d) => d.is_active).length;

  return (
    <div className="max-w-6xl pb-28">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{isPlatform ? 'Site Settings' : 'Settings'}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isPlatform
            ? 'Branding and contact details of the main website.'
            : 'Everything about how your college runs on the portal. Changes apply as soon as you save.'}
        </p>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${tabs.length > 1 ? 'lg:grid-cols-[250px_minmax(0,1fr)]' : ''}`}>
        {/* Tab navigation: a column on desktop, a scrolling row on phones */}
        {tabs.length > 1 && (
          <nav className="lg:sticky lg:top-6 self-start min-w-0">
            <div className="flex lg:flex-col gap-1 overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100 p-2">
              {tabs.map((t) => {
                const active = t.key === tab.key;
                const changed = changedTabs.some((c) => c.key === t.key);
                const hasError = errorTabs.some((c) => c.key === t.key);
                return (
                  <button type="button" key={t.key} onClick={() => goTo(t.key)}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-left whitespace-nowrap lg:whitespace-normal transition shrink-0 ${
                      active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                    <span className={`shrink-0 ${active ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'}`}><Icon d={t.icon} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium">{t.label}</span>
                      <span className="hidden lg:block text-xs text-gray-500 truncate">{t.hint}</span>
                    </span>
                    {hasError
                      ? <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Has a problem" />
                      : changed && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />}
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        <form onSubmit={submit} className="space-y-6 min-w-0">
          {tabs.length > 1 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{tab.label}</h2>
              <p className="text-sm text-gray-500">{tab.intro}</p>
            </div>
          )}

          {/* ── General ── */}
          {tab.key === 'general' && (
            <>
              <Card title="Branding" description={isPlatform ? 'Shown on the main website and its login page.' : 'Shown on the login, sign-up and portal pages, and on printed challans.'}>
                <Row label="Logo" error={err('logo')}>
                  <LogoPicker label="" value={values.logo ?? ''} onChange={(url) => set('logo', url)} />
                </Row>
                <Row label="Favicon" help="The small icon in the browser tab. If none is chosen, the logo is used." error={err('favicon')}>
                  <LogoPicker label="" small value={values.favicon ?? ''} onChange={(url) => set('favicon', url)}
                    help="Use a square PNG or ICO, for example 64 × 64." />
                </Row>
                <Row label="Primary colour" help="Buttons and highlights on your website." error={err('primary_color')}>
                  <div className="flex items-center gap-3">
                    <input type="color" value={values.primary_color || '#1e40af'}
                      onChange={(e) => set('primary_color', e.target.value)}
                      className="h-10 w-12 rounded-lg border border-gray-300 cursor-pointer p-0.5 bg-white" />
                    <input type="text" value={values.primary_color ?? ''} placeholder="#1e40af"
                      onChange={(e) => set('primary_color', e.target.value)} className={`${inputCls('primary_color')} max-w-[10rem] font-mono`} />
                  </div>
                </Row>
              </Card>

              <Card title="Contact" description="Shown on your public website.">
                <Row label="Email" error={err('contact_email')}>
                  <input type="email" value={values.contact_email ?? ''} placeholder="admissions@college.edu.pk"
                    onChange={(e) => set('contact_email', e.target.value)} className={inputCls('contact_email')} />
                </Row>
                <Row label="Phone" error={err('contact_phone')}>
                  <input type="text" value={values.contact_phone ?? ''} placeholder="022-1234567"
                    onChange={(e) => set('contact_phone', e.target.value)} className={inputCls('contact_phone')} />
                </Row>
              </Card>

              <Card title="Time zone" description="Your college's local time. It decides when a day starts and ends for due dates, late fees and the daily fee totals.">
                <Row label="Time zone" error={err('timezone')}>
                  <TimezonePicker value={values.timezone || 'Asia/Karachi'} onChange={(v) => set('timezone', v)} className={inputCls('timezone')} />
                </Row>
              </Card>

              <Card title="Website">
                <SwitchRow label="Show the portal login link"
                  help="When off, the login button is hidden from the website header and footer. The login page still works at /login for anyone who knows the address."
                  checked={values.show_login_link !== 'false'}
                  onChange={(on) => set('show_login_link', on ? 'true' : 'false')} />
              </Card>
            </>
          )}

          {/* ── Admissions ── */}
          {tab.key === 'admissions' && (
            <>
              <section className={`rounded-xl border p-5 flex items-center justify-between gap-6 ${
                values.admission_open === 'true' ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-4">
                  <span className={`w-3 h-3 rounded-full ${values.admission_open === 'true' ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-gray-400 ring-4 ring-gray-200'}`} />
                  <div>
                    <div className="font-semibold text-gray-900">Admissions are {values.admission_open === 'true' ? 'open' : 'closed'}</div>
                    <p className="text-sm text-gray-600">
                      {values.admission_open === 'true' ? 'Students can submit new applications.' : 'Students cannot submit new applications right now.'}
                    </p>
                  </div>
                </div>
                <Toggle checked={values.admission_open === 'true'} onChange={(on) => set('admission_open', on ? 'true' : 'false')} />
              </section>

              <Card title="Applying">
                <SwitchRow label="Require a complete profile before applying"
                  help="A student can only apply once their personal details, required education and required documents are 100% complete."
                  checked={(values.require_complete_profile ?? 'true') === 'true'}
                  onChange={(on) => set('require_complete_profile', on ? 'true' : 'false')} />
                <SwitchRow label="Allow multiple admissions"
                  help="A student may be admitted to more than one program. Applies only if the platform lets each college decide."
                  checked={values.allow_multiple_admissions === 'true'}
                  onChange={(on) => set('allow_multiple_admissions', on ? 'true' : 'false')} />
              </Card>

              <Card title="Required education"
                description="Every applicant must enter these levels and upload their certificates. A program can add more levels on its own page."
                footer={<>Certificates for each level are chosen under <button type="button" onClick={() => goTo('profile')} className="text-indigo-600 font-medium hover:underline">Profile &amp; Documents</button>.</>}>
                <Row wide label="Levels required for every program" error={err('required_education_levels')}>
                  <Chips options={levels} selected={requiredLevels} onToggle={toggleLevel} />
                </Row>
              </Card>
            </>
          )}

          {/* ── Profile & Documents ── */}
          {tab.key === 'profile' && (
            <>
              <Card title="Applicant documents"
                description="What applicants upload to their profile. Certificates count only when their education level is required, here under Admissions or by a program.">
                <div className="px-6 py-3 flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium">{requiredDocs} required</span>
                  <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">{askedDocs - requiredDocs} optional</span>
                  <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">{docTypes.length - askedDocs} not asked</span>
                </div>
                {docTypes.map((d) => {
                  const mode = docMode(d);
                  return (
                    <div key={d.id} className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`text-sm ${mode === 'off' ? 'text-gray-400' : 'text-gray-800'}`}>{d.name}</div>
                        {d.is_certificate && <div className="text-xs text-gray-400">Certificate · counts only when its level is required</div>}
                      </div>
                      <div className="inline-flex self-start sm:self-auto shrink-0 rounded-lg bg-gray-100 p-1">
                        {DOC_MODES.map((m) => (
                          <button type="button" key={m.key} onClick={() => setDocMode(d.id, m.key)}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition ${mode === m.key ? m.on : 'text-gray-500 hover:text-gray-800'}`}>
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </Card>

              <Card title="Editable after approval"
                description="Once a student's application is approved, their profile is locked except the fields ticked here. Every change is recorded in the audit log."
                footer="Untick everything to lock the whole profile after approval.">
                <Row wide label="Fields a student can still change" error={err('post_approval_editable_fields')}>
                  <Chips options={openFieldOptions} selected={openFields} onToggle={toggleOpenField} />
                </Row>
              </Card>
            </>
          )}

          {/* ── Fees & Challans ── */}
          {tab.key === 'fees' && (
            <>
              <Card>
                <div className="px-6 py-5">
                  <FeeTypesEditor feeTypes={feeTypes} setFeeTypes={setFeeTypes} errors={errors} />
                </div>
              </Card>

              <Card title="Challans">
                <SwitchRow label="Create the first challan on approval"
                  help="Approving an application creates its first-semester challan automatically. When off, an admin creates it."
                  checked={values.auto_generate_challan === 'true'}
                  onChange={(on) => set('auto_generate_challan', on ? 'true' : 'false')} />
                <Row label="Service challans due in" help="Due date of a challan a student makes for a service, such as a transcript, counted from the day they make it."
                  error={err('service_challan_due_days')}>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" max="90" step="1" value={values.service_challan_due_days ?? '7'}
                      onChange={(e) => set('service_challan_due_days', e.target.value)} className={`${inputCls('service_challan_due_days')} max-w-[7rem]`} />
                    <span className="text-sm text-gray-500">days</span>
                  </div>
                </Row>
              </Card>

              <Card title="Installments" description="Let staff split a challan into smaller challans with their own due dates, from the challan's page.">
                <Row label="Allow splitting into" help="Each part keeps the same fee lines, shared out in proportion. Choose Off to hide the option." error={err('max_installments')}>
                  <select value={values.max_installments ?? '3'} onChange={(e) => set('max_installments', e.target.value)} className={`${inputCls('max_installments')} max-w-[14rem]`}>
                    <option value="1">Off</option>
                    {[2, 3, 4, 5, 6].map((n) => <option key={n} value={String(n)}>Up to {n} installments</option>)}
                  </select>
                </Row>
              </Card>

              <Card title="Late fee" description="Added automatically to unpaid challans after their due date.">
                <Row label="How it is charged" error={err('late_fee_mode')}>
                  <select value={lateMode} onChange={(e) => set('late_fee_mode', e.target.value)} className={inputCls('late_fee_mode')}>
                    <option value="off">No late fee</option>
                    <option value="flat">Flat amount (charged once)</option>
                    <option value="per_week">Per week overdue</option>
                    <option value="per_month">Per month overdue</option>
                  </select>
                </Row>
                {lateMode !== 'off' && (
                  <Row label="Amount" error={err('late_fee_amount')}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Rs.</span>
                      <input type="number" min="0" step="1" value={values.late_fee_amount ?? '0'}
                        onChange={(e) => set('late_fee_amount', e.target.value)} className={`${inputCls('late_fee_amount')} max-w-[10rem]`} />
                      {lateMode === 'per_week' && <span className="text-sm text-gray-500">per week</span>}
                      {lateMode === 'per_month' && <span className="text-sm text-gray-500">per month</span>}
                    </div>
                  </Row>
                )}
                {(lateMode === 'per_week' || lateMode === 'per_month') && (
                  <Row label="Part of a period" error={err('late_fee_partial')}>
                    <select value={values.late_fee_partial ?? 'from_day_one'}
                      onChange={(e) => set('late_fee_partial', e.target.value)} className={inputCls('late_fee_partial')}>
                      <option value="from_day_one">Charge from day one (any overdue = 1 full period)</option>
                      <option value="full_period">Only completed periods (charge after each full period)</option>
                    </select>
                  </Row>
                )}
              </Card>
            </>
          )}

          {/* ── Academic & Timetable ── */}
          {tab.key === 'academic' && (
            <Card>
              <div className="px-6 py-5">
                <TimetableSettings embedded
                  values={values} set={set}
                  periods={periods} setPeriods={setPeriods}
                  terms={terms} setTerms={setTerms}
                  shiftOptions={shiftOptions} dayOptions={dayOptions}
                  errors={errors}
                />
              </div>
            </Card>
          )}
        </form>
      </div>

      {/* Save bar: only while something is unsaved */}
      <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl transition-all duration-300 ${
        dirty ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 pointer-events-none'}`}>
        <div className="flex items-center gap-3 rounded-xl bg-gray-900 text-white shadow-2xl ring-1 ring-black/10 px-4 py-3" style={{ background: '#111827' }}>
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <span className="font-medium" style={{ color: '#fff' }}>Unsaved changes</span>
            <span className="hidden sm:inline" style={{ color: '#9ca3af' }}> in {changedTabs.map((t) => t.label).join(', ')}</span>
          </div>
          <button type="button" onClick={discard} disabled={saving}
            className="px-3 py-1.5 rounded-lg text-sm hover:bg-white/10 disabled:opacity-50" style={{ color: '#d1d5db' }}>
            Discard
          </button>
          <button type="button" onClick={submit} disabled={saving}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60" style={{ color: '#fff' }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Every IANA zone the browser knows (the server checks it again). Shows the local time there.
const ZONES = (() => {
  try { return Intl.supportedValuesOf('timeZone'); } catch { return ['Asia/Karachi', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kolkata', 'Europe/London', 'UTC']; }
})();

function TimezonePicker({ value, onChange, className }) {
  const zones = ZONES.includes(value) ? ZONES : [value, ...ZONES];
  let now = '';
  try {
    now = new Date().toLocaleString(undefined, { timeZone: value, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  } catch { /* unknown zone: the server will reject it */ }
  return (
    <div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${className} max-w-xs`}>
        {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
      </select>
      {now && <p className="text-xs text-gray-500 mt-1.5">Local time there now: <span className="font-medium text-gray-700">{now}</span></p>}
    </div>
  );
}
