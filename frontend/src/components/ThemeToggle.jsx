import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Light / dark switch, used on every layout (portal top bar, college site, main site).
// The choice is saved in this browser (localStorage "theme"); with no saved choice the
// device setting is followed. index.html applies the saved choice before React starts,
// so pages do not flash white. All colour rules for dark mode live in index.css.

const KEY = 'theme';
const EVENT = 'themechange';

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function savedTheme() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function isDark() {
  return document.documentElement.classList.contains('dark');
}

export function setTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try { localStorage.setItem(KEY, theme); } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVENT));
}

export default function ThemeToggle({ className = '', onDark = false }) {
  const [dark, setDark] = useState(isDark);

  useEffect(() => {
    const sync = () => setDark(isDark());
    window.addEventListener(EVENT, sync);

    // Follow the device setting while the user has not picked a theme here.
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onSystem = () => {
      if (!savedTheme()) {
        document.documentElement.classList.toggle('dark', systemPrefersDark());
        sync();
      }
    };
    mq?.addEventListener?.('change', onSystem);

    return () => {
      window.removeEventListener(EVENT, sync);
      mq?.removeEventListener?.('change', onSystem);
    };
  }, []);

  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition ${
        onDark ? 'text-gray-300 hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
      } ${className}`}
    >
      {dark ? (
        // sun
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        // moon
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

// Login, sign-up and password pages have no header, so the switch floats in the
// top-right corner there. Mounted once in main.jsx.
const DARK_BACKGROUND_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];
const LIGHT_BACKGROUND_PAGES = ['/register-college'];

export function FloatingThemeToggle() {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, '') || '/';
  const onDark = DARK_BACKGROUND_PAGES.includes(path);
  if (!onDark && !LIGHT_BACKGROUND_PAGES.includes(path)) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 ${onDark ? 'theme-static' : ''}`}>
      <ThemeToggle onDark={onDark} />
    </div>
  );
}
