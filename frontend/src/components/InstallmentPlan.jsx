import { Link } from 'react-router-dom';

const money = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;
const STATUS = {
  unpaid:    'bg-amber-50 text-amber-700',
  overdue:   'bg-red-50 text-red-700',
  paid:      'bg-green-50 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

/**
 * The installments of one split, side by side, with the one being viewed highlighted.
 * Used on the admin and the student challan pages. `linkTo(id)` builds each link.
 */
export default function InstallmentPlan({ challan, linkTo }) {
  const parts = challan.installment_set ?? [];
  if (!parts.length) return null;

  const isParent = !challan.parent_challan_id;   // the challan that was split (now cancelled)
  const total = parts.reduce((s, p) => s + Number(p.total_amount), 0);
  const paid = parts.filter((p) => p.status === 'paid');
  const paidAmount = paid.reduce((s, p) => s + Number(p.total_amount), 0);
  const pct = total > 0 ? Math.round((paidAmount / total) * 100) : 0;

  return (
    <section className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-gray-900">Installment plan</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {isParent
              ? <>This challan was split into {parts.length} installments and is no longer payable. Pay the installments below.</>
              : <>Installment {challan.installment_no} of {parts.length}{challan.parent?.challan_no && <> · split from{' '}
                  <Link to={linkTo(challan.parent_challan_id)} className="text-indigo-600 hover:underline">{challan.parent.challan_no}</Link></>}</>}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">{paid.length} of {parts.length} paid</div>
          <div className="text-sm font-semibold text-gray-900">{money(paidAmount)} <span className="font-normal text-gray-400">of {money(total)}</span></div>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-4">
        <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className={`grid gap-3 ${parts.length <= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
        {parts.map((p) => {
          const current = p.id === challan.id;
          return (
            <Link key={p.id} to={linkTo(p.id)}
              className={`block rounded-xl border p-4 transition ${current
                ? 'border-indigo-300 ring-2 ring-indigo-100 bg-indigo-50/40'
                : 'border-gray-200 hover:border-indigo-200 hover:shadow-sm'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {p.installment_no} of {parts.length}{current ? ' · viewing' : ''}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${STATUS[p.status] ?? STATUS.cancelled}`}>{p.status}</span>
              </div>
              <div className="mt-2 text-lg font-bold text-gray-900 tabular-nums">{money(p.total_amount)}</div>
              <div className="text-xs text-gray-500 mt-0.5">Due {new Date(p.due_date).toLocaleDateString()}</div>
              <div className="text-xs text-indigo-600 mt-2 font-medium">{p.challan_no}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
