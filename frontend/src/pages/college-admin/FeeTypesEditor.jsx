import { withKeys } from './TimetableSettings';

// Settings → Fees & Challans: this college's fee types (Tuition, Exam, Hostel, Transcript ...).
// The list order is the dropdown order. A type used by fee lines cannot be removed, only switched off.
export default function FeeTypesEditor({ feeTypes, setFeeTypes, errors }) {
  const err = (key) => errors[key]?.[0];
  const cls = (key) => `flex-1 min-w-0 px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
    err(key) ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`;

  const update = (k, field, value) =>
    setFeeTypes((list) => list.map((t) => (t._k === k ? { ...t, [field]: value } : t)));

  const move = (i, dir) => setFeeTypes((list) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const remove = (k) => setFeeTypes((list) => list.filter((t) => t._k !== k));

  const add = () => setFeeTypes((list) => [...list, ...withKeys([{ id: null, name: '', is_active: true, in_use: 0 }])]);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Fee Types</label>
      <p className="text-xs text-gray-500 mb-2">
        The kinds of fees students pay, such as Tuition, Exam, Hostel, Transport, Transcript or Fine.
        They appear in this order in the Fee Type dropdown of every program.
      </p>

      {feeTypes.length === 0 ? (
        <p className="text-sm text-gray-400 border border-dashed border-gray-300 rounded-lg px-4 py-6 text-center">
          No fee types yet. Add one to start setting program fees.
        </p>
      ) : (
        <div className="space-y-2">
          {feeTypes.map((t, i) => (
            <div key={t._k}>
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${t.is_active ? 'bg-gray-50' : 'bg-gray-50 opacity-60'}`}>
                <div className="flex flex-col">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                    className="text-xs leading-none text-gray-500 hover:text-gray-900 disabled:opacity-30" aria-label="Move up">▲</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === feeTypes.length - 1}
                    className="text-xs leading-none text-gray-500 hover:text-gray-900 disabled:opacity-30" aria-label="Move down">▼</button>
                </div>
                <input type="text" value={t.name} maxLength={100} placeholder="e.g. Hostel"
                  onChange={(e) => update(t._k, 'name', e.target.value)}
                  className={cls(`fee_types.${i}.name`)} />
                <label className="flex items-center gap-1.5 text-sm text-gray-600 shrink-0">
                  <input type="checkbox" className="h-4 w-4"
                    checked={!!t.is_active} onChange={(e) => update(t._k, 'is_active', e.target.checked)} />
                  Active
                </label>
                {t.in_use > 0 ? (
                  <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700"
                    title="Fee lines use this type, so it can only be switched off.">
                    {t.in_use} fee{t.in_use > 1 ? 's' : ''}
                  </span>
                ) : (
                  <button type="button" onClick={() => remove(t._k)}
                    className="shrink-0 px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg">Remove</button>
                )}
              </div>
              {err(`fee_types.${i}.name`) && (
                <p className="text-xs text-red-600 mt-1 ml-1">{err(`fee_types.${i}.name`)}</p>
              )}
            </div>
          ))}
        </div>
      )}
      {err('fee_types') && <p className="text-xs text-red-600 mt-1">{err('fee_types')}</p>}

      <button type="button" onClick={add}
        className="mt-3 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">+ Add fee type</button>
    </div>
  );
}
