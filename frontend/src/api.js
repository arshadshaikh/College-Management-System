import axios from 'axios';
import toast from 'react-hot-toast';
import { getSubdomain } from './config/tenant';

const api = axios.create({
  // baseURL: '/api',
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  // headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Tell the backend which college this is (used in path mode on the server).
  const college = getSubdomain();
  if (college) {
    config.headers['X-College'] = college;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const message = err.response?.data?.message;

    // Unknown college address: the public site shows a "College not found" page instead of toasts.
    if (['college_not_found', 'college_suspended'].includes(err.response?.data?.error)) {
      return Promise.reject(err);
    }


    if (status === 401) {
      localStorage.removeItem('token');
      // Only an expired session inside the portal goes back to login.
      // Keeps the /cms/<college> prefix; on the login page itself (wrong password) we stay put.
      const path = window.location.pathname;
      if (path.includes('/portal')) {
        window.location.href = path.replace(/\/portal.*$/, '/login');
      }
    } else if (status === 403) {
      toast.error(message || 'You do not have permission to perform this action');
    } else if (status === 422) {
      // Validation errors — handled by individual pages
    } else if (status >= 500) {
      toast.error(message || 'Server error. Please try again later.');
    } else if (!err.response) {
      toast.error('Network error. Please check your connection.');
    } else {
      toast.error(message || 'Something went wrong.');
    }

    return Promise.reject(err);
  }
);

export default api;
