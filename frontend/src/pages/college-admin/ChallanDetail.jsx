import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

const STATUS_STYLES = {
  unpaid: 'bg-amber-50 text-amber-700', paid: 'bg-green-50 text-green-700',
  overdue: 'bg-red-50 text-red-700', cancelled: 'bg-gray-100 text-gray-600',
};

export default function ChallanDetail() {
  const { id } = useParams();
  const { hasPrv } = useAuth();

  const [challan, setChallan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [slipFile, setSlipFile] = useState(null);
  const [payForm, setPayForm] = useState({ payment_method: 'cash', payment_reference: '', bank_name: '', paid_at: new Date().toISOString().slice(0, 10), notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/challans/${id}`);
      setChallan(data);
    } catch { setChallan(null); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const downloadPdf = async () => {
    try {
      const res = await api.get(`/challans/${id}/pdf`, { responseType: 'arraybuffer' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `challan-${challan.challan_no}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Could not download PDF.'); }
  };

//   const markPaid = async () => {
//     setBusy(true);
//     try {
//       await api.post(`/challans/${id}/mark-paid`, payForm);
//       toast.success('Payment recorded. Challan marked as paid.');
//       setShowMarkPaid(false);
//       await load();
//     } catch (err) {
//       if (err.response?.status === 422) toast.error(err.response.data.message ?? 'Check the payment fields.');
//     } finally { setBusy(false); }
//   };


  const markPaid = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(payForm).forEach(([k, v]) => v && fd.append(k, v));
      if (slipFile) fd.append('slip', slipFile);

      await api.post(`/challans/${id}/mark-paid`, fd);
      // await api.post(`/challans/${id}/mark-paid`, fd, {
      //  headers: { 'Content-Type': 'multipart/form-data' },
      // });
      toast.success('Payment recorded. Challan marked as paid.');
      setShowMarkPaid(false);
      setSlipFile(null);
      await load();
    } catch (err) {
      if (err.response?.status === 422) toast.error(err.response.data.message ?? 'Check the payment fields.');
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    if (!window.confirm('Cancel this challan? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api.post(`/challans/${id}/cancel`);
      toast.success('Challan cancelled.');
      await load();
    } finally { setBusy(false); }
  };

  const verifySlip = async (paymentId, approved) => {
    setBusy(true);
    try {
      await api.post(`/payments/${paymentId}/verify-slip`, { approved });
      toast.success(approved ? 'Slip verified — challan paid.' : 'Slip rejected.');
      await load();
    } finally { setBusy(false); }
  };

  // const downloadSlip = async (payment) => {
  //  try {
  //    const res = await api.get(`/payments/${payment.id}/slip`, { responseType: 'arraybuffer' });
  //    const blob = new Blob([res.data], { type: 'application/octet-stream' });
  //    const url = window.URL.createObjectURL(blob);
  //    const a = document.createElement('a');
  //    a.href = url;
  //    a.download = `slip-${challan.challan_no}`;
  //    a.click();
  //    window.URL.revokeObjectURL(url);
  //  } catch { toast.error('Could not download slip.'); }
  //};

  const downloadSlip = async (payment) => {
    try {
      const res = await api.get(`/payments/${payment.id}/slip`, { responseType: 'arraybuffer' });

      const type = res.headers['content-type'] || 'application/octet-stream';
      const ext = {
        'image/png': 'png',
          'image/jpeg': 'jpg',
          'application/pdf': 'pdf',
      }[type] || '';

      const blob = new Blob([res.data], { type });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `slip-${challan.challan_no}${ext ? '.' + ext : ''}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Could not download slip.'); }
  };

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!challan) return (
    <div className="py-20 text-center">
      <p className="text-gray-500 mb-4">Challan not found.</p>
      <Link to="/challans" className="text-indigo-600 hover:underline">Back to challans</Link>
    </div>
  );

  const payable = ['unpaid', 'overdue'].includes(challan.status);
  const inputCls = "w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/challans" className="text-sm text-gray-500 hover:underline">← Challans</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{challan.challan_no}</h1>
        </div>
        <div className="flex items-center gap-3">
          {hasPrv('challans.pdf') && (
            <button onClick={downloadPdf} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">⬇ PDF</button>
          )}
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize ${STATUS_STYLES[challan.status]}`}>{challan.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Details</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Student" value={challan.student?.name} />
            <Row label="CNIC" value={challan.student?.cnic_no} />
            <Row label="Application" value={challan.application?.application_no} />
            <Row label="Program" value={challan.application?.program?.name} />
            <Row label="Type" value={challan.challan_type} />
            <Row label="Issue Date" value={new Date(challan.issue_date).toLocaleDateString()} />
            <Row label="Due Date" value={new Date(challan.due_date).toLocaleDateString()} />
          </dl>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Fee Breakdown</h2>
          <div className="space-y-2 text-sm">
            {(challan.fee_breakdown ?? []).map((f, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-gray-600">{f.label}</span>
                <span className="text-gray-900">Rs. {Number(f.amount).toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>Rs. {Number(challan.total_amount).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payments */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Payments</h2>
        {challan.payments?.length ? (
          <div className="space-y-3">
            {challan.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 text-sm">
                <div>
                  <div className="font-medium text-gray-900 capitalize">
                    {p.payment_method.replace('_', ' ')} · Rs. {Number(p.amount_paid).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    Paid {new Date(p.paid_at).toLocaleDateString()}
                    {p.slip_verified
                      ? ` · verified${p.recorded_by ? ' (admin-recorded)' : ''}`
                      : ' · awaiting verification'}
                  </div>
                </div>
                <div className="flex gap-3">
                  {p.has_slip && hasPrv('payments.slip') && (
                    <button onClick={() => downloadSlip(p)} className="text-indigo-600 hover:underline">Slip</button>
                  )}
                  {!p.slip_verified && hasPrv('payments.verify-slip') && (
                    <>
                      <button disabled={busy} onClick={() => verifySlip(p.id, true)} className="text-green-600 hover:underline">Approve</button>
                      <button disabled={busy} onClick={() => verifySlip(p.id, false)} className="text-red-600 hover:underline">Reject</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400">No payments yet.</p>}
      </div>

      {/* Actions */}
      {payable && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Actions</h2>
          {!showMarkPaid ? (
            <div className="flex gap-3">
              {hasPrv('challans.mark-paid') && (
                <button onClick={() => setShowMarkPaid(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Mark as Paid</button>
              )}
              {hasPrv('challans.cancel') && (
                <button disabled={busy} onClick={cancel} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">Cancel Challan</button>
              )}
            </div>
          ) : (
            <div className="space-y-3 max-w-md">
              <select value={payForm.payment_method} onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })} className={inputCls}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="online">Online</option>
              </select>
              <input type="date" value={payForm.paid_at} onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })} className={inputCls} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment proof (optional)</label>
                <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => setSlipFile(e.target.files[0] ?? null)}
                    className="text-sm"
                />
              </div>
              <input type="text" placeholder="Reference (optional)" value={payForm.payment_reference} onChange={(e) => setPayForm({ ...payForm, payment_reference: e.target.value })} className={inputCls} />
              <div className="flex gap-3">
                <button disabled={busy} onClick={markPaid} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">Confirm Payment</button>
                <button onClick={() => setShowMarkPaid(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 text-right capitalize">{value || '—'}</dd>
    </div>
  );
}