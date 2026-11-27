import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { PORTAL } from '../../config/app';
import { useAuth } from '../../context/AuthContext';
import { APPLICATION_STATUSES, statusColor, statusLabel } from '../../config/statuses';

const money = (n) => `Rs. ${Math.round(Number(n || 0)).toLocaleString()}`;
const short = (n) => {
  const v = Number(n || 0);
  if (v >= 10000000) return `${(v / 10000000).toFixed(1).replace(/\.0$/, '')} Cr`;
  if (v >= 100000) return `${(v / 100000).toFixed(1).replace(/\.0$/, '')} Lac`;
  return Math.round(v).toLocaleString();
};
const parse = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const dayLabel = (s, opts) => parse(s).toLocaleDateString(undefined, opts);
const METHOD = { cash: 'Cash', bank_transfer: 'Bank', online: 'Online' };

/**
 * College admin home: fees first (what came in, what is owed), then what needs a
 * decision today, then students. Every number links to the page that explains it.
 */
export default function CollegeDashboard() {
  const { user, hasPrv } = useAuth();
  const [d, setD] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.get('/dashboard').then(({ data }) => setD(data)).catch(() => setFailed(true));
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const to = (path, slug) => (hasPrv(slug) ? `${PORTAL}/${path}` : null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}, {user?.name?.split(' ')[0]}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPrv('challans.bulk') && <Quick to={`${PORTAL}/challans/bulk`}>Bill a class</Quick>}
          {hasPrv('challans.store') && <Quick to={`${PORTAL}/challans/create`}>New challan</Quick>}
          {hasPrv('students.store') && <Quick to={`${PORTAL}/students/create`} primary>+ Student</Quick>}
        </div>
      </div>

      {failed ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-sm text-gray-500">Could not load the dashboard. Refresh the page to try again.</div>
      ) : !d ? (
        <Skeleton />
      ) : (
        <>
          {/* Fee tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MonthTile fees={d.fees} link={to('collections', 'reports.collections')} />
            <Tile label="Collected today" value={money(d.fees.today)} sub={d.fees.today > 0 ? 'Confirmed payments' : 'Nothing received yet today'}
              link={to('collections', 'reports.collections')} />
            <Tile label="Outstanding" value={money(d.fees.outstanding)}
              sub={`${d.fees.outstanding_count} unpaid challan${d.fees.outstanding_count === 1 ? '' : 's'}`}
              link={to('challans', 'challans.index')} />
            <Tile label="Overdue" value={money(d.fees.overdue)} tone={d.fees.overdue_count > 0 ? 'red' : null}
              sub={d.fees.overdue_count > 0 ? `${d.fees.overdue_count} challan${d.fees.overdue_count === 1 ? '' : 's'} past due date` : 'No overdue challans'}
              link={to('defaulters', 'reports.defaulters')} />
          </div>

          {/* Chart + attention */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <Card className="lg:col-span-2" title="Collections, last 30 days"
              action={to('collections', 'reports.collections') && <Link to={to('collections', 'reports.collections')} className="text-sm text-indigo-600 hover:underline">Fee Collection →</Link>}>
              <Chart days={d.fees.last_30_days} />
            </Card>

            <Card title="Needs attention">
              <div className="space-y-2">
                <Attention n={d.applications.submitted + d.applications.under_review} label="applications to review"
                  link={to('applications', 'applications.index')} />
                <Attention n={d.fees.pending_slips} label="payment slips to verify"
                  link={to('payment-slips', 'payments.slips')} />
                <Attention n={d.fees.overdue_count} label="overdue challans" tone="red"
                  link={to('defaulters', 'reports.defaulters')} />
              </div>
              {d.applications.waiting.length > 0 && (
                <div className="mt-5">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">Waiting longest</div>
                  <ul className="divide-y divide-gray-100">
                    {d.applications.waiting.map((a) => (
                      <li key={a.id}>
                        <Maybe to={to(`applications/${a.id}`, 'applications.show')} className="flex items-center justify-between gap-3 py-2 group">
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-gray-900 truncate group-hover:text-indigo-600">{a.student}</span>
                            <span className="block text-xs text-gray-500 truncate">{a.program}</span>
                          </span>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor(APPLICATION_STATUSES, a.status)}`}>
                            {statusLabel(APPLICATION_STATUSES, a.status)}
                          </span>
                        </Maybe>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          {/* Students + recent payments */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <Card className="lg:col-span-2" title="Students"
              action={to('students', 'students.index') && <Link to={to('students', 'students.index')} className="text-sm text-indigo-600 hover:underline">All students →</Link>}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <Mini label="Total" value={d.students.total} />
                <Mini label="Active" value={d.students.active} />
                <Mini label="Enrolled" value={d.students.enrolled} hint="Approved application" />
                <Mini label="New this month" value={d.students.new_this_month} />
              </div>
              <ProgramBars rows={d.students.by_program} enrolled={d.students.enrolled}
                link={(id) => to(`students?program_id=${id}`, 'students.index')} />
            </Card>

            <Card title="Latest payments">
              {d.fees.recent.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">No payments yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100 -my-2">
                  {d.fees.recent.map((p) => (
                    <li key={p.id}>
                      <Maybe to={to(`challans/${p.challan_id}`, 'challans.show')} className="flex items-center justify-between gap-3 py-2.5 group">
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-gray-900 truncate group-hover:text-indigo-600">{p.student}</span>
                          <span className="block text-xs text-gray-500">{dayLabel(p.paid_at, { day: 'numeric', month: 'short' })} · {METHOD[p.payment_method] ?? p.payment_method} · {p.challan_no}</span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">{money(p.amount_paid)}</span>
                      </Maybe>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- pieces ---------- */

function Maybe({ to, className, style, children }) {
  return to ? <Link to={to} className={className} style={style}>{children}</Link> : <div className={className} style={style}>{children}</div>;
}

function Quick({ to, primary, children }) {
  return (
    <Link to={to} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${primary
      ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white'}`}>
      {children}
    </Link>
  );
}

function Card({ title, action, className = '', children }) {
  return (
    <section className={`bg-white rounded-xl shadow-sm p-5 sm:p-6 min-w-0 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Tile({ label, value, sub, tone, link }) {
  return (
    <Maybe to={link} className="block bg-white rounded-xl shadow-sm p-5 ring-1 ring-transparent hover:ring-indigo-100 transition min-w-0">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1.5 truncate ${tone === 'red' ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{sub}</div>
    </Maybe>
  );
}

// This month vs the same days of last month.
function MonthTile({ fees, link }) {
  const now = fees.this_month, before = fees.last_month_same_period;
  const pct = before > 0 ? Math.round(((now - before) / before) * 100) : null;
  return (
    // Inline gradient: the dark-mode CSS remaps bg-* classes, this card keeps its colour in both themes.
    <Maybe to={link} className="block rounded-xl shadow-sm p-5 text-white min-w-0 hover:opacity-95 transition"
      style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}>
      <div className="text-xs font-medium uppercase tracking-wide text-indigo-100">Collected this month</div>
      <div className="text-2xl font-bold tabular-nums mt-1.5 truncate">{money(now)}</div>
      <div className="text-xs text-indigo-100 mt-1">
        {pct == null ? 'Nothing in the same days last month'
          : <><span className="font-semibold text-white">{pct >= 0 ? '▲' : '▼'} {Math.abs(pct)}%</span> vs same days last month</>}
      </div>
    </Maybe>
  );
}

function Attention({ n, label, link, tone }) {
  const zero = !n;
  const body = (
    <>
      <span className={`inline-flex min-w-[2.25rem] h-9 px-2 items-center justify-center rounded-lg text-sm font-bold tabular-nums ${zero
        ? 'bg-gray-100 text-gray-400' : tone === 'red' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{n}</span>
      <span className={`text-sm ${zero ? 'text-gray-400' : 'text-gray-800'}`}>{label}</span>
      {!zero && link && <span className="ml-auto text-gray-300 group-hover:text-indigo-500">→</span>}
    </>
  );
  return zero || !link
    ? <div className="flex items-center gap-3 p-1">{body}</div>
    : <Link to={link} className="flex items-center gap-3 p-1 rounded-lg hover:bg-gray-50 group">{body}</Link>;
}

function Mini({ label, value, hint }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2.5 min-w-0">
      <div className="text-xs text-gray-500 truncate" title={hint}>{label}</div>
      <div className="text-xl font-bold text-gray-900 tabular-nums">{Number(value || 0).toLocaleString()}</div>
    </div>
  );
}

function ProgramBars({ rows, enrolled, link }) {
  if (!rows.length) {
    return <p className="text-sm text-gray-400 py-4 text-center">No enrolled students yet. Students appear here once their application is approved.</p>;
  }
  const max = Math.max(...rows.map((r) => r.students));
  const shown = rows.slice(0, 6);
  const rest = rows.slice(6).reduce((s, r) => s + r.students, 0);
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">Enrolled by program</div>
      <ul className="space-y-2.5">
        {shown.map((r) => (
          <li key={r.id}>
            <Maybe to={link(r.id)} className="block group">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-800 truncate group-hover:text-indigo-600">{r.name}</span>
                <span className="shrink-0 tabular-nums text-gray-900 font-medium">{r.students}
                  <span className="text-gray-400 font-normal"> · {enrolled ? Math.round((r.students / enrolled) * 100) : 0}%</span></span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(2, (r.students / max) * 100)}%` }} />
              </div>
            </Maybe>
          </li>
        ))}
      </ul>
      {rest > 0 && <p className="text-xs text-gray-500 mt-3">+ {rest} in {rows.length - 6} other program{rows.length - 6 === 1 ? '' : 's'}</p>}
    </div>
  );
}

// 30 slim columns, one per day. Hover shows the day's amount; the best day is labelled.
function Chart({ days }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...days.map((x) => x.total));
  const total = days.reduce((s, x) => s + x.total, 0);
  const active = days.filter((x) => x.total > 0).length;
  const best = days.reduce((b, x, i) => (x.total > (days[b]?.total ?? 0) ? i : b), 0);
  const h = hover != null ? days[hover] : null;

  if (total === 0) {
    return <div className="h-48 flex items-center justify-center text-sm text-gray-400">No payments in the last 30 days.</div>;
  }
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div className="text-sm text-gray-500">
          <span className="text-lg font-bold text-gray-900 tabular-nums">{money(total)}</span> on {active} day{active === 1 ? '' : 's'}
        </div>
        <div className="text-xs text-gray-500 h-4">
          {h ? <>{dayLabel(h.date, { weekday: 'short', day: 'numeric', month: 'short' })} · <b className="text-gray-900">{money(h.total)}</b></> : 'Hover a day for its total'}
        </div>
      </div>
      <div className="relative h-64" onMouseLeave={() => setHover(null)}>
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-100" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-100" />
        <div className="relative h-full flex items-end gap-[2px] border-b border-gray-200">
          {days.map((x, i) => (
            <div key={x.date} className="flex-1 h-full flex flex-col justify-end items-center" onMouseEnter={() => setHover(i)}>
              {i === best && hover == null && x.total > 0 && (
                <span className="mb-1 text-[10px] font-semibold text-gray-700 whitespace-nowrap tabular-nums">{short(x.total)}</span>
              )}
              <div className={`w-full max-w-[22px] rounded-t transition-colors ${x.total > 0 ? (hover === i ? 'bg-indigo-700' : 'bg-indigo-500') : 'bg-gray-100'}`}
                style={{ height: x.total > 0 ? `${Math.max(3, (x.total / max) * 85)}%` : '2px' }} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between mt-1.5 text-[11px] text-gray-400">
        <span>{dayLabel(days[0].date, { day: 'numeric', month: 'short' })}</span>
        <span>{dayLabel(days[Math.floor(days.length / 2)].date, { day: 'numeric', month: 'short' })}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 bg-white rounded-xl shadow-sm" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-72 bg-white rounded-xl shadow-sm" />
        <div className="h-72 bg-white rounded-xl shadow-sm" />
      </div>
    </div>
  );
}
