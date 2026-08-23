import axios from 'axios';
import toast from 'react-hot-toast';
import { getSubdomain } from './config/tenant';

const api = axios.create({
  baseURL: '/api',
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

    if (status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
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
