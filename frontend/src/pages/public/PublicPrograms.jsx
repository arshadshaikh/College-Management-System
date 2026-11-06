import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { usePublicSite } from '../../context/PublicSiteContext';

const LEVEL_LABELS = {
  certificate: 'Certificate', diploma: 'Diploma', associate: 'Associate',
  bachelor: 'Bachelor', master: 'Master', phd: 'PhD',
};

export default function PublicPrograms() {
  const { settings } = usePublicSite();
  const primary = settings.primary_color || '#1e40af';
  // Setting values arrive as strings; anything other than an explicit "false" counts as open.
  const admissionsOpen = settings.admission_open === 'true' || settings.admission_open === true;

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState('all');

  useEffect(() => {
    api.get('/public/programs')
      .then(({ data }) => setPrograms(Array.isArray(data) ? data : (data.data ?? [])))
      .catch(() => setPrograms([]))
      .finally(() => setLoading(false));
  }, []);

  const levels = [...new Set(programs.map((p) => p.degree_level))];
  const shown = level === 'all' ? programs : programs.filter((p) => p.degree_level === level);

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900">Programs Offered</h1>
      {!admissionsOpen && (
        <p className="mt-3 inline-block px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-sm">
          Admissions are currently closed.
        </p>
      )}

      {levels.length > 1 && (
        <div className="flex flex-wrap gap-2 mt-6">
          {['all', ...levels].map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-3 py-1.5 rounded-full text-sm border ${level === l ? 'text-white border-transparent' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              style={level === l ? { background: primary } : undefined}
            >
              {l === 'all' ? 'All' : (LEVEL_LABELS[l] ?? l)}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="mt-10 text-gray-500">No programs are listed at the moment.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {shown.map((p) => (
            <div key={p.id} className="border border-gray-200 rounded-xl p-5 flex flex-col">
              <span className="self-start text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                {LEVEL_LABELS[p.degree_level] ?? p.degree_level}
              </span>
              <h2 className="mt-3 text-lg font-semibold text-gray-900">{p.name}</h2>
              {p.code && <div className="text-xs text-gray-500">{p.code}</div>}
              <dl className="mt-3 text-sm text-gray-600 space-y-1">
                <div>Duration: {p.duration_years} yr / {p.total_semesters} semesters</div>
                <div>Seats: {p.total_seats}</div>
              </dl>
              {p.eligibility_criteria && (
                <p className="mt-3 text-sm text-gray-600"><span className="font-medium text-gray-800">Eligibility: </span>{p.eligibility_criteria}</p>
              )}
              {p.description && <p className="mt-2 text-sm text-gray-600">{p.description}</p>}
              <div className="mt-auto pt-4">
                {admissionsOpen ? (
                  <Link to="/login" className="inline-block px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: primary }}>
                    Apply now
                  </Link>
                ) : (
                  <span className="text-sm text-gray-400">Admissions closed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}