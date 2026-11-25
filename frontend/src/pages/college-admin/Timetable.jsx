import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';
import { useAuth } from '../../context/AuthContext';

// Class timetable editor: one weekly grid per academic term + program + semester + shift.
// Rows = the shift's periods (Settings → Timetable), columns = working days.

const EMPTY_FORM = { course_id: '', teacher_name: '', room: '' };

export default function Timetable() {
  const { hasPrv } = useAuth();
  const canSave = hasPrv('timetable.save');
  const canRemove = hasPrv('timetable.destroy');
  const canCopy = hasPrv('timetable.copy');
  const [params, setParams] = useSearchParams();

  const [meta, setMeta] = useState(null);      // programs, shifts, days
  const [grid, setGrid] = useState(null);      // periods, courses, entries for the chosen class
  const [loading, setLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);

  const [cell, setCell] = useState(null);      // { day, period, entry } being edited
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');   // term id to copy from ('' = closed)
  const [copying, setCopying] = useState(false);

  const programId = params.get('program') ?? '';
  const semester = params.get('semester') ?? '1';
  const shift = params.get('shift') ?? '';
  const termParam = params.get('term') ?? '';

  // Pickers (terms, programs, shifts, days)
  useEffect(() => {
    api.get('/timetable')
      .then(({ data }) => setMeta(data))
      .catch(() => toast.error('Could not load the timetable.'))
      .finally(() => setLoading(false));
  }, []);

  const shifts = meta?.shifts ?? [];
  const activeShift = shifts.some((s) => s.key === shift) ? shift : shifts[0]?.key;
  const program = meta?.programs.find((p) => String(p.id) === String(programId));
  const terms = meta?.terms ?? [];
  // Chosen term, else the current one, else the newest.
  const term = terms.find((t) => String(t.id) === termParam) ?? terms.find((t) => t.is_current) ?? terms[0];

  const loadGrid = useCallback(async () => {
    if (!program || !activeShift || !term) { setGrid(null); return; }
    setGridLoading(true);
    try {
      const { data } = await api.get('/timetable', {
        params: { term_id: term.id, program_id: program.id, semester_no: semester, shift: activeShift },
      });
      setGrid(data);
    } catch {
      setGrid(null);
    } finally {
      setGridLoading(false);
    }
  }, [program, semester, activeShift, term]);

  useEffect(() => { loadGrid(); }, [loadGrid]);

  const choose = (key, value) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key === 'program') next.set('semester', '1');
    setParams(next, { replace: true });
  };

  const entryAt = (day, periodId) =>
    grid?.entries.find((e) => e.day === day && e.timetable_period_id === periodId);

  const openCell = (day, period) => {
    const entry = entryAt(day.key, period.id);
    if (!canSave && !entry) return;
    setCell({ day, period, entry });
    setForm(entry
      ? { course_id: String(entry.course_id), teacher_name: entry.teacher_name ?? '', room: entry.room ?? '' }
      : EMPTY_FORM);
    setErrors({});
  };

  const closeCell = () => { setCell(null); setErrors({}); };

  const setField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api.post('/timetable', {
        academic_term_id: term.id,
        program_id: program.id,
        semester_no: Number(semester),
        shift: activeShift,
        day: cell.day.key,
        timetable_period_id: cell.period.id,
        course_id: form.course_id,
        teacher_name: form.teacher_name,
        room: form.room,
      });
      toast.success('Class saved.');
      closeCell();
      loadGrid();
    } catch (err) {
      if (err.response?.status === 422) setErrors(err.response.data.errors ?? {});
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Remove this class from the timetable?')) return;
    setSaving(true);
    try {
      await api.delete(`/timetable/${cell.entry.id}`);
      toast.success('Class removed.');
      closeCell();
      loadGrid();
    } catch { /* api.js shows the error */ }
    finally { setSaving(false); }
  };

  const copy = async () => {
    setCopying(true);
    try {
      const { data } = await api.post('/timetable/copy', {
        from_term_id: copyFrom, to_term_id: term.id,
        program_id: program.id, semester_no: Number(semester), shift: activeShift,
      });
      toast.success(data.message);
      if (data.skipped?.length) toast(data.skipped.slice(0, 5).join('\n'), { duration: 8000 });
      setCopyFrom('');
      loadGrid();
    } catch (err) {
      if (err.response?.status === 422) toast.error(Object.values(err.response.data.errors ?? {})[0]?.[0] ?? err.response.data.message);
    } finally {
      setCopying(false);
    }
  };

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!meta) return <div className="py-20 text-center text-gray-500">Could not load the timetable.</div>;

  const days = meta.days ?? [];
  const semesters = Array.from({ length: Math.max(1, program?.total_semesters || 1) }, (_, i) => i + 1);
  const shiftLabel = shifts.find((s) => s.key === activeShift)?.label;
  const courseById = (id) => grid?.courses.find((c) => c.id === id);
  const unique = (field) => [...new Set((grid?.entries ?? []).map((x) => x[field]).filter(Boolean))].sort();
  const fieldErr = (k) => errors[k]?.[0];
  const inputCls = (k) => `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
    fieldErr(k) ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`;
  const selectCls = 'px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Timetable</h1>
        <p className="text-sm text-gray-500">Weekly class timetable for each program, semester{shifts.length > 1 ? ' and shift' : ''}. Click a cell to set its class.</p>
      </div>

      {terms.length === 0 && (
        <Notice>
          Add an academic term (for example "Fall 2026") in{' '}
          <Link to={`${PORTAL}/settings?tab=academic`} className="font-medium underline">Settings → Timetable</Link> to start building timetables.
        </Notice>
      )}

      {/* Pickers */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-3">
        {terms.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Term</label>
            <select value={term?.id ?? ''} onChange={(e) => choose('term', e.target.value)} className={selectCls}>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_current ? ' (current)' : ''}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Program</label>
          <select value={programId} onChange={(e) => choose('program', e.target.value)} className={`${selectCls} min-w-56`}>
            <option value="">Choose a program…</option>
            {meta.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {program && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Semester</label>
            <select value={semester} onChange={(e) => choose('semester', e.target.value)} className={selectCls}>
              {semesters.map((n) => <option key={n} value={n}>Semester {n}</option>)}
            </select>
          </div>
        )}
        {program && shifts.length > 1 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Shift</label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              {shifts.map((s) => (
                <button type="button" key={s.key} onClick={() => choose('shift', s.key)}
                  className={`px-3 py-2 text-sm ${s.key === activeShift ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {program && hasPrv('courses.index') && (
          <Link to={`${PORTAL}/programs/${program.id}/courses`} className="ml-auto text-sm text-indigo-600 hover:underline py-2">
            Manage courses →
          </Link>
        )}
      </div>

      {/* Grid */}
      {!program || !term ? (
        <p className="bg-white rounded-xl shadow-sm px-6 py-12 text-center text-sm text-gray-400">Choose a program to see its timetable.</p>
      ) : gridLoading && !grid ? (
        <div className="py-12 text-center text-gray-400">Loading…</div>
      ) : grid && (
        <>
          {grid.periods.length === 0 && (
            <Notice>
              The {shiftLabel?.toLowerCase()} shift has no periods yet. Add them in{' '}
              <Link to={`${PORTAL}/settings?tab=academic`} className="font-medium underline">Settings → Timetable</Link>.
            </Notice>
          )}
          {grid.periods.length > 0 && grid.courses.length === 0 && (
            <Notice>
              Semester {semester} has no active courses yet.{' '}
              <Link to={`${PORTAL}/programs/${program.id}/courses`} className="font-medium underline">Add courses</Link> first.
            </Notice>
          )}
          {grid.periods.length > 0 && days.length === 0 && (
            <Notice>No working days are set. Choose them in <Link to={`${PORTAL}/settings?tab=academic`} className="font-medium underline">Settings → Timetable</Link>.</Notice>
          )}

          {grid.periods.length > 0 && days.length > 0 && (
            <div className={`bg-white rounded-xl shadow-sm overflow-x-auto ${gridLoading ? 'opacity-60' : ''}`}>
              <div className="px-5 py-3 border-b border-gray-200 flex flex-wrap items-baseline gap-x-3">
                <h2 className="font-semibold text-gray-900">{program.name} · Semester {semester}{shifts.length > 1 ? ` · ${shiftLabel}` : ''}</h2>
                <span className="text-xs text-gray-400">{term.name} · {grid.entries.length} class(es) a week</span>
                {canCopy && terms.length > 1 && (
                  <div className="ml-auto flex items-center gap-2">
                    <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded-lg text-xs bg-white">
                      <option value="">Copy from term…</option>
                      {terms.filter((t) => t.id !== term.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {copyFrom && (
                      <button type="button" onClick={copy} disabled={copying}
                        className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">
                        {copying ? 'Copying…' : 'Copy'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <table className="w-full text-sm border-collapse table-fixed min-w-[720px]">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="w-32 px-3 py-2 text-left font-medium border-b border-gray-200">Period</th>
                    {days.map((d) => (
                      <th key={d.key} className="px-2 py-2 text-left font-medium border-b border-l border-gray-200">{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grid.periods.map((p) => p.is_break ? (
                    <tr key={p.id}>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-xs text-gray-500 bg-amber-50">
                        <div className="font-medium">{p.name}</div>{p.start_time}–{p.end_time}
                      </td>
                      <td colSpan={days.length} className="border-b border-l border-gray-200 bg-amber-50 text-center text-xs tracking-widest uppercase text-amber-700">
                        {p.name}
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id}>
                      <td className="px-3 py-2 border-b border-gray-200 align-top">
                        <div className="font-medium text-gray-800">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.start_time}–{p.end_time}</div>
                      </td>
                      {days.map((d) => {
                        const e = entryAt(d.key, p.id);
                        return (
                          <td key={d.key} className="border-b border-l border-gray-200 p-1 align-top">
                            <button type="button" onClick={() => openCell(d, p)}
                              disabled={!canSave && !e}
                              className={`w-full min-h-16 text-left rounded-lg px-2 py-1.5 transition ${e
                                ? 'bg-indigo-50 hover:bg-indigo-100'
                                : canSave ? 'hover:bg-gray-50 text-gray-300 hover:text-gray-500' : ''}`}>
                              {e ? (
                                <>
                                  <div className="font-semibold text-indigo-700 text-xs">{e.course?.code}</div>
                                  <div className="text-xs text-gray-800 leading-snug">{e.course?.title}</div>
                                  {(e.teacher_name || e.room) && (
                                    <div className="text-[11px] text-gray-500 mt-0.5">
                                      {[e.teacher_name, e.room].filter(Boolean).join(' · ')}
                                    </div>
                                  )}
                                </>
                              ) : canSave ? <span className="text-lg leading-none">+</span> : null}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Cell editor */}
      {cell && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={closeCell}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-start justify-between px-5 py-3 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900">{cell.day.label}, {cell.period.name}</h3>
                <p className="text-xs text-gray-500">{cell.period.start_time}–{cell.period.end_time}{shifts.length > 1 ? ` · ${shiftLabel}` : ''}</p>
              </div>
              <button type="button" onClick={closeCell} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
                <select value={form.course_id} onChange={setField('course_id')} disabled={!canSave}
                  className={inputCls('course_id')}>
                  <option value="">Choose a course…</option>
                  {grid.courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
                  {cell.entry && !courseById(cell.entry.course_id) && (
                    <option value={cell.entry.course_id}>{cell.entry.course?.code} · {cell.entry.course?.title} (inactive)</option>
                  )}
                </select>
                {fieldErr('course_id') && <p className="text-xs text-red-600 mt-1">{fieldErr('course_id')}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teacher <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={form.teacher_name} onChange={setField('teacher_name')} disabled={!canSave}
                  list="tt-teachers" maxLength={100} placeholder="Dr. Ali Raza" className={inputCls('teacher_name')} />
                <datalist id="tt-teachers">{unique('teacher_name').map((t) => <option key={t} value={t} />)}</datalist>
                {fieldErr('teacher_name') && <p className="text-xs text-red-600 mt-1">{fieldErr('teacher_name')}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={form.room} onChange={setField('room')} disabled={!canSave}
                  list="tt-rooms" maxLength={50} placeholder="Lab 2" className={inputCls('room')} />
                <datalist id="tt-rooms">{unique('room').map((r) => <option key={r} value={r} />)}</datalist>
                {fieldErr('room') && <p className="text-xs text-red-600 mt-1">{fieldErr('room')}</p>}
              </div>
              {['timetable_period_id', 'day', 'shift', 'semester_no'].map((k) => fieldErr(k) && (
                <p key={k} className="text-xs text-red-600">{fieldErr(k)}</p>
              ))}
              <p className="text-xs text-gray-400">In {term.name}, a teacher or room can't be booked in two classes at the same time, in any program or shift.</p>
            </div>

            <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-200">
              {cell.entry && canRemove && (
                <button type="button" onClick={remove} disabled={saving}
                  className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">Remove class</button>
              )}
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={closeCell}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                {canSave && (
                  <button type="submit" disabled={saving || !form.course_id}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Notice({ children }) {
  return <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">{children}</div>;
}
