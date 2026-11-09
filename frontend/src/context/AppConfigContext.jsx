import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const DEFAULTS = {
  name: 'Admin Panel',
  short_name: 'AP',
  icon: 'shield',
  primary_color: '#4f46e5',
  logo_url: null,
  is_college: false,
};

const AppConfigContext = createContext(DEFAULTS);

// Tailwind 4 reads every indigo-* class from a CSS variable (--color-indigo-600 ...).
// Pointing those variables at the college's Primary Color re-brands every page
// (buttons, sidebar, links) without touching each component.
function applyBrandColor(color) {
  if (!color || !/^#[0-9a-f]{3,8}$/i.test(color)) return;
  const root = document.documentElement.style;
  const tint  = (pct) => `color-mix(in srgb, ${color} ${pct}%, white)`;
  const shade = (pct) => `color-mix(in srgb, ${color} ${pct}%, black)`;
  root.setProperty('--color-indigo-50',  tint(8));
  root.setProperty('--color-indigo-100', tint(16));
  root.setProperty('--color-indigo-200', tint(32));
  root.setProperty('--color-indigo-300', tint(55));
  root.setProperty('--color-indigo-400', tint(75));
  root.setProperty('--color-indigo-500', tint(90));
  root.setProperty('--color-indigo-600', color);
  root.setProperty('--color-indigo-700', shade(85));
  root.setProperty('--color-indigo-800', shade(70));
}

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULTS);

  useEffect(() => {
    api.get('/app-config').then(({ data }) => {
      const merged = { ...DEFAULTS, ...data };
      setConfig(merged);
      document.title = merged.name || DEFAULTS.name;
      if (merged.is_college) applyBrandColor(merged.primary_color);
    }).catch(() => {});
  }, []);

  return (
    <AppConfigContext.Provider value={config}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  return useContext(AppConfigContext);
}
