import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';
import DataTable from '../../components/DataTable';
import { useAuth } from '../../context/AuthContext';

// Payment slip queue: every slip students uploaded. Pending first, oldest first.
// Review opens the slip next to the challan so the admin can compare and approve / reject.

const money = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;
const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const cap = (s) => (s ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const ago = (d) => {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const days = Math.round(h / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

const STATUS = {
  pending:  ['Pending',  'bg-amber-50 text-amber-700'],
  approved: ['Approved', 'bg-green-50 text-green-700'],
  rejected: ['Rejected', 'bg-red-50 text-red-700'],
};
const Pill = ({ s }) => {
  const [label, cls] = STATUS[s] ?? [s, 'bg-gray-100 text-gray-600'];
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
};

const TABS = [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']];

const REASONS = ['Slip is not clear', 'Amount does not match the challan', 'Wrong challan number', 'Payment not found in bank record'];

// ── Review panel ──────────────────────────────────────────────
function ReviewPanel({ payment, onClose, onDone, canVerify, hasNext }) {
  const [file, setFile] = useState(null);       // { url, type }
  const [fileErr, setFileErr] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    let made = null;
    setFile(null); setFileErr(false); setRejecting(false); setReason('');
    api.get(`/payments/${payment.id}/slip`, { responseType: 'arraybuffer' })
      .then((res) => {
        const type = res.headers['content-type'] || 'application/octet-stream';
        made = URL.createObjectURL(new Blob([res.data], { type }));
        setFile({ url: made, type });
      })
      .catch(() => setFileErr(true));
    const esc = (e) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('keydown', esc); if (made) URL.revokeObjectURL(made); };
  }, [payment.id]);

  const c = payment.challan ?? {};
  const program = c.program ?? c.application?.program;
  const term = program?.scheme === 'annual' ? 'Part' : 'Semester';
  const mismatch = Number(payment.amount_paid) !== Number(c.total_amount);
  const pending = payment.slip_status === 'pending';

  const decide = async (approved) => {
    if (!approved && !reason.trim()) { toast.error('Give the student a reason.'); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/payments/${payment.id}/verify-slip`, { approved, remarks: approved ? null : reason.trim() });
      toast.success(data.message);
      onDone();
    } catch (err) {
      if (err.response?.status === 422) toast.error(err.response.data.message);
    } finally { setBusy(false); }
  };

  const Row = ({ label, children }) => (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{children}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{payment.student?.name} · {c.challan_no}</p>
            <p className="text-xs text-gray-500">Uploaded {ago(payment.created_at)}</p>
          </div>
          <div className="flex items-center gap-3">
            <Pill s={payment.slip_status} />
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500" title="Close (Esc)">✕</button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 min-h-0">
          {/* slip */}
          <div className="lg:col-span-3 bg-gray-100 flex items-center justify-center min-h-0 overflow-auto p-3">
            {fileErr ? <p className="text-sm text-red-600">The slip file could not be loaded.</p>
              : !file ? <p className="text-sm text-gray-400 animate-pulse">Loading slip…</p>
              : file.type.startsWith('image/') ? <img src={file.url} alt="Payment slip" className="max-w-full max-h-full object-contain rounded shadow" />
              : <iframe src={file.url} title="Payment slip" className="w-full h-full rounded bg-white" />}
          </div>

          {/* details + decision */}
          <div className="lg:col-span-2 flex flex-col min-h-0 border-t lg:border-t-0 lg:border-l border-gray-100">
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Challan</p>
              <div className="divide-y divide-gray-100">
                <Row label="Challan #"><Link to={`${PORTAL}/challans/${c.id}`} className="text-indigo-600 hover:underline">{c.challan_no}</Link></Row>
                <Row label="For">{c.title || cap(c.challan_type)}</Row>
                {program && <Row label="Program">{program.name}{c.semester_no ? ` · ${term} ${c.semester_no}` : ''}</Row>}
                <Row label="Challan amount">{money(c.total_amount)}</Row>
                <Row label="Due date">{fmt(c.due_date)}</Row>
              </div>

              <p className="text-xs uppercase tracking-wider text-gray-400 mt-5 mb-1">Slip</p>
              <div className="divide-y divide-gray-100">
                <Row label="Student">{payment.student?.name}<span className="block text-xs text-gray-500 font-normal">{payment.student?.cnic_no}</span></Row>
                <Row label="Amount on slip">
                  <span className={mismatch ? 'text-red-600' : ''}>{money(payment.amount_paid)}</span>
                </Row>
                <Row label="Paid on">{fmt(payment.paid_at)}</Row>
                <Row label="Method">{cap(payment.payment_method)}</Row>
                <Row label="Bank">{payment.bank_name || '—'}</Row>
                <Row label="Reference #">{payment.payment_reference || '—'}</Row>
              </div>

              {mismatch && (
                <div className="mt-4 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">
                  The challan is now {money(c.total_amount)}, but the slip was uploaded for {money(payment.amount_paid)}. A late fee may have been added since. Check the slip before approving.
                </div>
              )}

              {!pending && (
                <div className="mt-5 text-sm bg-gray-50 rounded-lg px-3 py-2.5 text-gray-700">
                  {payment.slip_status === 'approved' ? 'Approved' : 'Rejected'}
                  {payment.verified_by?.name ? ` by ${payment.verified_by.name}` : ''} on {fmt(payment.slip_verified_at)}.
                  {payment.slip_remarks && <span className="block mt-1 text-gray-600">Reason: “{payment.slip_remarks}”</span>}
                </div>
              )}

              {pending && rejecting && (
                <div className="mt-5">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason for the student</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {REASONS.map((r) => (
                      <button key={r} type="button" onClick={() => setReason(r)}
                        className={`text-xs px-2.5 py-1 rounded-full border ${reason === r ? 'bg-red-50 border-red-300 text-red-700' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>{r}</button>
                    ))}
                  </div>
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} autoFocus
                    placeholder="The student sees this and can upload a new slip."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
              )}
            </div>

            {pending && canVerify && (
              <div className="p-4 border-t border-gray-100 bg-gray-50/60">
                {!rejecting ? (
                  <div className="flex gap-2">
                    <button disabled={busy || fileErr} onClick={() => decide(true)}
                      className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                      {busy ? 'Saving…' : hasNext ? '✓ Approve & next' : '✓ Approve'}
                    </button>
                    <button disabled={busy} onClick={() => setRejecting(true)}
                      className="px-4 py-2.5 border border-red-200 text-red-700 bg-white rounded-lg text-sm font-semibold hover:bg-red-50">Reject…</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button disabled={busy || !reason.trim()} onClick={() => decide(false)}
                      className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                      {busy ? 'Saving…' : 'Reject slip'}
                    </button>
                    <button disabled={busy} onClick={() => setRejecting(false)} className="px-4 py-2.5 border border-gray-300 bg-white rounded-lg text-sm hover:bg-gray-50">Back</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function PaymentSlips() {
  const { hasPrv } = useAuth();
  const [status, setStatus] = useState('pending');
  const [counts, setCounts] = useState(null);
  const [rows, setRows] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [reviewing, setReviewing] = useState(null);

  const onData = (d) => { setCounts(d.counts ?? null); setRows(d.data ?? []); };

  // After a decision: refresh, and on the Pending tab move straight to the next slip.
  const next = reviewing ? rows[rows.findIndex((r) => r.id === reviewing.id) + 1] : null;
  const afterDecision = () => {
    setRefreshKey((k) => k + 1);
    setReviewing(status === 'pending' && next ? next : null);
  };

  const columns = [
    { key: 'student', label: 'Student',
      render: (r) => (
        <div>
          <div className="font-medium text-gray-900">{r.student?.name}</div>
          <div className="text-xs text-gray-500">{r.student?.cnic_no}</div>
        </div>
      ),
      csv: (r) => `${r.student?.name ?? ''} (${r.student?.cnic_no ?? ''})` },
    { key: 'challan', label: 'Challan',
      render: (r) => (
        <div>
          <div className="text-gray-900">{r.challan?.challan_no}</div>
          <div className="text-xs text-gray-500 truncate max-w-[14rem]">{r.challan?.title || cap(r.challan?.challan_type)}</div>
        </div>
      ),
      csv: (r) => `${r.challan?.challan_no ?? ''} ${r.challan?.title ?? ''}` },
    { key: 'amount_paid', label: 'Amount', sortable: true,
      render: (r) => {
        const off = Number(r.amount_paid) !== Number(r.challan?.total_amount);
        return (
          <div>
            <div className="font-medium text-gray-900">{money(r.amount_paid)}</div>
            {off && <div className="text-xs text-red-600">Challan {money(r.challan?.total_amount)}</div>}
          </div>
        );
      },
      csv: (r) => r.amount_paid },
    { key: 'bank', label: 'Bank / Ref',
      render: (r) => (
        <div className="text-gray-700">
          <div>{r.bank_name || '—'}</div>
          <div className="text-xs text-gray-500">{r.payment_reference || ''}</div>
        </div>
      ),
      csv: (r) => `${r.bank_name ?? ''} ${r.payment_reference ?? ''}`.trim() },
    { key: 'paid_at', label: 'Paid on', sortable: true, render: (r) => fmt(r.paid_at), csv: (r) => r.paid_at?.slice(0, 10) },
    { key: 'created_at', label: 'Uploaded', sortable: true,
      render: (r) => <span className="text-gray-600" title={new Date(r.created_at).toLocaleString()}>{ago(r.created_at)}</span>,
      csv: (r) => r.created_at?.slice(0, 10) },
    { key: 'slip_status', label: 'Status',
      render: (r) => <Pill s={r.slip_status} />,
      csv: (r) => r.slip_status },
  ];

  const actions = (r) => (
    <button onClick={() => setReviewing(r)} className={r.slip_status === 'pending'
      ? 'px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700'
      : 'text-indigo-600 hover:underline'}>
      {r.slip_status === 'pending' ? 'Review' : 'View'}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Tabs with counts */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(([key, label]) => {
          const n = key === 'all' ? null : counts?.[key];
          const on = status === key;
          return (
            <button key={key} onClick={() => setStatus(key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition ${
                on ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
              }`}>
              {label}
              {n != null && (
                <span className={`min-w-[1.5rem] px-1.5 py-0.5 rounded-full text-xs ${
                  on ? 'bg-white/20 text-white' : key === 'pending' && n > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                }`}>{n}</span>
              )}
            </button>
          );
        })}
      </div>

      {status === 'pending' && counts && counts.pending === 0 && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3">
          All caught up. No slips are waiting for review.
        </div>
      )}

      <DataTable
        title="Payment Slips"
        endpoint="/payments/slips"
        csvName={`payment-slips-${status}`}
        columns={columns}
        actions={actions}
        filters={{ status }}
        refreshKey={refreshKey}
        onData={onData}
      />

      {reviewing && (
        <ReviewPanel
          payment={reviewing}
          canVerify={hasPrv('payments.verify-slip')}
          hasNext={status === 'pending' && !!next}
          onClose={() => setReviewing(null)}
          onDone={afterDecision}
        />
      )}
    </div>
  );
}
