import { useState } from 'react';
import DataTable from '../components/DataTable';

export default function AuditLogList() {
  const [action, setAction] = useState('');

  const columns = [
    { key: 'created_at', label: 'When', sortable: false,
      render: (r) => {
        const d = new Date(r.created_at);
        return <span className="text-sm">{d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>;
      },
      csv: (r) => r.created_at },
    { key: 'action', label: 'Action',
      render: (r) => <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{r.action}</span>,
      csv: (r) => r.action },
    { key: 'user', label: 'By',
      render: (r) => r.user ? `${r.user.name}` : 'System',
      csv: (r) => r.user?.name ?? 'System' },
    { key: 'auditable_type', label: 'Subject',
      render: (r) => {
        const type = (r.auditable_type ?? '').split('\\').pop();   // "App\Models\College" → "College"
        return r.auditable_id ? `${type} #${r.auditable_id}` : type || '—';
      },
      csv: (r) => `${(r.auditable_type ?? '').split('\\').pop()} ${r.auditable_id ?? ''}`.trim() },
    { key: 'ip_address', label: 'IP', render: (r) => r.ip_address ?? '—' },
  ];

  const selectCls = "px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  // Known actions for the filter. Soft-coded list, extend as you add audited actions.
  const ACTIONS = [
    '', 'college.approved', 'college.rejected', 'college.suspended', 'college.reinstated',
    'college_admin.created', 'application.approved', 'application.rejected',
    'challan.marked_paid', 'payment.slip_verified', 'challan.cancelled',
  ];

  return (
    <DataTable
      title="Audit Logs"
      endpoint="/audit-logs"
      csvName="audit-logs"
      columns={columns}
      filters={{ action: action || undefined }}
      showIndex={false}
      headerActions={
        <select value={action} onChange={(e) => setAction(e.target.value)} className={selectCls}>
          {ACTIONS.map((a) => <option key={a} value={a}>{a === '' ? 'All actions' : a}</option>)}
        </select>
      }
    />
  );
}