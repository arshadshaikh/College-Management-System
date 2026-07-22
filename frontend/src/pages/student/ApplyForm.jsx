import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';

const DOCS = [
  { key: 'doc_cnic',   label: 'CNIC (B-Form)' },
  { key: 'doc_matric', label: 'Matric Certificate' },
  { key: 'doc_inter',  label: 'Intermediate Certificate' },
  { key: 'doc_photo',  label: 'Photograph' },
];

const MAX_MB = 2;

export default function ApplyForm() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [form, setForm] = useState({ program_id: '', semester_no: 1, admission_year: new Date().getFullYear() });
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/programs', { params: { per_page: 100 } })
      .then(({ data }) => setPrograms(data.data ?? data))
      .catch(() => toast.error('Could not load programs.'));
  }, []);

  const setFile = (key) => (e) => {
    const file = e.target.files[0] ?? null;
    if (file && file.size > MAX_MB * 1024 * 1024) {
      toast.error(`${file.name} is larger than ${MAX_MB} MB.`);
      e.target.value = '';
      return;
    }
    setFiles((f) => ({ ...f, [key]: file }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();

    // Client-side completeness check before the upload starts.
    const missing = DOCS.filter((d) => !files[d.key]);
    if (!form.program_id || missing.length) {
      const er = {};
      if (!form.program_id) er.program_id = ['Please choose a program.'];
      missing.forEach((d) => { er[d.key] = ['This document is required.']; });
      setErrors(er);
      toast.error('Please complete all required fields.');
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      const fd = new FormData();
      fd.append('program_id', form.program_id);
      fd.append('semester_no', form.semester_no);
      fd.append('admission_year', form.admission_year);
      DOCS.forEach((d) => fd.append(d.key, files[d.key]));

      const { data } = await api.post('/applications', fd);
      toast.success(`Application ${data.application?.application_no} submitted.`);
      navigate('/my-applications');
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
        const msg = err.response.data.message;
        if (msg && !err.response.data.errors) toast.error(msg);   // e.g. duplicate application / no seats
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
        <Link to="/my-applications" className="text-sm text-gray-500 hover:underline">← My Applications</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Apply for Admission</h1>
      </div>

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
              onChange={(e) => setForm({ ...form, semester_no: e.target.value })} className={inputCls()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admission Year</label>
            <input type="number" value={form.admission_year}
              onChange={(e) => setForm({ ...form, admission_year: e.target.value })} className={inputCls()} />
          </div>
        </div>

        <div className="border-t pt-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Required Documents <span className="font-normal text-gray-500">(jpg/png/pdf, max {MAX_MB} MB each)</span></h2>
          <div className="space-y-4">
            {DOCS.map((d) => (
              <div key={d.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{d.label} <span className="text-red-500">*</span></label>
                <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={setFile(d.key)} className="text-sm" />
                {files[d.key] && <p className="text-xs text-green-600 mt-1">✓ {files[d.key].name}</p>}
                {errors[d.key] && <p className="text-xs text-red-600 mt-1">{errors[d.key][0]}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Submitting…' : 'Submit Application'}
          </button>
          <Link to="/my-applications" className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}