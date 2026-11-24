import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PORTAL } from '../../config/app';
import DataTable from '../../components/DataTable';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

const STATUSES = ['', 'unpaid', 'paid', 'overdue', 'cancelled'];

const STATUS_STYLES = {
  unpaid:    'bg-amber-50 text-amber-700',
  paid:      'bg-green-50 text-green-700',
  overdue:   'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

export default function ChallanList() {
  const [status, setStatus] = useState('');
  const [type, setType]     = useState('');
  const [feeTypes, setFeeTypes] = useState([]);   // college fee types (Settings), for names + filter
  const { hasPrv } = useAuth();

  // ?student=<id>&name=<name> comes from the Fee Defaulters page: show only that student's challans.
  const [params, setParams] = useSearchParams();
  const studentId   = params.get('student') || '';
  const studentName = params.get('name') || 'this student';
  const clearStudent = () => setParams({});

  useEffect(() => {
    api.get('/settings').then(({ data }) => setFeeTypes(data.fee_types ?? [])).catch(() => {});
  }, []);

  // challan_type is a fee type slug (or 'other' for mixed challans).
  const typeName = (slug) => feeTypes.find((t) => t.slug === slug)?.name ?? (slug ?? '').replace(/_/g, ' ');
  const typeOptions = [...feeTypes.map((t) => t.slug), ...(feeTypes.some((t) => t.slug === 'other') ? [] : ['other'])];

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
      render: (r) => <span className="capitalize">{typeName(r.challan_type)}</span>,
      csv: (r) => typeName(r.challan_type) },
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
      filters={{ status: status || undefined, challan_type: type || undefined, student_id: studentId || undefined }}
      headerActions={
        <>
          {studentId && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm">
              Only {studentName}
              <button onClick={clearStudent} className="text-indigo-500 hover:text-indigo-800" title="Show all students">✕</button>
            </span>
          )}
          <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
            <option value="">All types</option>
            {typeOptions.map((t) => <option key={t} value={t}>{typeName(t)}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
            {STATUSES.map((s) => <option key={s} value={s}>{s === '' ? 'All statuses' : s}</option>)}
          </select>
          {hasPrv('challans.store') && (
            <Link to={`${PORTAL}/challans/create`}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">+ New Challan</Link>
          )}
        </>
      }
    />
  );
}