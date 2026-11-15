import { useState, useEffect } from 'react';
import { Outlet, Link, NavLink, useLocation } from 'react-router-dom';
import api from '../../api';

// Main-domain site shell. Content comes from the PLATFORM tenant's CMS
// (super admin → CMS → Menus / Pages / Site Settings).
export default function PlatformLayout() {
  const [site, setSite] = useState({ name: 'College Admissions Platform', settings: {} });
  const [menus, setMenus] = useState([]);
  const [pages, setPages] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    api.get('/public/settings').then(({ data }) => setSite({ name: data.name, settings: data.settings || {} })).catch(() => {});
    // Skip items that point nowhere (e.g. their page was deleted), or they would show as always-active links.
    api.get('/public/menus').then(({ data }) => setMenus(data.filter((m) => m.page?.slug || m.url || m.children?.length))).catch(() => {});
    api.get('/public/pages').then(({ data }) => setPages(data)).catch(() => {});
  }, []);

  // New page → close the mobile menu and start at the top.
  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  const { settings } = site;
  // Site Settings → "Show login link on the public website" (default on).
  const showLogin = settings.show_login_link !== 'false';
  const footerPages = pages.filter((p) => p.slug !== 'home');

  return (
    <div className="min-h-screen bg-white flex flex-col text-gray-900">
      {/* ── Header ───────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <Brand name={site.name} logo={settings.logo} />

          <nav className="hidden lg:flex items-center gap-1 text-sm">
            <TopLink to="/colleges">Colleges</TopLink>
            {menus.map((m) => <NavItem key={m.id} item={m} />)}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link to="/register-college" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-indigo-700">
              Register college
            </Link>
            {showLogin && (
              <Link to="/login" className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700">
                Portal login
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="lg:hidden p-2 -mr-2 rounded-lg text-gray-700 hover:bg-gray-100"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              {mobileOpen
                ? <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>

        {/* Mobile panel */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              <MobileLink to="/colleges" label="Colleges" />
              {menus.map((m) => (
                <div key={m.id}>
                  <MobileLink item={m} />
                  {m.children?.map((c) => (
                    <div key={c.id} className="pl-4"><MobileLink item={c} /></div>
                  ))}
                </div>
              ))}
              <div className={`pt-3 mt-3 border-t border-gray-100 grid gap-3 ${showLogin ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <Link to="/register-college" className="text-center px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium">Register college</Link>
                {showLogin && <Link to="/login" className="text-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold">Portal login</Link>}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Brand name={site.name} logo={settings.logo} dark />
            <p className="mt-4 text-sm leading-6">
              Online admissions, fee challans and student records for every college, each with its own website and portal.
            </p>
          </div>

          <FooterCol title="Platform">
            <FooterLink to="/">Home</FooterLink>
            <FooterLink to="/colleges">Browse colleges</FooterLink>
            {showLogin && <FooterLink to="/login">Portal login</FooterLink>}
          </FooterCol>

          <FooterCol title="For colleges">
            <FooterLink to="/register-college">Register your college</FooterLink>
            {footerPages.map((p) => <FooterLink key={p.slug} to={`/pages/${p.slug}`}>{p.title}</FooterLink>)}
          </FooterCol>

          <FooterCol title="Contact">
            {settings.contact_email && (
              <li><a href={`mailto:${settings.contact_email}`} className="hover:text-white break-all">{settings.contact_email}</a></li>
            )}
            {settings.contact_phone && (
              <li><a href={`tel:${settings.contact_phone}`} className="hover:text-white">{settings.contact_phone}</a></li>
            )}
            {!settings.contact_email && !settings.contact_phone && <li className="text-gray-500">Add contact details in Site Settings.</li>}
          </FooterCol>
        </div>

        <div className="border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-xs flex flex-col sm:flex-row justify-between gap-2">
            <span>© {new Date().getFullYear()} {site.name}. All rights reserved.</span>
            <span>Built for colleges and universities.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Pieces ─────────────────────────────────────────────────

function Brand({ name, logo, dark = false }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 shrink-0">
      {logo
        ? <img src={logo} alt={name} className="h-9 w-auto" />
        : <span className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">{name?.charAt(0)}</span>}
      <span className={`font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{name}</span>
    </Link>
  );
}

// Platform CMS pages live under /pages/<slug> so a page slug can never clash with a college slug (path mode on the server).
const linkTo = (m) => (m.page_id ? (m.page?.slug === 'home' ? '/' : `/pages/${m.page?.slug ?? ''}`) : m.url || '#');
const isExternal = (m) => !m.page_id && /^https?:\/\//i.test(m.url || '');

function TopLink({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded-lg font-medium ${isActive ? 'text-indigo-700 bg-indigo-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
    >
      {children}
    </NavLink>
  );
}

function MenuLink({ item, className }) {
  return isExternal(item)
    ? <a href={item.url} target="_blank" rel="noopener noreferrer" className={className}>{item.label}</a>
    : <Link to={linkTo(item)} className={className}>{item.label}</Link>;
}

function NavItem({ item }) {
  const [open, setOpen] = useState(false);
  if (!item.children?.length) {
    return isExternal(item)
      ? <MenuLink item={item} className="px-3 py-2 rounded-lg font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50" />
      : <TopLink to={linkTo(item)}>{item.label}</TopLink>;
  }
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="px-3 py-2 rounded-lg font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-1">
        {item.label}
        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 7.5l4.5 4.5 4.5-4.5" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full pt-2">
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg py-2 min-w-[200px]">
            {(item.page_id || item.url) && <MenuLink item={item} className="block px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50" />}
            {item.children.map((c) => <MenuLink key={c.id} item={c} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" />)}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileLink({ item, to, label }) {
  const cls = 'block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50';
  if (item) return <MenuLink item={item} className={cls} />;
  return <Link to={to} className={cls}>{label}</Link>;
}

function FooterCol({ title, children }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }) {
  return <li><Link to={to} className="hover:text-white">{children}</Link></li>;
}
