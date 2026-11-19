import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';
import EducationSection from './profile/EducationSection';
import DocumentsSection from './profile/DocumentsSection';

// Personal fields. `account` = stored on users; the rest on student_profiles.
const PERSONAL = [
  { key: 'name',              label: 'Full Name (as on certificates)', required: true, account: true },
  { key: 'father_name',       label: "Father's Name",                  required: true },
  { key: 'phone',             label: 'Mobile Number',                  account: true },
  { key: 'email',             label: 'Email',                          type: 'email', account: true },
  { key: 'date_of_birth',     label: 'Date of Birth',                  type: 'date' },
  { key: 'gender',            label: 'Gender',                         options: ['male', 'female', 'other'] },
  { key: 'marital_status',    label: 'Marital Status',                 options: ['single', 'married', 'divorced', 'widowed'] },
  { key: 'nationality',       label: 'Nationality' },
  { key: 'religion',          label: 'Religion' },
  { key: 'domicile_province', label: 'Domicile Province' },
  { key: 'domicile_district', label: 'Domicile District' },
  { key: 'prc_no',            label: 'PRC Number' },
  { key: 'emergency_contact', label: 'Emergency Contact' },
  { key: 'permanent_address', label: 'Permanent Address', textarea: true },
  { key: 'present_address',   label: 'Present Address',   textarea: true },
];

const labelFor = (key) => PERSONAL.find((f) => f.key === key)?.label ?? key;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const SECTIONS = [
  { key: 'personal',  label: 'Personal details' },
  { key: 'education', label: 'Education' },
  { key: 'documents', label: 'Documents' },
];
const goTo = (id) => document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

