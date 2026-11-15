import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { collegeUrl } from '../../config/tenant';

// Main-domain home page. The hero text/image can be overridden by the first
// active banner in the PLATFORM CMS (super admin → CMS → Banners).
const DEFAULT_HERO = {
  title: 'Admissions, simplified for every college.',
  subtitle: 'One platform for online applications, document verification and fee challans. Every college gets its own website and admission portal.',
  button_text: 'Register your college',
  link_url: '/register-college',
};

const STEPS = [
  { n: '1', title: 'Find your college', text: 'Browse the colleges on the platform and open their admission site.' },
  { n: '2', title: 'Build your profile once', text: 'Add your personal details, education and documents in one place.' },
  { n: '3', title: 'Apply and pay', text: 'Apply to programs, track your status and download your fee challan.' },
];

const FEATURES = [
  { icon: 'M9 12h6m-6 4h6M7 4h7l5 5v11a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z', title: 'Online applications', text: 'Applicants apply to any program, with eligibility checked against your rules.' },
  { icon: 'M9 12l2 2 4-4m5.6-4A11.9 11.9 0 0112 3a11.9 11.9 0 01-8.6 3A12 12 0 0012 21a12 12 0 008.6-15z', title: 'Document verification', text: 'Review certificates and documents, return applications for correction, approve in one click.' },
  { icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', title: 'Fee challans', text: 'Bank challans with automatic late fees, discounts and payment verification.' },
  { icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18', title: 'Your own website', text: 'Pages, menus, banners and news managed by your staff, in your colours and logo.' },
  { icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', title: 'Roles and privileges', text: 'Give each staff member exactly the access they need.' },
  { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Full audit trail', text: 'Every important action is logged, so you always know who did what.' },
];

export default function PlatformHome() {
  const [colleges, setColleges] = useState([]);
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    api.get('/public/colleges').then(({ data }) => setColleges(data.data ?? data)).catch(() => {});
    api.get('/public/banners').then(({ data }) => setBanner((data.data ?? data)[0] || null)).catch(() => {});
  }, []);

  const hero = {
    title: banner?.title || DEFAULT_HERO.title,
    subtitle: banner?.subtitle || DEFAULT_HERO.subtitle,
    button_text: banner?.button_text || DEFAULT_HERO.button_text,
    link_url: banner?.link_url || DEFAULT_HERO.link_url,
    image: banner?.image_url || null,
  };
  const preview = colleges.slice(0, 6);

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white border border-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
              {colleges.length > 0 ? `${colleges.length} ${colleges.length === 1 ? 'college' : 'colleges'} already on the platform` : 'Now open for colleges'}
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">{hero.title}</h1>
            <p className="mt-5 text-lg text-gray-600 leading-8 max-w-xl">{hero.subtitle}</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <SmartLink to={hero.link_url} className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold text-center shadow-sm hover:bg-indigo-700">
                {hero.button_text}
              </SmartLink>
              <Link to="/colleges" className="px-6 py-3 rounded-lg border border-gray-300 bg-white font-semibold text-gray-800 text-center hover:bg-gray-50">
                Find a college to apply
              </Link>
            </div>
          </div>

          <div className="hidden lg:block">
            {hero.image
              ? <img src={hero.image} alt="" className="w-full rounded-2xl shadow-xl ring-1 ring-gray-200 object-cover aspect-[4/3]" />
              : <HeroMock />}
          </div>
        </div>
      </section>

      {/* ── How it works (students) ────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
        <SectionHead eyebrow="For students" title="Apply in three simple steps" />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-gray-200 p-6">
              <span className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center">{s.n}</span>
              <h3 className="mt-4 font-semibold text-gray-900">{s.title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-6">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features (colleges) ────────────────────────── */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
          <SectionHead eyebrow="For colleges" title="Everything your admission office needs" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white border border-gray-200 p-6">
                <span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                  </svg>
                </span>
                <h3 className="mt-4 font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-6">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Colleges ───────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
        <div className="flex items-end justify-between gap-4">
          <SectionHead eyebrow="Directory" title="Colleges on the platform" left />
          <Link to="/colleges" className="shrink-0 text-sm font-semibold text-indigo-600 hover:text-indigo-700">View all →</Link>
        </div>
        {preview.length === 0 ? (
          <p className="mt-8 text-gray-500">No colleges yet. Be the first to register.</p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {preview.map((c) => (
              <a key={c.id} href={collegeUrl(c.slug)} className="group flex items-center gap-4 rounded-2xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-md transition">
                <span className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 text-lg font-bold flex items-center justify-center">{c.name.charAt(0)}</span>
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 truncate group-hover:text-indigo-700">{c.name}</div>
                  <div className="text-sm text-gray-500 truncate">{[c.city, c.province].filter(Boolean).join(', ')}</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* ── CTA band ───────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="theme-static rounded-3xl bg-indigo-600 px-6 py-12 sm:px-12 flex flex-col lg:flex-row items-center justify-between gap-6 text-center lg:text-left">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Run your next admission cycle online</h2>
            <p className="mt-2 text-indigo-100">Register your college. Once approved, your website and portal are ready to use.</p>
          </div>
          <Link to="/register-college" className="shrink-0 px-6 py-3 rounded-lg bg-white text-indigo-700 font-semibold hover:bg-indigo-50">
            Register your college
          </Link>
        </div>
      </section>
    </div>
  );
}

function SectionHead({ eyebrow, title, left = false }) {
  return (
    <div className={left ? '' : 'text-center max-w-2xl mx-auto'}>
      <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{title}</h2>
    </div>
  );
}

// Internal paths use the router; full URLs open normally.
function SmartLink({ to, className, children }) {
  return /^https?:\/\//i.test(to)
    ? <a href={to} className={className}>{children}</a>
    : <Link to={to} className={className}>{children}</Link>;
}

// Illustration of an application card, built with plain markup (no image needed).
function HeroMock() {
  const rows = [
    { label: 'Profile complete', done: true },
    { label: 'Documents verified', done: true },
    { label: 'Application approved', done: true },
    { label: 'Fee challan issued', done: true },
  ];
  return (
    <div className="relative select-none" aria-hidden="true">
      <div className="absolute -inset-4 rounded-3xl bg-indigo-100/60 blur-2xl" />
      <div className="relative rounded-2xl bg-white shadow-xl ring-1 ring-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Application</p>
            <p className="font-semibold text-gray-900">BS Computer Science</p>
          </div>
          <span className="rounded-full bg-green-50 text-green-700 text-xs font-semibold px-3 py-1">Approved</span>
        </div>
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-3 text-sm">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center ${r.done ? 'bg-indigo-600 text-white' : 'border-2 border-gray-300'}`}>
                {r.done && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
              </span>
              <span className={r.done ? 'text-gray-900' : 'text-gray-500'}>{r.label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-xl bg-gray-50 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Fee challan</p>
            <p className="font-semibold text-gray-900">Due in 7 days</p>
          </div>
          <span className="rounded-full bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1">Unpaid</span>
        </div>
      </div>
    </div>
  );
}
