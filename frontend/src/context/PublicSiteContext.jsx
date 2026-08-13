import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const PublicSiteContext = createContext({ loading: true, college: null, settings: {}, menus: [] });

export function PublicSiteProvider({ children }) {
  const [state, setState] = useState({ loading: true, college: null, settings: {}, menus: [] });

  useEffect(() => {
    Promise.all([
      api.get('/public/settings').catch(() => ({ data: {} })),
      api.get('/public/menus').catch(() => ({ data: [] })),
    ]).then(([settingsRes, menusRes]) => {
      const s = settingsRes.data || {};
      setState({
        loading: false,
        college: { name: s.name, slug: s.slug },
        settings: s.settings || {},
        menus: Array.isArray(menusRes.data) ? menusRes.data : [],
      });
    });
  }, []);

  return <PublicSiteContext.Provider value={state}>{children}</PublicSiteContext.Provider>;
}

export const usePublicSite = () => useContext(PublicSiteContext);