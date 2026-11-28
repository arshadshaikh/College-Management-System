import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';

const money = (n) => `Rs. ${Math.round(Number(n || 0)).toLocaleString()}`;
const parse = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const day = (s) => parse(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const STATUS = {
  paid:    'bg-green-50 text-green-700',
  unpaid:  'bg-amber-50 text-amber-700',
  overdue: 'bg-red-50 text-red-700',
};

/**
 * One student's fee statement: what is owed now, then every charge and payment with
 * a running balance. Used by admins (any student) and by students (their own).
 *
 * endpoint     – JSON source, e.g. /students/5/statement or /my-statement
 * challanLink  – (challanId) => route of that challan's page, or null for no links
 * back         – optional { to, label } for the breadcrumb
 */
export default function FeeStatement({ endpoint, challanLink, back, self = false }) {
  const [d, setD] = useState(null);
  const [failed, setFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setD(null); setFailed(false);
    api.get(endpoint).then(({ data }) => setD(data)).catch(() => setFailed(true));
  }, [endpoint]);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`${endpoint}/pdf`, { responseType: 'arraybuffer' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `fee-statement-${d?.student?.cnic_no ?? 'student'}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not create the PDF.');
    } finally { setDownloading(false); }
  };

  if (failed) return <div className="py-20 text-center text-gray-500">Could not load the fee statement.</div>;
  if (!d) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const s = d.summary;
  const st = d.student;
  const ChallanNo = ({ id, no }) => (challanLink
    ? <Link to={challanLink(id)} className="text-indigo-600 hover:underline whitespace-nowrap">{no}</Link>
    : <span className="whitespace-nowrap">{no}</span>);

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {back && <Link to={back.to} className="text-sm text-gray-500 hover:underline">← {back.label}</Link>}
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{self ? 'My Fee Statement' : 'Fee Statement'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">As of {day(d.as_of)}</p>
        </div>
        <button type="button" onClick={download} disabled={downloading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap">
          {downloading ? 'Preparing…' : '⬇ Download PDF'}
        </button>
      </div>

      {/* Student */}
      <section className="bg-white rounded-xl shadow-sm p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <Info label="Student" value={<span className="font-semibold text-gray-900">{st.name}</span>} />
        <Info label="Program" value={st.program ?? <span className="text-gray-400">Not enrolled</span>} />
        <Info label="Father" value={st.father_name} />
        <Info label="Batch" value={st.batch ? `${st.batch}${st.shift ? ` · ${st.shift.charAt(0).toUpperCase()}${st.shift.slice(1)}` : ''}` : null} />
        <Info label="CNIC" value={<span className="font-mono">{st.cnic_no}</span>} />
        <Info label="Contact" value={[st.phone, st.email].filter(Boolean).join(' · ') || null} />
      </section>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Inline gradient: dark mode remaps bg-* classes; this card keeps its colour. */}
        <div className="col-span-2 lg:col-span-1 rounded-xl shadow-sm p-5 text-white"
          style={{ background: s.outstanding > 0 ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}>
          <div className="text-xs font-medium uppercase tracking-wide text-white/80">Balance due</div>
          <div className="text-2xl font-bold tabular-nums mt-1.5">{money(s.outstanding)}</div>
          <div className="text-xs text-white/80 mt-1">
            {s.outstanding > 0
              ? (s.next_due ? `Next: ${money(s.next_due.amount)} by ${day(s.next_due.due_date)}` : `${s.open_count} unpaid challan${s.open_count === 1 ? '' : 's'}`)
              : 'All fees are paid'}
          </div>
        </div>
        <Tile label="Total billed" value={money(s.billed)} />
        <Tile label="Total paid" value={money(s.paid)} />
        <Tile className="col-span-2 lg:col-span-1" label="Overdue" value={money(s.overdue)} red={s.overdue > 0}
          sub={s.overdue_count ? `${s.overdue_count} challan${s.overdue_count === 1 ? '' : 's'} past due` : 'Nothing overdue'} />
      </div>

      {s.pending_slips > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          {money(s.pending_slips)} in uploaded payment slips is waiting for verification. It will be counted once the slip is approved.
        </div>
      )}

      {/* To pay */}
      {d.open.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <h2 className="font-semibold text-gray-900 px-5 sm:px-6 pt-5 pb-3">To pay</h2>
          <ul className="divide-y divide-gray-100">
            {d.open.map((o) => (
              <li key={o.challan_id} className="px-5 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">{o.description}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    <ChallanNo id={o.challan_id} no={o.challan_no} /> ·{' '}
                    <span className={o.overdue ? 'text-red-600 font-medium' : ''}>{o.overdue ? 'Overdue since' : 'Due'} {day(o.due_date)}</span>
                  </div>
                </div>
                <div className="text-sm font-semibold text-gray-900 tabular-nums">{money(o.amount)}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Ledger */}
      <section className="bg-white rounded-xl shadow-sm">
        <h2 className="font-semibold text-gray-900 px-5 sm:px-6 pt-5 pb-3">Statement of account</h2>
        {d.ledger.length === 0 ? (
          <p className="px-6 pb-8 pt-2 text-sm text-gray-400 text-center">No challans have been issued yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Particulars</th>
                  <th className="px-4 py-3 text-left font-semibold">Challan</th>
                  <th className="px-4 py-3 text-right font-semibold">Charged</th>
                  <th className="px-4 py-3 text-right font-semibold">Paid</th>
                  <th className="px-4 sm:px-6 py-3 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {d.ledger.map((e, i) => (
                  <tr key={i} className={e.type === 'payment' ? 'bg-green-50/40' : ''}>
                    <td className="px-4 sm:px-6 py-3 text-gray-600 whitespace-nowrap">{day(e.date)}</td>
                    <td className="px-4 py-3 min-w-[14rem]">
                      <div className={e.type === 'payment' ? 'text-green-700 font-medium' : 'text-gray-900'}>{e.description}</div>
                      {e.type === 'charge' && (
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                          Due {day(e.due_date)}
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${STATUS[e.status] ?? 'bg-gray-100 text-gray-600'}`}>{e.status}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3"><ChallanNo id={e.challan_id} no={e.challan_no} /></td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900 whitespace-nowrap">{e.debit ? money(e.debit) : ''}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700 whitespace-nowrap">{e.credit ? money(e.credit) : ''}</td>
                    <td className="px-4 sm:px-6 py-3 text-right tabular-nums font-medium text-gray-900 whitespace-nowrap">{money(e.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 font-semibold text-gray-900">
                  <td className="px-4 sm:px-6 py-3" colSpan={3}>Totals</td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{money(s.billed)}</td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-green-700">{money(s.paid)}</td>
                  <td className="px-4 sm:px-6 py-3 text-right tabular-nums whitespace-nowrap">{money(s.balance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-gray-400">
        Payments count once they are recorded by the accounts office or once an uploaded slip is approved. Cancelled challans are not shown.
      </p>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex gap-3 min-w-0">
      <span className="w-20 shrink-0 text-gray-500">{label}</span>
      <span className="text-gray-800 min-w-0 break-words">{value || <span className="text-gray-400">—</span>}</span>
    </div>
  );
}

function Tile({ label, value, sub, red, className = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm p-5 min-w-0 ${className}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1.5 truncate ${red ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
