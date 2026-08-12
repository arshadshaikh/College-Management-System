import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';
import { PORTAL } from '../config/app';

export default function UserCreate() {
  const [form, setForm] = useState({ name: '', cnic_no: '', email: '', phone: '', password: '', is_active: true });
  const [roles, setRoles] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/roles').then(({ data }) => setRoles(data));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'cnic_no') {
      setForm((f) => ({ ...f, [name]: value.replace(/\D/g, '').slice(0, 13) }));
    } else {
      setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const toggleRole = (id) => {
    setSelectedRoles((prev) => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const { data } = await api.post('/users', form);
      if (selectedRoles.length > 0) {
        await api.post(`/users/${data.id}/assign-roles`, { role_ids: selectedRoles });
      }
      toast.success('User created successfully');
      navigate(`${PORTAL}/users`);
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors || {});
        toast.error('Please fix the validation errors');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <button type="button" onClick={() => navigate(`${PORTAL}/users`)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create User</h1>
          <p className="text-sm text-gray-500 mt-0.5">Add a new user to the system</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 md:px-8 py-4 bg-gray-50/80 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Personal Information</h2>
          </div>
          <div className="p-6 md:p-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input name="name" value={form.name} onChange={handleChange} required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name[0]}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CNIC Number *</label>
          <input name="cnic_no" value={form.cnic_no} onChange={handleChange} maxLength={13} required placeholder="0000000000000"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono tracking-widest" />
          <p className="text-xs text-gray-400 mt-1">13 digits without dashes</p>
          {errors.cnic_no && <p className="text-red-500 text-xs mt-1">{errors.cnic_no[0]}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input name="email" type="email" value={form.email} onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email[0]}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input name="phone" value={form.phone} onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
          <input name="password" type="password" value={form.password} onChange={handleChange} required
            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white outline-none transition" />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password[0]}</p>}
        </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 md:px-8 py-4 bg-gray-50/80 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Roles & Status</h2>
          </div>
          <div className="p-6 md:p-8 space-y-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Assign Roles</label>
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <button key={role.id} type="button" onClick={() => toggleRole(role.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  selectedRoles.includes(role.id)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                }`}>
                {role.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300" />
            <label className="text-sm text-gray-700">Active</label>
          </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-indigo-800 disabled:from-indigo-400 disabled:to-indigo-400 shadow-sm shadow-indigo-200 transition">
            {loading ? 'Creating...' : 'Create User'}
          </button>
          <button type="button" onClick={() => navigate(`${PORTAL}/users`)}
            className="px-8 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
