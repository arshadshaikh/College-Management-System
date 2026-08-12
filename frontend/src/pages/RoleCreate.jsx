import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';
import { PORTAL } from '../config/app';

export default function RoleCreate() {
  const [form, setForm] = useState({ name: '', slug: '', description: '', is_active: true });
  const [privileges, setPrivileges] = useState([]);
  const [selectedPrivileges, setSelectedPrivileges] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/privilege-groups').then(({ data }) => setPrivileges(data));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const togglePrivilege = (id) => {
    setSelectedPrivileges((prev) => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const toggleGroup = (group) => {
    const ids = group.privileges.map(p => p.id);
    const allSelected = ids.every(id => selectedPrivileges.includes(id));
    if (allSelected) {
      setSelectedPrivileges(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedPrivileges(prev => [...new Set([...prev, ...ids])]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const { data } = await api.post('/roles', form);
      if (selectedPrivileges.length > 0) {
        await api.post(`/roles/${data.id}/assign-privileges`, { privilege_ids: selectedPrivileges });
      }
      toast.success('Role created successfully');
      // navigate('/roles');
      navigate(`${PORTAL}/roles`);
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
        <button type="button" onClick={() => navigate(`${PORTAL}/roles`)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Role</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create a new role with privilege assignments</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 md:px-8 py-4 bg-gray-50/80 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Role Details</h2>
          </div>
          <div className="p-6 md:p-8 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input name="name" value={form.name} onChange={handleChange} required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name[0]}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input name="slug" value={form.slug} onChange={handleChange} placeholder="auto-generated"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none" />
          </div>

          <div className="flex items-center gap-2">
            <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300" />
            <label className="text-sm text-gray-700">Active</label>
          </div>
          </div>
        </div>

        {/* Privileges by group */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 md:px-8 py-4 bg-gray-50/80 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Assign Privileges</h2>
          </div>
          <div className="p-6 md:p-8">
          {privileges.length === 0 ? (
            <p className="text-gray-400 text-sm">No privilege groups found</p>
          ) : (
            <div className="space-y-4">
              {privileges.map((group) => (
                <div key={group.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <button type="button" onClick={() => toggleGroup(group)}
                      className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition">
                      {group.privileges.every(p => selectedPrivileges.includes(p.id)) ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className="text-sm font-semibold text-gray-700">{group.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.privileges?.map((prv) => (
                      <button key={prv.id} type="button" onClick={() => togglePrivilege(prv.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                          selectedPrivileges.includes(prv.id)
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                        }`}>
                        {prv.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-indigo-800 disabled:from-indigo-400 disabled:to-indigo-400 shadow-sm shadow-indigo-200 transition">
            {loading ? 'Creating...' : 'Create Role'}
          </button>
          <button type="button" onClick={() => navigate(`${PORTAL}/roles`)}
            className="px-8 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