// Overall progress + one tile per section. Every missing item is a link to its section.
function Completeness({ c }) {
  if (!c) return null;
  const color = c.complete ? 'bg-green-500' : 'bg-indigo-600';
  const missingIn = (key) => c.missing.filter((m) => m.section === key);
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-900">Profile completeness</h2>
        <span className="text-sm font-semibold text-gray-700">{c.percent}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-2 ${color} transition-all`} style={{ width: `${c.percent}%` }} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        {SECTIONS.map((s) => {
          const left = missingIn(s.key);
          return (
            <button key={s.key} type="button" onClick={() => goTo(s.key)}
              className={`text-left rounded-lg border px-3 py-2.5 transition hover:shadow-sm ${
                left.length ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
              <span className="block text-sm font-medium text-gray-900">{s.label}</span>
              <span className={`block text-xs mt-0.5 ${left.length ? 'text-amber-700' : 'text-green-700'}`}>
                {left.length ? `${left.length} item${left.length > 1 ? 's' : ''} needed` : '✓ Complete'}
              </span>
            </button>
          );
        })}
      </div>

      {c.complete ? (
        <p className="text-xs text-green-700 mt-3">Your profile is complete. You can now apply for admission.</p>
      ) : (
        <div className="mt-4 text-xs text-gray-600">
          <p className="mb-1">Still needed (click to jump there):</p>
          <ul className="flex flex-wrap gap-2">
            {c.missing.map((m) => (
              <li key={`${m.section}-${m.key}`}>
                <button type="button" onClick={() => goTo(m.section)}
                  className="px-2 py-1 rounded-full bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700">
                  {m.label ?? labelFor(m.key)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function MyProfile() {
  const [data, setData] = useState(null);
  const [personal, setPersonal] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Every profile endpoint returns the same payload; this loads it into state.
  const apply = (d) => {
    setData(d);
    const p = d.profile ?? {};
    const next = {};
    PERSONAL.forEach((f) => {
      const v = f.account ? d.user?.[f.key] : p[f.key];
      next[f.key] = v ?? '';
    });
    if (next.date_of_birth) next.date_of_birth = String(next.date_of_birth).slice(0, 10);
    setPersonal(next);
  };

  useEffect(() => {
    api.get('/profile')
      .then(({ data: d }) => apply(d))
      .catch(() => toast.error('Could not load your profile.'));
  }, []);

  const setField = (key) => (e) => setPersonal((prev) => ({ ...prev, [key]: e.target.value }));

  const savePersonal = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      // After approval send only the open fields (the server ignores the rest anyway).
      const body = partial
        ? Object.fromEntries(Object.entries(personal).filter(([k]) => openFields.includes(k)))
        : personal;
      const { data: d } = await api.put('/profile', body);

      apply(d);
      toast.success(d.message ?? 'Profile saved.');
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
        toast.error('Please fix the highlighted fields.');
      } else {
        toast.error(err.response?.data?.message ?? 'Could not save your profile.');
      }
    } finally {
      setSaving(false);
    }
  };

  // After approval the server sends editable_fields: only those stay open.
  const openFields = data?.editable_fields ?? null;
  const partial = !!data?.locked && openFields?.length > 0;
  const fieldLocked = (key) => partial && !openFields.includes(key);

  const inputCls = (error) =>
    `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
      error ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'
    }`;

  if (!data) return <p className="text-sm text-gray-500">Loading profile…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Admission Profile</h1>
        <p className="text-sm text-gray-500 mt-1">
          CNIC {data.user?.cnic_no}. Fill each section and press its Save button. You can come back any time.
        </p>
      </div>

      {data.locked && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-4 py-3 text-sm">
          {partial ? (
            <>
              <p className="font-medium">Application {data.locked.application_no} is approved. Most of your profile is now locked.</p>
              <p className="mt-0.5 text-blue-800">
                You can still update: {openFields.map(labelFor).join(', ')}.
                For anything else, contact the admissions office.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Your profile is locked while application {data.locked.application_no} is {data.locked.status_label}.</p>
              <p className="mt-0.5 text-blue-800">
                This keeps what the admissions office is reviewing unchanged. If something needs correcting,
                contact the admissions office; they can return your application to you for correction.
              </p>
            </>
          )}
        </div>
      )}

      {data.returned?.map((r) => (
        <ReturnedBanner key={r.id} app={r} complete={data.completeness?.complete}
          onDone={() => api.get('/profile').then(({ data: d }) => apply(d))} />
      ))}

      <Completeness c={data.completeness} />

      {/* A disabled fieldset disables every input and button inside it. */}
      <fieldset disabled={!!data.locked && !partial} className="space-y-6 min-w-0 disabled:opacity-75">

      {/* ── Personal ─────────────────────────────────────────── */}
      <form id="section-personal" onSubmit={savePersonal} className="bg-white rounded-xl shadow-sm p-6 space-y-4 scroll-mt-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Personal Details</h2>
          <p className="text-xs text-gray-500 mt-0.5">Fields marked <span className="text-red-500">*</span> are needed before you can apply. You can save a partly filled form.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PERSONAL.map((f) => (
            <div key={f.key} className={f.textarea ? 'md:col-span-2' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {f.label}{' '}
                {(f.required || data.required_personal?.includes(f.key)) && <span className="text-red-500">*</span>}
              </label>
              {f.options ? (
                <select value={personal[f.key] ?? ''} onChange={setField(f.key)} disabled={fieldLocked(f.key)} className={`${inputCls(errors[f.key])} disabled:bg-gray-100 disabled:text-gray-500`}>
                  <option value="">Select…</option>
                  {f.options.map((o) => <option key={o} value={o}>{cap(o)}</option>)}
                </select>
              ) : f.textarea ? (
                <textarea rows={2} value={personal[f.key] ?? ''} onChange={setField(f.key)} disabled={fieldLocked(f.key)} className={`${inputCls(errors[f.key])} disabled:bg-gray-100 disabled:text-gray-500`} />
              ) : (
                <input type={f.type ?? 'text'} value={personal[f.key] ?? ''} onChange={setField(f.key)} disabled={fieldLocked(f.key)} className={`${inputCls(errors[f.key])} disabled:bg-gray-100 disabled:text-gray-500`} />
              )}
              {errors[f.key] && <p className="text-xs text-red-600 mt-1">{errors[f.key][0]}</p>}
            </div>
          ))}
        </div>
        <div className="pt-2">
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Personal Details'}
          </button>
        </div>
      </form>

      </fieldset>
      <div id="section-education" className="scroll-mt-4">
        <EducationSection data={data} onSaved={setData} locked={!!data.locked} />
      </div>

      
      
      <div id="section-documents" className="scroll-mt-4">
        <DocumentsSection data={data} onSaved={setData} profileLocked={!!data.locked} />
      </div>

    </div>
  );
}

function ReturnedBanner({ app, complete, onDone }) {
  const [busy, setBusy] = useState(false);

  const resubmit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/applications/${app.id}/resubmit`);
      toast.success(data.message ?? 'Application resubmitted.');
      await onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not resubmit.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-4 text-sm">
      <p className="font-semibold text-orange-900">
        Application {app.application_no}{app.program ? ` (${app.program.name})` : ''} was returned for correction
      </p>
      <p className="mt-2 text-orange-800">The admissions office says:</p>
      <p className="mt-1 bg-white/70 border border-orange-100 rounded-lg px-3 py-2 text-gray-800 whitespace-pre-line">
        {app.correction_note}
      </p>
      <p className="mt-2 text-orange-800">
        Make the changes below and save each section, then press Resubmit.
      </p>
      <button
        onClick={resubmit}
        disabled={busy || !complete}
        title={complete ? '' : 'Complete your profile first'}
        className="mt-3 px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50"
      >
        {busy ? 'Resubmitting…' : 'Resubmit Application'}
      </button>
    </div>
  );
}