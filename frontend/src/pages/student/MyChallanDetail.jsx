import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';

const STATUS_STYLES = {
  unpaid: 'bg-amber-50 text-amber-700', paid: 'bg-green-50 text-green-700',
  overdue: 'bg-red-50 text-red-700', cancelled: 'bg-gray-100 text-gray-600',
};

export default function MyChallanDetail() {
  const { id } = useParams();
  const [challan, setChallan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({
    payment_method: 'bank_transfer', payment_reference: '', bank_name: '',
    paid_at: new Date().toISOString().slice(0, 10),
  });
  const [slip, setSlip] = useState(null);
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // const { data } = await api.get(`/challans/${id}`);
      const { data } = await api.get(`/my-challans/${id}`);
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
      a.href = url; a.download = `challan-${challan.challan_no}.pdf`; a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Could not download PDF.'); }
  };

  const submitSlip = async () => {
    if (!slip) { setErrors({ slip: ['Please attach your payment slip.'] }); return; }
    setBusy(true); setErrors({});
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      fd.append('slip', slip);
      await api.post(`/challans/${id}/upload-slip`, fd);
      toast.success('Slip uploaded. Awaiting verification by the college.');
      setShowUpload(false); setSlip(null);
      await load();
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
        if (err.response.data.message && !err.response.data.errors) toast.error(err.response.data.message);
      }
    } finally { setBusy(false); }
  };

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!challan) return (
    <div className="py-20 text-center">
      <p className="text-gray-500 mb-4">Challan not found.</p>
      <Link to={`${PORTAL}/my-challans`} className="text-indigo-600 hover:underline">Back to my challans</Link>
    </div>
  );

  const payable = ['unpaid', 'overdue'].includes(challan.status);
  const hasPendingSlip = challan.payments?.some((p) => !p.slip_verified);
  const inputCls = (e) => `w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${e ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <Link to={`${PORTAL}/my-challans`} className="text-sm text-gray-500 hover:underline">← My Challans</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{challan.challan_no}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={downloadPdf} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">⬇ PDF</button>
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize ${STATUS_STYLES[challan.status]}`}>{challan.status}</span>
        </div>
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
            <span>Total</span><span>Rs. {Number(challan.total_amount).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500 pt-1">
            <span>Due date</span><span>{new Date(challan.due_date).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Existing payment status */}
      {challan.payments?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Payment Status</h2>
          {challan.payments.map((p) => (
            <div key={p.id} className="text-sm text-gray-700">
              Rs. {Number(p.amount_paid).toLocaleString()} · {p.slip_verified
                ? <span className="text-green-700">verified</span>
                : <span className="text-amber-700">awaiting verification by the college</span>}
            </div>
          ))}
        </div>
      )}

      {/* Upload action */}
      {payable && !hasPendingSlip && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          {!showUpload ? (
            <button onClick={() => setShowUpload(true)} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              Pay / Upload Slip
            </button>
          ) : (
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900">Upload Payment Slip</h2>
              <div className="grid grid-cols-2 gap-4">
                <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className={inputCls()}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="online">Online</option>
                  <option value="cash">Cash Deposit</option>
                </select>
                <input type="date" value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} className={inputCls()} />
                <input type="text" placeholder="Bank name (optional)" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} className={inputCls()} />
                <input type="text" placeholder="Reference # (optional)" value={form.payment_reference} onChange={(e) => setForm({ ...form, payment_reference: e.target.value })} className={inputCls()} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment slip <span className="text-red-500">*</span></label>
                <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setSlip(e.target.files[0] ?? null)} className="text-sm" />
                {errors.slip && <p className="text-xs text-red-600 mt-1">{errors.slip[0]}</p>}
              </div>
              <div className="flex gap-3">
                <button disabled={busy} onClick={submitSlip} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {busy ? 'Uploading…' : 'Submit Slip'}
                </button>
                <button onClick={() => setShowUpload(false)} className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {payable && hasPendingSlip && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
          Your payment slip has been submitted and is awaiting verification.
        </div>
      )}
    </div>
  );
}