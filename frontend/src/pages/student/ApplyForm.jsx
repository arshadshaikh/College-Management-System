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
  const [form, setForm] = useState({ program_id: searchParams.get('program') ?? '', semester_no: 1, admission_year: new Date().getFullYear(), shift: '' });
  const [shifts, setShifts] = useState([]);   // shifts the college runs (Settings → Timetable)
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);   // full profile payload, shown on the review step
  const [step, setStep] = useState('form');        // form -> review -> submit
  const [agree, setAgree] = useState(false);
  const [appliedIds, setAppliedIds] = useState([]);  // programs with an active application

  useEffect(() => {
    api.get('/programs', { params: { per_page: 100 } })
      .then(({ data }) => setPrograms(data.data ?? data))
      .catch(() => toast.error('Could not load programs.'));
    api.get('/applications/my')
      .then(({ data }) => setAppliedIds((data.data ?? data)
        .filter((a) => a.status !== 'withdrawn' && a.status !== 'rejected')
        .map((a) => String(a.program_id))))
      .catch(() => {});
    api.get('/public/settings')
      .then(({ data }) => {
        const keys = (data.settings?.shifts || 'morning').split(',').map((s) => s.trim()).filter(Boolean);
        setShifts(keys);
        if (keys.length === 1) setForm((f) => ({ ...f, shift: keys[0] }));
      })
      .catch(() => {});
    api.get('/profile')
      .then(({ data }) => { setCompleteness(data.completeness); setProfile(data); })
      .catch(() => {});
  }, []);

  // Step 1: check the form, then show the review.
  const review = (e) => {
    e.preventDefault();
    if (!form.program_id) {
      setErrors({ program_id: ['Please choose a program.'] });
      return;
    }
    if (shifts.length > 1 && !form.shift) {
      setErrors({ shift: ['Please choose a shift.'] });
      return;
    }
    setErrors({});
    setAgree(false);
    setStep('review');
    window.scrollTo?.(0, 0);
  };

  // Step 2: confirmed on the review screen.
  const submit = async () => {
    setSaving(true);
    setErrors({});
    try {
      const { data } = await api.post('/applications', form);
      toast.success(`Application ${data.application?.application_no} submitted.`);
      navigate(`${PORTAL}/my-applications`);
    } catch (err) {
      if (err.response?.status === 422) {
        setStep('form');                                        // show the problem on the form
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

      {step === 'review' && selected && (
        <ReviewCard program={selected} form={form} profile={profile}
          showShift={shifts.length > 1}
          agree={agree} setAgree={setAgree} saving={saving}
          onBack={() => setStep('form')} onSubmit={submit} />
      )}

      {step === 'form' && (
      <form onSubmit={review} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Program <span className="text-red-500">*</span></label>
          <select value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })} className={inputCls(errors.program_id)}>
            <option value="">Choose a program…</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id} disabled={appliedIds.includes(String(p.id))}>
                {p.name} ({p.code}){appliedIds.includes(String(p.id)) ? ' — already applied' : ''}
              </option>
            ))}
          </select>
          {errors.program_id && <p className="text-xs text-red-600 mt-1">{errors.program_id[0]}</p>}
          {selected?.eligibility_criteria && (
            <p className="text-xs text-gray-500 mt-2">Eligibility: {selected.eligibility_criteria}</p>
          )}
        </div>

        {shifts.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shift <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-2">
              {shifts.map((key) => (
                <button type="button" key={key}
                  onClick={() => { setForm({ ...form, shift: key }); setErrors({ ...errors, shift: undefined }); }}
                  className={`px-4 py-2 rounded-lg text-sm border ${form.shift === key
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  {shiftLabel(key)}
                </button>
              ))}
            </div>
            {errors.shift && <p className="text-xs text-red-600 mt-1">{errors.shift[0]}</p>}
          </div>
        )}

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
            Review application
          </button>
          <Link to={`${PORTAL}/my-applications`} className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
      )}
    </div>
  );
}

const shiftLabel = (key) => (key ? key.charAt(0).toUpperCase() + key.slice(1) : '');

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm">
    <span className="text-gray-500">{label}</span>
    <span className="text-gray-900 text-right">{value || '—'}</span>
  </div>
);

// One-page summary of what the college will receive, plus a declaration.
function ReviewCard({ program, form, profile, showShift, agree, setAgree, saving, onBack, onSubmit }) {
  const u = profile?.user ?? {};
  const p = profile?.profile ?? {};
  const levelLabel = (k) => profile?.levels?.find((l) => l.key === k)?.label ?? k;
  const docName = (slug) => profile?.document_types?.find((t) => t.slug === slug)?.name ?? slug;
  const result = (e) => (e.cgpa ? `CGPA ${e.cgpa} / ${e.cgpa_scale}` : e.obtained_marks ? `${e.obtained_marks} / ${e.total_marks}` : '');

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Review your application</h2>
        <p className="text-sm text-gray-500 mt-1">Please check everything below. To change your details, go back to My Profile.</p>
      </div>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Program</h3>
        <div className="divide-y divide-gray-100">
          <Row label="Program" value={`${program.name} (${program.code})`} />
          {showShift && <Row label="Shift" value={shiftLabel(form.shift)} />}
          <Row label="Semester" value={form.semester_no} />
          <Row label="Admission year" value={form.admission_year} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Applicant</h3>
        <div className="divide-y divide-gray-100">
          <Row label="Name" value={u.name} />
          <Row label="Father's name" value={p.father_name} />
          <Row label="CNIC / B-Form" value={u.cnic_no} />
          <Row label="Date of birth" value={p.date_of_birth?.slice(0, 10)} />
          <Row label="Domicile" value={[p.domicile_district, p.domicile_province].filter(Boolean).join(', ')} />
          <Row label="Mobile" value={u.phone} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Education</h3>
        {(profile?.educations ?? []).length === 0 ? <p className="text-sm text-gray-500">None added.</p> : (
          <div className="divide-y divide-gray-100">
            {profile.educations.map((e) => (
              <Row key={e.id} label={levelLabel(e.level)}
                value={[e.board_university, e.passing_year, result(e)].filter(Boolean).join(' · ')} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Documents</h3>
        <div className="flex flex-wrap gap-2">
          {(profile?.documents ?? []).map((d) => (
            <span key={d.id} className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700">✓ {docName(d.document_type)}</span>
          ))}
        </div>
      </section>

      <label className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">
        <input type="checkbox" className="h-4 w-4 mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        I confirm that the information and documents I have provided are true and complete. I understand that
        false information may lead to cancellation of my admission.
      </label>

      <div className="flex gap-3">
        <button type="button" onClick={onSubmit} disabled={!agree || saving}
          className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Submitting…' : 'Confirm & Submit'}
        </button>
        <button type="button" onClick={onBack} className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
          Back
        </button>
      </div>
    </div>
  );
}
