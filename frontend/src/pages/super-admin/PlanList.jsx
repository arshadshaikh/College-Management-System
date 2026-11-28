import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

const money = (n) => `Rs. ${Math.round(Number(n || 0)).toLocaleString()}`;
const EMPTY_ADDON = { name: '', description: '', kind: 'feature', feature: '', students_per_unit: '100', price: '0', is_active: true, sort_order: '' };
const EMPTY = { name: '', description: '', price: '0', billing_period: 'monthly', max_students: '', features: [], is_free: false, is_default: false, is_active: true, sort_order: '' };

/**
 * Super Admin: subscription plans. Each plan has a price, a student limit and a set
 * of feature switches; colleges are put on a plan from their college page.
 */
export default function PlanList() {
  const { hasPrv } = useAuth();
  const [plans, setPlans] = useState(null);
  const [features, setFeatures] = useState([]);
  const [addons, setAddons] = useState([]);
  const [trialDays, setTrialDays] = useState(0);
  const [editing, setEditing] = useState(null);       // null | 'new' | plan
  const [editingAddon, setEditingAddon] = useState(null); // null | 'new' | add-on

  const load = () => api.get('/plans').then(({ data }) => {
    setPlans(data.plans); setFeatures(data.features); setAddons(data.addons ?? []); setTrialDays(data.trial_days ?? 0);
  }).catch(() => setPlans([]));
  useEffect(() => { load(); }, []);

  const remove = async (p) => {
    if (!window.confirm(`Delete the ${p.name} plan?`)) return;
    try {
      const { data } = await api.delete(`/plans/${p.id}`);
      toast.success(data.message);
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Could not delete the plan.'); }
  };

  const removeAddon = async (a) => {
    if (!window.confirm(`Delete the add-on "${a.name}"?`)) return;
    try {
      const { data } = await api.delete(`/addons/${a.id}`);
      toast.success(data.message);
      load();
    } catch (err) { toast.error(err.response?.data?.message ?? 'Could not delete the add-on.'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plans</h1>
          <p className="text-sm text-gray-500 mt-0.5">What each college can use and how many students it can have. Put a college on a plan from its college page.</p>
        </div>
        {hasPrv('plans.store') && (
          <button type="button" onClick={() => setEditing('new')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">+ New plan</button>
        )}
      </div>

      {plans === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => <div key={i} className="h-96 bg-white rounded-2xl shadow-sm animate-pulse" />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-sm text-gray-500">No plans yet. Create the first one.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} features={features} trialDays={trialDays}
              onEdit={hasPrv('plans.update') ? () => setEditing(p) : null}
              onDelete={hasPrv('plans.destroy') ? () => remove(p) : null} />
          ))}
        </div>
      )}

      {plans !== null && (
        <AddonSection addons={addons} features={features}
          onNew={hasPrv('addons.store') ? () => setEditingAddon('new') : null}
          onEdit={hasPrv('addons.update') ? (a) => setEditingAddon(a) : null}
          onDelete={hasPrv('addons.destroy') ? removeAddon : null} />
      )}

      {editingAddon && (
        <AddonEditor addon={editingAddon === 'new' ? null : editingAddon} features={features}
          onClose={() => setEditingAddon(null)} onSaved={() => { setEditingAddon(null); load(); }} />
      )}

      {editing && (
        <PlanEditor plan={editing === 'new' ? null : editing} features={features} trialDays={trialDays}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}

function PlanCard({ plan, features, trialDays, onEdit, onDelete }) {
  const on = new Set(plan.features ?? []);
  return (
    <section className={`bg-white rounded-2xl shadow-sm p-6 flex flex-col ring-1 ${plan.is_default ? 'ring-indigo-200' : 'ring-transparent'} ${plan.is_active ? '' : 'opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900">{plan.name}</h2>
          {plan.description && <p className="text-sm text-gray-500 mt-0.5">{plan.description}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {plan.is_default && <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 whitespace-nowrap">Default{trialDays > 0 ? ` · ${trialDays}-day trial` : ''}</span>}
          {!plan.is_active && <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">Inactive</span>}
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        {Number(plan.price) > 0 ? (
          <>
            <span className="text-3xl font-bold text-gray-900 tabular-nums">{money(plan.price)}</span>
            <span className="text-sm text-gray-500">/ {plan.billing_period === 'monthly' ? 'month' : 'year'}</span>
          </>
        ) : plan.is_free ? (
          <span className="text-3xl font-bold text-green-700">Free</span>
        ) : (
          <span className="text-2xl font-bold text-gray-900 py-0.5">Custom price</span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-gray-50 px-3 py-2.5">
          <div className="text-xs text-gray-500">Students</div>
          <div className="text-base font-semibold text-gray-900 tabular-nums">{plan.max_students ? Number(plan.max_students).toLocaleString() : 'Unlimited'}</div>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2.5">
          <div className="text-xs text-gray-500">Colleges on plan</div>
          <div className="text-base font-semibold text-gray-900 tabular-nums">{plan.colleges_count ?? 0}</div>
        </div>
      </div>

      <ul className="mt-5 space-y-2 text-sm flex-1">
        <li className="flex gap-2 text-gray-800"><Tick on /> Admissions, students and fee challans</li>
        {features.map((f) => (
          <li key={f.key} className={`flex gap-2 ${on.has(f.key) ? 'text-gray-800' : 'text-gray-400 line-through decoration-gray-300'}`}>
            <Tick on={on.has(f.key)} /> {f.label}
          </li>
        ))}
      </ul>

      {(onEdit || onDelete) && (
        <div className="mt-6 flex gap-2">
          {onEdit && <button type="button" onClick={onEdit} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Edit</button>}
          {onDelete && <button type="button" onClick={onDelete} className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50">Delete</button>}
        </div>
      )}
    </section>
  );
}

function Tick({ on }) {
  return on
    ? <svg className="w-4 h-4 mt-0.5 shrink-0 text-green-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
    : <svg className="w-4 h-4 mt-0.5 shrink-0 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
}

function PlanEditor({ plan, features, trialDays, onClose, onSaved }) {
  const [f, setF] = useState(() => (plan ? {
    ...EMPTY, ...plan, price: String(Number(plan.price)), max_students: plan.max_students ?? '', sort_order: plan.sort_order ?? '', features: plan.features ?? [],
  } : EMPTY));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const toggle = (key) => set('features', f.features.includes(key) ? f.features.filter((k) => k !== key) : [...f.features, key]);

  const save = async () => {
    setBusy(true); setErrors({});
    const body = {
      name: f.name, description: f.description || null, price: f.is_free ? 0 : (f.price || 0), billing_period: f.billing_period, is_free: !!f.is_free,
      max_students: f.max_students === '' ? null : Number(f.max_students), features: f.features,
      is_default: !!f.is_default, is_active: !!f.is_active, sort_order: f.sort_order === '' ? null : Number(f.sort_order),
    };
    try {
      const { data } = plan ? await api.put(`/plans/${plan.id}`, body) : await api.post('/plans', body);
      toast.success(data.message);
      onSaved();
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
        toast.error(err.response.data.message ?? 'Check the highlighted fields.');
      } else toast.error('Could not save the plan.');
    } finally { setBusy(false); }
  };

  const cls = (k) => `w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 ${errors[k] ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`;
  const Err = ({ k }) => (errors[k] ? <p className="text-xs text-red-600 mt-1">{errors[k][0]}</p> : null);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900">{plan ? `Edit ${plan.name}` : 'New plan'}</h3>
          <button type="button" onClick={onClose} disabled={busy} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block sm:col-span-2">
              <span className="block text-sm font-medium text-gray-700 mb-1">Name</span>
              <input value={f.name} onChange={(e) => set('name', e.target.value)} className={cls('name')} placeholder="Standard" />
              <Err k="name" />
            </label>
            <label className="block sm:col-span-2">
              <span className="block text-sm font-medium text-gray-700 mb-1">Short description</span>
              <input value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} className={cls('description')} placeholder="Shown on the plan card" />
              <Err k="description" />
            </label>
            <div className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Price (Rs.)</span>
              <div className="flex gap-2">
                <input type="number" min="0" value={f.is_free ? '0' : f.price} disabled={f.is_free} onChange={(e) => set('price', e.target.value)} className={`${cls('price')} disabled:bg-gray-50 disabled:text-gray-400`} />
                <select value={f.billing_period} disabled={f.is_free} onChange={(e) => set('billing_period', e.target.value)} className={`${cls('billing_period')} w-32 disabled:bg-gray-50 disabled:text-gray-400`}>
                  <option value="yearly">per year</option>
                  <option value="monthly">per month</option>
                </select>
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-700 cursor-pointer w-fit">
                <input type="checkbox" checked={!!f.is_free} onChange={(e) => set('is_free', e.target.checked)} className="w-4 h-4 accent-indigo-600" />
                Free plan
              </label>
              {f.is_free ? <p className="text-xs text-gray-500 mt-1">Shown as "Free". Give it to a college only when you choose to.</p>
                : Number(f.price) === 0 ? <p className="text-xs text-gray-500 mt-1">0 shows as "Custom price", agreed per college.</p> : <Err k="price" />}
            </div>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Student limit</span>
              <input type="number" min="1" value={f.max_students} onChange={(e) => set('max_students', e.target.value)} className={cls('max_students')} placeholder="Empty = unlimited" />
              <Err k="max_students" />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Features</span>
              <span className="text-xs text-gray-500">Admissions, students and fee challans are in every plan.</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {features.map((ft) => {
                const on = f.features.includes(ft.key);
                return (
                  <button type="button" key={ft.key} onClick={() => toggle(ft.key)}
                    className={`text-left rounded-xl border p-3 transition ${on ? 'border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded border flex items-center justify-center ${on ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                        {on && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{ft.label}</span>
                      {ft.coming_soon && <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">Soon</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 pl-6">{ft.description}</p>
                  </button>
                );
              })}
            </div>
            <Err k="features" />
          </div>

          <div className="space-y-3 rounded-xl bg-gray-50 p-4">
            <Check checked={f.is_default} onChange={(v) => set('is_default', v)} label="Default plan"
              help={`Newly approved colleges start on this plan${trialDays > 0 ? ` with a ${trialDays}-day free trial` : ''}. Only one plan can be the default.`} />
            <Check checked={f.is_active} onChange={(v) => set('is_active', v)} label="Active"
              help="Inactive plans stay on the colleges that have them but can't be given to new ones." />
            {errors.is_default && <p className="text-xs text-red-600">{errors.is_default[0]}</p>}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={save} disabled={busy || !f.name.trim()}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Saving…' : plan ? 'Save plan' : 'Create plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Check({ checked, onChange, label, help }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-indigo-600" />
      <span>
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        <span className="block text-xs text-gray-500">{help}</span>
      </span>
    </label>
  );
}

/* ---------- Add-ons ---------- */

function addonUnlocks(a, features) {
  if (a.kind === 'students') return `+${Number(a.students_per_unit).toLocaleString()} students per unit`;
  return features.find((f) => f.key === a.feature)?.label ?? a.feature;
}

function AddonSection({ addons, features, onNew, onEdit, onDelete }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm">
      <div className="px-5 sm:px-6 pt-5 pb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Add-ons</h2>
          <p className="text-sm text-gray-500 mt-0.5">Paid extras on top of any plan, priced per month. Give them to a college from its college page.</p>
        </div>
        {onNew && (
          <button type="button" onClick={onNew}
            className="px-4 py-2 border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-lg text-sm font-medium hover:bg-indigo-100">+ New add-on</button>
        )}
      </div>
      {addons.length === 0 ? (
        <p className="px-6 pb-8 pt-2 text-sm text-gray-400 text-center">No add-ons yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border-t border-gray-100">
          {addons.map((a) => (
            <li key={a.id} className={`px-5 sm:px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-2 ${a.is_active ? '' : 'opacity-60'}`}>
              <div className="min-w-0 flex-1 basis-60">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{a.name}</span>
                  {!a.is_active && <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">Inactive</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  <span className={`inline-block px-1.5 py-px rounded mr-1.5 text-[11px] font-medium ${a.kind === 'students' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>
                    {a.kind === 'students' ? 'Students' : 'Feature'}
                  </span>
                  {addonUnlocks(a, features)}{a.description ? ` · ${a.description}` : ''}
                </div>
              </div>
              <div className="text-sm tabular-nums whitespace-nowrap">
                <span className="font-semibold text-gray-900">{money(a.price)}</span>
                <span className="text-gray-500"> / month{a.kind === 'students' ? ' per unit' : ''}</span>
              </div>
              <div className="text-xs text-gray-500 whitespace-nowrap w-24">{a.colleges_count ?? 0} college{a.colleges_count === 1 ? '' : 's'}</div>
              {(onEdit || onDelete) && (
                <div className="flex gap-1 ml-auto">
                  {onEdit && <button type="button" onClick={() => onEdit(a)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50">Edit</button>}
                  {onDelete && <button type="button" onClick={() => onDelete(a)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddonEditor({ addon, features, onClose, onSaved }) {
  const [f, setF] = useState(() => (addon ? {
    ...EMPTY_ADDON, ...addon, feature: addon.feature ?? '', students_per_unit: addon.students_per_unit ?? '100',
    price: String(Number(addon.price)), sort_order: addon.sort_order ?? '',
  } : EMPTY_ADDON));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const locked = addon && (addon.colleges_count ?? 0) > 0;   // what it unlocks can't change once colleges have it

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  const save = async () => {
    setBusy(true); setErrors({});
    const body = {
      name: f.name, description: f.description || null, kind: f.kind,
      feature: f.kind === 'feature' ? (f.feature || null) : null,
      students_per_unit: f.kind === 'students' ? Number(f.students_per_unit) || null : null,
      price: f.price || 0, is_active: !!f.is_active, sort_order: f.sort_order === '' ? null : Number(f.sort_order),
    };
    try {
      const { data } = addon ? await api.put(`/addons/${addon.id}`, body) : await api.post('/addons', body);
      toast.success(data.message);
      onSaved();
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
        toast.error(err.response.data.message ?? 'Check the highlighted fields.');
      } else toast.error('Could not save the add-on.');
    } finally { setBusy(false); }
  };

  const cls = (k) => `w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 disabled:bg-gray-50 disabled:text-gray-500 ${errors[k] ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`;
  const Err = ({ k }) => (errors[k] ? <p className="text-xs text-red-600 mt-1">{errors[k][0]}</p> : null);
  const Kind = ({ value, title, help }) => (
    <button type="button" disabled={locked} onClick={() => set('kind', value)}
      className={`text-left rounded-xl border p-3 transition disabled:cursor-not-allowed ${f.kind === value ? 'border-indigo-300 bg-indigo-50/60 ring-1 ring-indigo-200' : 'border-gray-200 hover:border-gray-300'}`}>
      <span className="block text-sm font-medium text-gray-900">{title}</span>
      <span className="block text-xs text-gray-500 mt-0.5">{help}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900">{addon ? `Edit ${addon.name}` : 'New add-on'}</h3>
          <button type="button" onClick={onClose} disabled={busy} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Name</span>
            <input value={f.name} onChange={(e) => set('name', e.target.value)} className={cls('name')} placeholder="College website" />
            <Err k="name" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Short description</span>
            <input value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} className={cls('description')} />
            <Err k="description" />
          </label>

          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1">What it gives</span>
            <div className="grid grid-cols-2 gap-2">
              <Kind value="feature" title="A feature" help="Unlocks one feature the plan doesn't have." />
              <Kind value="students" title="More students" help="Raises the student limit per unit." />
            </div>
            {locked && <p className="text-xs text-gray-500 mt-1.5">Colleges have this add-on, so only its name, description, price and status can change.</p>}
          </div>

          {f.kind === 'feature' ? (
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Feature</span>
              <select value={f.feature} disabled={locked} onChange={(e) => set('feature', e.target.value)} className={cls('feature')}>
                <option value="">Choose…</option>
                {features.map((ft) => <option key={ft.key} value={ft.key}>{ft.label}{ft.coming_soon ? ' (coming soon)' : ''}</option>)}
              </select>
              <Err k="feature" />
            </label>
          ) : (
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Students per unit</span>
              <input type="number" min="1" value={f.students_per_unit} disabled={locked} onChange={(e) => set('students_per_unit', e.target.value)} className={cls('students_per_unit')} />
              <Err k="students_per_unit" />
            </label>
          )}

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Price per month (Rs.){f.kind === 'students' ? ', per unit' : ''}</span>
            <input type="number" min="0" value={f.price} onChange={(e) => set('price', e.target.value)} className={cls('price')} />
            {errors.price ? <Err k="price" /> : addon && <p className="text-xs text-gray-500 mt-1">A new price applies to colleges that get this add-on from now on. Colleges that already have it keep their price.</p>}
          </label>

          <div className="rounded-xl bg-gray-50 p-4">
            <Check checked={f.is_active} onChange={(v) => set('is_active', v)} label="Active"
              help="Inactive add-ons stay with the colleges that have them but can't be given to new ones." />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={save} disabled={busy || !f.name.trim()}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Saving…' : addon ? 'Save add-on' : 'Create add-on'}
          </button>
        </div>
      </div>
    </div>
  );
}
