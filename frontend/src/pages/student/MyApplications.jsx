import { Link } from 'react-router-dom';
import { PORTAL } from '../../config/app';
import DataTable from '../../components/DataTable';

const STATUS_STYLES = {
  submitted: 'bg-blue-50 text-blue-700', under_review: 'bg-amber-50 text-amber-700',
  shortlisted: 'bg-purple-50 text-purple-700', approved: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700', withdrawn: 'bg-gray-100 text-gray-600',
};

export default function MyApplications() {
  const columns = [
    { key: 'application_no', label: 'Application #' },
    { key: 'program', label: 'Program', render: (r) => r.program?.name ?? '—' },
    { key: 'admission_year', label: 'Year' },
    { key: 'status', label: 'Status',
      render: (r) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}>
          {r.status.replace('_', ' ')}
        </span>
      )},
    { key: 'created_at', label: 'Submitted',
      render: (r) => new Date(r.created_at).toLocaleDateString() },
  ];

  return (
    <DataTable
      title="My Applications"
      endpoint="/applications/my"
      columns={columns}
      showIndex={false}
      headerActions={
        <Link to={`${PORTAL}/apply`} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          + New Application
        </Link>
      }
    />
  );
}