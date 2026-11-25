import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PORTAL } from '../../config/app';
import DataTable from '../../components/DataTable';
import api from '../../api';

const money = (n) => `Rs. ${Math.round(Number(n || 0)).toLocaleString()}`;

// Local calendar date as Y-m-d (toISOString would shift to UTC and give yesterday before 5 AM).
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

const PRESETS = [
  { key: 'today',     label: 'Today',       range: (t) => [t, t] },
  { key: 'yesterday', label: 'Yesterday',   range: (t) => [addDays(t, -1), addDays(t, -1)] },
  { key: 'week',      label: 'Last 7 days', range: (t) => [addDays(t, -6), t] },
  { key: 'month',     label: 'This month',  range: (t) => [new Date(t.getFullYear(), t.getMonth(), 1), t] },
  { key: 'lastmonth', label: 'Last month',  range: (t) => [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)] },
  { key: 'custom',    label: 'Custom' },
];

const METHODS = { cash: 'Cash', bank_transfer: 'Bank deposit', online: 'Online' };

const periodLabel = (from, to) => {
  const f = parse(from), t = parse(to);
  if (from === to) return f.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const o = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${f.toLocaleDateString(undefined, o)} to ${t.toLocaleDateString(undefined, o)}`;
};

// One labelled horizontal bar. Single series, so one hue; the value is printed beside it.
function BarRow({ name, value, max, sub, negative }) {
  const pct = max > 0 ? Math.max(2, Math.round((Math.abs(value) / max) * 100)) : 0;
  return (
    <div className="group" title={`${name}: ${money(value)}${sub ? ` (${sub})` : ''}`}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-gray-700 truncate">{name}</span>
        <span className="font-semibold text-gray-900 tabular-nums whitespace-nowrap">{money(value)}</span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${negative ? 'bg-rose-400' : 'bg-indigo-500 group-hover:bg-indigo-600'}`}
          style={{ width: `${pct}%` }} />
      </div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

