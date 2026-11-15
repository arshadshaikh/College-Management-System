import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { usePublicSite } from '../../context/PublicSiteContext';
import { useAuth } from '../../context/AuthContext';
import { PORTAL } from '../../config/app';

// College home page. Works with zero content (a brand-new college) and gets
// richer as the college adds banners, programs and announcements in the CMS.
// Colours: indigo-* = the college's Primary Color (see AppConfigContext).

const LEVEL_LABELS = {
  certificate: 'Certificate', diploma: 'Diploma', associate: 'Associate',
  bachelor: 'Bachelor', master: 'Master', phd: 'PhD',
};

const FEATURES = [
  { icon: 'M12 6.25v13m0-13C10.8 5.5 9.2 5 7.5 5S4.2 5.5 3 6.25v13C4.2 18.5 5.8 18 7.5 18s3.3.5 4.5 1.25m0-13C13.2 5.5 14.8 5 16.5 5s3.3.5 4.5 1.25v13C19.8 18.5 18.2 18 16.5 18s-3.3.5-4.5 1.25', title: 'A choice of programs', text: 'Choose from programs across different levels, each with clear eligibility and seats.' },
  { icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18', title: 'Apply from anywhere', text: 'The whole admission process is online. No queues, no paper forms.' },
  { icon: 'M9 12l2 2 4-4m5.6-4A11.9 11.9 0 0112 3a11.9 11.9 0 01-8.6 3A12 12 0 0012 21a12 12 0 008.6-15z', title: 'Fair and transparent', text: 'Every application is reviewed against published criteria, and you see each decision.' },
  { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Track every step', text: 'Follow your application, download your fee challan and get updates in your portal.' },
];

const STEPS = [
  { title: 'Create an account', text: 'Sign up with your CNIC in under a minute.' },
  { title: 'Complete your profile', text: 'Add personal details, education and documents once.' },
  { title: 'Apply to a program', text: 'Pick a program, review and submit your application.' },
  { title: 'Pay and confirm', text: 'Download your fee challan once you are approved.' },
];

const asList = (data) => (Array.isArray(data) ? data : (data?.data ?? []));

export default function PublicHome() {
  const { settings, college } = usePublicSite();
  const { user } = useAuth();
  const [banners, setBanners] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [programsLoaded, setProgramsLoaded] = useState(false);

  useEffect(() => {
    api.get('/public/banners').then(({ data }) => setBanners(asList(data))).catch(() => {});
    api.get('/public/announcements').then(({ data }) => setAnnouncements(asList(data))).catch(() => {});
    api.get('/public/programs')
      .then(({ data }) => setPrograms(asList(data)))
      .catch(() => {})
      .finally(() => setProgramsLoaded(true));
  }, []);

  const name = college?.name || 'our college';
  const admissionsOpen = settings.admission_open === 'true' || settings.admission_open === true;
  const applyTo = user ? `${PORTAL}/apply` : '/register';
  // Banners with an image become hero slides (sorted by the CMS sort order).
  const slides = banners.filter((b) => b.image_url);
  const hero = slides[0];
  const levels = [...new Set(programs.map((p) => p.degree_level))];
  const totalSeats = programs.reduce((sum, p) => sum + (Number(p.total_seats) || 0), 0);
  const featured = programs.slice(0, 6);
  const news = announcements.slice(0, 3);

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────── */}
      {hero ? (
        <HeroSlider slides={slides} name={name} admissionsOpen={admissionsOpen} applyTo={applyTo} />
      ) : (
        <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <AdmissionBadge open={admissionsOpen} />
              <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
                Welcome to <span className="text-indigo-700">{name}</span>
              </h1>
              <p className="mt-5 text-lg text-gray-600 leading-8 max-w-xl">
                {admissionsOpen
                  ? 'Admissions are now open. Explore our programs, build your profile once and apply online in a few minutes.'
                  : 'Explore our programs and get your profile ready, so you can apply as soon as admissions open.'}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                {admissionsOpen
                  ? <Link to={applyTo} className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold text-center shadow-sm hover:bg-indigo-700">Apply now</Link>
                  : !user && <Link to="/register" className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold text-center shadow-sm hover:bg-indigo-700">Create an account</Link>}
                <Link to="/programs" className="px-6 py-3 rounded-lg bg-white border border-gray-300 text-gray-800 font-semibold text-center hover:bg-gray-50">Explore programs</Link>
              </div>
            </div>

            {/* Admission card */}
            <div className="relative">
              <div className="absolute -inset-4 bg-indigo-100 rounded-3xl rotate-2" aria-hidden="true" />
              <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                    <Svg d="M12 14l9-5-9-5-9 5 9 5zm0 0v6m-6.5-9.4V16c0 1.1 2.9 3 6.5 3s6.5-1.9 6.5-3v-5.4" className="w-6 h-6" />
                  </span>
                  <div>
                    <p className="text-sm text-gray-500">Admissions {new Date().getFullYear()}</p>
                    <p className="font-semibold text-gray-900">{admissionsOpen ? 'Applications are being accepted' : 'Applications are closed for now'}</p>
                  </div>
                </div>
                <ol className="mt-6 space-y-4">
                  {STEPS.map((s, i) => (
                    <li key={s.title} className="flex gap-3">
                      <span className="w-7 h-7 shrink-0 rounded-full bg-indigo-50 text-indigo-700 text-sm font-bold flex items-center justify-center">{i + 1}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                        <p className="text-sm text-gray-500">{s.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Quick facts ──────────────────────────────────── */}
      {programs.length > 0 && (
        <section className="border-y border-gray-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <Fact value={programs.length} label={programs.length === 1 ? 'Program offered' : 'Programs offered'} />
            <Fact value={levels.length} label={levels.length === 1 ? 'Study level' : 'Study levels'} />
            <Fact value={totalSeats > 0 ? totalSeats.toLocaleString() : '—'} label="Total seats" />
            <Fact value={admissionsOpen ? 'Open' : 'Closed'} label="Admissions" />
          </div>
        </section>
      )}

      {/* ── Programs ───────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
        <SectionHead
          eyebrow="Academics"
          title="Programs we offer"
          text="Find the program that fits your goals. Open a program to see its eligibility and apply."
          action={programs.length > 0 && <Link to="/programs" className="text-sm font-semibold text-indigo-700 hover:text-indigo-800">View all programs →</Link>}
        />
        {!programsLoaded ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-44 rounded-xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : featured.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-gray-300 p-10 text-center">
            <p className="font-medium text-gray-900">Programs will be announced soon.</p>
            <p className="mt-1 text-sm text-gray-500">Create an account now so you are ready to apply when they are published.</p>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <Link key={p.id} to="/programs" className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-indigo-200 transition flex flex-col">
                <span className="self-start text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                  {LEVEL_LABELS[p.degree_level] ?? p.degree_level}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-gray-900 group-hover:text-indigo-700">{p.name}</h3>
                {p.description && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{p.description}</p>}
                <div className="mt-auto pt-5 flex items-center gap-4 text-sm text-gray-500">
                  {p.duration_years && <span>{p.duration_years} {Number(p.duration_years) === 1 ? 'year' : 'years'}</span>}
                  {p.total_seats > 0 && <span>{p.total_seats} seats</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Why us ─────────────────────────────────────── */}
      <section className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
          <SectionHead eyebrow="Why choose us" title={`Why study at ${name}`} center />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
                <span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Svg d={f.icon} className="w-6 h-6" />
                </span>
                <h3 className="mt-4 font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-6">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How to apply (shown here when a banner replaced the hero card) ── */}
      {hero && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
          <SectionHead eyebrow="Admissions" title="How to apply" center />
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-gray-200 p-6">
                <span className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center">{i + 1}</span>
                <h3 className="mt-4 font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-1 text-sm text-gray-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── News ───────────────────────────────────────── */}
      {news.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
          <SectionHead eyebrow="Latest" title="News and announcements" />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {news.map((a) => (
              <article key={a.id} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col">
                {a.published_at && (
                  <time className="text-xs font-medium text-indigo-700">
                    {new Date(a.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </time>
                )}
                <h3 className="mt-2 font-semibold text-gray-900">{a.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-6 whitespace-pre-line line-clamp-4">{a.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ── Call to action ─────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-4">
        <div className="rounded-2xl bg-indigo-700 px-6 py-12 sm:px-12 text-center sm:text-left sm:flex items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {admissionsOpen ? 'Ready to start your journey?' : 'Get ready for the next admissions'}
            </h2>
            <p className="mt-2 text-indigo-100">
              {admissionsOpen ? `Apply online to ${name} today.` : 'Create your account and complete your profile in advance.'}
            </p>
          </div>
          <div className="mt-6 sm:mt-0 flex flex-col sm:flex-row gap-3 shrink-0">
            {admissionsOpen
              ? <Link to={applyTo} className="px-6 py-3 rounded-lg bg-white text-indigo-700 font-semibold text-center hover:bg-indigo-50">Apply now</Link>
              : <Link to={user ? PORTAL : '/register'} className="px-6 py-3 rounded-lg bg-white text-indigo-700 font-semibold text-center hover:bg-indigo-50">{user ? 'Go to my portal' : 'Create an account'}</Link>}
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Pieces ─────────────────────────────────────────────────

const SLIDE_MS = 6000;

// Full-width hero. One banner = a static hero; several = a crossfading slider
// with arrows, dots, swipe, auto-play (paused on hover/focus and when the user
// prefers reduced motion).
function HeroSlider({ slides, name, admissionsOpen, applyTo }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touchX, setTouchX] = useState(null);
  const count = slides.length;

  const go = useCallback((i) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setTimeout(() => go(index + 1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, paused, count, go]);

  const onTouchEnd = (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    setTouchX(null);
  };

  return (
    <section
      className="relative isolate overflow-hidden bg-gray-900 min-h-[28rem] lg:min-h-[34rem]"
      aria-roledescription={count > 1 ? 'carousel' : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={onTouchEnd}
    >
      {slides.map((s, i) => {
        const active = i === index;
        return (
          <div
            key={s.id ?? i}
            className={`absolute inset-0 flex items-center transition-opacity duration-700 ease-in-out ${active ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
            aria-hidden={!active}
            aria-roledescription={count > 1 ? 'slide' : undefined}
            aria-label={count > 1 ? `${i + 1} of ${count}` : undefined}
          >
            <img
              src={s.image_url}
              alt=""
              className={`absolute inset-0 -z-10 w-full h-full object-cover transition-transform duration-[7000ms] ease-out ${active ? 'scale-105' : 'scale-100'}`}
              loading={i === 0 ? 'eager' : 'lazy'}
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-gray-900/85 via-gray-900/60 to-gray-900/20" />
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-20 text-white">
              <div className="max-w-2xl">
                <AdmissionBadge open={admissionsOpen} dark />
                {i === 0
                  ? <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">{s.title || `Welcome to ${name}`}</h1>
                  : <h2 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">{s.title || `Welcome to ${name}`}</h2>}
                {s.subtitle && <p className="mt-5 text-lg text-gray-200 leading-8">{s.subtitle}</p>}
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  {s.button_text && s.link_url
                    ? <SmartLink href={s.link_url} tabIndex={active ? 0 : -1} className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold text-center shadow-sm hover:bg-indigo-700">{s.button_text}</SmartLink>
                    : admissionsOpen && <Link to={applyTo} tabIndex={active ? 0 : -1} className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold text-center shadow-sm hover:bg-indigo-700">Apply now</Link>}
                  <Link to="/programs" tabIndex={active ? 0 : -1} className="px-6 py-3 rounded-lg bg-white/10 border border-white/30 text-white font-semibold text-center hover:bg-white/20">Explore programs</Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {count > 1 && (
        <>
          <button type="button" onClick={() => go(index - 1)} aria-label="Previous slide"
            className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white items-center justify-center backdrop-blur">
            <Svg d="M15 19l-7-7 7-7" />
          </button>
          <button type="button" onClick={() => go(index + 1)} aria-label="Next slide"
            className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/15 hover:bg-white/30 text-white items-center justify-center backdrop-blur">
            <Svg d="M9 5l7 7-7 7" />
          </button>
          <div className="absolute bottom-6 inset-x-0 z-20 flex justify-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id ?? i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Svg({ d, className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function AdmissionBadge({ open, dark = false }) {
  const base = dark ? 'bg-white/10 border-white/30 text-white' : 'bg-white border-indigo-100 text-indigo-700';
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${base}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-green-500' : 'bg-gray-400'}`} />
      {open ? `Admissions ${new Date().getFullYear()} open` : 'Admissions closed'}
    </span>
  );
}

function Fact({ value, label }) {
  return (
    <div>
      <p className="text-2xl sm:text-3xl font-extrabold text-indigo-700">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  );
}

function SectionHead({ eyebrow, title, text, action, center = false }) {
  return (
    <div className={center ? 'text-center max-w-2xl mx-auto' : 'sm:flex items-end justify-between gap-6'}>
      <div className={center ? '' : 'max-w-2xl'}>
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{title}</h2>
        {text && <p className="mt-3 text-gray-600">{text}</p>}
      </div>
      {action && <div className="mt-4 sm:mt-0 shrink-0">{action}</div>}
    </div>
  );
}

// Banner links: in-site paths go through the router (keeps the /cms/<college> base), others open normally.
function SmartLink({ href, className, children, ...rest }) {
  if (href.startsWith('/')) return <Link to={href} className={className} {...rest}>{children}</Link>;
  return <a href={href} className={className} target="_blank" rel="noopener noreferrer" {...rest}>{children}</a>;
}
