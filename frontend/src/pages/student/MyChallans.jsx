import DataTable from '../../components/DataTable';
import { Link } from 'react-router-dom';

const STATUS_STYLES = {
  unpaid: 'bg-amber-50 text-amber-700', paid: 'bg-green-50 text-green-700',
  overdue: 'bg-red-50 text-red-700', cancelled: 'bg-gray-100 text-gray-600',
};

const actions = (row) => (
  <Link to={`/my-challans/${row.id}`} className="text-indigo-600 hover:underline">View</Link>
);

export default function MyChallans() {
  const columns = [
    { key: 'challan_no', label: 'Challan #' },
    { key: 'challan_type', label: 'Type', render: (r) => <span className="capitalize">{r.challan_type}</span> },
    { key: 'total_amount', label: 'Amount', render: (r) => `Rs. ${Number(r.total_amount).toLocaleString()}` },
    { key: 'due_date', label: 'Due', render: (r) => new Date(r.due_date).toLocaleDateString() },
    { key: 'status', label: 'Status',
      render: (r) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}>{r.status}</span>
      )},
  ];

  return <DataTable title="My Challans" endpoint="/challans/my" columns={columns} showIndex={false} actions={actions} />;
}