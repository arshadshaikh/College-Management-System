import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';
import { useAuth } from '../../context/AuthContext';

const STATUS_STYLES = {
  unpaid: 'bg-amber-50 text-amber-700', paid: 'bg-green-50 text-green-700',
  overdue: 'bg-red-50 text-red-700', cancelled: 'bg-gray-100 text-gray-600',
};

// Styling + sign hint per line-item type.
const ITEM_TYPE_META = {
  fee:         { badge: 'bg-gray-100 text-gray-600',   label: 'Fee' },
  discount:    { badge: 'bg-green-50 text-green-700',  label: 'Discount' },
  late_fee:    { badge: 'bg-red-50 text-red-700',      label: 'Late Fee' },
  conditional: { badge: 'bg-indigo-50 text-indigo-700', label: 'Conditional' },
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

  // Add-item form state
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState({ label: '', amount: '', type: 'fee' });

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

  const markPaid = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(payForm).forEach(([k, v]) => v && fd.append(k, v));
      if (slipFile) fd.append('slip', slipFile);

      await api.post(`/challans/${id}/mark-paid`, fd);
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

  const downloadSlip = async (payment) => {
    try {
      const res = await api.get(`/payments/${payment.id}/slip`, { responseType: 'arraybuffer' });
      const type = res.headers['content-type'] || 'application/octet-stream';
      const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' }[type] || '';
      const blob = new Blob([res.data], { type });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `slip-${challan.challan_no}${ext ? '.' + ext : ''}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Could not download slip.'); }
  };

  // ── Line-item actions ───────────────────────────────────────────
  const addItem = async () => {
    if (!itemForm.label.trim()) { toast.error('Enter a label.'); return; }
    if (itemForm.amount === '' || isNaN(Number(itemForm.amount))) { toast.error('Enter a valid amount.'); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/challans/${id}/items`, {
        label: itemForm.label.trim(),
        amount: Number(itemForm.amount),
        type: itemForm.type,
      });
      setChallan(data.challan);
      setItemForm({ label: '', amount: '', type: 'fee' });
      setShowAddItem(false);
      toast.success('Line-item added.');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not add line-item.');
    } finally { setBusy(false); }
  };

  const removeItem = async (itemId) => {
    if (!window.confirm('Remove this line-item?')) return;
    setBusy(true);
    try {
      const { data } = await api.delete(`/challans/${id}/items/${itemId}`);
      setChallan(data.challan);
      toast.success('Line-item removed.');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not remove line-item.');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!challan) return (
    <div className="py-20 text-center">
      <p className="text-gray-500 mb-4">Challan not found.</p>
      <Link to={`${PORTAL}/challans`} className="text-indigo-600 hover:underline">Back to challans</Link>
    </div>
  );

  const payable = ['unpaid', 'overdue'].includes(challan.status);
  const editable = payable; // items editable only while unpaid/overdue
  const canEditItems = hasPrv('challans.items.store') || hasPrv('challans.items.destroy');
  const inputCls = "w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  // Prefer real line-items; fall back to fee_breakdown for any legacy challan
  // that has no items yet.
  const items = challan.items ?? [];
  const useItems = items.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to={`${PORTAL}/challans`} className="text-sm text-gray-500 hover:underline">← Challans</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{challan.challan_no}</h1>
          {challan.title && <p className="text-sm text-gray-500 mt-0.5">{challan.title}</p>}
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
            {challan.installment_no != null && <Row label="Installment" value={`#${challan.installment_no}`} />}
            <Row label="Issue Date" value={new Date(challan.issue_date).toLocaleDateString()} />
            <Row label="Due Date" value={new Date(challan.due_date).toLocaleDateString()} />
          </dl>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Fee Breakdown</h2>
            {editable && canEditItems && !showAddItem && (
              <button onClick={() => setShowAddItem(true)} className="text-sm text-indigo-600 hover:underline">+ Add line</button>
            )}
          </div>

          <div className="space-y-2 text-sm">
            {useItems ? (
              items.map((it) => {
                const meta = ITEM_TYPE_META[it.type] ?? ITEM_TYPE_META.fee;
                const amt = Number(it.amount);
                const negative = amt < 0;
                return (
                  <div key={it.id} className="flex justify-between items-center group">
                    <span className="flex items-center gap-2">
                      <span className="text-gray-700">{it.label}</span>
                      {it.type !== 'fee' && (
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${meta.badge}`}>{meta.label}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className={negative ? 'text-green-700' : 'text-gray-900'}>
                        {negative ? '– ' : ''}Rs. {Math.abs(amt).toLocaleString()}
                      </span>
                      {editable && hasPrv('challans.items.destroy') && (
                        <button
                          onClick={() => removeItem(it.id)}
                          disabled={busy}
                          className="text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                          title="Remove line"
                        >✕</button>
                      )}
                    </span>
                  </div>
                );
              })
            ) : (
              // Legacy fallback: fee_breakdown snapshot
              (challan.fee_breakdown ?? []).map((f, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-gray-600">{f.label}</span>
                  <span className="text-gray-900">Rs. {Number(f.amount).toLocaleString()}</span>
                </div>
              ))
            )}

            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span>Rs. {Number(challan.total_amount).toLocaleString()}</span>
            </div>
          </div>

          {/* Add line-item form */}
          {editable && canEditItems && showAddItem && (
            <div className="mt-4 pt-4 border-t space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text" placeholder="Label (e.g. Merit Discount)"
                  value={itemForm.label}
                  onChange={(e) => setItemForm({ ...itemForm, label: e.target.value })}
                  className={inputCls}
                />
                <input
                  type="number" placeholder="Amount"
                  value={itemForm.amount}
                  onChange={(e) => setItemForm({ ...itemForm, amount: e.target.value })}
                  className={inputCls}
                />
              </div>
              <select
                value={itemForm.type}
                onChange={(e) => {
                  const type = e.target.value;
                  // Convenience: discounts are negative. Flip sign hint if user
                  // picks discount and typed a positive number.
                  setItemForm((f) => ({ ...f, type }));
                }}
                className={inputCls}
              >
                <option value="fee">Fee (positive)</option>
                <option value="discount">Discount (enter negative, e.g. -1000)</option>
                <option value="late_fee">Late Fee (positive)</option>
                <option value="conditional">Conditional Fee (positive)</option>
              </select>
              <p className="text-xs text-gray-400">Tip: for a discount, enter a negative amount like <code>-1000</code>.</p>
              <div className="flex gap-3">
                <button disabled={busy} onClick={addItem} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Add</button>
                <button onClick={() => { setShowAddItem(false); setItemForm({ label: '', amount: '', type: 'fee' }); }} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}
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
