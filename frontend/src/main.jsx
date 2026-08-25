import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppConfigProvider } from './context/AppConfigContext';
import { AuthProvider } from './context/AuthContext';
import { getSubdomain } from './config/tenant';
import App from './App';
import './index.css';

// const BASENAME = import.meta.env.VITE_BASE_PATH ? `/${import.meta.env.VITE_BASE_PATH}` : '';

const BASE_PATH = import.meta.env.VITE_BASE_PATH ? `/${import.meta.env.VITE_BASE_PATH}` : '';
// In path mode, absorb the college slug into the basename so in-app routes match
// subdomain mode (/cms/uos → "/" home, /cms/uos/about → "/about", /cms/uos/portal → "/portal").
const college = BASE_PATH ? getSubdomain() : null;
const BASENAME = college ? `${BASE_PATH}/${college}` : BASE_PATH;

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter basename={BASENAME}>
    <AppConfigProvider>
      <AuthProvider>
        <App />
        <Toaster position="top-right" toastOptions={{
          duration: 4000,
          style: { borderRadius: '12px', padding: '12px 16px', fontSize: '14px' },
          success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
          error: { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
        }} />
      </AuthProvider>
    </AppConfigProvider>
  </BrowserRouter>
);