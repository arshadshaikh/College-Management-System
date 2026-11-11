import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../../api';
import DocumentCard from './DocumentCard';

// One card per education level from the API (`data.levels`).
// Which levels are required comes from the college setting `required_education_levels`.

const EMPTY = {
  degree_title: '', board_university: '', institution: '', roll_no: '', passing_year: '',
  total_marks: '', obtained_marks: '', grade: '', cgpa: '', cgpa_scale: '4',
};

const inputCls = (error) =>
  `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
    error ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'
  }`;

function LevelCard({ level, row, onSaved, docTypes, docs, locked }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [mode, setMode] = useState(level.result);      // 'marks' | 'cgpa'
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  
  // Documents asked at this level (Pass, Marks ...), with the full type for file rules.
  const levelDocs = (level.documents ?? [])
    .map((d) => ({ ...d, type: docTypes.find((t) => t.slug === d.slug) }))
    .filter((d) => d.type);
  const uploaded = levelDocs.filter((d) => docs.some((x) => x.document_type === d.slug)).length;
  const showDocs = levelDocs.length > 0 && (row || level.required);

  // Fill the form from the saved row whenever it changes.
  useEffect(() => {
    if (!row) { setForm(EMPTY); setMode(level.result); return; }
    const next = { ...EMPTY };
    Object.keys(EMPTY).forEach((k) => { next[k] = row[k] ?? ''; });
    next.cgpa_scale = row.cgpa_scale ? String(Number(row.cgpa_scale)) : '4';
    setForm(next);
    setMode(row.cgpa ? 'cgpa' : row.total_marks ? 'marks' : level.result);
  }, [row, level.result]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    // Send only the result fields for the chosen mode.
    const body = { ...form, level: level.key };
    if (mode === 'marks') { body.cgpa = ''; body.cgpa_scale = ''; }
    else { body.total_marks = ''; body.obtained_marks = ''; }
    try {
      const { data } = await api.put('/profile/educations', body);
      onSaved(data);
      setOpen(false);
      toast.success(`${level.label} saved.`);
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
        if (!err.response.data.errors) toast.error(err.response.data.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!row) return;
    setSaving(true);
    try {
      const { data } = await api.delete(`/profile/educations/${row.id}`);
      onSaved(data);
      setOpen(false);
      toast.success(`${level.label} removed.`);
    } finally {
      setSaving(false);
    }
  };

  const summary = row
    ? [
        row.degree_title,
        row.board_university,
        row.passing_year,
        row.total_marks
          ? `${row.obtained_marks}/${row.total_marks} (${((row.obtained_marks / row.total_marks) * 100).toFixed(1)}%)`
          : row.cgpa ? `CGPA ${Number(row.cgpa).toFixed(2)}/${Number(row.cgpa_scale).toFixed(2)}` : null,
        row.grade && `Grade ${row.grade}`,
      ].filter(Boolean).join(' · ')
    : null;

  const field = (k, label, props = {}) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input value={form[k]} onChange={set(k)} className={inputCls(errors[k])} {...props} />
      {errors[k] && <p className="text-xs text-red-600 mt-1">{errors[k][0]}</p>}
    </div>
  );

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {level.label}{' '}
            {level.required
              ? <span className="text-xs font-normal text-red-600">Required</span>
              : <span className="text-xs font-normal text-gray-400">Optional</span>}
          </p>
          <p className={`text-xs mt-0.5 ${row ? 'text-green-700' : 'text-gray-500'}`}>
            {summary ?? 'Not added yet'}
            {row && levelDocs.length > 0 && ` · ${uploaded} of ${levelDocs.length} documents uploaded`}
          </p>
        </div>
        
        {!locked && (
          <button type="button" onClick={() => setOpen(!open)}
            className="shrink-0 px-3 py-1.5 border border-gray-300 rounded-lg text-xs hover:bg-gray-50">
            {open ? 'Close' : row ? 'Edit' : 'Add'}
          </button>
        )}
      </div>

      {showDocs && (
        <div className="mt-3 space-y-2">
          {levelDocs.map((d) => (
            <DocumentCard key={d.slug} type={d.type} required={level.required && d.required} locked={locked}
              doc={docs.find((x) => x.document_type === d.slug)} onSaved={onSaved} />
          ))}
        </div>
      )}

      {open && (
        <form onSubmit={save} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {field('degree_title', 'Degree / Group (e.g. Science, BS Computer Science)')}
            {field('board_university', 'Board / University *')}
            {field('institution', 'School / College / Institute')}
            {field('roll_no', 'Roll Number')}
            {field('passing_year', 'Passing Year *', { type: 'number', min: 1950, max: new Date().getFullYear() })}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Result Type</label>
              <select value={mode} onChange={(e) => setMode(e.target.value)} className={inputCls()}>
                <option value="marks">Marks</option>
                <option value="cgpa">CGPA</option>
              </select>
            </div>
            {mode === 'marks' ? (
              <>
                {field('total_marks', 'Total Marks *', { type: 'number', min: 1 })}
                {field('obtained_marks', 'Obtained Marks *', { type: 'number', min: 0 })}
                {field('grade', 'Grade / Division')}
              </>
            ) : (
              <>
                {field('cgpa', 'CGPA *', { type: 'number', step: '0.01', min: 0 })}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Out of *</label>
                  <select value={form.cgpa_scale} onChange={set('cgpa_scale')} className={inputCls(errors.cgpa_scale)}>
                    <option value="4">4.00</option>
                    <option value="5">5.00</option>
                  </select>
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : `Save ${level.label}`}
            </button>
            {row && (
              <button type="button" onClick={remove} disabled={saving}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50">
                Remove
              </button>
            )}
          </div>
         </form>
      )}
    </div>
  );
}

export default function EducationSection({ data, onSaved, locked = false }) {
  const rows = data.educations ?? [];
  // Required levels first, then optional, keeping catalog order within each group.
  const levels = [...(data.levels ?? [])].sort((a, b) => Number(b.required) - Number(a.required));

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Education</h2>
        <p className="text-xs text-gray-500 mt-1">Add every level you have completed. Required levels are marked.</p>
      </div>
      <div className="space-y-3">
        {levels.map((level) => (
          <LevelCard key={level.key} level={level} locked={locked}
            row={rows.find((r) => r.level === level.key)} onSaved={onSaved}
            docTypes={data.document_types ?? []} docs={data.documents ?? []} />
        ))}
      </div>
    </div>
  );
}
