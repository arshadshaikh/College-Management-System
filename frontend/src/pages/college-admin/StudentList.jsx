import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PORTAL } from '../../config/app';
import toast from 'react-hot-toast';

export default function StudentList() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({});
  const navigate = useNavigate();

  // toggleActive goes HERE — inside the component, after setStudents exists
  const toggleActive = async (s) => {
    try {
      await api.put(`/students/${s.id}`, { is_active: !s.is_active });
      toast.success(`Student ${s.is_active ? 'deactivated' : 'activated'}.`);

      // Update the row directly in state — no refetch needed
      setStudents((list) => list.map((x) => x.id === s.id ? { ...x, is_active: !s.is_active } : x));
      // load(meta.current_page);
      // load(meta.current_page || 1);
    } catch { /* interceptor */ }
  };

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const { data } = await api.get('/students', { params: { page: p, search } });
      setStudents(data.data ?? data);
      setMeta(data);
    } catch { /* interceptor toasts */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Students</h1>
        <div className="flex items-center gap-3">
          <form onSubmit={(e) => { e.preventDefault(); load(1); }} className="flex gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, CNIC, email…"
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">Search</button>
          </form>
          <button onClick={() => navigate(`${PORTAL}/students/create`)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap">
            + Create Student
          </button>
          <button onClick={() => navigate(`${PORTAL}/students/import`)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap">
            Import
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Name</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">CNIC</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500 hidden md:table-cell">Email</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500 hidden lg:table-cell">Father Name</th>
              <th className="text-center px-6 py-3 font-medium text-gray-500">Status</th>
              <th className="text-right px-6 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No students yet.</td></tr>
            ) : students.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{s.name}</td>
                <td className="px-6 py-4 text-gray-600 font-mono">{s.cnic_no}</td>
                <td className="px-6 py-4 text-gray-600 hidden md:table-cell">{s.email || '—'}</td>
                <td className="px-6 py-4 text-gray-600 hidden lg:table-cell">{s.student_profile?.father_name ?? s.studentProfile?.father_name ?? '—'}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${s.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => navigate(`${PORTAL}/students/${s.id}`)} className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded">View</button>
                    <button onClick={() => navigate(`${PORTAL}/students/${s.id}/edit`)} className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded">Edit</button>
                    <button onClick={() => toggleActive(s)} className={`px-2.5 py-1 text-xs font-medium rounded ${s.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
                      {s.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {meta.last_page > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">Page {meta.current_page} of {meta.last_page}</p>
            <div className="flex gap-2">
              <button onClick={() => load(meta.current_page - 1)} disabled={meta.current_page <= 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50">Previous</button>
              <button onClick={() => load(meta.current_page + 1)} disabled={meta.current_page >= meta.last_page}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}