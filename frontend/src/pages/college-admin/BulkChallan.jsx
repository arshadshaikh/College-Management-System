import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';

// Bill a whole class at once: program + Part/Semester -> one challan per student.
// The server previews exactly what will be billed (same fee rules as a single challan)
// and skips anyone already billed for the same thing.

const inDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const money = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;
const cap = (s) => (s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

function Card({ title, step, children, right }) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2.5">
          {step && <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">{step}</span>}
          {title}
        </h2>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const FieldError = ({ msg }) => (msg ? <p className="mt-1 text-xs text-red-600">{Array.isArray(msg) ? msg[0] : msg}</p> : null);

export default function BulkChallan() {
  const [programs, setPrograms] = useState([]);
  const [feeTypes, setFeeTypes] = useState([]);

  const [programId, setProgramId] = useState('');
  const [semesterNo, setSemesterNo] = useState('');
  const [types, setTypes] = useState([]);
  const [items, setItems] = useState([]);              // extra lines [{label, amount}]
  const [dueDate, setDueDate] = useState(inDays(14));
  const [title, setTitle] = useState('');

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [shift, setShift] = useState('');
  const [batch, setBatch] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get('/programs', { params: { per_page: 200, sort_by: 'name', sort_dir: 'asc' } })
      .then(({ data }) => setPrograms(data.data ?? data ?? [])).catch(() => {});
    api.get('/settings')
      .then(({ data }) => setFeeTypes((data.fee_types ?? []).filter((t) => t.is_active))).catch(() => {});
  }, []);

  const program  = programs.find((p) => String(p.id) === String(programId));
  const termWord = program?.scheme === 'annual' ? 'Part' : 'Semester';
  const cleanItems = items.filter((i) => i.label.trim() && Number(i.amount) > 0);

  const payload = {
    program_id: programId ? Number(programId) : null,
    semester_no: semesterNo ? Number(semesterNo) : null,
    fee_types: types,
    items: cleanItems.map((i) => ({ label: i.label.trim(), amount: Number(i.amount) })),
    due_date: dueDate,
    title: title.trim() || null,
  };
  const ready = programId && semesterNo && types.length > 0 && dueDate;

  // Live preview (debounced) whenever the bill changes.
  useEffect(() => {
    setConfirming(false);
    if (!ready) { setPreview(null); setErrors({}); return; }
    const t = setTimeout(() => {
      setLoading(true);
      api.post('/challans/bulk/preview', payload)
        .then(({ data }) => {
          setPreview(data);
          setErrors({});
          // Select everyone not billed yet.
          setSelected(new Set(data.students.filter((s) => !s.existing).map((s) => s.id)));
        })
        .catch((err) => {
          setPreview(null);
          setErrors(err.response?.status === 422 ? (err.response.data.errors ?? {}) : {});
        })
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(payload)]);

  const students = preview?.students ?? [];
  const shifts  = useMemo(() => [...new Set(students.map((s) => s.shift).filter(Boolean))], [students]);
  const batches = useMemo(() => [...new Set(students.map((s) => s.admission_year).filter(Boolean))].sort(), [students]);
  const visible = students.filter((s) => (!shift || s.shift === shift) && (!batch || String(s.admission_year) === String(batch)));
  const billable = visible.filter((s) => !s.existing);
  const chosen = students.filter((s) => selected.has(s.id) && !s.existing
    && (!shift || s.shift === shift) && (!batch || String(s.admission_year) === String(batch)));
  const grandTotal = chosen.length * (preview?.per_student ?? 0);
  const allChecked = billable.length > 0 && billable.every((s) => selected.has(s.id));

  const toggle = (id) => setSelected((cur) => { const n = new Set(cur); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((cur) => {
    const n = new Set(cur);
    billable.forEach((s) => (allChecked ? n.delete(s.id) : n.add(s.id)));
    return n;
  });
  const toggleType = (slug) => setTypes((l) => (l.includes(slug) ? l.filter((s) => s !== slug) : [...l, slug]));
  const setItem = (i, k, v) => setItems((l) => l.map((it, j) => (j === i ? { ...it, [k]: v } : it)));

  const generate = async () => {
    setSaving(true);
    try {
      const { data } = await api.post('/challans/bulk', { ...payload, student_ids: chosen.map((s) => s.id) });
      setResult(data);
      toast.success(data.message);
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
        toast.error(err.response.data.message || 'Please check the form.');
      }
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };

  // ── Done screen ──
  if (result) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-2xl">✓</div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">{result.created.length} challan{result.created.length === 1 ? '' : 's'} generated</h1>
          <p className="mt-1 text-gray-500">{preview?.title} · {program?.name} · {termWord} {semesterNo}</p>
          <p className="mt-3 text-3xl font-bold text-indigo-600">{money(result.total)}</p>
          <p className="text-xs text-gray-500">billed in total, due {new Date(dueDate).toLocaleDateString()}</p>

          {result.skipped.length > 0 && (
            <div className="mt-6 text-left bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-800">{result.skipped.length} skipped</p>
              <ul className="mt-1 text-sm text-amber-700 list-disc ml-5">
                {result.skipped.slice(0, 10).map((s) => <li key={s.id}>{s.name ?? `Student #${s.id}`}: {s.reason}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={`${PORTAL}/challans`} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Go to Challans</Link>
            <button onClick={() => { setResult(null); setPreview(null); setSemesterNo(''); setTypes([]); setItems([]); setTitle(''); }}
              className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Bill another class</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to={`${PORTAL}/challans`} className="text-sm text-indigo-600 hover:underline">← Challans</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Bill a Class</h1>
          <p className="text-sm text-gray-500 mt-1">Generate the same challan for every student in a program's {program ? termWord.toLowerCase() : 'Part / Semester'}.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left: the form + the students */}
        <div className="lg:col-span-2 space-y-6">
          <Card step="1" title="Choose the class">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Program</label>
                <select value={programId} onChange={(e) => { setProgramId(e.target.value); setSemesterNo(''); setShift(''); setBatch(''); }} className={inputCls}>
                  <option value="">Choose a program…</option>
                  {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <FieldError msg={errors.program_id} />
              </div>
              <div>
                <label className={labelCls}>{termWord}</label>
                <select value={semesterNo} onChange={(e) => setSemesterNo(e.target.value)} disabled={!program} className={`${inputCls} disabled:bg-gray-50 disabled:text-gray-400`}>
                  <option value="">{program ? `Choose a ${termWord.toLowerCase()}…` : 'Choose a program first'}</option>
                  {Array.from({ length: program?.total_semesters || 0 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{termWord} {n}</option>
                  ))}
                </select>
                <FieldError msg={errors.semester_no} />
              </div>
            </div>
          </Card>

          <Card step="2" title="What to bill">
            <label className={labelCls}>Fee types</label>
            <div className="flex flex-wrap gap-2">
              {feeTypes.map((t) => {
                const on = types.includes(t.slug);
                return (
                  <button key={t.slug} type="button" onClick={() => toggleType(t.slug)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition ${
                      on ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400'
                    }`}>
                    {on ? '✓ ' : ''}{t.name}
                  </button>
                );
              })}
            </div>
            <FieldError msg={errors.fee_types} />

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <label className={labelCls}>Extra items <span className="text-gray-400 font-normal">(optional, same for everyone)</span></label>
                {items.length < 5 && (
                  <button type="button" onClick={() => setItems((l) => [...l, { label: '', amount: '' }])} className="text-sm text-indigo-600 font-medium hover:underline">+ Add item</button>
                )}
              </div>
              {items.map((it, i) => (
                <div key={i} className="flex gap-2 mt-2">
                  <input value={it.label} onChange={(e) => setItem(i, 'label', e.target.value)} placeholder="e.g. Annual function" className={inputCls} />
                  <input value={it.amount} onChange={(e) => setItem(i, 'amount', e.target.value)} type="number" min="1" placeholder="Amount" className={`${inputCls} w-36`} />
                  <button type="button" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} className="px-3 text-gray-400 hover:text-red-600" title="Remove">✕</button>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Due date</label>
                <input type="date" value={dueDate} min={inDays(1)} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
                <FieldError msg={errors.due_date} />
              </div>
              <div>
                <label className={labelCls}>Title <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={preview?.title ?? 'Made from the fee types'} className={inputCls} />
              </div>
            </div>
          </Card>

          <Card step="3" title="Students"
            right={students.length > 0 && (
              <div className="flex gap-2">
                {shifts.length > 1 && (
                  <select value={shift} onChange={(e) => setShift(e.target.value)} className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs">
                    <option value="">All shifts</option>
                    {shifts.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
                  </select>
                )}
                {batches.length > 1 && (
                  <select value={batch} onChange={(e) => setBatch(e.target.value)} className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs">
                    <option value="">All batches</option>
                    {batches.map((b) => <option key={b} value={b}>Batch {b}</option>)}
                  </select>
                )}
              </div>
            )}>
            {!ready ? (
              <p className="py-8 text-center text-sm text-gray-400">Choose the class and at least one fee type to see the students.</p>
            ) : loading && !preview ? (
              <div className="space-y-2 animate-pulse">{[1, 2, 3].map((k) => <div key={k} className="h-10 bg-gray-100 rounded" />)}</div>
            ) : !preview ? (
              <p className="py-8 text-center text-sm text-gray-400">Fix the highlighted fields to continue.</p>
            ) : students.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No approved students are in {program?.name} · {termWord} {semesterNo}.</p>
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm">
                  <thead className="text-gray-500 text-xs uppercase tracking-wide">
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-2 text-left w-10">
                        <input type="checkbox" checked={allChecked} onChange={toggleAll} disabled={!billable.length} className="rounded border-gray-300" />
                      </th>
                      <th className="px-2 py-2 text-left">Student</th>
                      <th className="px-2 py-2 text-left">Shift</th>
                      <th className="px-2 py-2 text-left">Batch</th>
                      <th className="px-5 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visible.map((s) => (
                      <tr key={s.id} className={s.existing ? 'opacity-60' : 'hover:bg-gray-50 cursor-pointer'} onClick={() => !s.existing && toggle(s.id)}>
                        <td className="px-5 py-2.5">
                          <input type="checkbox" checked={!s.existing && selected.has(s.id)} disabled={!!s.existing}
                            onChange={() => toggle(s.id)} onClick={(e) => e.stopPropagation()} className="rounded border-gray-300" />
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="font-medium text-gray-900">{s.name}</div>
                          <div className="text-xs text-gray-500">{s.cnic_no} · {s.application_no}</div>
                        </td>
                        <td className="px-2 py-2.5 text-gray-600">{s.shift ? cap(s.shift) : '—'}</td>
                        <td className="px-2 py-2.5 text-gray-600">{s.admission_year ?? '—'}</td>
                        <td className="px-5 py-2.5 text-right">
                          {s.existing
                            ? <Link to={`${PORTAL}/challans/${s.existing.id}`} onClick={(e) => e.stopPropagation()}
                                className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:underline">Already billed · {s.existing.challan_no}</Link>
                            : selected.has(s.id)
                              ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">Will be billed</span>
                              : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Not selected</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right: sticky summary */}
        <aside className="lg:sticky lg:top-6 space-y-4">
          <div className="rounded-2xl shadow-lg overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-800 text-white">
            <div className="p-5">
              <p className="text-xs uppercase tracking-widest text-white/60">Summary</p>
              <p className="mt-1 font-semibold leading-snug">{preview?.title ?? 'Nothing chosen yet'}</p>
              {program && semesterNo && <p className="text-sm text-white/70">{program.name} · {termWord} {semesterNo}</p>}

              <div className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-white/60">Students</p>
                  <p className="text-2xl font-bold">{chosen.length}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60">Per student</p>
                  <p className="text-2xl font-bold">{money(preview?.per_student)}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/15">
                <p className="text-xs text-white/60">Total to bill</p>
                <p className="text-3xl font-bold">{money(grandTotal)}</p>
              </div>
            </div>
          </div>

          {preview?.lines?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-900 mb-3">Each challan has</p>
              <ul className="space-y-2 text-sm">
                {preview.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="text-gray-600">{l.label}</span>
                    <span className="font-medium text-gray-900 whitespace-nowrap">{money(l.amount)}</span>
                  </li>
                ))}
                <li className="flex justify-between gap-3 pt-2 border-t border-gray-100 font-semibold">
                  <span className="text-gray-900">Total</span>
                  <span className="text-gray-900">{money(preview.per_student)}</span>
                </li>
              </ul>
            </div>
          )}

          {!confirming ? (
            <button onClick={() => setConfirming(true)} disabled={!chosen.length || loading || saving}
              className="w-full px-5 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
              {chosen.length ? `Generate ${chosen.length} challan${chosen.length === 1 ? '' : 's'}` : 'Generate challans'}
            </button>
          ) : (
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4">
              <p className="text-sm text-gray-800">
                Bill <b>{chosen.length}</b> student{chosen.length === 1 ? '' : 's'} <b>{money(preview?.per_student)}</b> each, due {new Date(dueDate).toLocaleDateString()}?
              </p>
              <div className="mt-3 flex gap-2">
                <button onClick={generate} disabled={saving} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                  {saving ? 'Generating…' : 'Yes, generate'}
                </button>
                <button onClick={() => setConfirming(false)} disabled={saving} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-500 text-center">Students already billed for this are skipped automatically.</p>
        </aside>
      </div>
    </div>
  );
}
