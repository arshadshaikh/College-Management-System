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

function Completeness({ c }) {
  if (!c) return null;
  const color = c.complete ? 'bg-green-500' : c.percent >= 60 ? 'bg-indigo-500' : 'bg-amber-500';
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-900">Profile completeness</h2>
        <span className="text-sm font-semibold text-gray-700">{c.percent}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-2 ${color} transition-all`} style={{ width: `${c.percent}%` }} />
      </div>
      {c.complete ? (
        <p className="text-xs text-green-700 mt-3">Your profile is complete. You can now apply for admission.</p>
      ) : (
        <div className="mt-3 text-xs text-gray-600">
          <p className="mb-1">Still needed:</p>
          <ul className="list-disc ml-5 space-y-0.5">
            {c.missing.map((m) => (
              <li key={`${m.section}-${m.key}`}>
                {cap(m.section)}: {m.label ?? labelFor(m.key)}
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
      const { data: d } = await api.put('/profile', personal);
      apply(d);
      toast.success(d.message ?? 'Profile saved.');
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
        toast.error('Please fix the highlighted fields.');
      }
    } finally {
      setSaving(false);
    }
  };

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

      <Completeness c={data.completeness} />

      {/* ── Personal ─────────────────────────────────────────── */}
      <form onSubmit={savePersonal} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Personal Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PERSONAL.map((f) => (
            <div key={f.key} className={f.textarea ? 'md:col-span-2' : ''}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {f.label} {f.required && <span className="text-red-500">*</span>}
              </label>
              {f.options ? (
                <select value={personal[f.key] ?? ''} onChange={setField(f.key)} className={inputCls(errors[f.key])}>
                  <option value="">Select…</option>
                  {f.options.map((o) => <option key={o} value={o}>{cap(o)}</option>)}
                </select>
              ) : f.textarea ? (
                <textarea rows={2} value={personal[f.key] ?? ''} onChange={setField(f.key)} className={inputCls(errors[f.key])} />
              ) : (
                <input type={f.type ?? 'text'} value={personal[f.key] ?? ''} onChange={setField(f.key)} className={inputCls(errors[f.key])} />
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
      <EducationSection data={data} onSaved={setData} />
      <DocumentsSection data={data} onSaved={setData} />
    </div>
  );
}
