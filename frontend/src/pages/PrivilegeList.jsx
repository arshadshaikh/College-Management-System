import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';
import { PORTAL } from '../config/app';

export default function PrivilegeList() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchGroups = () => {
    api.get('/privilege-groups').then(({ data }) => { setGroups(data); setLoading(false); });
  };

  useEffect(() => { fetchGroups(); }, []);

  const toggleActive = async (prv) => {
    try {
      await api.put(`/privileges/${prv.id}`, { is_active: !prv.is_active });
      toast.success(`Privilege ${prv.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchGroups();
    } catch { /* handled by interceptor */ }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Privileges</h1>
        <button onClick={() => navigate(`${PORTAL}/privileges/create`)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Create Privilege
        </button>
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">{group.name}</h2>
              {group.description && <p className="text-sm text-gray-500 mt-0.5">{group.description}</p>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-2.5 font-medium text-gray-500">Name</th>
                    <th className="text-left px-6 py-2.5 font-medium text-gray-500">Slug</th>
                    <th className="text-left px-6 py-2.5 font-medium text-gray-500 hidden md:table-cell">Frontend Route</th>
                    <th className="text-left px-6 py-2.5 font-medium text-gray-500 hidden lg:table-cell">API Route</th>
                    <th className="text-center px-6 py-2.5 font-medium text-gray-500 hidden sm:table-cell">Method</th>
                    <th className="text-center px-6 py-2.5 font-medium text-gray-500">Menu</th>
                    <th className="text-center px-6 py-2.5 font-medium text-gray-500">Status</th>
                    <th className="text-right px-6 py-2.5 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {group.privileges?.map((prv) => (
                    <tr key={prv.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          {prv.icon && <span className="text-gray-400 text-xs">{prv.icon}</span>}
                          <span className="font-medium text-gray-900">{prv.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-gray-600 font-mono text-xs">{prv.slug}</td>
                      <td className="px-6 py-3 text-gray-600 font-mono text-xs hidden md:table-cell">{prv.frontend_route || '-'}</td>
                      <td className="px-6 py-3 text-gray-600 font-mono text-xs hidden lg:table-cell">{prv.api_route || '-'}</td>
                      <td className="px-6 py-3 text-center hidden sm:table-cell">
                        {prv.method ? (
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            prv.method === 'GET' ? 'bg-green-50 text-green-700' :
                            prv.method === 'POST' ? 'bg-blue-50 text-blue-700' :
                            prv.method === 'PUT' || prv.method === 'PATCH' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-red-50 text-red-700'
                          }`}>{prv.method}</span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          prv.menu_type === 'menu' ? 'bg-purple-50 text-purple-700' :
                          prv.menu_type === 'submenu' ? 'bg-purple-50/50 text-purple-500' :
                          'bg-gray-50 text-gray-400'
                        }`}>{prv.menu_type}</span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className={`w-2 h-2 rounded-full inline-block ${prv.is_active ? 'bg-green-500' : 'bg-red-400'}`} />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => navigate(`${PORTAL}/privileges/${prv.id}/edit`)}
                            className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded transition">
                            Edit
                          </button>
                          <button onClick={() => toggleActive(prv)}
                            className={`px-2.5 py-1 text-xs font-medium rounded transition ${
                              prv.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                            }`}>
                            {prv.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