// Daily totals as columns with a hover tooltip. Only shown for ranges longer than a day.
function DayChart({ days, from, to }) {
  // Fill in days with no collection so gaps show as gaps.
  const map = Object.fromEntries(days.map((d) => [d.date, d]));
  const all = [];
  for (let d = parse(from); ymd(d) <= to && all.length < 62; d = addDays(d, 1)) {
    const k = ymd(d);
    all.push(map[k] ?? { date: k, total: 0, payments: 0 });
  }
  const max = Math.max(1, ...all.map((d) => d.total));
  const [hover, setHover] = useState(null);
  const h = hover != null ? all[hover] : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">By day</h3>
        <span className="text-xs text-gray-500 h-4">
          {h ? <>{parse(h.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · <b className="text-gray-900">{money(h.total)}</b> · {h.payments} payment{h.payments === 1 ? '' : 's'}</> : 'Hover a day for details'}
        </span>
      </div>
      {/* Columns stay slim (max 36px) so one busy day doesn't turn into a block. */}
      <div className="relative h-40 border-b border-gray-200" onMouseLeave={() => setHover(null)}>
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-100" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-100" />
        <div className="relative h-full flex items-end gap-[2px]">
          {all.map((d, i) => {
            const isMax = d.total > 0 && d.total === max;
            return (
              <div key={d.date} className="flex-1 h-full flex flex-col justify-end items-center cursor-default" onMouseEnter={() => setHover(i)}>
                {(isMax || hover === i) && d.total > 0 && (
                  <span className="mb-1 text-[10px] font-semibold text-gray-700 whitespace-nowrap tabular-nums">{money(d.total)}</span>
                )}
                <div className={`w-full max-w-[36px] rounded-t-md transition-colors ${d.total > 0 ? (hover === i ? 'bg-indigo-600' : 'bg-indigo-500') : 'bg-gray-100'}`}
                  style={{ height: d.total > 0 ? `${Math.max(3, (d.total / max) * 80)}%` : '2px' }} />
              </div>
            );
          })}
        </div>
      </div>
      {all.length <= 14 ? (
        <div className="flex gap-[2px] mt-1.5">
          {all.map((d) => (
            <div key={d.date} className="flex-1 text-center text-[11px] text-gray-500 leading-tight">
              <div>{parse(d.date).toLocaleDateString(undefined, { weekday: 'short' })}</div>
              <div className="text-gray-400">{parse(d.date).getDate()}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex justify-between text-[11px] text-gray-500 mt-1.5">
          <span>{parse(all[0].date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
          <span>{parse(all[all.length - 1].date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
        </div>
      )}
    </div>
  );
}

// Fee collected in a period: totals, split by fee type / method / day, and every payment.
export default function Collections() {
  const today = new Date();
  const [preset, setPreset] = useState('today');
  const [from, setFrom] = useState(ymd(today));
  const [to, setTo] = useState(ymd(today));
  const [programs, setPrograms] = useState([]);
  const [programId, setProgramId] = useState('');
  const [method, setMethod] = useState('');
  const [summary, setSummary] = useState(null);
  const [range, setRange] = useState(null);   // the range the server used (it swaps from/to if reversed)
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get('/programs', { params: { per_page: 200, sort_by: 'name', sort_dir: 'asc' } })
      .then(({ data }) => setPrograms(data.data ?? data ?? [])).catch(() => {});
  }, []);

  const choose = (p) => {
    setPreset(p.key);
    if (p.range) {
      const [f, t] = p.range(new Date());
      setFrom(ymd(f)); setTo(ymd(t));
    }
  };

  const filters = {
    from, to,
    program_id: programId || undefined,
    payment_method: method || undefined,
  };

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/reports/collections/pdf', { params: filters, responseType: 'arraybuffer' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = from === to ? `fee-collection-${from}.pdf` : `fee-collection-${from}-to-${to}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not create the PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const columns = [
    { key: 'paid_at', label: 'Date', sortable: true,
      render: (r) => <span className="whitespace-nowrap">{parse(r.paid_at).toLocaleDateString()}</span>,
      csv: (r) => r.paid_at },
    { key: 'challan_no', label: 'Challan', sortable: true,
      render: (r) => (
        <div>
          <Link to={`${PORTAL}/challans/${r.challan_id}`} className="font-medium text-indigo-600 hover:underline whitespace-nowrap">{r.challan_no}</Link>
          {r.title && <div className="text-xs text-gray-500">{r.title}</div>}
        </div>
      ),
      csv: (r) => r.challan_no },
    { key: 'name', label: 'Student', sortable: true,
      render: (r) => (
        <div>
          <div className="font-medium text-gray-900">{r.name}</div>
          <div className="text-xs text-gray-500">{r.cnic_no}</div>
        </div>
      ),
      csv: (r) => r.name },
    { key: 'program', label: 'Program',
      render: (r) => r.program
        ? <span>{r.program.name}{r.semester_no ? <span className="text-gray-500"> · {r.program.scheme === 'annual' ? 'Part' : 'Semester'} {r.semester_no}</span> : null}</span>
        : '—',
      csv: (r) => r.program?.name ?? '' },
    { key: 'payment_method', label: 'Method',
      render: (r) => (
        <div>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap">{METHODS[r.payment_method] ?? r.payment_method}</span>
          {r.payment_reference && <div className="text-xs text-gray-500 mt-1">{r.payment_reference}</div>}
        </div>
      ),
      csv: (r) => `${METHODS[r.payment_method] ?? r.payment_method}${r.payment_reference ? ` (${r.payment_reference})` : ''}` },
    { key: 'received_by', label: 'Received by',
      render: (r) => (
        <div>
          <div className="text-gray-800">{r.received_by ?? '—'}</div>
          <div className="text-xs text-gray-500">{r.source === 'slip' ? 'Slip approved' : 'Recorded at counter'}</div>
        </div>
      ),
      csv: (r) => r.received_by ?? '' },
    { key: 'amount_paid', label: 'Amount', sortable: true,
      render: (r) => <span className="font-semibold text-gray-900 tabular-nums whitespace-nowrap">{money(r.amount_paid)}</span>,
      csv: (r) => r.amount_paid },
  ];

  const selectCls = "px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const byType = summary?.by_fee_type ?? [];
  const byMethod = summary?.by_method ?? [];
  const typeMax = Math.max(0, ...byType.map((t) => Math.abs(t.total)));
  const methodMax = Math.max(0, ...byMethod.map((m) => m.total));
  const multiDay = range && range.from !== range.to;
  const empty = summary && summary.payments === 0;

  return (
    <div className="space-y-5">
      {/* Title + period picker */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fee Collection</h1>
          <p className="text-sm text-gray-500 mt-1">Money received from staff-recorded payments and approved slips. Pending and rejected slips are not counted.</p>
        </div>
        <button onClick={downloadPdf} disabled={downloading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 shadow-sm whitespace-nowrap">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          {downloading ? 'Preparing…' : 'Print / PDF'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-3 flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => choose(p)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${preset === p.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
            {p.label}
          </button>
        ))}
        {preset === 'custom' && (
          <div className="flex items-center gap-2 ml-1">
            <input type="date" value={from} max={ymd(today)} onChange={(e) => e.target.value && setFrom(e.target.value)} className={selectCls + ' py-1.5'} />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={to} max={ymd(today)} onChange={(e) => e.target.value && setTo(e.target.value)} className={selectCls + ' py-1.5'} />
          </div>
        )}
      </div>

      {/* Headline + breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="relative overflow-hidden rounded-2xl shadow-lg bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-white p-6">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute -right-4 bottom-0 w-24 h-24 rounded-full bg-white/5" />
          <p className="relative text-xs uppercase tracking-widest text-white/60">Collected</p>
          <p className="relative text-sm text-white/80 mt-1">{periodLabel(range?.from ?? from, range?.to ?? to)}</p>
          <p className="relative text-4xl font-bold mt-4 tabular-nums">{summary ? money(summary.total) : '…'}</p>
          <div className="relative mt-6 pt-4 border-t border-white/15 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-white/60">Payments</p>
              <p className="text-xl font-semibold">{summary ? summary.payments.toLocaleString() : '…'}</p>
            </div>
            <div>
              <p className="text-xs text-white/60">Students</p>
              <p className="text-xl font-semibold">{summary ? summary.students.toLocaleString() : '…'}</p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">By fee type</h3>
          {!summary ? <p className="text-sm text-gray-400">Loading…</p>
            : empty ? <p className="text-sm text-gray-500">Nothing collected in this period.</p>
            : <div className="space-y-4">
                {byType.map((t) => <BarRow key={t.key} name={t.name} value={t.total} max={typeMax} negative={t.total < 0} />)}
              </div>}
        </section>

        <section className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">By payment method</h3>
          {!summary ? <p className="text-sm text-gray-400">Loading…</p>
            : empty ? <p className="text-sm text-gray-500">Nothing collected in this period.</p>
            : <div className="space-y-4">
                {byMethod.map((m) => (
                  <BarRow key={m.key} name={m.name} value={m.total} max={methodMax}
                    sub={`${m.payments} payment${m.payments === 1 ? '' : 's'} · ${summary.total > 0 ? Math.round((m.total / summary.total) * 100) : 0}%`} />
                ))}
              </div>}
        </section>
      </div>

      {multiDay && summary && !empty && (
        <section className="bg-white rounded-xl shadow-sm p-6">
          <DayChart days={summary.by_day} from={range.from} to={range.to} />
        </section>
      )}

      <DataTable
        title="Payments received"
        endpoint="/reports/collections"
        csvName={from === to ? `fee-collection-${from}` : `fee-collection-${from}-to-${to}`}
        columns={columns}
        filters={filters}
        onData={(d) => { setSummary(d.summary ?? null); setRange(d.range ?? null); }}
        headerActions={
          <>
            <select value={programId} onChange={(e) => setProgramId(e.target.value)} className={selectCls}>
              <option value="">All programs</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={selectCls}>
              <option value="">All methods</option>
              {Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </>
        }
      />
    </div>
  );
}
