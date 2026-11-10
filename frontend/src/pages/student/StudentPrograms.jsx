import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { PORTAL } from '../../config/app';

// Programs as cards for applicants: what each program needs, whether the
// student's profile is ready for it, and one Apply button.
// "Ready" is a guide only; the server re-checks everything when they apply.

const DEGREE_LABELS = {
  certificate: 'Certificate', diploma: 'Diploma', associate: 'Associate',
  bachelor: 'Bachelor', master: 'Master', mphil: 'M.Phil', phd: 'PhD',
};

export default function StudentPrograms() {
  const [d, setD] = useState(null);
  const [level, setLevel] = useState('all');

  useEffect(() => {
    const list = (r) => r?.data?.data ?? r?.data ?? [];
    Promise.all([
      api.get('/programs', { params: { per_page: 100 } }).catch(() => null),
      api.get('/profile').catch(() => null),
      api.get('/applications/my').catch(() => null),
      api.get('/public/settings').catch(() => null),
    ]).then(([p, prof, a, s]) => setD({
      programs: list(p).filter((x) => x.is_active !== false && x.is_active !== 0),
      profile: prof?.data ?? null,
      applications: list(a).filter((x) => x.status !== 'withdrawn'),
      admissionOpen: (s?.data?.settings?.admission_open ?? 'true') === 'true',
    }));
  }, []);

  if (!d) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const prof = d.profile;
  const levels = prof?.levels ?? [];
  const haveLevels = (prof?.educations ?? []).map((e) => e.level);
  const haveDocs = (prof?.documents ?? []).map((x) => x.document_type);
  const baseComplete = !!prof?.completeness?.complete;

  // What is still missing for this program's EXTRA levels (on top of the college baseline).
  const missingFor = (program) => {
    const extra = String(program.required_education_levels ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const out = [];
    extra.forEach((key) => {
      const lv = levels.find((l) => l.key === key);
      if (!lv) return;
      if (!haveLevels.includes(key)) out.push(lv.label);
      else if (lv.document && !haveDocs.includes(lv.document)) out.push(`${lv.label} certificate`);
    });
    return { extra, out };
  };

  const degrees = [...new Set(d.programs.map((p) => p.degree_level))];
  const shown = level === 'all' ? d.programs : d.programs.filter((p) => p.degree_level === level);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Programs</h1>
        <p className="text-sm text-gray-500 mt-1">Choose a program to apply. Each card shows whether your profile is ready for it.</p>
      </div>

      {!d.admissionOpen && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
          Admissions are currently closed.
        </div>
      )}

      {degrees.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {['all', ...degrees].map((l) => (
            <button key={l} type="button" onClick={() => setLevel(l)}
              className={`px-3 py-1.5 rounded-full text-sm border ${level === l
                ? 'bg-indigo-600 text-white border-transparent' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
              {l === 'all' ? 'All' : (DEGREE_LABELS[l] ?? l)}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-gray-500">No programs are open at the moment.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {shown.map((p) => {
            const applied = d.applications.find((x) => x.program_id === p.id || x.program?.id === p.id);
            const { extra, out } = missingFor(p);
            const ready = baseComplete && out.length === 0;
            return (
              <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
                    {DEGREE_LABELS[p.degree_level] ?? p.degree_level}
                  </span>
                  {applied && <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700">Applied</span>}
                </div>
                <h2 className="mt-3 text-lg font-semibold text-gray-900">{p.name}</h2>
                {p.code && <p className="text-xs text-gray-400">{p.code}</p>}
                <dl className="mt-3 text-sm text-gray-600 space-y-1">
                  <div>{p.duration_years} years · {p.total_semesters} semesters · {p.total_seats} seats</div>
                  {extra.length > 0 && (
                    <div>Also requires: {extra.map((k) => levels.find((l) => l.key === k)?.label ?? k).join(', ')}</div>
                  )}
                </dl>
                {p.eligibility_criteria && (
                  <p className="mt-2 text-sm text-gray-600"><span className="font-medium text-gray-800">Eligibility: </span>{p.eligibility_criteria}</p>
                )}

                <div className="mt-auto pt-4">
                  {applied ? (
                    <Link to={`${PORTAL}/my-applications`} className="text-sm font-medium text-indigo-600">
                      View application {applied.application_no} →
                    </Link>
                  ) : ready ? (
                    <>
                      <p className="text-xs text-green-700 mb-2">✓ Your profile is ready for this program.</p>
                      {d.admissionOpen ? (
                        <Link to={`${PORTAL}/apply?program=${p.id}`}
                          className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
                          Apply now
                        </Link>
                      ) : <span className="text-sm text-gray-400">Admissions closed</span>}
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-amber-700 mb-2">
                        {out.length ? `Needs: ${out.join(', ')}` : 'Complete your profile first.'}
                      </p>
                      <Link to={`${PORTAL}/my-profile`}
                        className="inline-block px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                        Complete my profile
                      </Link>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
