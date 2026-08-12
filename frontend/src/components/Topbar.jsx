import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { PORTAL } from '../config/app';

function flattenMenu(items, parentName = '') {
  const result = [];
  for (const item of (items || [])) {
    const path = parentName ? `${parentName} → ${item.name}` : item.name;
    if (item.frontend_route) {
      result.push({ name: item.name, path, route: item.frontend_route });
    }
    const children = item.menu_children || item.children_recursive || item.children || [];
    if (children.length) result.push(...flattenMenu(children, path));
  }
  return result;
}

export default function Topbar({ onMenuToggle, collapsed, onCollapse }) {
  const { user, menu, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  const allLinks = useMemo(() => flattenMenu(menu), [menu]);

  const filteredLinks = useMemo(() => {
    if (!searchQuery.trim()) return allLinks;
    const q = searchQuery.toLowerCase();
    return allLinks.filter((l) => l.name.toLowerCase().includes(q) || l.path.toLowerCase().includes(q));
  }, [searchQuery, allLinks]);

  useEffect(() => { setSelectedIndex(0); }, [filteredLinks]);

  const handleSearchSelect = useCallback((route) => {
    setSearchQuery('');
    setSearchOpen(false);
    const to = route.startsWith('/portal') ? route : `${PORTAL}${route.startsWith('/') ? '' : '/'}${route}`;
    navigate(to);
  }, [navigate]);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, filteredLinks.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && filteredLinks[selectedIndex]) { e.preventDefault(); handleSearchSelect(filteredLinks[selectedIndex].route); }
    else if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); }
  };

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ctrl+K focuses the search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-2">
        <button onClick={onMenuToggle} className="lg:hidden text-gray-600 hover:text-gray-900">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <button onClick={onCollapse}
          className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <svg className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Search bar */}
      <div className="relative flex-1 max-w-md mx-4" ref={searchRef}>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search menu..."
            className="w-full pl-9 pr-16 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded">
            Ctrl K
          </kbd>
        </div>

        {searchOpen && filteredLinks.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-80 overflow-y-auto z-50">
            {filteredLinks.map((link, i) => (
              <button key={link.route} onClick={() => handleSearchSelect(link.route)} onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${i === selectedIndex ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                <svg className={`w-4 h-4 shrink-0 ${i === selectedIndex ? 'text-indigo-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{link.name}</p>
                  <p className="text-xs text-gray-400 truncate">{link.path}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {searchOpen && searchQuery.trim() && filteredLinks.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 px-4 py-6 text-center text-sm text-gray-500">
            No matching menu items
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 hover:bg-gray-50 rounded-xl px-2 py-1.5 transition">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">{user?.cnic_no}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 z-50">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{user?.email || user?.cnic_no}</p>
                {user?.active_role && (
                  <p className="text-xs text-indigo-600 font-medium mt-1">Role: {user.active_role.name}</p>
                )}
              </div>
              <button onClick={() => { setDropdownOpen(false); navigate(`${PORTAL}/change-password`); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Change Password
              </button>
              {user?.active_roles?.length > 1 && (
                <button onClick={() => { setDropdownOpen(false); navigate(`${PORTAL}/change-role`); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Change Role
                </button>
              )}
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}