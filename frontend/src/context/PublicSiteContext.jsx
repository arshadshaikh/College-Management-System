import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const PublicSiteContext = createContext({ loading: true, notFound: false, college: null, settings: {}, menus: [] });

export function PublicSiteProvider({ children }) {
  const [state, setState] = useState({ loading: true, notFound: false, college: null, settings: {}, menus: [] });

  useEffect(() => {
    let notFound = false;
    Promise.all([
      api.get('/public/settings').catch((err) => {
        notFound = ['college_not_found', 'college_suspended'].includes(err.response?.data?.error);
        return { data: {} };
      }),
      api.get('/public/menus').catch(() => ({ data: [] })),
    ]).then(([settingsRes, menusRes]) => {
      const s = settingsRes.data || {};
      setState({
        loading: false,
        notFound,
        college: { name: s.name, slug: s.slug },
        settings: s.settings || {},
        menus: Array.isArray(menusRes.data) ? menusRes.data : [],
      });
    });
  }, []);

  return <PublicSiteContext.Provider value={state}>{children}</PublicSiteContext.Provider>;
}

export const usePublicSite = () => useContext(PublicSiteContext);