import { useEffect, useMemo, useState } from 'react';
import DataTable from '../../components/DataTable';
import api from '../../api';

// "App\Models\CmsPage" → "CmsPage"
const shortType = (t) => (t ?? '').split('\\').pop();

// Badge colour from the last part of the action: program.deleted → red.
const actionTone = (action = '') => {
  const ev = action.split('.').pop();
  if (['deleted', 'login_failed', 'rejected', 'cancelled', 'suspended', 'deactivated'].includes(ev))
    return 'bg-red-50 text-red-700';
  if (['created', 'approved', 'login', 'restored', 'reinstated', 'reactivated', 'marked_paid', 'generated'].includes(ev))
    return 'bg-green-50 text-green-700';
  if (['updated', 'returned', 'role_switched', 'password_changed'].includes(ev))
    return 'bg-amber-50 text-amber-700';
  return 'bg-gray-100 text-gray-700';
};

const fmtDate = (v) => {
  const d = new Date(v);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
};

const fmtValue = (v) => {
  if (v === null || v === undefined || v === '') return <span className="text-gray-400">—</span>;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return <code className="text-xs break-all">{JSON.stringify(v)}</code>;
  return <span className="break-all">{String(v)}</span>;
};

function ChangesModal({ log, onClose }) {
  const oldV = log.old_values ?? {};
  const newV = log.new_values ?? {};
  const keys = [...new Set([...Object.keys(oldV), ...Object.keys(newV)])].filter((k) => k !== '_label');
  const showOld = Object.keys(oldV).length > 0;
  const showNew = Object.keys(newV).filter((k) => k !== '_label').length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100">
          <div>
            <span className={`font-mono text-xs px-2 py-1 rounded ${actionTone(log.action)}`}>{log.action}</span>
            <div className="mt-2 text-sm text-gray-600">
              {fmtDate(log.created_at)} · by <b>{log.user?.name ?? 'System'}</b>
              {log.auditable_id && <> · {shortType(log.auditable_type)} #{log.auditable_id}</>}
              {newV._label && <> · {newV._label}</>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-4">
          {keys.length === 0 ? (
            <p className="text-sm text-gray-500">No field details for this action.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="text-left py-2 pr-4 font-semibold w-1/4">Field</th>
                  {showOld && <th className="text-left py-2 pr-4 font-semibold">{showNew ? 'Old value' : 'Value'}</th>}
                  {showNew && <th className="text-left py-2 font-semibold">{showOld ? 'New value' : 'Value'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {keys.map((k) => (
                  <tr key={k} className="align-top">
                    <td className="py-2 pr-4 font-mono text-xs text-gray-600">{k}</td>
                    {showOld && <td className={`py-2 pr-4 ${showNew ? 'text-red-700' : ''}`}>{fmtValue(oldV[k])}</td>}
                    {showNew && <td className={`py-2 ${showOld ? 'text-green-700' : ''}`}>{fmtValue(newV[k])}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-4 text-xs text-gray-400 break-all">
            IP {log.ip_address ?? '—'} · {log.user_agent ?? ''}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuditLogList() {
  const [module, setModule]   = useState('');
  const [action, setAction]   = useState('');
  const [userId, setUserId]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]   = useState('');
  const [options, setOptions] = useState({ actions: [], users: [] });
  const [viewing, setViewing] = useState(null);

  // Dropdown lists come from the log itself, so new actions appear automatically.
  useEffect(() => {
    api.get('/audit-logs', { params: { per_page: 1, with_options: 1 } })
      .then(({ data }) => setOptions(data.options ?? { actions: [], users: [] }))
      .catch(() => {});
  }, []);

  const modules = useMemo(
    () => [...new Set(options.actions.map((a) => a.split('.')[0]))].sort(),
    [options.actions]
  );
  const moduleActions = module ? options.actions.filter((a) => a.startsWith(module + '.')) : options.actions;

  const hasFilters = module || action || userId || dateFrom || dateTo;
  const clearFilters = () => { setModule(''); setAction(''); setUserId(''); setDateFrom(''); setDateTo(''); };

  const columns = [
    { key: 'created_at', label: 'When',
      render: (r) => <span className="text-sm whitespace-nowrap">{fmtDate(r.created_at)}</span>,
      csv: (r) => r.created_at },
    { key: 'action', label: 'Action',
      render: (r) => <span className={`font-mono text-xs px-2 py-1 rounded ${actionTone(r.action)}`}>{r.action}</span>,
      csv: (r) => r.action },
    { key: 'user', label: 'By',
      render: (r) => r.user
        ? <div><div>{r.user.name}</div><div className="text-xs text-gray-400">{r.user.cnic_no}</div></div>
        : (r.action === 'auth.login_failed' ? <span className="text-gray-500">CNIC {r.new_values?.cnic_no}</span> : 'System'),
      csv: (r) => r.user?.name ?? (r.new_values?.cnic_no ? `CNIC ${r.new_values.cnic_no}` : 'System') },
    { key: 'auditable_type', label: 'Subject',
      render: (r) => {
        const type  = shortType(r.auditable_type);
        const label = r.new_values?._label;
        return (
          <div>
            <div>{r.auditable_id ? `${type} #${r.auditable_id}` : (type || '—')}</div>
            {label && <div className="text-xs text-gray-500 truncate max-w-[220px]" title={label}>{label}</div>}
            {r.action === 'auth.login_failed' && r.new_values?.reason &&
              <div className="text-xs text-red-600">{r.new_values.reason.replace(/_/g, ' ')}</div>}
          </div>
        );
      },
      csv: (r) => `${shortType(r.auditable_type)} ${r.auditable_id ?? ''} ${r.new_values?._label ?? ''}`.trim() },
    { key: 'ip_address', label: 'IP', render: (r) => r.ip_address ?? '—' },
    { key: 'changes', label: 'Details',
      render: (r) => (
        <button onClick={() => setViewing(r)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
          View
        </button>
      ),
      csv: (r) => JSON.stringify({ old: r.old_values, new: r.new_values }) },
  ];

  const selectCls = 'px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <>
      <DataTable
        title="Audit Logs"
        endpoint="/audit-logs"
        csvName="audit-logs"
        columns={columns}
        showIndex={false}
        filters={{
          module:    module || undefined,
          action:    action || undefined,
          user_id:   userId || undefined,
          date_from: dateFrom || undefined,
          date_to:   dateTo || undefined,
        }}
        headerActions={
          <>
            <select value={module} onChange={(e) => { setModule(e.target.value); setAction(''); }} className={selectCls}>
              <option value="">All areas</option>
              {modules.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={action} onChange={(e) => setAction(e.target.value)} className={selectCls}>
              <option value="">All actions</option>
              {moduleActions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={userId} onChange={(e) => setUserId(e.target.value)} className={selectCls}>
              <option value="">All users</option>
              {options.users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.cnic_no})</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={selectCls} title="From" />
            <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className={selectCls} title="To" />
            {hasFilters && (
              <button onClick={clearFilters} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">Clear</button>
            )}
          </>
        }
      />
      {viewing && <ChangesModal log={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
