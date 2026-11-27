import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import DataTable from '../../components/DataTable';
import { PORTAL } from '../../config/app';
import { useAuth } from '../../context/AuthContext';

const EMPTY = { program_id: '', batch: '', shift: '', status: '' };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Students: counts on top (click one to filter), then program / batch / shift filters.
 * "Enrolled" means the student has an approved application; its program, batch and
 * shift are what the filters match.
 */
export default function StudentList() {
  const navigate = useNavigate();
  const { hasPrv } = useAuth();
  const [params] = useSearchParams();
  // Links from the dashboard can preselect a filter, e.g. ?program_id=3
  const [f, setF] = useState(() => ({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, params.get(k) ?? ''])) }));
  const [summary, setSummary] = useState(null);
  const [options, setOptions] = useState({ programs: [], batches: [], shifts: [] });
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState(null);

  const set = (key, value) => setF((x) => ({
    ...x, [key]: value,
    // "Not enrolled" students have no batch or shift, so those filters would match nobody.
    ...(key === 'program_id' && value === 'none' ? { batch: '', shift: '' } : {}),
  }));
  const filtered = Object.values(f).some(Boolean);

  const onData = (data) => {
    if (data.summary) setSummary(data.summary);
    if (data.options) setOptions(data.options);
  };

  const toggleActive = async (s) => {
    const verb = s.is_active ? 'Deactivate' : 'Activate';
    if (s.is_active && !window.confirm(`Deactivate ${s.name}? They will not be able to log in.`)) return;
    setBusyId(s.id);
    try {
      await api.put(`/students/${s.id}`, { is_active: !s.is_active });
      toast.success(`${s.name} ${verb.toLowerCase()}d.`);
      setRefreshKey((k) => k + 1);
    } catch { /* interceptor toasts */ } finally { setBusyId(null); }
  };

  const columns = [
    { key: 'name', label: 'Student', sortable: true, csv: (r) => r.name,
      render: (r) => (
        <Link to={`${PORTAL}/students/${r.id}`} className="group block min-w-0">
          <div className="font-medium text-gray-900 group-hover:text-indigo-600 whitespace-nowrap">{r.name}</div>
          <div className="text-xs text-gray-500 whitespace-nowrap">
            <span className="font-mono">{r.cnic_no}</span>
            {r.student_profile?.father_name && <span> · s/o {r.student_profile.father_name}</span>}
          </div>
        </Link>
      )},
    { key: 'cnic_no', label: 'CNIC', hidden: true, csv: (r) => r.cnic_no },
    { key: 'father_name', label: 'Father Name', hidden: true, csv: (r) => r.student_profile?.father_name ?? '' },
    { key: 'program_name', label: 'Program', sortable: true, csv: (r) => r.program_name ?? 'Not enrolled',
      render: (r) => r.program_name
        ? <span className="text-gray-800 block min-w-[9rem]">{r.program_name}</span>
        : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 whitespace-nowrap">Not enrolled</span> },
    { key: 'batch', label: 'Batch', sortable: true, csv: (r) => r.batch ?? '',
      render: (r) => (r.batch
        ? <span className="tabular-nums text-gray-700 whitespace-nowrap">{r.batch}{r.shift && <span className="text-gray-400"> · {cap(r.shift)}</span>}</span>
        : <span className="text-gray-400">—</span>) },
    { key: 'contact', label: 'Contact', csv: (r) => [r.email, r.phone].filter(Boolean).join(' / '),
      render: (r) => (
        <div className="text-xs text-gray-600 min-w-0">
          <div className="truncate max-w-[13rem]">{r.email || '—'}</div>
          {r.phone && <div className="text-gray-400">{r.phone}</div>}
        </div>
      )},
    { key: 'is_active', label: 'Status', csv: (r) => (r.is_active ? 'Active' : 'Inactive'),
      render: (r) => (
        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${r.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {r.is_active ? 'Active' : 'Inactive'}
        </span>
      )},
  ];

  const actions = (s) => (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <Link to={`${PORTAL}/students/${s.id}`} className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded">View</Link>
      {hasPrv('students.update') && (
        <>
          <Link to={`${PORTAL}/students/${s.id}/edit`} className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded">Edit</Link>
          <button type="button" onClick={() => toggleActive(s)} disabled={busyId === s.id}
            className={`px-2.5 py-1 text-xs font-medium rounded disabled:opacity-50 ${s.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>
            {s.is_active ? 'Deactivate' : 'Activate'}
          </button>
        </>
      )}
    </span>
  );

  // Stat tiles double as quick filters.
  const tiles = [
    { label: 'All students', value: summary?.total, active: !f.status && f.program_id !== 'none',
      onClick: () => setF((x) => ({ ...x, status: '', program_id: x.program_id === 'none' ? '' : x.program_id })), tone: 'indigo' },
    { label: 'Active', value: summary?.active, active: f.status === 'active',
      onClick: () => set('status', f.status === 'active' ? '' : 'active'), tone: 'green' },
    { label: 'Inactive', value: summary?.inactive, active: f.status === 'inactive',
      onClick: () => set('status', f.status === 'inactive' ? '' : 'inactive'), tone: 'red' },
    { label: 'Not enrolled', value: summary?.not_enrolled, active: f.program_id === 'none',
      hint: 'No approved application yet',
      onClick: () => setF((x) => ({ ...x, program_id: x.program_id === 'none' ? '' : 'none', batch: '', shift: '' })), tone: 'amber' },
  ];
  const TONE = {
    indigo: 'text-indigo-600 ring-indigo-200 bg-indigo-50/60',
    green:  'text-green-600 ring-green-200 bg-green-50/60',
    red:    'text-red-600 ring-red-200 bg-red-50/60',
    amber:  'text-amber-600 ring-amber-200 bg-amber-50/60',
  };

  const select = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const notEnrolled = f.program_id === 'none';

  return (
    <DataTable
      title="Students"
      endpoint="/students"
      csvName="students"
      showIndex={false}
      columns={columns}
      actions={actions}
      filters={Object.fromEntries(Object.entries(f).filter(([, v]) => v))}
      refreshKey={refreshKey}
      onData={onData}
      headerActions={(
        <>
          {hasPrv('students.import') && (
            <button type="button" onClick={() => navigate(`${PORTAL}/students/import`)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap">
              Import
            </button>
          )}
          {hasPrv('students.store') && (
            <button type="button" onClick={() => navigate(`${PORTAL}/students/create`)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 whitespace-nowrap">
              + Create Student
            </button>
          )}
        </>
      )}
    >
      {/* Counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <button type="button" key={t.label} onClick={t.onClick}
            className={`text-left bg-white rounded-xl shadow-sm p-4 transition ring-1 ${t.active ? TONE[t.tone] : 'ring-transparent hover:ring-gray-200'}`}>
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{t.label}</div>
            <div className={`text-2xl font-bold tabular-nums mt-1 ${t.active ? TONE[t.tone].split(' ')[0] : 'text-gray-900'}`}>
              {summary ? (t.value ?? 0).toLocaleString() : '…'}
            </div>
            {t.hint && <div className="text-[11px] text-gray-400 mt-0.5">{t.hint}</div>}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-3 items-end">
        <label className="block min-w-0">
          <span className="block text-xs font-medium text-gray-500 mb-1">Program</span>
          <select value={f.program_id} onChange={(e) => set('program_id', e.target.value)} className={select}>
            <option value="">All programs</option>
            {options.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="none">Not enrolled</option>
          </select>
        </label>
        <label className="block min-w-0">
          <span className="block text-xs font-medium text-gray-500 mb-1">Batch (admission year)</span>
          <select value={f.batch} onChange={(e) => set('batch', e.target.value)} disabled={notEnrolled} className={`${select} disabled:opacity-50`}>
            <option value="">All batches</option>
            {options.batches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="block text-xs font-medium text-gray-500 mb-1">Shift</span>
          <select value={f.shift} onChange={(e) => set('shift', e.target.value)} disabled={notEnrolled} className={`${select} disabled:opacity-50`}>
            <option value="">All shifts</option>
            {options.shifts.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="block text-xs font-medium text-gray-500 mb-1">Status</span>
          <select value={f.status} onChange={(e) => set('status', e.target.value)} className={select}>
            <option value="">Active and inactive</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <button type="button" onClick={() => setF(EMPTY)} disabled={!filtered}
          className="px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:text-gray-300 disabled:hover:bg-transparent whitespace-nowrap">
          Clear filters
        </button>
      </div>
    </DataTable>
  );
}
