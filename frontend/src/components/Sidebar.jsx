import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import MenuIcon from './MenuIcon';
import AppIcon from './AppIcon';
import { useAppConfig } from '../context/AppConfigContext';

/* ---------- helper: get children array (supports all key names from backend) ---------- */
const getChildren = (item) => item.menu_children || item.children_recursive || item.children || [];

/* Prefix menu routes with the portal base. DB stores "/programs";
   the app serves it at "/portal/programs". */
const portalPath = (route) => {
  if (!route || route === '#') return '#';
  return route.startsWith('/portal') ? route : `/portal${route.startsWith('/') ? '' : '/'}${route}`;
};

/* ---------- Expanded (non-collapsed) recursive menu item ---------- */
function ExpandedMenuItem({ item, depth = 0, expanded, toggle, onClose }) {
  const children = getChildren(item).filter(c => c.show_in_menu);

  if (children.length > 0) {
    return (
      <div>
        <button
          onClick={() => toggle(item.id)}
          className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-slate-800 hover:text-white transition"
        >
          <span className="flex items-center gap-3">
            <span className="shrink-0"><MenuIcon icon={item.icon} /></span>
            <span>{item.name}</span>
          </span>
          <svg
            className={`w-4 h-4 shrink-0 transition-transform ${expanded[item.id] ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expanded[item.id] && (
          <div className="ml-4 mt-1 space-y-1 border-l border-slate-700 pl-3">
            {children.map((child) => (
              <ExpandedMenuItem key={child.id} item={child} depth={depth + 1} expanded={expanded} toggle={toggle} onClose={onClose} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={portalPath(item.frontend_route)}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
          isActive ? 'bg-indigo-600/20 text-indigo-400' : 'text-gray-400 hover:bg-slate-800 hover:text-white'
        }`
      }
    >
      <MenuIcon icon={item.icon} />
      {item.name}
    </NavLink>
  );
}

/* ---------- Collapsed popup: recursive flyout submenu ---------- */
function FlyoutMenu({ items, onClose }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="py-1">
      {items.map((child) => {
        const grandChildren = getChildren(child).filter(c => c.show_in_menu);
        if (grandChildren.length > 0) {
          return <FlyoutParent key={child.id} item={child} onClose={onClose} />;
        }
        return (
          <NavLink
            key={child.id}
            to={portalPath(child.frontend_route)}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 text-sm whitespace-nowrap transition ${
                isActive ? 'text-indigo-400 bg-slate-700/50' : 'text-gray-300 hover:bg-slate-700 hover:text-white'
              }`
            }
          >
            <MenuIcon icon={child.icon} />
            {child.name}
          </NavLink>
        );
      })}
    </div>
  );
}

function FlyoutParent({ item, onClose }) {
  const [open, setOpen] = useState(false);
  const children = getChildren(item).filter(c => c.show_in_menu);

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-slate-700 hover:text-white transition whitespace-nowrap">
        <span className="flex items-center gap-2">
          <MenuIcon icon={item.icon} />
          {item.name}
        </span>
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-full top-0 ml-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-[100] min-w-[180px]">
          <FlyoutMenu items={children} onClose={onClose} />
        </div>
      )}
    </div>
  );
}

/* ---------- Collapsed icon button with popup (portal) ---------- */
function CollapsedMenuItem({ item, onClose }) {
  const [showPopup, setShowPopup] = useState(false);
  const btnRef = useRef(null);
  const popupRef = useRef(null);
  const children = getChildren(item).filter(c => c.show_in_menu);

  useEffect(() => {
    const handler = (e) => {
      if (btnRef.current?.contains(e.target) || popupRef.current?.contains(e.target)) return;
      setShowPopup(false);
    };
    if (showPopup) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPopup]);

  const getPos = () => {
    if (!btnRef.current) return {};
    const r = btnRef.current.getBoundingClientRect();
    return { position: 'fixed', top: r.top, left: r.right + 8, zIndex: 9999 };
  };

  if (children.length > 0) {
    return (
      <>
        <button
          ref={btnRef}
          onClick={() => setShowPopup(!showPopup)}
          title={item.name}
          className={`w-full flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-medium transition ${
            showPopup ? 'bg-slate-800 text-white' : 'text-gray-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <span className="shrink-0"><MenuIcon icon={item.icon} /></span>
        </button>

        {showPopup && createPortal(
          <div ref={popupRef} style={getPos()} className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl min-w-[200px] animate-in fade-in slide-in-from-left-2 duration-150">
            <div className="px-3 py-2 border-b border-slate-700">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{item.name}</span>
            </div>
            <FlyoutMenu items={children} onClose={() => { setShowPopup(false); onClose(); }} />
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <NavLink
      to={portalPath(item.frontend_route)}
      onClick={onClose}
      title={item.name}
      className={({ isActive }) =>
        `flex items-center justify-center px-3 py-2.5 rounded-lg text-sm font-medium transition ${
          isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-slate-800 hover:text-white'
        }`
      }
    >
      <span className="shrink-0"><MenuIcon icon={item.icon} /></span>
    </NavLink>
  );
}

/* ---------- Main Sidebar ---------- */
export default function Sidebar({ menu, open, collapsed, onClose, onCollapse }) {
  const [expanded, setExpanded] = useState({});
  const appConfig = useAppConfig();

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen bg-slate-900 text-white flex flex-col
          transform transition-all duration-300 ease-in-out
          lg:sticky lg:top-0 lg:z-auto lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}
          ${collapsed ? 'lg:w-16' : 'lg:w-64'}
          w-64
        `}
      >
        {/* Logo header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                <AppIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-indigo-400 truncate">{appConfig.name}</span>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center" title={appConfig.name}>
              <AppIcon className="w-5 h-5 text-white" />
            </div>
          )}
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation - scrollable */}
        <nav className="flex-1 mt-4 px-3 space-y-1 overflow-y-auto overflow-x-hidden">
          {/* Dashboard link */}
          <NavLink
            to="/portal"
            end
            onClick={onClose}
            title="Dashboard"
            className={({ isActive }) =>
              `flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {!collapsed && <span>Dashboard</span>}
          </NavLink>

          {/* Dynamic menu */}
          {menu.map((item) =>
            collapsed ? (
              <CollapsedMenuItem key={item.id} item={item} onClose={onClose} />
            ) : (
              <ExpandedMenuItem key={item.id} item={item} expanded={expanded} toggle={toggle} onClose={onClose} />
            )
          )}
        </nav>

        {/* Collapse toggle button — desktop only */}
        <div className="hidden lg:flex items-center justify-center border-t border-slate-700 p-3 shrink-0">
          <button
            onClick={onCollapse}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-slate-800 hover:text-white transition"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
