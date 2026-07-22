import { useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';

const STATUSES = ['', 'submitted', 'under_review', 'shortlisted', 'approved', 'rejected', 'withdrawn'];

const STATUS_STYLES = {
  submitted:    'bg-blue-50 text-blue-700',
  under_review: 'bg-amber-50 text-amber-700',
  shortlisted:  'bg-purple-50 text-purple-700',
  approved:     'bg-green-50 text-green-700',
  rejected:     'bg-red-50 text-red-700',
  withdrawn:    'bg-gray-100 text-gray-600',
};

export default function ApplicationList() {
  const [status, setStatus] = useState('');

  const columns = [
    { key: 'application_no', label: 'Application #', sortable: true },
    { key: 'student', label: 'Student',
      render: (r) => (
        <div>
          <div className="font-medium text-gray-900">{r.student?.name ?? '—'}</div>
          <div className="text-xs text-gray-500">{r.student?.cnic_no}</div>
        </div>
      )},
    { key: 'program', label: 'Program',
      render: (r) => r.program?.name ?? '—' },
    { key: 'admission_year', label: 'Year', sortable: true },
    { key: 'status', label: 'Status', sortable: true,
      render: (r) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
          STATUS_STYLES[r.status] ?? 'bg-gray-100 text-gray-600'
        }`}>
          {r.status.replace('_', ' ')}
        </span>
      )},
    { key: 'created_at', label: 'Submitted', sortable: true,
      render: (r) => new Date(r.created_at).toLocaleDateString() },
  ];

  const actions = (row) => (
    <Link to={`/applications/${row.id}`} className="text-indigo-600 hover:underline">
      Review
    </Link>
  );

  return (
    <DataTable
      title="Applications"
      endpoint="/applications"
      csvName="applications"
      columns={columns}
      actions={actions}
      filters={{ status: status || undefined }}
      headerActions={
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === '' ? 'All statuses' : s.replace('_', ' ')}
            </option>
          ))}
        </select>
      }
    />
  );
}