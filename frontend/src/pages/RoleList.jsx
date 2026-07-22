import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

export default function RoleList() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchRoles = () => {
    // api.get('/roles').then(({ data }) => { setRoles(data); setLoading(false); });
    api.get('/roles').then(({ data }) => { setRoles(data.data ?? data); setLoading(false); });
  };

  useEffect(() => { fetchRoles(); }, []);

  const toggleActive = async (role) => {
    try {
      await api.put(`/roles/${role.id}`, { is_active: !role.is_active });
      toast.success(`Role ${role.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchRoles();
    } catch { /* handled by interceptor */ }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Roles</h1>
        <button onClick={() => navigate('/roles/create')}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Create Role
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Slug</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">College</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500 hidden md:table-cell">Description</th>
                <th className="text-center px-6 py-3 font-medium text-gray-500">Privileges</th>
                <th className="text-center px-6 py-3 font-medium text-gray-500">Status</th>
                <th className="text-right px-6 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : roles.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No roles found</td></tr>
              ) : roles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{role.name}</td>
                  <td className="px-6 py-4 text-gray-600 font-mono text-xs">{role.slug}</td>
                  <td className="px-6 py-4 text-gray-600 font-mono text-xs">{role.college?.name ?? 'Platform'}</td>
                  <td className="px-6 py-4 text-gray-600 hidden md:table-cell">{role.description || '-'}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">
                      {role.privileges?.length || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${role.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {role.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => navigate(`/roles/${role.id}/edit`)}
                        className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded transition">
                        Edit
                      </button>
                      <button onClick={() => toggleActive(role)}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition ${
                          role.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                        }`}>
                        {role.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
