import { useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';
import { APPLICATION_STATUSES, statusColor, statusLabel, filterOptions } from '../config/statuses';

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
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(APPLICATION_STATUSES, r.status)}`}>
          {statusLabel(APPLICATION_STATUSES, r.status)}
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
          {filterOptions(APPLICATION_STATUSES).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      }
    />
  );
}