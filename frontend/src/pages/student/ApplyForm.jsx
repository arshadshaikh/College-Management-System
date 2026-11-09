import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';

// Applying no longer uploads files: documents, education and personal details
// come from the applicant profile (My Profile) and are reused for every application.
// Whether an incomplete profile may apply is the college setting `require_complete_profile`
// (checked on the server; the 422 reply includes what is missing).

export default function ApplyForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();   // ?program=ID from the public "Apply now" button
  const [programs, setPrograms] = useState([]);
  const [completeness, setCompleteness] = useState(null);
  const [form, setForm] = useState({ program_id: searchParams.get('program') ?? '', semester_no: 1, admission_year: new Date().getFullYear() });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/programs', { params: { per_page: 100 } })
      .then(({ data }) => setPrograms(data.data ?? data))
      .catch(() => toast.error('Could not load programs.'));
    api.get('/profile')
      .then(({ data }) => setCompleteness(data.completeness))
      .catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.program_id) {
      setErrors({ program_id: ['Please choose a program.'] });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const { data } = await api.post('/applications', form);
      toast.success(`Application ${data.application?.application_no} submitted.`);
      navigate(`${PORTAL}/my-applications`);
    } catch (err) {
      if (err.response?.status === 422) {
        const d = err.response.data;
        if (d.completeness) setCompleteness(d.completeness);   // profile gate
        setErrors(d.errors ?? {});
        if (d.message && !d.errors) toast.error(d.message);    // duplicate / no seats / incomplete profile
      }
    } finally {
      setSaving(false);
    }
  };

  const selected = programs.find((p) => String(p.id) === String(form.program_id));
  const inputCls = (error) =>
    `w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
      error ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'
    }`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to={`${PORTAL}/my-applications`} className="text-sm text-gray-500 hover:underline">← My Applications</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Apply for Admission</h1>
      </div>

      {/* Profile status */}
      {completeness && (
        completeness.complete ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
            Your admission profile is complete. Your details, education and documents will be sent with this application.{' '}
            <Link to={`${PORTAL}/my-profile`} className="underline">Review profile</Link>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
            <p className="font-medium">Your admission profile is {completeness.percent}% complete.</p>
            <ul className="list-disc ml-5 mt-1 text-xs">
              {completeness.missing.map((m) => (
                <li key={`${m.section}-${m.key}`}>
                  {m.section.charAt(0).toUpperCase() + m.section.slice(1)}: {m.label ?? m.key.replace(/_/g, ' ')}
                </li>
              ))}
            </ul>
            <Link to={`${PORTAL}/my-profile`}
              className="inline-block mt-3 px-4 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700">
              Complete my profile
            </Link>
          </div>
        )
      )}

      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Program <span className="text-red-500">*</span></label>
          <select value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })} className={inputCls(errors.program_id)}>
            <option value="">Choose a program…</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </select>
          {errors.program_id && <p className="text-xs text-red-600 mt-1">{errors.program_id[0]}</p>}
          {selected?.eligibility_criteria && (
            <p className="text-xs text-gray-500 mt-2">Eligibility: {selected.eligibility_criteria}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
            <input type="number" min="1" value={form.semester_no}
              onChange={(e) => setForm({ ...form, semester_no: e.target.value })} className={inputCls(errors.semester_no)} />
            {errors.semester_no && <p className="text-xs text-red-600 mt-1">{errors.semester_no[0]}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admission Year</label>
            <input type="number" value={form.admission_year}
              onChange={(e) => setForm({ ...form, admission_year: e.target.value })} className={inputCls(errors.admission_year)} />
            {errors.admission_year && <p className="text-xs text-red-600 mt-1">{errors.admission_year[0]}</p>}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Submitting…' : 'Submit Application'}
          </button>
          <Link to={`${PORTAL}/my-applications`} className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
