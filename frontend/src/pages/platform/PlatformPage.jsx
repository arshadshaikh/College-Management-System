import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api';

// Styles for admin-authored HTML (no typography plugin installed).
const CONTENT = [
  'text-gray-700 leading-7',
  '[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-10 [&_h2]:mb-3',
  '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mt-8 [&_h3]:mb-2',
  '[&_p]:my-4 [&_a]:text-indigo-600 [&_a]:underline [&_strong]:text-gray-900',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4 [&_li]:my-1.5',
  '[&_img]:mx-auto [&_img]:rounded-xl [&_img]:my-6',
  '[&_table]:w-full [&_table]:border-collapse [&_table]:my-6 [&_td]:border [&_th]:border [&_td]:border-gray-200 [&_th]:border-gray-200',
  '[&_td]:p-2 [&_th]:p-2 [&_th]:bg-gray-50 [&_th]:text-left [&_th]:font-semibold [&_th]:text-gray-900 [&_td>p]:my-0 [&_th>p]:my-0 [&_td]:align-top',
  '[&>*:first-child]:mt-0',
].join(' ');

// Main-domain CMS page: /pages/:slug (platform tenant's pages).
export default function PlatformPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [settings, setSettings] = useState({});
  const [state, setState] = useState('loading');

  useEffect(() => {
    setState('loading');
    api.get(`/public/pages/${slug}`)
      .then(({ data }) => { setPage(data); setState('ok'); document.title = data.meta_title || data.title; })
      .catch(() => setState('missing'));
  }, [slug]);

  useEffect(() => {
    if (slug === 'contact') api.get('/public/settings').then(({ data }) => setSettings(data.settings || {})).catch(() => {});
  }, [slug]);

  if (state === 'loading') {
    return <div className="max-w-3xl mx-auto px-4 py-24"><div className="h-8 w-1/2 bg-gray-100 rounded animate-pulse" /></div>;
  }

  if (state === 'missing') {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <p className="text-sm font-semibold text-indigo-600">404</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-3 text-gray-600">The page you are looking for does not exist or is not published.</p>
        <Link to="/" className="mt-6 inline-block px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold">Back to home</Link>
      </div>
    );
  }

  const hasContact = settings.contact_email || settings.contact_phone;

  return (
    <div>
      <section className="bg-gradient-to-b from-indigo-50 to-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
          <nav className="text-sm text-gray-500"><Link to="/" className="hover:text-indigo-600">Home</Link> <span className="mx-1">/</span> {page.title}</nav>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-gray-900">{page.title}</h1>
          {page.meta_description && <p className="mt-3 text-lg text-gray-600">{page.meta_description}</p>}
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <article className={CONTENT} dangerouslySetInnerHTML={{ __html: page.content || '' }} />

        {slug === 'contact' && hasContact && (
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {settings.contact_email && (
              <a href={`mailto:${settings.contact_email}`} className="rounded-2xl border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-md transition">
                <p className="text-sm text-gray-500">Email</p>
                <p className="mt-1 font-semibold text-gray-900 break-all">{settings.contact_email}</p>
              </a>
            )}
            {settings.contact_phone && (
              <a href={`tel:${settings.contact_phone}`} className="rounded-2xl border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-md transition">
                <p className="text-sm text-gray-500">Phone</p>
                <p className="mt-1 font-semibold text-gray-900">{settings.contact_phone}</p>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
