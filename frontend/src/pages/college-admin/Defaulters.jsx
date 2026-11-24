import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PORTAL } from '../../config/app';
import DataTable from '../../components/DataTable';
import api from '../../api';

const money = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

// Students who owe fees: one row per student, all their unpaid / overdue challans added up.
export default function Defaulters() {
  const [programs, setPrograms] = useState([]);
  const [feeTypes, setFeeTypes] = useState([]);
  const [programId, setProgramId] = useState('');
  const [semesterNo, setSemesterNo] = useState('');
  const [type, setType] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get('/programs', { params: { per_page: 200, sort_by: 'name', sort_dir: 'asc' } })
      .then(({ data }) => setPrograms(data.data ?? data ?? [])).catch(() => {});
    api.get('/settings').then(({ data }) => setFeeTypes(data.fee_types ?? [])).catch(() => {});
  }, []);

  const program  = programs.find((p) => String(p.id) === String(programId));
  const partWord = (p) => (p?.scheme === 'annual' ? 'Part' : 'Semester');
  const typeName = (slug) => feeTypes.find((t) => t.slug === slug)?.name ?? (slug ?? '').replace(/_/g, ' ');

  const classOf = (r) => {
    // Challans from more than one program: one name/Part would be misleading.
    if (r.programs_count > 1) return `${r.programs_count} programs`;
    if (!r.program) return '—';
    return r.semester_no ? `${r.program.name} · ${partWord(r.program)} ${r.semester_no}` : r.program.name;
  };

  const columns = [
    { key: 'name', label: 'Student', sortable: true,
      render: (r) => <span className="font-medium text-gray-900">{r.name}</span>,
      csv: (r) => r.name },
    { key: 'cnic_no', label: 'CNIC', render: (r) => r.cnic_no, csv: (r) => r.cnic_no },
    { key: 'class', label: 'Program', render: classOf, csv: classOf },
    { key: 'challans_count', label: 'Challans', sortable: true },
    { key: 'amount_due', label: 'Amount Due', sortable: true,
      render: (r) => <span className="font-semibold text-gray-900">{money(r.amount_due)}</span>,
      csv: (r) => r.amount_due },
    { key: 'oldest_due', label: 'Oldest Due Date', sortable: true,
      render: (r) => new Date(r.oldest_due).toLocaleDateString(),
      csv: (r) => r.oldest_due?.slice(0, 10) },
    { key: 'days_overdue', label: 'Days Overdue',
      render: (r) => r.days_overdue > 0
        ? <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">{r.days_overdue} days</span>
        : <span className="text-xs text-gray-500">Not yet due</span>,
      csv: (r) => r.days_overdue },
  ];

  const actions = (r) => (
    <Link to={`${PORTAL}/challans?student=${r.student_id}&name=${encodeURIComponent(r.name)}`}
      className="text-indigo-600 hover:underline">Challans</Link>
  );

  const selectCls = "px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const parts = program ? Array.from({ length: program.total_semesters || 0 }, (_, i) => i + 1) : [];

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="text-sm text-gray-500">Students owing fees</div>
            <div className="text-2xl font-bold text-gray-900">{summary.students.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="text-sm text-gray-500">Total outstanding</div>
            <div className="text-2xl font-bold text-red-600">{money(summary.amount_due)}</div>
          </div>
        </div>
      )}

      <DataTable
        title="Fee Defaulters"
        endpoint="/reports/defaulters"
        csvName="fee-defaulters"
        columns={columns}
        actions={actions}
        onData={(d) => setSummary(d.summary ?? null)}
        filters={{
          program_id:   programId || undefined,
          semester_no:  semesterNo || undefined,
          challan_type: type || undefined,
          overdue_only: overdueOnly ? 1 : undefined,
        }}
        headerActions={
          <>
            <select value={programId} onChange={(e) => { setProgramId(e.target.value); setSemesterNo(''); }} className={selectCls}>
              <option value="">All programs</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {program && (
              <select value={semesterNo} onChange={(e) => setSemesterNo(e.target.value)} className={selectCls}>
                <option value="">All {partWord(program).toLowerCase()}s</option>
                {parts.map((n) => <option key={n} value={n}>{partWord(program)} {n}</option>)}
              </select>
            )}
            <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
              <option value="">All fee types</option>
              {feeTypes.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)}
                className="rounded border-gray-300" />
              Past due date only
            </label>
          </>
        }
      />
    </div>
  );
}
