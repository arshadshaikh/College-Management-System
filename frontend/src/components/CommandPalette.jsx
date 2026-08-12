import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PORTAL } from '../config/app';

// Flatten the menu tree into a searchable list: { name, route, path (breadcrumb) }.
function flatten(items, trail = []) {
  const out = [];
  for (const item of items) {
    const children = item.menu_children || item.children || [];
    const here = [...trail, item.name];
    if (item.frontend_route) {
      out.push({ id: item.id, name: item.name, route: item.frontend_route, path: trail.join(' → ') });
    }
    if (children.length) out.push(...flatten(children, here));
  }
  return out;
}

export default function CommandPalette() {
  const { menu } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => flatten(menu || []), [menu]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.name.toLowerCase().includes(q) || i.path.toLowerCase().includes(q)
    );
  }, [query, items]);

  // Ctrl/Cmd+K to open, Escape to close.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Focus input and reset when opened.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Keep active index in range as results change.
  useEffect(() => { setActive(0); }, [query]);

  const go = (item) => {
    setOpen(false);
    const to = item.route.startsWith('/portal') ? item.route : `${PORTAL}${item.route.startsWith('/') ? '' : '/'}${item.route}`;
    navigate(to);
  };

  const onInputKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4 bg-black/40" onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 border-b border-gray-100">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search menu…"
            className="flex-1 py-3 text-sm outline-none"
          />
          <kbd className="text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No matches.</div>
          ) : (
            results.map((item, i) => (
              <button
                key={item.id}
                onClick={() => go(item)}
                onMouseEnter={() => setActive(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${
                  i === active ? 'bg-indigo-50' : 'hover:bg-gray-50'
                }`}
              >
                <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">{item.name}</span>
                  {item.path && <span className="block text-xs text-gray-400">{item.path}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}