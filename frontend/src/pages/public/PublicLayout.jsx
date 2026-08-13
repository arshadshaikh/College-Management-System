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
  // A menu item links to a page (slug), a custom url, or is a container.
  const to = item.page_id ? `/${item.page_slug ?? ''}` : (item.url || '#');
  return <Link to={to} className="text-gray-700 hover:text-gray-900">{item.label}</Link>;
}