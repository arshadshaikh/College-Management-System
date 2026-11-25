import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';

const money = (n) => `Rs. ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
// Same day k months later (end of month when that day does not exist).
const addMonths = (d, k) => {
  const x = new Date(d.getFullYear(), d.getMonth() + k, 1);
  x.setDate(Math.min(d.getDate(), new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
  return x;
};

// Equal whole-rupee parts; the first part takes the odd rupees.
const evenAmounts = (total, n) => {
  const each = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? Math.round((total - each * (n - 1)) * 100) / 100 : each));
};

/**
 * Modal: split an unpaid challan into installments. Amounts default to equal parts,
 * due dates to one month apart starting from the challan's own due date.
 */
export default function SplitInstallments({ challan, onClose, onDone }) {
  const max = Math.max(2, challan.max_installments ?? 3);
  const base = (challan.items ?? []).filter((i) => i.type !== 'late_fee').reduce((s, i) => s + Number(i.amount), 0);
  const lateFee = (challan.items ?? []).filter((i) => i.type === 'late_fee').reduce((s, i) => s + Number(i.amount), 0);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const firstDue = (() => { const d = parse(challan.due_date); return d < today ? today : d; })();

  const plan = (n) => evenAmounts(base, n).map((amount, i) => ({ amount: String(amount), due_date: ymd(addMonths(firstDue, i)) }));
  const [count, setCount] = useState(2);
  const [rows, setRows] = useState(() => plan(2));
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  const choose = (n) => { setCount(n); setRows(plan(n)); setErrors({}); };
  const update = (i, key, value) => {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: value } : row)));
    setErrors((e) => ({ ...e, [`installments.${i}.${key}`]: undefined, installments: undefined }));
  };

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const assigned = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);
  const left = Math.round((base - assigned) * 100) / 100;
  const datesOk = rows.every((r, i) => r.due_date && parse(r.due_date) >= today && (i === 0 || r.due_date >= rows[i - 1].due_date));
  const amountsOk = rows.every((r) => Number(r.amount) >= 1);
  const ready = left === 0 && datesOk && amountsOk;

  const submit = async () => {
    setBusy(true); setErrors({});
    try {
      const { data } = await api.post(`/challans/${challan.id}/split`, {
        installments: rows.map((r) => ({ amount: Number(r.amount), due_date: r.due_date })),
      });
      toast.success(data.message);
      onDone(data.installments ?? []);
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
        toast.error(err.response.data.message ?? 'Check the installments.');
      } else {
        toast.error('Could not split the challan.');
      }
    } finally { setBusy(false); }
  };

  const err = (i, key) => errors[`installments.${i}.${key}`]?.[0];
  const cell = (bad) => `w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 ${bad ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Split into installments</h3>
            <p className="text-sm text-gray-500 mt-0.5">{challan.challan_no} · {money(base)}{challan.student?.name ? ` · ${challan.student.name}` : ''}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-5">
          {/* How many */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium text-gray-800">Number of installments</span>
            <div className="inline-flex rounded-lg bg-gray-100 p-1">
              {Array.from({ length: max - 1 }, (_, i) => i + 2).map((n) => (
                <button type="button" key={n} onClick={() => choose(n)}
                  className={`min-w-[2.5rem] px-3 py-1.5 rounded-md text-sm font-medium transition ${count === n ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div className="hidden sm:grid grid-cols-[7rem_1fr_1fr_3.5rem] gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 bg-gray-50 rounded-t-xl">
              <span>Installment</span><span>Amount (Rs.)</span><span>Due date</span><span className="text-right">Share</span>
            </div>
            {rows.map((r, i) => {
              const share = base > 0 ? Math.round(((Number(r.amount) || 0) / base) * 100) : 0;
              const badDate = r.due_date && (parse(r.due_date) < today || (i > 0 && r.due_date < rows[i - 1].due_date));
              return (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-[7rem_1fr_1fr_3.5rem] gap-3 px-4 py-3 items-center">
                  <span className="col-span-2 sm:col-span-1 text-sm font-medium text-gray-800">
                    <span className="inline-flex w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold items-center justify-center mr-2">{i + 1}</span>
                    of {count}
                  </span>
                  <div>
                    <input type="number" min="1" step="1" value={r.amount} onChange={(e) => update(i, 'amount', e.target.value)}
                      className={cell(err(i, 'amount') || (r.amount !== '' && Number(r.amount) < 1))} aria-label={`Installment ${i + 1} amount`} />
                    {err(i, 'amount') && <p className="text-xs text-red-600 mt-1">{err(i, 'amount')}</p>}
                  </div>
                  <div>
                    <input type="date" value={r.due_date} min={ymd(today)} onChange={(e) => update(i, 'due_date', e.target.value)}
                      className={cell(err(i, 'due_date') || badDate)} aria-label={`Installment ${i + 1} due date`} />
                    {(err(i, 'due_date') || badDate) && (
                      <p className="text-xs text-red-600 mt-1">{err(i, 'due_date') ?? (parse(r.due_date) < today ? 'Cannot be in the past.' : 'Must be on or after the one before.')}</p>
                    )}
                  </div>
                  <span className="hidden sm:block text-right text-sm text-gray-500 tabular-nums">{share}%</span>
                </div>
              );
            })}
          </div>

          {/* Balance */}
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm ${
            left === 0 ? 'bg-green-50 text-green-800' : left > 0 ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>
            <span className="font-medium">
              {left === 0 ? '✓ Adds up to the full amount' : left > 0 ? `${money(left)} still to assign` : `${money(-left)} more than the challan`}
            </span>
            <span className="flex items-center gap-3">
              <span className="tabular-nums">{money(assigned)} of {money(base)}</span>
              {left !== 0 && (
                <button type="button" onClick={() => setRows((r) => evenAmounts(base, count).map((amount, i) => ({ ...r[i], amount: String(amount) })))}
                  className="font-medium underline">Split evenly</button>
              )}
            </span>
          </div>

          <ul className="text-xs text-gray-500 space-y-1 list-disc pl-4">
            <li>Each installment keeps the same fee lines (Admission, Exam …), shared out in proportion, so reports stay correct.</li>
            <li>{challan.challan_no} will be cancelled and replaced by {count} new challans the student pays one by one.</li>
            {lateFee > 0 && <li>The current late fee ({money(lateFee)}) is not carried over. Each installment gets its own late fee only if it is paid after its due date.</li>}
          </ul>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={submit} disabled={!ready || busy}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Splitting…' : `Split into ${count} challans`}
          </button>
        </div>
      </div>
    </div>
  );
}
