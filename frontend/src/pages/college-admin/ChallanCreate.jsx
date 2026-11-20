import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';

// Admin: bill ANY student (hostel, transcript, exam, fines ...), no admission application needed.
// Fee lines come from the program's fee structure for the chosen fee types and Part/Semester,
// plus any items typed in here. POST /api/challans without application_id (privilege challans.store).

const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);
const money = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

export default function ChallanCreate() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Student picker
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState(null);       // full student (with applications.program)

  // Catalogs
  const [programs, setPrograms] = useState([]);
  const [feeTypes, setFeeTypes] = useState([]);
  const [program, setProgram] = useState(null);       // selected program with fee_structures

  // Form
  const [programId, setProgramId] = useState('');
  const [types, setTypes] = useState([]);              // chosen fee type slugs
  const [semesterNo, setSemesterNo] = useState('');
  const [items, setItems] = useState([]);              // [{label, amount}]
  const [dueDate, setDueDate] = useState(inDays(14));
  const [title, setTitle] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/programs', { params: { per_page: 200, sort_by: 'name', sort_dir: 'asc' } })
      .then(({ data }) => setPrograms(data.data ?? data))
      .catch(() => {});
    api.get('/settings')
      .then(({ data }) => setFeeTypes((data.fee_types ?? []).filter((t) => t.is_active)))
      .catch(() => {});
  }, []);

  // ?student=ID (e.g. from a student's page) preselects the student.
  useEffect(() => {
    const id = params.get('student');
    if (id) pickStudent({ id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search students as the admin types (name, CNIC or email).
  useEffect(() => {
    if (student || query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      setSearching(true);
      api.get('/students', { params: { search: query.trim(), per_page: 8 } })
        .then(({ data }) => setResults(data.data ?? data))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, student]);

  const pickStudent = async (s) => {
    try {
      const { data } = await api.get(`/students/${s.id}`);
      setStudent(data);
      setResults([]);
      setErrors((e) => ({ ...e, student_id: undefined }));
      // Default program: the student's latest approved admission, if any.
      const approved = (data.applications ?? []).filter((a) => a.status === 'approved');
      const last = approved[approved.length - 1];
      if (last?.program_id) setProgramId(String(last.program_id));
    } catch { toast.error('Could not load the student.'); }
  };

  // Load the chosen program's fee lines (for the preview).
  useEffect(() => {
    if (!programId) { setProgram(null); return; }
    api.get(`/programs/${programId}`)
      .then(({ data }) => setProgram(data))
      .catch(() => setProgram(null));
  }, [programId]);

  const annual = program?.scheme === 'annual';
  const termLabel = annual ? 'Part' : 'Semester';

  // Same rule as the server: active, in date, chosen type, and (no part) or (the chosen part).
  const matchedFees = useMemo(() => {
    const fees = program?.fee_structures ?? program?.feeStructures ?? [];
    const now = today();
    return fees.filter((f) =>
      f.is_active
      && types.includes(f.fee_type)
      && (f.effective_from ?? '').slice(0, 10) <= now
      && (!f.effective_to || f.effective_to.slice(0, 10) >= now)
      && (f.semester_no == null || (semesterNo && Number(f.semester_no) === Number(semesterNo))))
      // Same order as the saved challan: Settings fee type order, then part, then oldest first.
      .sort((a, b) => {
        const rank = (f) => { const i = feeTypes.findIndex((t) => t.slug === f.fee_type); return i < 0 ? 9999 : i; };
        return rank(a) - rank(b) || (a.semester_no ?? 0) - (b.semester_no ?? 0) || a.id - b.id;
      });
  }, [program, types, semesterNo, feeTypes]);

  const extraTotal = items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const total = matchedFees.reduce((s, f) => s + Number(f.amount), 0) + extraTotal;

  const toggleType = (slug) => {
    setTypes((list) => (list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]));
    setErrors((e) => ({ ...e, fee_types: undefined }));
  };

  const setItem = (i, key, value) => setItems((list) => list.map((it, j) => (j === i ? { ...it, [key]: value } : it)));

  const submit = async (e) => {
    e.preventDefault();
    if (!student) { setErrors({ student_id: ['Choose a student.'] }); return; }
    setSaving(true);
    setErrors({});
    try {
      const { data } = await api.post('/challans', {
        student_id: student.id,
        program_id: programId ? Number(programId) : null,
        fee_types: types,
        semester_no: semesterNo ? Number(semesterNo) : null,
        items: items.filter((i) => i.label || i.amount).map((i) => ({ label: i.label, amount: Number(i.amount) })),
        due_date: dueDate,
        title: title || null,
      });
      toast.success(`Challan ${data.challan.challan_no} created.`);
      navigate(`${PORTAL}/challans/${data.challan.id}`);
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
        toast.error(err.response.data.message ?? 'Please fix the highlighted fields.');
      }
    } finally { setSaving(false); }
  };

  const err = (k) => errors[k]?.[0];
  const itemErr = Object.keys(errors).find((k) => k.startsWith('items.'));
  const inputCls = (k) => `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
    err(k) ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`;
  const Label = ({ children, required }) => (
    <label className="block text-sm font-medium text-gray-700 mb-1">{children}{required && <span className="text-red-500"> *</span>}</label>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to={`${PORTAL}/challans`} className="text-sm text-gray-500 hover:underline">← Challans</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">New Challan</h1>
        <p className="text-sm text-gray-500">Bill any student: hostel, transcript, exam, fines and so on.</p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* 1. Student */}
        <section className="bg-white rounded-xl shadow-sm p-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Student</h2>
          {student ? (
            <div className="flex items-center justify-between rounded-lg bg-indigo-50 px-4 py-3">
              <div>
                <div className="font-medium text-gray-900">{student.name}</div>
                <div className="text-xs text-gray-600">{student.cnic_no}{student.email ? ` · ${student.email}` : ''}</div>
              </div>
              <button type="button" onClick={() => { setStudent(null); setQuery(''); }}
                className="text-sm text-indigo-600 hover:underline">Change</button>
            </div>
          ) : (
            <div className="relative">
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, CNIC or email" className={inputCls('student_id')} autoFocus />
              {searching && <p className="text-xs text-gray-400 mt-1">Searching…</p>}
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
                  {results.map((s) => (
                    <button type="button" key={s.id} onClick={() => pickStudent(s)}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-50">
                      <div className="text-sm font-medium text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.cnic_no}{s.email ? ` · ${s.email}` : ''}</div>
                    </button>
                  ))}
                </div>
              )}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">No students found.</p>
              )}
            </div>
          )}
          {err('student_id') && <p className="text-xs text-red-600">{err('student_id')}</p>}
        </section>

        {/* 2. Fees */}
        <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Fees</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Program</Label>
              <select value={programId} onChange={(e) => { setProgramId(e.target.value); setSemesterNo(''); }}
                className={inputCls('program_id')}>
                <option value="">No program (typed items only)</option>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>)}
              </select>
              {err('program_id') && <p className="text-xs text-red-600 mt-1">{err('program_id')}</p>}
            </div>
            <div>
              <Label>{termLabel} <span className="font-normal text-gray-400">(optional)</span></Label>
              <select value={semesterNo} onChange={(e) => setSemesterNo(e.target.value)}
                disabled={!program} className={inputCls('semester_no')}>
                <option value="">One-time fees only</option>
                {Array.from({ length: program?.total_semesters ?? 0 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{termLabel} {n}</option>
                ))}
              </select>
              {err('semester_no') && <p className="text-xs text-red-600 mt-1">{err('semester_no')}</p>}
            </div>
          </div>

          {programId && (
            <div>
              <Label>Fee types</Label>
              <div className="flex flex-wrap gap-2">
                {feeTypes.map((t) => {
                  const on = types.includes(t.slug);
                  return (
                    <button type="button" key={t.slug} onClick={() => toggleType(t.slug)}
                      className={`px-3 py-1.5 rounded-full text-sm border ${on
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                      {t.name}
                    </button>
                  );
                })}
              </div>
              {err('fee_types') && <p className="text-xs text-red-600 mt-1">{err('fee_types')}</p>}
            </div>
          )}

          {/* Preview of the program's lines */}
          {programId && types.length > 0 && (
            matchedFees.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3">
                This program has no active fees of the chosen type{types.length > 1 ? 's' : ''}
                {semesterNo ? ` for ${termLabel} ${semesterNo}` : ' without a part'}.{' '}
                <Link to={`${PORTAL}/programs/${programId}/fees`} className="underline">Set up fees</Link> or add an item below.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                {matchedFees.map((f) => (
                  <div key={f.id} className="flex justify-between px-4 py-2 text-sm">
                    <span className="text-gray-700">{f.label}
                      {f.semester_no ? <span className="text-xs text-gray-400"> · {termLabel} {f.semester_no}</span> : null}
                    </span>
                    <span className="text-gray-900">{money(f.amount)}</span>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Typed-in items */}
          <div>
            <Label>Other items <span className="font-normal text-gray-400">(optional)</span></Label>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={it.label} onChange={(e) => setItem(i, 'label', e.target.value)}
                    placeholder="e.g. Duplicate ID card" className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="number" min="1" value={it.amount} onChange={(e) => setItem(i, 'amount', e.target.value)}
                    placeholder="Amount" className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button type="button" onClick={() => setItems((l) => l.filter((_, j) => j !== i))}
                    className="px-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">Remove</button>
                </div>
              ))}
            </div>
            {itemErr && <p className="text-xs text-red-600 mt-1">{errors[itemErr][0]}</p>}
            <button type="button" onClick={() => setItems((l) => [...l, { label: '', amount: '' }])}
              className="mt-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">+ Add item</button>
          </div>

          <div className="flex justify-between border-t border-gray-100 pt-3 font-semibold text-gray-900">
            <span>Total</span><span>{money(total)}</span>
          </div>
        </section>

        {/* 3. Challan details */}
        <section className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Challan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label required>Due date</Label>
              <input type="date" value={dueDate} min={inDays(1)} onChange={(e) => setDueDate(e.target.value)}
                className={inputCls('due_date')} />
              {err('due_date') && <p className="text-xs text-red-600 mt-1">{err('due_date')}</p>}
            </div>
            <div>
              <Label>Title <span className="font-normal text-gray-400">(optional)</span></Label>
              <input type="text" value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)}
                placeholder="Made from the fee types if left empty" className={inputCls('title')} />
            </div>
          </div>
        </section>

        <div className="flex gap-3">
          <button type="submit" disabled={saving || total <= 0}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Creating…' : `Create challan${total > 0 ? ` (${money(total)})` : ''}`}
          </button>
          <Link to={`${PORTAL}/challans`} className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
