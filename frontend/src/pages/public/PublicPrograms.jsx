import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { PORTAL } from '../../config/app';
import { usePublicSite } from '../../context/PublicSiteContext';

// Public list of this college's active programs (/programs).
// Colours: indigo-* = the college's Primary Color (see AppConfigContext).
const LEVEL_LABELS = {
  certificate: 'Certificate', diploma: 'Diploma', associate: 'Associate',
  bachelor: 'Bachelor', master: 'Master', phd: 'PhD',
};

export default function PublicPrograms() {
  const { settings, college } = usePublicSite();
  const { user } = useAuth();
  // Logged-in students go straight to Apply with the program chosen; visitors sign up first.
  const applyLink = (id) => (user ? `${PORTAL}/apply?program=${id}` : '/register');
  // Setting values arrive as strings; only an explicit "true" counts as open.
  const admissionsOpen = settings.admission_open === 'true' || settings.admission_open === true;

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState('all');

  useEffect(() => {
    if (college?.name) document.title = `Programs | ${college.name}`;
  }, [college?.name]);

  useEffect(() => {
    api.get('/public/programs')
      .then(({ data }) => setPrograms(Array.isArray(data) ? data : (data.data ?? [])))
      .catch(() => setPrograms([]))
      .finally(() => setLoading(false));
  }, []);

  const levels = [...new Set(programs.map((p) => p.degree_level))];
  const shown = level === 'all' ? programs : programs.filter((p) => p.degree_level === level);

  return (
    <div>
      {/* ── Page header ─────────────────────────────────── */}
      <section className="bg-gradient-to-b from-indigo-50 to-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <nav className="text-sm text-gray-500">
            <Link to="/" className="hover:text-indigo-600">Home</Link>
            <span className="mx-1.5">/</span>
            <span className="text-gray-700">Programs</span>
          </nav>
          <div className="mt-3 sm:flex items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">Programs offered</h1>
              <p className="mt-3 max-w-2xl text-lg text-gray-600">
                Find the program that fits your goals, check its eligibility and apply online.
              </p>
            </div>
            <span className={`mt-4 sm:mt-0 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold shrink-0 ${admissionsOpen ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
              <span className={`w-2 h-2 rounded-full ${admissionsOpen ? 'bg-green-500' : 'bg-amber-500'}`} />
              {admissionsOpen ? 'Admissions open' : 'Admissions currently closed'}
            </span>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-64 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : programs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <p className="font-semibold text-gray-900">Programs will be announced soon.</p>
            <p className="mt-1 text-sm text-gray-500">Create an account now so you are ready to apply when they are published.</p>
            {!user && (
              <Link to="/register" className="mt-5 inline-block px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">Create an account</Link>
            )}
          </div>
        ) : (
          <>
            {levels.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {['all', ...levels].map((l) => {
                  const count = l === 'all' ? programs.length : programs.filter((p) => p.degree_level === l).length;
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLevel(l)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${level === l ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                      {l === 'all' ? 'All' : (LEVEL_LABELS[l] ?? l)} <span className={level === l ? 'text-indigo-100' : 'text-gray-400'}>({count})</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${levels.length > 1 ? 'mt-8' : ''}`}>
              {shown.map((p) => (
                <article key={p.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                      {LEVEL_LABELS[p.degree_level] ?? p.degree_level}
                    </span>
                    {p.code && <span className="text-xs font-medium text-gray-400">{p.code}</span>}
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-gray-900">{p.name}</h2>
                  {p.description && <p className="mt-2 text-sm text-gray-600 leading-6">{p.description}</p>}

                  <dl className="mt-4 grid grid-cols-2 gap-3">
                    <Stat label="Duration" value={durationText(p)} />
                    <Stat label="Seats" value={p.total_seats > 0 ? p.total_seats : '—'} />
                  </dl>

                  {p.eligibility_criteria && (
                    <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Eligibility</p>
                      <p className="mt-1 text-sm text-gray-700">{p.eligibility_criteria}</p>
                    </div>
                  )}

                  <div className="mt-auto pt-5">
                    {admissionsOpen ? (
                      <Link to={applyLink(p.id)} className="block w-full text-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
                        Apply now
                      </Link>
                    ) : (
                      <span className="block w-full text-center px-4 py-2.5 rounded-lg bg-gray-100 text-gray-500 text-sm font-medium">Admissions closed</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function durationText(p) {
  const years = Number(p.duration_years);
  if (!years) return '—';
  const y = `${years} ${years === 1 ? 'year' : 'years'}`;
  return p.total_semesters ? `${y} · ${p.total_semesters} sem.` : y;
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-100 px-3 py-2">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-gray-900">{value}</dd>
    </div>
  );
}
