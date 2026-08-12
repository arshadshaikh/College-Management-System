import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { PORTAL } from '../../config/app';

export default function ChangeRole() {
  const { user, fetchUser } = useAuth();
  const [selectedRole, setSelectedRole] = useState(user?.active_role_id || '');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const roles = user?.active_roles || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRole) {
      toast.error('Please select a role');
      return;
    }
    if (selectedRole === user?.active_role_id) {
      toast.error('This role is already active');
      return;
    }
    setLoading(true);
    try {
      await api.post('/change-role', { role_id: selectedRole });
      toast.success('Role switched successfully');
      await fetchUser();
      // navigate('/');
      navigate(PORTAL);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to switch role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Change Role</h1>
          <p className="text-sm text-gray-500 mt-0.5">Switch your active role to access different permissions</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 md:px-8 py-4 bg-gray-50/80 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Active Role</h2>
          </div>
          <div className="p-6 md:p-8 space-y-5">
            <div className="bg-indigo-50 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-indigo-600 font-medium">Currently active</p>
                <p className="text-sm font-semibold text-indigo-900">{user?.active_role?.name || 'No role selected'}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Role</label>
              <div className="space-y-2">
                {roles.map((role) => (
                  <label key={role.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition ${
                      selectedRole === role.id
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}>
                    <input
                      type="radio"
                      name="role"
                      value={role.id}
                      checked={selectedRole === role.id}
                      onChange={() => setSelectedRole(role.id)}
                      className="w-4 h-4 text-indigo-600 border-gray-300"
                    />
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${selectedRole === role.id ? 'text-indigo-900' : 'text-gray-900'}`}>
                        {role.name}
                      </p>
                      {role.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                      )}
                    </div>
                    {user?.active_role_id === role.id && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">Current</span>
                    )}
                  </label>
                ))}
              </div>
              {roles.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No roles assigned to your account.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading || selectedRole === user?.active_role_id}
            className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-indigo-800 disabled:from-indigo-400 disabled:to-indigo-400 shadow-sm shadow-indigo-200 transition">
            {loading ? 'Switching...' : 'Switch Role'}
          </button>
          <button type="button" onClick={() => navigate(-1)}
            className="px-8 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
