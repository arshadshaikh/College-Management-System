import { useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';

const STATUSES = ['', 'pending', 'approved', 'rejected', 'suspended'];

const STATUS_STYLES = {
  pending:   'bg-amber-50 text-amber-700',
  approved:  'bg-green-50 text-green-700',
  rejected:  'bg-red-50 text-red-700',
  suspended: 'bg-gray-100 text-gray-600',
};

export default function CollegeList() {
  const [status, setStatus] = useState('');

  const columns = [
    { key: 'name', label: 'Name', sortable: true,
      render: (r) => <span className="font-medium text-gray-900">{r.name}</span> },
    { key: 'slug', label: 'Slug', sortable: true,
      render: (r) => <span className="text-gray-500">{r.slug}</span> },
    { key: 'city', label: 'City', sortable: true,
      render: (r) => r.city ?? '—' },
    { key: 'status', label: 'Status', sortable: true,
      render: (r) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
          STATUS_STYLES[r.status] ?? 'bg-gray-100 text-gray-600'
        }`}>
          {r.status}
        </span>
      )},
    { key: 'created_at', label: 'Registered', sortable: true,
      render: (r) => new Date(r.created_at).toLocaleDateString() },
  ];

  const actions = (row) => (
    <Link to={`/colleges/${row.id}`} className="text-indigo-600 hover:underline">
      View
    </Link>
  );

  return (
    <DataTable
      title="Colleges"
      endpoint="/colleges"
      csvName="colleges"
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
              {s === '' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      }
    />
  );
}
