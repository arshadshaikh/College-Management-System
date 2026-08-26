import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { usePublicSite } from '../../context/PublicSiteContext';

export default function PublicLayout() {
  const { loading, college, settings, menus } = usePublicSite();
  const primary = settings.primary_color || '#1e40af';

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ '--primary': primary }}>
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            {settings.logo
              ? <img src={settings.logo} alt={college?.name} className="h-9" />
              : <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold" style={{ background: primary }}>{college?.name?.charAt(0)}</span>}
            <span className="font-bold text-gray-900">{college?.name}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm">
            {menus.map((m) => <PublicNavItem key={m.id} item={m} />)}
            <Link to="/login" className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: primary }}>
              Portal Login
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-gray-500 flex flex-col sm:flex-row justify-between gap-3">
          <span>© {new Date().getFullYear()} {college?.name}</span>
          <span>
            {settings.contact_email && <a href={`mailto:${settings.contact_email}`} className="hover:underline">{settings.contact_email}</a>}
            {settings.contact_phone && <span className="ml-4">{settings.contact_phone}</span>}
          </span>
        </div>
      </footer>
    </div>
  );
}

function PublicNavItem({ item }) {
  const [open, setOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  // Build the target for a single item.
  const linkTo = (m) => {
    if (m.page_id) {
      const slug = m.page?.slug ?? '';
      return slug === 'home' ? '/' : `/${slug}`;   // home lives at root
    }
    return m.url || '#';
  };

  // External links (http/https) must use a plain <a>, not React Router <Link>.
  const isExternal = (m) => !m.page_id && /^https?:\/\//i.test(m.url || '');

  const renderLink = (m, className) =>
    isExternal(m)
      ? <a href={m.url} target="_blank" rel="noopener noreferrer" className={className}>{m.label}</a>
      : <Link to={linkTo(m)} className={className}>{m.label}</Link>;

  if (!hasChildren) {
    return renderLink(item, 'text-gray-700 hover:text-gray-900');
  }

  // Parent with children → dropdown
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="text-gray-700 hover:text-gray-900 flex items-center gap-1">
        {item.label}
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.5 7.5l4.5 4.5 4.5-4.5" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full pt-2 z-20">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[180px]">
            {/* The parent itself is also clickable if it links somewhere */}
            {(item.page_id || item.url) && (
              <div className="px-4 py-2 border-b border-gray-100">
                {renderLink(item, 'text-gray-900 font-medium hover:text-gray-700')}
              </div>
            )}
            {item.children.map((child) => (
              <div key={child.id} className="px-4 py-2 hover:bg-gray-50">
                {renderLink(child, 'block text-gray-700 hover:text-gray-900')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}