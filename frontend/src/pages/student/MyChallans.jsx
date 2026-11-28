import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import api from '../../api';
import { PORTAL } from '../../config/app';
import { useAuth } from '../../context/AuthContext';

const STATUS_STYLES = {
  unpaid: 'bg-amber-50 text-amber-700', paid: 'bg-green-50 text-green-700',
  overdue: 'bg-red-50 text-red-700', cancelled: 'bg-gray-100 text-gray-600',
};

// Slip state of a challan, from its latest payment (like "uploaded / verified" on bank portals).
const slipState = (r) => {
  const p = [...(r.payments ?? [])].sort((a, b) => b.id - a.id)[0];
  if (r.status === 'paid') return 'verified';
  if (!p) return 'none';
  if (p.slip_status) return { pending: 'pending', approved: 'verified', rejected: 'rejected' }[p.slip_status] ?? 'none';
  return p.slip_verified ? 'verified' : 'pending';
};
const SLIP = {
  none:     ['Not uploaded',           'bg-gray-100 text-gray-600'],
  pending:  ['Awaiting verification',  'bg-amber-50 text-amber-700'],
  verified: ['Verified',               'bg-green-50 text-green-700'],
  rejected: ['Rejected, upload again', 'bg-red-50 text-red-700'],
};
const payable = (r) => ['unpaid', 'overdue'].includes(r.status) && Number(r.total_amount) > 0;

const actions = (row) => {
  const s = slipState(row);
  const needsSlip = payable(row) && (s === 'none' || s === 'rejected');
  return (
    <Link to={`${PORTAL}/my-challans/${row.id}`}
      className={needsSlip
        ? 'inline-block whitespace-nowrap px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700'
        : 'text-indigo-600 hover:underline'}>
      {needsSlip ? 'Upload slip' : 'View'}
    </Link>
  );
};

// Services the college lets students request (Settings -> Fee Types with an amount).
function RequestServicePanel({ onClose }) {
  const navigate = useNavigate();
  const [services, setServices] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    api.get('/challans/services')
      .then(({ data }) => setServices(data.services ?? []))
      .catch(() => setServices([]));
  }, []);

  const request = async (s) => {
    if (s.unpaid_challan_id) {
      navigate(`${PORTAL}/my-challans/${s.unpaid_challan_id}`);
      return;
    }
    if (!window.confirm(`Make a challan for ${s.name} (Rs. ${s.amount.toLocaleString()})?`)) return;
    setBusy(s.slug);
    try {
      const { data } = await api.post('/challans/request', { fee_type: s.slug });
      toast.success(data.message);
      navigate(`${PORTAL}/my-challans/${data.challan.id}`);
    } catch (err) {
      if (err.response?.status === 422) toast.error(err.response.data.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">Request a service</h2>
          <p className="text-sm text-gray-500">Choose a service to get its challan. Pay it at the bank, then upload the slip.</p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">Close</button>
      </div>

      {services === null ? (
        <p className="py-6 text-center text-sm text-gray-400">Loading…</p>
      ) : services.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">No services can be requested right now.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {services.map((s) => (
            <div key={s.slug} className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
              <div>
                <p className="font-medium text-gray-900">{s.name}</p>
                <p className="text-sm text-gray-600">Rs. {s.amount.toLocaleString()}</p>
              </div>
              <button type="button" disabled={busy !== null} onClick={() => request(s)}
                className={`mt-auto px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${s.unpaid_challan_id
                  ? 'border border-amber-300 text-amber-700 hover:bg-amber-50'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                {busy === s.slug ? 'Making…' : s.unpaid_challan_id ? 'View unpaid challan' : 'Get challan'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyChallans() {
  const { hasPrv } = useAuth();
  const [open, setOpen] = useState(false);

  const columns = [
    { key: 'challan_no', label: 'Challan #' },
    { key: 'title', label: 'For', render: (r) => r.title || <span className="capitalize">{r.challan_type}</span> },
    { key: 'total_amount', label: 'Amount', render: (r) => `Rs. ${Number(r.total_amount).toLocaleString()}` },
    { key: 'due_date', label: 'Due', render: (r) => new Date(r.due_date).toLocaleDateString() },
    { key: 'status', label: 'Status',
      render: (r) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[r.status]}`}>{r.status}</span>
      )},
    { key: 'slip', label: 'Payment slip',
      render: (r) => {
        if (r.status === 'cancelled' || Number(r.total_amount) <= 0) return <span className="text-gray-400">—</span>;
        const [label, cls] = SLIP[slipState(r)];
        return <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${cls}`}>{label}</span>;
      }},
  ];

  const headerActions = (
    <>
      {hasPrv('statement.my') && (
        <Link to={`${PORTAL}/my-statement`}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 bg-white">
          Fee statement
        </Link>
      )}
      {hasPrv('challans.request') && !open && (
        <button type="button" onClick={() => setOpen(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Request a service
        </button>
      )}
    </>
  );

  return (
    <div>
      {open && <RequestServicePanel onClose={() => setOpen(false)} />}
      <DataTable title="My Challans" endpoint="/challans/my" columns={columns} showIndex={false}
        actions={actions} headerActions={headerActions} />
    </div>
  );
}
