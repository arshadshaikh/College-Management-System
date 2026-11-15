import { useState, useEffect } from 'react';
import { Outlet, Link, NavLink, useLocation } from 'react-router-dom';
import api from '../../api';
import { usePublicSite } from '../../context/PublicSiteContext';
import { useAuth } from '../../context/AuthContext';
import { PORTAL } from '../../config/app';

// College public-site shell. Colours: AppConfigContext points every indigo-*
// class at the college's Primary Color, so this file only uses indigo-*.
// Menus come from the college CMS; until the college adds any, DEFAULT_MENU
// keeps the header useful (links to pages that exist are kept, see below).
const DEFAULT_MENU = [
  { id: 'd-home', label: 'Home', to: '/' },
  { id: 'd-about', label: 'About', to: '/about', page: 'about' },
  { id: 'd-programs', label: 'Programs', to: '/programs' },
  { id: 'd-admissions', label: 'Admissions', to: '/admissions', page: 'admissions' },
  { id: 'd-contact', label: 'Contact', to: '/contact', page: 'contact' },
];

export default function PublicLayout() {
  const { loading, college, settings, menus } = usePublicSite();
  const { user } = useAuth();
  const [pages, setPages] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    api.get('/public/pages').then(({ data }) => setPages(Array.isArray(data) ? data : (data.data ?? []))).catch(() => {});
  }, []);

  // New page → close the mobile menu and start at the top.
  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  }

  const name = college?.name || 'Our College';
  const admissionsOpen = settings.admission_open === 'true' || settings.admission_open === true;
  const pageSlugs = new Set(pages.map((p) => p.slug));

  // Skip CMS items that point nowhere (e.g. their page was deleted).
  const cmsMenu = menus.filter((m) => m.page?.slug || m.url || m.children?.length);
  // Default links to CMS pages are shown only when that page is published.
  const nav = cmsMenu.length > 0
    ? cmsMenu
    : DEFAULT_MENU.filter((m) => !m.page || pageSlugs.has(m.page));

  const footerPages = pages.filter((p) => p.slug !== 'home');
  const applyTo = user ? `${PORTAL}/apply` : '/register';
  // Site Settings → "Show login link on the public website" (default on). Signed-in users always see "My portal".
  const showLogin = !!user || settings.show_login_link !== 'false';

  return (
    <div className="min-h-screen bg-white flex flex-col text-gray-900">
      {/* ── Top bar (contact) ─────────────────────────────── */}
      {(settings.contact_email || settings.contact_phone) && (
        <div className="hidden md:block bg-indigo-800 text-indigo-100 text-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-9 flex items-center justify-between">
            <div className="flex items-center gap-5">
              {settings.contact_phone && (
                <a href={`tel:${settings.contact_phone}`} className="flex items-center gap-1.5 hover:text-white">
                  <Icon d="M3 5a2 2 0 012-2h2.3a1 1 0 01.95.68l1.1 3.3a1 1 0 01-.5 1.2l-1.6.8a11 11 0 005.5 5.5l.8-1.6a1 1 0 011.2-.5l3.3 1.1a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.7 21 3 14.3 3 6V5z" />
                  {settings.contact_phone}
                </a>
              )}
              {settings.contact_email && (
                <a href={`mailto:${settings.contact_email}`} className="flex items-center gap-1.5 hover:text-white">
                  <Icon d="M3 8l7.9 5.3a2 2 0 002.2 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  {settings.contact_email}
                </a>
              )}
            </div>
            <span className={`font-medium ${admissionsOpen ? 'text-white' : ''}`}>
              {admissionsOpen ? 'Admissions are open' : 'Admissions are currently closed'}
            </span>
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <Brand name={name} logo={settings.logo} />

          <nav className="hidden lg:flex items-center gap-1 text-sm">
            {nav.map((m) => <NavItem key={m.id} item={m} />)}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            {showLogin && (
              <Link to={user ? PORTAL : '/login'} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-indigo-700">
                {user ? 'My portal' : 'Portal login'}
              </Link>
            )}
            {admissionsOpen && (
              <Link to={applyTo} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700">
                Apply now
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
              {nav.map((m) => (
                <div key={m.id}>
                  <MenuLink item={m} className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50" />
                  {m.children?.map((c) => (
                    <div key={c.id} className="pl-4">
                      <MenuLink item={c} className="block px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50" />
                    </div>
                  ))}
                </div>
              ))}
              <div className={`pt-3 mt-3 border-t border-gray-100 grid gap-3 ${admissionsOpen && showLogin ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {showLogin && (
                  <Link to={user ? PORTAL : '/login'} className="text-center px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium">
                    {user ? 'My portal' : 'Portal login'}
                  </Link>
                )}
                {admissionsOpen && (
                  <Link to={applyTo} className="text-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold">Apply now</Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Brand name={name} logo={settings.logo} dark />
            <p className="mt-4 text-sm leading-6">
              Official website and online admission portal of {name}. Explore our programs, apply online and track your application.
            </p>
          </div>

          <FooterCol title="Quick links">
            <FooterLink to="/">Home</FooterLink>
            <FooterLink to="/programs">Programs offered</FooterLink>
            {footerPages.map((p) => <FooterLink key={p.slug} to={`/${p.slug}`}>{p.title}</FooterLink>)}
          </FooterCol>

          <FooterCol title="Admissions">
            <li className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${admissionsOpen ? 'bg-green-400' : 'bg-gray-500'}`} />
              <span className="text-gray-300">{admissionsOpen ? 'Admissions open' : 'Admissions closed'}</span>
            </li>
            {admissionsOpen && <FooterLink to={applyTo}>Apply online</FooterLink>}
            {!user && <FooterLink to="/register">Create an account</FooterLink>}
            {showLogin && <FooterLink to={user ? PORTAL : '/login'}>{user ? 'My portal' : 'Portal login'}</FooterLink>}
          </FooterCol>

          <FooterCol title="Contact us">
            {settings.contact_phone && (
              <li><a href={`tel:${settings.contact_phone}`} className="hover:text-white">{settings.contact_phone}</a></li>
            )}
            {settings.contact_email && (
              <li><a href={`mailto:${settings.contact_email}`} className="hover:text-white break-all">{settings.contact_email}</a></li>
            )}
            {pageSlugs.has('contact') && <FooterLink to="/contact">Contact page</FooterLink>}
            {!settings.contact_email && !settings.contact_phone && !pageSlugs.has('contact') && (
              <li className="text-gray-500">Contact details coming soon.</li>
            )}
          </FooterCol>
        </div>

        <div className="border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-xs flex flex-col sm:flex-row justify-between gap-2">
            <span>© {new Date().getFullYear()} {name}. All rights reserved.</span>
            <span>Online admissions portal</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Pieces ─────────────────────────────────────────────────

function Icon({ d }) {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

function Brand({ name, logo, dark = false }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 min-w-0">
      {logo
        ? <img src={logo} alt={name} className={`h-10 w-auto shrink-0 ${dark ? 'bg-white rounded-md p-1' : ''}`} />
        : <span className="w-10 h-10 shrink-0 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-lg font-bold">{name?.charAt(0)}</span>}
      <span className={`font-bold leading-tight truncate ${dark ? 'text-white' : 'text-gray-900'}`}>{name}</span>
    </Link>
  );
}

// College pages live at /<slug>; the "home" page is the site root.
// Default menu items carry their own `to`.
const linkTo = (m) => {
  if (m.to) return m.to;
  if (m.page_id) return m.page?.slug === 'home' ? '/' : `/${m.page?.slug ?? ''}`;
  return m.url || '#';
};
const isExternal = (m) => !m.to && !m.page_id && /^https?:\/\//i.test(m.url || '');

function MenuLink({ item, className }) {
  return isExternal(item)
    ? <a href={item.url} target="_blank" rel="noopener noreferrer" className={className}>{item.label}</a>
    : <Link to={linkTo(item)} className={className}>{item.label}</Link>;
}

function TopLink({ to, children }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `px-3 py-2 rounded-lg font-medium ${isActive ? 'text-indigo-700 bg-indigo-50' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
    >
      {children}
    </NavLink>
  );
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
        <div className="absolute left-0 top-full pt-2 z-50">
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg py-2 min-w-[200px]">
            {(item.page_id || item.url) && <MenuLink item={item} className="block px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50" />}
            {item.children.map((c) => <MenuLink key={c.id} item={c} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" />)}
          </div>
        </div>
      )}
    </div>
  );
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
