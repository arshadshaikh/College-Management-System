import { useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';
import { useAuth } from '../context/AuthContext';

export default function ProgramList() {
  const { hasPrv } = useAuth();
  const [refreshKey] = useState(0);

  const columns = [
    { key: 'name',         label: 'Program',   sortable: true },
    { key: 'code',         label: 'Code',      sortable: true },
    { key: 'degree_level', label: 'Level',     sortable: true,
      render: (r) => <span className="capitalize">{r.degree_level}</span> },
    
    { key: 'duration_years', label: 'Duration', sortable: true,
      render: (r) => `${r.duration_years} yr / ${r.total_semesters} sem`,
      csv:    (r) => `${r.duration_years} yr / ${r.total_semesters} sem` },
    { key: 'student', label: 'Student',
      render: (r) => (<div>...</div>),
      csv:    (r) => `${r.student?.name ?? ''} (${r.student?.cnic_no ?? ''})` },

    { key: 'total_seats',  label: 'Seats',     sortable: true },
    { key: 'is_active',    label: 'Status', sortable: true,
      render: (r) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          r.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {r.is_active ? 'Active' : 'Inactive'}
        </span>
      )},
  ];

  const actions = (row) => (
    <>
      {hasPrv('programs.update') && (
        <Link to={`/programs/${row.id}/edit`} className="text-indigo-600 hover:underline">Edit</Link>
      )}
      <Link to={`/programs/${row.id}`} className="text-gray-600 hover:underline">View</Link>
    </>
  );

  return (
    <DataTable
        title="Programs"
        endpoint="/programs"
        csvName="programs"
        columns={columns}
        actions={actions}
        refreshKey={refreshKey}
        headerActions={
          hasPrv('programs.store') && (
            <Link to="/programs/create"
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              + Create Program
            </Link>
          )
        }
      />
  );
}