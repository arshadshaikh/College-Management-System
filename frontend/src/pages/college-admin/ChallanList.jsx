import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PORTAL } from '../../config/app';
import DataTable from '../../components/DataTable';

const STATUSES = ['', 'unpaid', 'paid', 'overdue', 'cancelled'];
const TYPES    = ['', 'admission', 'semester', 'exam', 'arrears', 'other'];

const STATUS_STYLES = {
  unpaid:    'bg-amber-50 text-amber-700',
  paid:      'bg-green-50 text-green-700',
  overdue:   'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

export default function ChallanList() {
  const [status, setStatus] = useState('');
  const [type, setType]     = useState('');

  const columns = [
    { key: 'challan_no', label: 'Challan #', sortable: true },
    { key: 'student', label: 'Student',
      render: (r) => (
        <div>
          <div className="font-medium text-gray-900">{r.student?.name ?? '—'}</div>
          <div className="text-xs text-gray-500">{r.student?.cnic_no}</div>
        </div>
      ),
      csv: (r) => `${r.student?.name ?? ''} (${r.student?.cnic_no ?? ''})` },
    { key: 'challan_type', label: 'Type', sortable: true,
      render: (r) => <span className="capitalize">{r.challan_type}</span> },
    { key: 'total_amount', label: 'Amount', sortable: true,
      render: (r) => `Rs. ${Number(r.total_amount).toLocaleString()}`,
      csv: (r) => r.total_amount },
    { key: 'due_date', label: 'Due Date', sortable: true,
      render: (r) => new Date(r.due_date).toLocaleDateString(),
      csv: (r) => r.due_date?.slice(0, 10) },
    { key: 'status', label: 'Status', sortable: true,
      render: (r) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
          STATUS_STYLES[r.status] ?? 'bg-gray-100 text-gray-600'
        }`}>{r.status}</span>
      )},
  ];

  const actions = (row) => (
    <Link to={`${PORTAL}/challans/${row.id}`} className="text-indigo-600 hover:underline">View</Link>
  );

  const selectCls = "px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <DataTable
      title="Challans"
      endpoint="/challans"
      csvName="challans"
      columns={columns}
      actions={actions}
      filters={{ status: status || undefined, challan_type: type || undefined }}
      headerActions={
        <>
          <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
            {TYPES.map((t) => <option key={t} value={t}>{t === '' ? 'All types' : t}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
            {STATUSES.map((s) => <option key={s} value={s}>{s === '' ? 'All statuses' : s}</option>)}
          </select>
        </>
      }
    />
  );
}