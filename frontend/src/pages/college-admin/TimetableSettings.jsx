import { useState } from 'react';

// Settings → Timetable: academic terms, shifts the college runs, working days, and each shift's periods.
// Values live in the parent Settings form: settings `shifts` + `timetable_days` (CSV)
// and the `periods` list, which is saved as `timetable_periods` (the full list).

const toList = (csv) => (csv ?? '').split(',').map((s) => s.trim()).filter(Boolean);

// "08:30" + minutes → "09:30" (stops at 23:59)
const addMinutes = (hhmm, mins) => {
  const [h, m] = (hhmm || '08:00').split(':').map(Number);
  const t = Math.min(h * 60 + m + mins, 23 * 60 + 59);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

const DEFAULT_START = { morning: '08:30', noon: '12:00', evening: '15:00' };

let nextKey = 1;
export const withKeys = (rows) => rows.map((r) => ({ ...r, _k: nextKey++ }));

export default function TimetableSettings({ values, set, periods, setPeriods, terms, setTerms, shiftOptions, dayOptions, errors }) {
  const shifts = toList(values.shifts || 'morning');
  const days = toList(values.timetable_days).map(Number);
  const [activeShift, setActiveShift] = useState(shifts[0] ?? 'morning');
  const shown = shifts.includes(activeShift) ? activeShift : shifts[0];

  const err = (key) => errors[key]?.[0];

  const toggleShift = (key, on) => {
    const next = on ? [...shifts, key] : shifts.filter((k) => k !== key);
    if (next.length === 0) return;   // at least one shift
    set('shifts', shiftOptions.map((s) => s.key).filter((k) => next.includes(k)).join(','));
  };

  const toggleDay = (key, on) => {
    const next = on ? [...days, key] : days.filter((d) => d !== key);
    set('timetable_days', [...next].sort((a, b) => a - b).join(','));
  };

  // Periods of the shown shift, in time order; errors are keyed by index in the FULL list.
  const rows = periods
    .map((p, index) => ({ ...p, index }))
    .filter((p) => p.shift === shown)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const update = (k, field, value) =>
    setPeriods((list) => list.map((p) => (p._k === k ? { ...p, [field]: value } : p)));

  const remove = (k) => setPeriods((list) => list.filter((p) => p._k !== k));

  const addPeriod = (isBreak = false) => {
    const last = rows[rows.length - 1];
    const start = last ? last.end_time : DEFAULT_START[shown] ?? '08:00';
    const classCount = rows.filter((r) => !r.is_break).length;
    setPeriods((list) => [...list, ...withKeys([{
      id: null,
      shift: shown,
      name: isBreak ? 'Break' : `Period ${classCount + 1}`,
      start_time: start,
      end_time: addMinutes(start, isBreak ? 30 : 60),
      is_break: isBreak,
      entries_count: 0,
    }])]);
  };

  const cell = 'px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2';
  const cellCls = (key) => `${cell} ${err(key) ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`;
  const shiftLabel = (key) => shiftOptions.find((s) => s.key === key)?.label ?? key;

  return (
    <section className="bg-white rounded-xl shadow-sm p-6 space-y-5">
      <h2 className="font-semibold text-gray-900">Timetable</h2>

      <AcademicTerms terms={terms} setTerms={setTerms} errors={errors} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Shifts</label>
        <p className="text-xs text-gray-500 mb-2">
          The shifts your college teaches in. Each shift has its own periods and its own timetables. Most colleges only run Morning.
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {shiftOptions.map((s) => (
            <label key={s.key} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="h-4 w-4"
                checked={shifts.includes(s.key)}
                disabled={shifts.length === 1 && shifts.includes(s.key)}
                onChange={(e) => toggleShift(s.key, e.target.checked)} />
              {s.label}
            </label>
          ))}
        </div>
        {err('settings.shifts') && <p className="text-xs text-red-600 mt-1">{err('settings.shifts')}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Working Days</label>
        <div className="flex flex-wrap gap-2">
          {dayOptions.map((d) => {
            const on = days.includes(d.key);
            return (
              <button type="button" key={d.key} onClick={() => toggleDay(d.key, !on)}
                className={`px-3 py-1.5 rounded-lg text-sm border ${on
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                {d.label.slice(0, 3)}
              </button>
            );
          })}
        </div>
        {err('settings.timetable_days') && <p className="text-xs text-red-600 mt-1">{err('settings.timetable_days')}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Periods</label>
        <p className="text-xs text-gray-500 mb-2">
          The time slots of a teaching day. Breaks show on the timetable but take no class.
        </p>

        {shifts.length > 1 && (
          <div className="flex gap-1 mb-3 border-b border-gray-200">
            {shifts.map((key) => (
              <button type="button" key={key} onClick={() => setActiveShift(key)}
                className={`px-4 py-2 text-sm -mb-px border-b-2 ${key === shown
                  ? 'border-indigo-600 text-indigo-700 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {shiftLabel(key)}
                <span className="ml-1 text-xs text-gray-400">({periods.filter((p) => p.shift === key).length})</span>
              </button>
            ))}
          </div>
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-gray-400 border border-dashed border-gray-300 rounded-lg px-4 py-6 text-center">
            No periods for the {shiftLabel(shown).toLowerCase()} shift yet.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((p) => (
              <div key={p._k}>
                <div className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ${p.is_break ? 'bg-amber-50' : 'bg-gray-50'}`}>
                  <input type="text" value={p.name} maxLength={50}
                    onChange={(e) => update(p._k, 'name', e.target.value)}
                    className={`${cellCls(`timetable_periods.${p.index}.name`)} w-32`} />
                  <input type="time" value={p.start_time}
                    onChange={(e) => update(p._k, 'start_time', e.target.value)}
                    className={cellCls(`timetable_periods.${p.index}.start_time`)} />
                  <span className="text-gray-400 text-sm">to</span>
                  <input type="time" value={p.end_time}
                    onChange={(e) => update(p._k, 'end_time', e.target.value)}
                    className={cellCls(`timetable_periods.${p.index}.end_time`)} />
                  <label className="flex items-center gap-1.5 text-sm text-gray-600 ml-1">
                    <input type="checkbox" className="h-4 w-4" checked={!!p.is_break}
                      onChange={(e) => update(p._k, 'is_break', e.target.checked)} />
                    Break
                  </label>
                  <button type="button" onClick={() => remove(p._k)}
                    className="ml-auto px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg">Remove</button>
                </div>
                {p.entries_count > 0 && (
                  <p className="text-xs text-amber-700 mt-1 ml-1">
                    {p.entries_count} class{p.entries_count > 1 ? 'es are' : ' is'} placed in this period. Removing it removes {p.entries_count > 1 ? 'them' : 'it'} when you save.
                  </p>
                )}
                {['name', 'start_time', 'end_time'].map((f) => err(`timetable_periods.${p.index}.${f}`) && (
                  <p key={f} className="text-xs text-red-600 mt-1 ml-1">{err(`timetable_periods.${p.index}.${f}`)}</p>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => addPeriod(false)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">+ Add period</button>
          <button type="button" onClick={() => addPeriod(true)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">+ Add break</button>
        </div>
      </div>
    </section>
  );
}

// Academic terms (e.g. "Fall 2026"). Every timetable belongs to one term; one term is current.
function AcademicTerms({ terms, setTerms, errors }) {
  const err = (key) => errors[key]?.[0];
  const cls = (key) => `px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
    err(key) ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`;

  const update = (k, field, value) =>
    setTerms((list) => list.map((t) => (t._k === k ? { ...t, [field]: value } : t)));

  // Exactly one current term.
  const makeCurrent = (k) => setTerms((list) => list.map((t) => ({ ...t, is_current: t._k === k })));

  const remove = (k) => setTerms((list) => {
    const next = list.filter((t) => t._k !== k);
    if (next.length && !next.some((t) => t.is_current)) next[0] = { ...next[0], is_current: true };
    return next;
  });

  const add = () => {
    const year = new Date().getFullYear();
    setTerms((list) => [...withKeys([{
      id: null, name: '', start_date: `${year}-01-01`, end_date: `${year}-12-31`,
      is_current: list.length === 0, entries_count: 0,
    }]), ...list]);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Academic Terms</label>
      <p className="text-xs text-gray-500 mb-2">
        Each timetable belongs to a term, such as "Fall 2026" or "2026–27". Students see the current term's timetable.
      </p>

      {terms.length === 0 ? (
        <p className="text-sm text-gray-400 border border-dashed border-gray-300 rounded-lg px-4 py-6 text-center">
          No terms yet. Add one to start building timetables.
        </p>
      ) : (
        <div className="space-y-2">
          {terms.map((t, i) => (
            <div key={t._k}>
              <div className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ${t.is_current ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                <input type="text" value={t.name} maxLength={50} placeholder="Fall 2026"
                  onChange={(e) => update(t._k, 'name', e.target.value)}
                  className={`${cls(`academic_terms.${i}.name`)} w-36`} />
                <input type="date" value={t.start_date}
                  onChange={(e) => update(t._k, 'start_date', e.target.value)}
                  className={cls(`academic_terms.${i}.start_date`)} />
                <span className="text-gray-400 text-sm">to</span>
                <input type="date" value={t.end_date}
                  onChange={(e) => update(t._k, 'end_date', e.target.value)}
                  className={cls(`academic_terms.${i}.end_date`)} />
                <label className="flex items-center gap-1.5 text-sm text-gray-600 ml-1">
                  <input type="radio" name="current-term" className="h-4 w-4"
                    checked={!!t.is_current} onChange={() => makeCurrent(t._k)} />
                  Current
                </label>
                <button type="button" onClick={() => remove(t._k)}
                  className="ml-auto px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg">Remove</button>
              </div>
              {t.entries_count > 0 && (
                <p className="text-xs text-amber-700 mt-1 ml-1">
                  {t.entries_count} class{t.entries_count > 1 ? 'es are' : ' is'} on this term's timetables. Removing the term removes {t.entries_count > 1 ? 'them' : 'it'} when you save.
                </p>
              )}
              {['name', 'start_date', 'end_date'].map((f) => err(`academic_terms.${i}.${f}`) && (
                <p key={f} className="text-xs text-red-600 mt-1 ml-1">{err(`academic_terms.${i}.${f}`)}</p>
              ))}
            </div>
          ))}
        </div>
      )}
      {err('academic_terms') && <p className="text-xs text-red-600 mt-1">{err('academic_terms')}</p>}
      <CurrentTermHint terms={terms} onMakeCurrent={makeCurrent} />

      <button type="button" onClick={add}
        className="mt-3 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">+ Add term</button>
    </div>
  );
}

// Students always see the term marked Current (never chosen by date), so the admin decides
// when the next term's timetable goes live. This hint shows when today falls in another term.
function CurrentTermHint({ terms, onMakeCurrent }) {
  const today = new Date().toISOString().slice(0, 10);
  const current = terms.find((t) => t.is_current);
  const todays = terms.find((t) => t.start_date && t.end_date && t.start_date <= today && today <= t.end_date);
  if (!current || !todays || todays._k === current._k) return null;

  return (
    <p className="text-xs text-amber-700 mt-2">
      Today falls in <b>{todays.name || 'another term'}</b>, but <b>{current.name}</b> is marked current, so students still see {current.name}.{' '}
      <button type="button" onClick={() => onMakeCurrent(todays._k)} className="underline font-medium">
        Make {todays.name || 'it'} current
      </button>{' '}(then save).
    </p>
  );
}
