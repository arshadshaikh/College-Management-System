import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';
import { useAppConfig } from '../../context/AppConfigContext';

// Student: weekly class timetable for the current term, one grid per admitted program.
// "Print" prints only the timetable (see the print styles below).

const todayIso = () => ((new Date().getDay() + 6) % 7) + 1;   // 1 = Monday ... 7 = Sunday

export default function MyTimetable() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const config = useAppConfig();

  useEffect(() => {
    api.get('/timetable/my')
      .then(({ data }) => setData(data))
      .catch(() => toast.error('Could not load your timetable.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!data) return <div className="py-20 text-center text-gray-500">Could not load your timetable.</div>;

  const { term, days, classes } = data;
  const today = todayIso();

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #my-timetable, #my-timetable * { visibility: visible !important; }
          #my-timetable { position: absolute; left: 0; top: 0; width: 100%; }
          #my-timetable .no-print { display: none !important; }
          #my-timetable .tt-card { break-inside: avoid; box-shadow: none !important; border: 1px solid #ccc; }
          @page { margin: 12mm; }
        }
      `}</style>

      <div id="my-timetable" className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="hidden print:block text-sm text-gray-500">{config?.name}</p>
            <h1 className="text-2xl font-bold text-gray-900">My Timetable</h1>
            <p className="text-sm text-gray-500">{term ? term.name : 'No current term is set yet.'}</p>
          </div>
          {term && classes.some((c) => c.entries.length > 0) && (
            <button type="button" onClick={printTimetable}
              className="no-print px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
              Print
            </button>
          )}
        </div>

        {classes.length === 0 ? (
          <Empty>
            Your timetable appears here once your admission is approved.{' '}
            <Link to={`${PORTAL}/my-applications`} className="text-indigo-600 font-medium hover:underline">My Applications</Link>
          </Empty>
        ) : !term ? (
          <Empty>The college has not set the current term yet. Please check again later.</Empty>
        ) : classes.map((c) => (
          <div key={c.application_id} className="tt-card bg-white rounded-xl shadow-sm overflow-x-auto">
            <div className="px-5 py-3 border-b border-gray-200 flex flex-wrap items-baseline gap-x-3">
              <h2 className="font-semibold text-gray-900">
                {c.program?.name} · Semester {c.semester_no}{c.shift_label ? ` · ${c.shift_label}` : ''}
              </h2>
              <span className="text-xs text-gray-400">{c.entries.length} class(es) a week</span>
            </div>

            {c.entries.length === 0 || c.periods.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-gray-400">The timetable for your class has not been published yet.</p>
            ) : (
              <table className="w-full text-sm border-collapse table-fixed min-w-[720px]">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="w-32 px-3 py-2 text-left font-medium border-b border-gray-200">Period</th>
                    {days.map((d) => (
                      <th key={d.key} className={`px-2 py-2 text-left font-medium border-b border-l border-gray-200 ${
                        d.key === today ? 'text-indigo-700' : ''}`}>
                        {d.label}{d.key === today && <span className="no-print ml-1 text-[10px] uppercase">· today</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.periods.map((p) => p.is_break ? (
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
                        const e = c.entries.find((x) => x.day === d.key && x.timetable_period_id === p.id);
                        return (
                          <td key={d.key} className="border-b border-l border-gray-200 p-1 align-top">
                            {e && (
                              <div className={`rounded-lg px-2 py-1.5 min-h-16 ${d.key === today
                                ? 'bg-indigo-100 ring-1 ring-indigo-300' : 'bg-indigo-50'}`}>
                                <div className="font-semibold text-indigo-700 text-xs">{e.course?.code}</div>
                                <div className="text-xs text-gray-800 leading-snug">{e.course?.title}</div>
                                {(e.teacher_name || e.room) && (
                                  <div className="text-[11px] text-gray-500 mt-0.5">
                                    {[e.teacher_name, e.room].filter(Boolean).join(' · ')}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Print in light colours even when the portal is in dark mode, then restore the theme.
function printTimetable() {
  const html = document.documentElement;
  const wasDark = html.classList.contains('dark');
  if (wasDark) {
    html.classList.remove('dark');
    window.addEventListener('afterprint', () => html.classList.add('dark'), { once: true });
  }
  window.print();
}

function Empty({ children }) {
  return <p className="bg-white rounded-xl shadow-sm px-6 py-12 text-center text-sm text-gray-500">{children}</p>;
}

