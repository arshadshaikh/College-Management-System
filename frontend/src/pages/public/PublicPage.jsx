import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api';
import { usePublicSite } from '../../context/PublicSiteContext';
import { useAuth } from '../../context/AuthContext';
import { PORTAL } from '../../config/app';

// Styles for admin-authored HTML (no typography plugin installed, so `prose` does nothing).
// A leading <h1> is hidden because the page header already shows the title.
const CONTENT = [
  'text-gray-700 leading-7',
  '[&>h1:first-child]:hidden [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:mt-10 [&_h1]:mb-4',
  '[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-10 [&_h2]:mb-3',
  '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-8 [&_h3]:mb-2',
  '[&_p]:my-4 [&_a]:text-indigo-600 [&_a]:underline [&_strong]:text-gray-900',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4 [&_li]:my-1.5',
  '[&_img]:rounded-xl [&_img]:my-6 [&_table]:w-full [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2',
  '[&_blockquote]:border-l-4 [&_blockquote]:border-indigo-200 [&_blockquote]:pl-4 [&_blockquote]:italic',
  '[&>*:first-child]:mt-0 [&>h1:first-child+*]:mt-0',
].join(' ');

// College CMS page: /:slug (this college's published pages).
export default function PublicPage() {
  const { slug } = useParams();
  const { settings, college } = usePublicSite();
  const { user } = useAuth();
  const [page, setPage] = useState(null);
  const [pages, setPages] = useState([]);
  const [state, setState] = useState('loading');

  useEffect(() => {
    setState('loading');
    api.get(`/public/pages/${slug}`)
      .then(({ data }) => {
        setPage(data);
        setState('ok');
        document.title = `${data.meta_title || data.title}${college?.name ? ` | ${college.name}` : ''}`;
      })
      .catch(() => setState('missing'));
  }, [slug, college?.name]);

  useEffect(() => {
    api.get('/public/pages')
      .then(({ data }) => setPages(Array.isArray(data) ? data : (data.data ?? [])))
      .catch(() => {});
  }, []);

  if (state === 'loading') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 space-y-4">
        <div className="h-9 w-1/3 bg-gray-100 rounded animate-pulse" />
        <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />
        <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (state === 'missing') {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <p className="text-sm font-semibold text-indigo-600">404</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-3 text-gray-600">The page you are looking for does not exist or is not published.</p>
        <Link to="/" className="mt-6 inline-block px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">Back to home</Link>
      </div>
    );
  }

  const admissionsOpen = settings.admission_open === 'true' || settings.admission_open === true;
  const applyTo = user ? `${PORTAL}/apply` : '/register';
  const otherPages = pages.filter((p) => p.slug !== 'home' && p.slug !== slug);
  const hasContact = settings.contact_email || settings.contact_phone;

  return (
    <div>
      {/* ── Page header ─────────────────────────────────── */}
      <section className="bg-gradient-to-b from-indigo-50 to-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <nav className="text-sm text-gray-500">
            <Link to="/" className="hover:text-indigo-600">Home</Link>
            <span className="mx-1.5">/</span>
            <span className="text-gray-700">{page.title}</span>
          </nav>
          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">{page.title}</h1>
          {page.meta_description && <p className="mt-3 max-w-3xl text-lg text-gray-600">{page.meta_description}</p>}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid gap-10 lg:grid-cols-3">
        {/* ── Content ───────────────────────────────────── */}
        <div className="lg:col-span-2 min-w-0">
          <article className={CONTENT} dangerouslySetInnerHTML={{ __html: page.content || '' }} />

          {slug === 'contact' && hasContact && (
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {settings.contact_phone && (
                <ContactCard href={`tel:${settings.contact_phone}`} label="Call us" value={settings.contact_phone}
                  icon="M3 5a2 2 0 012-2h2.3a1 1 0 01.95.68l1.1 3.3a1 1 0 01-.5 1.2l-1.6.8a11 11 0 005.5 5.5l.8-1.6a1 1 0 011.2-.5l3.3 1.1a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.7 21 3 14.3 3 6V5z" />
              )}
              {settings.contact_email && (
                <ContactCard href={`mailto:${settings.contact_email}`} label="Email us" value={settings.contact_email}
                  icon="M3 8l7.9 5.3a2 2 0 002.2 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              )}
            </div>
          )}
        </div>

        {/* ── Sidebar ───────────────────────────────────── */}
        <aside className="space-y-6">
          <div className="theme-static rounded-2xl bg-indigo-700 p-6 text-white">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-100">
              <span className={`w-2 h-2 rounded-full ${admissionsOpen ? 'bg-green-400' : 'bg-gray-300'}`} />
              {admissionsOpen ? 'Admissions open' : 'Admissions closed'}
            </span>
            <h2 className="mt-3 text-xl font-bold">
              {admissionsOpen ? 'Start your application' : 'Get ready to apply'}
            </h2>
            <p className="mt-2 text-sm text-indigo-100 leading-6">
              {admissionsOpen
                ? 'Create your profile once and apply to any of our programs online.'
                : 'Create an account and complete your profile so you are ready when admissions open.'}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {admissionsOpen
                ? <Link to={applyTo} className="px-4 py-2.5 rounded-lg bg-white text-indigo-700 text-sm font-semibold text-center hover:bg-indigo-50">Apply now</Link>
                : <Link to={user ? PORTAL : '/register'} className="px-4 py-2.5 rounded-lg bg-white text-indigo-700 text-sm font-semibold text-center hover:bg-indigo-50">{user ? 'Go to my portal' : 'Create an account'}</Link>}
              <Link to="/programs" className="px-4 py-2.5 rounded-lg border border-white/30 text-white text-sm font-semibold text-center hover:bg-white/10">View programs</Link>
            </div>
          </div>

          {otherPages.length > 0 && (
            <div className="rounded-2xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900">More information</h2>
              <ul className="mt-3 space-y-1">
                {otherPages.map((p) => (
                  <li key={p.slug}>
                    <Link to={`/${p.slug}`} className="flex items-center justify-between rounded-lg px-3 py-2 -mx-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-indigo-700">
                      {p.title}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {slug !== 'contact' && hasContact && (
            <div className="rounded-2xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900">Need help?</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {settings.contact_phone && <li><a href={`tel:${settings.contact_phone}`} className="text-gray-700 hover:text-indigo-700">{settings.contact_phone}</a></li>}
                {settings.contact_email && <li><a href={`mailto:${settings.contact_email}`} className="text-gray-700 hover:text-indigo-700 break-all">{settings.contact_email}</a></li>}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ContactCard({ href, label, value, icon }) {
  return (
    <a href={href} className="flex items-start gap-4 rounded-2xl border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-md transition">
      <span className="w-11 h-11 shrink-0 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-gray-500">{label}</span>
        <span className="block mt-1 font-semibold text-gray-900 break-all">{value}</span>
      </span>
    </a>
  );
}
