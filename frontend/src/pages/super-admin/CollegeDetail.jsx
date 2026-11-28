import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';
import { useAuth } from '../../context/AuthContext';
import HistoryTimeline from '../../components/HistoryTimeline';

const STATUS_STYLES = {
  pending:   'bg-amber-50 text-amber-700',
  approved:  'bg-green-50 text-green-700',
  rejected:  'bg-red-50 text-red-700',
  suspended: 'bg-gray-100 text-gray-600',
};

export default function CollegeDetail() {
  const { id } = useParams();
  const { hasPrv } = useAuth();

  const [college, setCollege] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'reject' | 'suspend' | null
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/colleges/${id}`);
      setCollege(data);
    } catch {
      setCollege(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const act = async (path, body, successMsg) => {
    setBusy(true);
    try {
      await api.post(`/colleges/${id}/${path}`, body);
      toast.success(successMsg);
      setPendingAction(null);
      setReason('');
      await load();
    } catch (err) {
      const msg = err.response?.data?.message;
      if (msg) toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const downloadDoc = async (doc) => {
    try {
      const res = await api.get(`/college-documents/${doc.id}/download`, { responseType: 'arraybuffer' });
      const type = res.headers['content-type'] || 'application/octet-stream';
      const blob = new Blob([res.data], { type });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_name || 'document';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Could not download document.'); }
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading…</div>;
  }

  if (!college) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500 mb-4">College not found.</p>
        <Link to={`${PORTAL}/colleges`} className="text-indigo-600 hover:underline">Back to colleges</Link>
      </div>
    );
  }

  const canApprove = ['pending', 'rejected'].includes(college.status) && hasPrv('colleges.approve');
  // const canApprove = college.status === 'pending' && hasPrv('colleges.approve');
  const canReject  = college.status === 'pending' && hasPrv('colleges.reject');
  const canSuspend = college.status === 'approved' && hasPrv('colleges.suspend');
  const canReinstate = college.status === 'suspended' && hasPrv('colleges.reinstate');
  const hasActions = canApprove || canReject || canSuspend || canReinstate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to={`${PORTAL}/colleges`} className="text-sm text-gray-500 hover:underline">← Colleges</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{college.name}</h1>
          <p className="text-sm text-gray-500">{college.slug}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize ${
          STATUS_STYLES[college.status] ?? 'bg-gray-100 text-gray-600'
        }`}>
          {college.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* College info */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">College Info</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Name"     value={college.name} />
            <Row label="Slug"     value={college.slug} />
            <Row label="Email"    value={college.email} />
            <Row label="Phone"    value={college.phone} />
            <Row label="Address"  value={college.address} />
            <Row label="City"     value={college.city} />
            <Row label="Province" value={college.province} />
          </dl>
        </div>

        {/* Status info */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Status</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Status"       value={college.status} />
            <Row label="Registered"  value={new Date(college.created_at).toLocaleString()} />
            <Row label="Approved At" value={college.approved_at ? new Date(college.approved_at).toLocaleString() : null} />
            <Row label="Admin Users" value={college.users?.length ?? 0} />
          </dl>
        </div>
      </div>

      {!college.is_platform && hasPrv('colleges.plan') && (
        <SubscriptionCard college={college} onSaved={(c) => setCollege((prev) => ({ ...prev, plan_id: c.plan_id, plan_expires_at: c.plan_expires_at, on_trial: c.on_trial, plan: c.plan, addons: c.addons, subscription: c.subscription, monthly_total: c.monthly_total }))} />
      )}

      {/* Rejection / suspension reason, if any */}
      {college.rejection_reason && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="text-sm font-medium text-red-800">
            {college.status === 'suspended' ? 'Suspension reason' : 'Rejection reason'}
          </div>
          <p className="text-sm text-red-700 mt-1">{college.rejection_reason}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Registration Documents</h2>
        {college.documents?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {college.documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3">  
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900">{doc.document_name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {doc.original_name} · {(doc.file_size / 1024).toFixed(0)} KB
                  </div>
                </div>
                <button onClick={() => downloadDoc(doc)} className="ml-4 shrink-0 text-sm text-indigo-600 hover:underline">
                  Download
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No documents were uploaded with this registration.</p>
        )}
      </div>

      {/* Actions */}
      {hasActions && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>

          {!pendingAction ? (
            <div className="flex flex-wrap gap-3">
              {canApprove && (
                <button
                  disabled={busy}
                  onClick={() => act('approve', {}, `College '${college.name}' approved and initialized successfully.`)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  Approve
                </button>
              )}
              {canReinstate && (
                <button disabled={busy}
                  onClick={() => act('reinstate', {}, `College '${college.name}' reinstated.`)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  Reinstate
                </button>
              )}
              {canReject && (
                <button
                  disabled={busy}
                  onClick={() => setPendingAction('reject')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              )}
              {canSuspend && (
                <button
                  disabled={busy}
                  onClick={() => setPendingAction('suspend')}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
                >
                  Suspend
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder={`Reason for ${pendingAction} (required)`}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 ${
                  pendingAction === 'suspend' ? 'focus:ring-amber-500' : 'focus:ring-red-500'
                }`}
              />
              <div className="flex gap-3">
                <button
                  disabled={busy || !reason.trim()}
                  onClick={() => act(
                    pendingAction,
                    { reason },
                    pendingAction === 'suspend'
                      ? `College '${college.name}' has been suspended.`
                      : `College '${college.name}' has been rejected.`
                  )}
                  className={`px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${
                    pendingAction === 'suspend' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  Confirm {pendingAction === 'suspend' ? 'Suspension' : 'Rejection'}
                </button>
                <button
                  onClick={() => { setPendingAction(null); setReason(''); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status History — add here, last card */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Status History</h2>
        <HistoryTimeline auditableType="App\Models\College" auditableId={college.id} />
      </div>

    </div>
  );
}

const money = (n) => `Rs. ${Math.round(Number(n || 0)).toLocaleString()}`;

const SUB_BADGE = {
  trial:   ['bg-indigo-50 text-indigo-700', 'Free trial'],
  active:  ['bg-green-50 text-green-700', 'Active'],
  grace:   ['bg-amber-50 text-amber-700', 'Grace period'],
  expired: ['bg-red-50 text-red-700', 'Expired'],
  none:    ['bg-gray-100 text-gray-600', 'No plan'],
};
const perMonth = (p) => (p ? Number(p.price) / (p.billing_period === 'yearly' ? 12 : 1) : 0);
const fmtDay = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// Super admin: the college's plan, end date, trial and add-ons, with the monthly total.
function SubscriptionCard({ college, onSaved }) {
  const [cat, setCat] = useState(null);   // { plans, addons, features, grace_days }
  const initial = () => ({
    planId: college.plan_id ?? '',
    expires: college.plan_expires_at ? String(college.plan_expires_at).slice(0, 10) : '',
    trial: !!college.on_trial,
    picked: Object.fromEntries((college.addons ?? []).map((a) => [a.id, a.pivot?.quantity ?? 1])),
  });
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/plans').then(({ data }) => setCat(data)).catch(() => setCat({ plans: [], addons: [], features: [] }));
  }, []);
  useEffect(() => { setForm(initial()); }, [college]);   // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const held = Object.fromEntries((college.addons ?? []).map((a) => [a.id, a]));
  const plans = (cat?.plans ?? []).filter((p) => p.is_active || p.id === college.plan_id);
  const plan = plans.find((p) => String(p.id) === String(form.planId)) ?? null;

  // Add-ons that make sense on the chosen plan.
  const addons = (cat?.addons ?? []).filter((a) => (a.is_active || held[a.id])
    && (a.kind === 'students' ? plan?.max_students != null : !(plan?.features ?? []).includes(a.feature)));
  const picked = Object.entries(form.picked).filter(([id]) => addons.some((a) => String(a.id) === id));
  const unitPrice = (a) => Number(held[a.id]?.pivot?.price ?? a.price);
  const total = perMonth(plan) + picked.reduce((sum, [id, q]) => sum + unitPrice(addons.find((a) => String(a.id) === id)) * q, 0);
  const extra = picked.reduce((sum, [id, q]) => { const a = addons.find((x) => String(x.id) === id); return sum + (a.kind === 'students' ? a.students_per_unit * q : 0); }, 0);

  const toggle = (a) => setForm((f) => {
    const next = { ...f.picked };
    if (next[a.id]) delete next[a.id]; else next[a.id] = 1;
    return { ...f, picked: next };
  });
  const qty = (a, q) => setForm((f) => ({ ...f, picked: { ...f.picked, [a.id]: Math.max(1, Math.min(1000, Number(q) || 1)) } }));

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/colleges/${college.id}/plan`, {
        plan_id: form.planId === '' ? null : Number(form.planId),
        plan_expires_at: form.expires || null,
        on_trial: form.planId !== '' && form.trial,
        addons: form.planId === '' ? [] : picked.map(([id, q]) => ({ addon_id: Number(id), quantity: q })),
      });
      toast.success(data.message);
      onSaved(data.college);
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not save the subscription.');
    } finally { setSaving(false); }
  };

  const sub = college.subscription ?? { status: college.plan_id ? 'active' : 'none' };
  const [badgeCls, badgeText] = SUB_BADGE[sub.status] ?? SUB_BADGE.none;
  const baseLimit = plan?.max_students ?? null;

  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="px-6 pt-6 pb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">Subscription</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {college.plan ? <>On <span className="font-medium text-gray-800">{college.plan.name}</span>
              {college.monthly_total > 0 && <> · {money(college.monthly_total)} a month</>}</> : 'No plan assigned.'}
          </p>
        </div>
        <div className="text-right">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${badgeCls}`}>{badgeText}</span>
          {sub.expires_at && (
            <div className="text-xs text-gray-500 mt-1">
              {sub.status === 'grace' ? `Ended ${fmtDay(sub.expires_at)}, read-only after ${fmtDay(sub.grace_ends_at)}`
                : sub.status === 'expired' ? `Ended ${fmtDay(sub.expires_at)}`
                : `Until ${fmtDay(sub.expires_at)} · ${sub.days_left} day${sub.days_left === 1 ? '' : 's'} left`}
            </div>
          )}
        </div>
      </div>

      {cat === null ? (
        <p className="px-6 pb-6 text-sm text-gray-400">Loading plans…</p>
      ) : (
        <>
          <div className="px-6 pb-5 grid grid-cols-1 sm:grid-cols-[1fr_12rem] gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Plan</span>
              <select value={form.planId} onChange={(e) => set('planId', e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">No plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.max_students ? `${Number(p.max_students).toLocaleString()} students` : 'unlimited'} · {Number(p.price) > 0 ? `${money(p.price)}/${p.billing_period === 'yearly' ? 'year' : 'month'}` : p.is_free ? 'free' : 'custom price'}{p.is_active ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Valid until <span className="text-gray-400">(empty = no end)</span></span>
              <input type="date" value={form.expires} onChange={(e) => set('expires', e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
            {plan && (
              <label className="sm:col-span-2 flex items-center gap-2 text-sm text-gray-700 cursor-pointer w-fit">
                <input type="checkbox" checked={form.trial} onChange={(e) => set('trial', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                This period is a free trial
              </label>
            )}
          </div>

          {plan && (
            <div className="border-t border-gray-100 px-6 py-5">
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <span className="text-sm font-medium text-gray-900">Add-ons</span>
                <Link to={`${PORTAL}/plans`} className="text-xs text-indigo-600 hover:underline">Manage plans and add-ons</Link>
              </div>
              {addons.length === 0 ? (
                <p className="text-sm text-gray-400">No add-ons apply to this plan.</p>
              ) : (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {addons.map((a) => {
                    const on = !!form.picked[a.id];
                    return (
                      <li key={a.id} className={`rounded-xl border p-3 flex items-center gap-3 ${on ? 'border-indigo-300 bg-indigo-50/60' : 'border-gray-200'}`}>
                        <input type="checkbox" checked={on} onChange={() => toggle(a)} className="w-4 h-4 accent-indigo-600 shrink-0" aria-label={a.name} />
                        <button type="button" onClick={() => toggle(a)} className="min-w-0 flex-1 text-left">
                          <span className="block text-sm font-medium text-gray-900">{a.name}{!a.is_active && <span className="text-xs text-gray-500 font-normal"> (inactive)</span>}</span>
                          <span className="block text-xs text-gray-500">{money(unitPrice(a))} / month{a.kind === 'students' ? ` per ${a.students_per_unit} students` : ''}</span>
                        </button>
                        {on && a.kind === 'students' && (
                          <input type="number" min="1" max="1000" value={form.picked[a.id]} onChange={(e) => qty(a, e.target.value)}
                            className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-sm text-right bg-white" aria-label="Units" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/60 rounded-b-xl flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              {plan ? (
                <>
                  <span className="text-gray-500">Monthly total </span>
                  <span className="font-semibold text-gray-900 tabular-nums">{money(total)}</span>
                  {Number(plan.price) === 0 && !plan.is_free && <span className="text-xs text-gray-500"> + plan price agreed with the college</span>}
                  <span className="text-gray-500"> · Students </span>
                  <span className="font-semibold text-gray-900 tabular-nums">{baseLimit == null ? 'Unlimited' : (baseLimit + extra).toLocaleString()}</span>
                  {extra > 0 && <span className="text-xs text-gray-500"> ({Number(baseLimit).toLocaleString()} + {extra.toLocaleString()})</span>}
                </>
              ) : <span className="text-gray-500">Choose a plan to see the total.</span>}
            </div>
            <button type="button" onClick={save} disabled={saving}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save subscription'}
            </button>
          </div>
        </>
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
