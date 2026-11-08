import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';

const DEGREE_LEVELS = ['certificate', 'diploma', 'associate', 'bachelor', 'master', 'phd'];
// Display names (stored values stay lowercase).
const DEGREE_LABELS = {
  certificate: 'Certificate', diploma: 'Diploma', associate: 'Associate',
  bachelor: 'Bachelor', master: 'Master', phd: 'PhD',
};

const EMPTY = {
  name: '', code: '', degree_level: 'bachelor',
  duration_years: 4, total_semesters: 8, total_seats: 60,
  eligibility_criteria: '', description: '', is_active: true,
  required_education_levels: '',
};

const splitLevels = (v) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export default function ProgramForm() {
  const { id } = useParams();            // present = edit mode
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [levels, setLevels] = useState([]);       // catalog from config/admission.php
  const [baseline, setBaseline] = useState([]);   // college setting required_education_levels

  // Level catalog + college baseline come from the settings endpoint.
  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => {
        setLevels(data.education_levels ?? []);
        setBaseline(splitLevels(data.settings?.required_education_levels));
      })
      .catch(() => {});
  }, []);

  // Edit mode: load the existing program into the form.
  useEffect(() => {
    if (!isEdit) return;
    api.get(`/programs/${id}`)
      .then(({ data }) => setForm({
        ...EMPTY,
        ...data,
        eligibility_criteria: data.eligibility_criteria ?? '',
        description: data.description ?? '',
        required_education_levels: data.required_education_levels ?? '',
      }))
      .catch(() => toast.error('Could not load program.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((er) => ({ ...er, [key]: undefined }));   // clear field error on change
  };

  // Extra levels for this program only (stored in catalog order, without baseline levels).
  const extra = splitLevels(form.required_education_levels);
  const toggleLevel = (key, on) => {
    const next = on ? [...extra, key] : extra.filter((k) => k !== key);
    const ordered = levels.map((l) => l.key).filter((k) => next.includes(k) && !baseline.includes(k));
    setForm((f) => ({ ...f, required_education_levels: ordered.join(',') }));
    setErrors((er) => ({ ...er, required_education_levels: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      if (isEdit) {
        await api.put(`/programs/${id}`, form);
        toast.success('Program updated.');
      } else {
        await api.post('/programs', form);
        toast.success('Program created.');
      }
      navigate(`${PORTAL}/programs`);
    } catch (err) {
      if (err.response?.status === 422) {
        // Laravel validation errors: { errors: { field: [msg] } }
        setErrors(err.response.data.errors ?? {});
        toast.error('Please fix the highlighted fields.');
      }
      // other statuses already toasted by the api interceptor
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading…</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to={`${PORTAL}/programs`} className="text-sm text-gray-500 hover:underline">← Programs</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          {isEdit ? 'Edit Program' : 'Create Program'}
        </h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <Field label="Program Name" error={errors.name} required>
          <input type="text" value={form.name} onChange={set('name')} className={inputCls(errors.name)} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Code" error={errors.code}>
            <input type="text" value={form.code ?? ''} onChange={set('code')} placeholder="e.g. BSCS" className={inputCls(errors.code)} />
          </Field>
          <Field label="Degree Level" error={errors.degree_level} required>
            <select value={form.degree_level} onChange={set('degree_level')} className={inputCls(errors.degree_level)}>
              {DEGREE_LEVELS.map((l) => <option key={l} value={l}>{DEGREE_LABELS[l]}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Duration (years)" error={errors.duration_years} required>
            <input type="number" min="1" max="10" value={form.duration_years} onChange={set('duration_years')} className={inputCls(errors.duration_years)} />
          </Field>
          <Field label="Total Semesters" error={errors.total_semesters} required>
            <input type="number" min="1" max="20" value={form.total_semesters} onChange={set('total_semesters')} className={inputCls(errors.total_semesters)} />
          </Field>
          <Field label="Total Seats" error={errors.total_seats} required>
            <input type="number" min="1" max="1000" value={form.total_seats} onChange={set('total_seats')} className={inputCls(errors.total_seats)} />
          </Field>
        </div>

        <Field label="Eligibility Criteria" error={errors.eligibility_criteria}>
          <textarea rows={3} value={form.eligibility_criteria} onChange={set('eligibility_criteria')} className={inputCls(errors.eligibility_criteria)} />
        </Field>

        {/* Required education for applicants to THIS program, on top of the college baseline */}
        {levels.length > 0 && (
          <Field label="Required Education" error={errors.required_education_levels}>
            <p className="text-xs text-gray-500 mb-2">
              Greyed levels are required for every program (College Settings). Tick extra levels applicants to this program must have.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {levels.map((l) => {
                const isBase = baseline.includes(l.key);
                return (
                  <label key={l.key} className={`flex items-center gap-2 text-sm ${isBase ? 'text-gray-400' : 'text-gray-700'}`}>
                    <input type="checkbox" className="h-4 w-4" disabled={isBase}
                      checked={isBase || extra.includes(l.key)}
                      onChange={(e) => toggleLevel(l.key, e.target.checked)} />
                    {l.label}
                  </label>
                );
              })}
            </div>
          </Field>
        )}

        <Field label="Description" error={errors.description}>
          <textarea rows={3} value={form.description} onChange={set('description')} className={inputCls(errors.description)} />
        </Field>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.is_active} onChange={set('is_active')} className="rounded" />
          Active (visible to students)
        </label>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Update Program' : 'Create Program'}
          </button>
          <Link to={`${PORTAL}/programs`} className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, error, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error[0]}</p>}
    </div>
  );
}

function inputCls(error) {
  return `w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
    error ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'
  }`;
}
