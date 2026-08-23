import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppConfigProvider } from './context/AppConfigContext';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

const BASENAME = import.meta.env.VITE_BASE_PATH ? `/${import.meta.env.VITE_BASE_PATH}` : '';

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