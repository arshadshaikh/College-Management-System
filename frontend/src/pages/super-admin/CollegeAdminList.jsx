import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { PORTAL } from '../../config/app';
import DataTable from '../../components/DataTable';
import { useAuth } from '../../context/AuthContext';

export default function CollegeAdminList() {
  const { hasPrv } = useAuth();
  const [collegeId, setCollegeId] = useState('');
  const [colleges, setColleges] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Colleges for the filter dropdown.
  useEffect(() => {
    api.get('/colleges', { params: { per_page: 1000 } })
      .then(({ data }) => setColleges(data.data ?? data))
      .catch(() => {});
  }, []);

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'cnic_no', label: 'CNIC', sortable: true },
    { key: 'email', label: 'Email', sortable: true, render: (r) => r.email ?? '—' },
    { key: 'college', label: 'College', render: (r) => r.college?.name ?? '—',
      csv: (r) => r.college?.name ?? '' },
    { key: 'is_active', label: 'Status',
      render: (r) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          r.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>{r.is_active ? 'Active' : 'Inactive'}</span>
      )},
  ];

//   const actions = (row) => (
//     hasPrv('college-admins.update') && (
//       <Link to={`/college-admins/${row.id}/edit`} className="text-indigo-600 hover:underline">Edit</Link>
//     )
//   );

  const actions = (row) => (
    <>
      {hasPrv('college-admins.update') && (
        <Link to={`${PORTAL}/college-admins/${row.id}/edit`} className="text-indigo-600 hover:underline">Edit</Link>
      )}
      {hasPrv('college-admins.toggle-active') && (
        <button onClick={() => toggleActive(row)}
          className={row.is_active ? 'text-red-600 hover:underline' : 'text-green-600 hover:underline'}>
          {row.is_active ? 'Deactivate' : 'Reactivate'}
        </button>
      )}
    </>
  );

  const toggleActive = async (row) => {
    const verb = row.is_active ? 'deactivate' : 'reactivate';
    if (!window.confirm(`${verb.charAt(0).toUpperCase() + verb.slice(1)} ${row.name}?`)) return;
    try {
      await api.patch(`/college-admins/${row.id}/toggle-active`);
      toast.success(`Admin ${row.is_active ? 'deactivated' : 'reactivated'}.`);
      setRefreshKey((k) => k + 1);
    } catch { /* interceptor toasts */ }
  };

  const selectCls = "px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <DataTable
      title="College Admins"
      endpoint="/college-admins"
      csvName="college-admins"
      columns={columns}
      actions={actions}
      refreshKey={refreshKey}
      filters={{ college_id: collegeId || undefined }}
      headerActions={
        <div className="flex items-center gap-3">
          <select value={collegeId} onChange={(e) => setCollegeId(e.target.value)} className={selectCls}>
            <option value="">All colleges</option>
            {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {hasPrv('college-admins.store') && (
            <Link to={`${PORTAL}/college-admins/create`} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              + Add Admin
            </Link>
          )}
        </div>
      }
    />
  );
}