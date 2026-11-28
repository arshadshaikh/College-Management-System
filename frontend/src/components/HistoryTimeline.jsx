import { useState, useEffect } from 'react';
import api from '../api';

// Friendly labels for action slugs. Add new ones as modules grow.
const ACTION_LABELS = {
  'college.approved':    { text: 'Approved',    color: 'bg-green-500' },
  'college.rejected':    { text: 'Rejected',    color: 'bg-red-500' },
  'college.suspended':   { text: 'Suspended',   color: 'bg-amber-500' },
  'college.reinstated':  { text: 'Reinstated',  color: 'bg-green-500' },
  'application.approved':{ text: 'Approved',    color: 'bg-green-500' },
  'application.rejected':{ text: 'Rejected',    color: 'bg-red-500' },
  'challan.marked_paid': { text: 'Marked Paid', color: 'bg-green-500' },
  'payment.slip_verified': { text: 'Slip Verified', color: 'bg-green-500' },
  'challan.cancelled':   { text: 'Cancelled',   color: 'bg-gray-400' },
  'college.plan_changed':{ text: 'Subscription changed', color: 'bg-indigo-500' },
  'college.updated':     { text: 'Details updated', color: 'bg-gray-400' },
};

// Fields that already have their own entry (status, subscription), so a generic
// "<model>.updated" row that changed only these is left out.
const COVERED = new Set(['status', 'rejection_reason', 'approved_at', 'approved_by', 'plan_id', 'plan_expires_at', 'on_trial', 'updated_at']);
const isGenericUpdate = (r) => /\.updated$/.test(r.action);
const changedKeys = (r) => Object.keys(r.new_values ?? {}).filter((k) => !COVERED.has(k));
const humanKey = (k) => k.replace(/_id$/, '').replace(/_/g, ' ');
const show = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v));

// "Enterprise → Growth · until 31 Dec 2026 · trial · Add-ons: Website, Extra 100 students x2"
function planLine(v) {
  if (!v) return '';
  const bits = [v.plan ?? (v.plan_id ? `Plan #${v.plan_id}` : 'No plan')];
  if (v.plan_expires_at) bits.push(`until ${new Date(`${v.plan_expires_at}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`);
  if (v.on_trial) bits.push('trial');
  if (v.addons?.length) bits.push(`add-ons: ${v.addons.join(', ')}`);
  return bits.join(' · ');
}

export default function HistoryTimeline({ auditableType, auditableId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get('/audit-logs', {
      params: { auditable_type: auditableType, auditable_id: auditableId, per_page: 100 },
    })
      .then(({ data }) => { if (!cancelled) setRows(data.data ?? data); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [auditableType, auditableId]);

  const visible = rows.filter((r) => !isGenericUpdate(r) || changedKeys(r).length > 0);

  if (loading) return <div className="text-sm text-gray-400">Loading history…</div>;
  if (!visible.length) return <div className="text-sm text-gray-400">No history recorded.</div>;

  return (
    <div className="space-y-4">
      {visible.map((r) => {
        const meta = ACTION_LABELS[r.action] ?? { text: r.action, color: 'bg-indigo-500' };
        const ctx = r.new_values ?? {};
        const when = new Date(r.created_at);
        return (
          <div key={r.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`w-3 h-3 rounded-full ${meta.color} mt-1`} />
              <span className="flex-1 w-px bg-gray-200 my-1" />
            </div>
            <div className="pb-4">
              <div className="text-sm font-medium text-gray-900">{meta.text}</div>
              {ctx.reason && (
                <div className="text-sm text-gray-600 mt-0.5">Reason: {ctx.reason}</div>
              )}
              {r.action === 'college.plan_changed' && (
                <div className="text-sm text-gray-600 mt-0.5">
                  {r.old_values?.plan || r.old_values?.plan_id ? <><span className="text-gray-400">{planLine(r.old_values)}</span><span className="mx-1.5 text-gray-400">→</span></> : null}
                  {planLine(ctx)}
                </div>
              )}
              {isGenericUpdate(r) && (
                <ul className="text-xs text-gray-600 mt-0.5 space-y-0.5">
                  {changedKeys(r).map((k) => (
                    <li key={k}><span className="capitalize text-gray-500">{humanKey(k)}:</span> {show(r.old_values?.[k])} → {show(ctx[k])}</li>
                  ))}
                </ul>
              )}
              {(ctx.from || ctx.to) && (
                <div className="text-xs text-gray-500 mt-0.5 capitalize">{ctx.from} → {ctx.to}</div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                By: {r.user?.name ?? 'System'}
                {r.user?.cnic_no ? ` (${r.user.cnic_no})` : ''}
                {' · '}
                {when.toLocaleDateString()} {when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-xs text-gray-400">
                IP: {r.ip_address ?? '—'}
                {r.user_agent ? ` · ${shortUA(r.user_agent)}` : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Turn a long user-agent string into something readable.
function shortUA(ua) {
  const browser = /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome'
    : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}