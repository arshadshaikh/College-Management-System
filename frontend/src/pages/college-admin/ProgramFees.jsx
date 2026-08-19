import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';
import Toggle from '../../components/Toggle';

const FEE_TYPES = ['admission', 'semester', 'exam', 'library', 'sports', 'security_deposit', 'arrears', 'other'];

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { fee_type: 'admission', label: '', amount: '', semester_no: '', effective_from: today(), effective_to: '', is_active: true };

export default function ProgramFees() {
  const { id } = useParams();
  const [program, setProgram] = useState(null);
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/programs/${id}`);
      setProgram(data);
      setFees(data.fee_structures ?? data.feeStructures ?? data.fees ?? []);
    } catch { toast.error('Could not load program.'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const startEdit = (fee) => {
    setEditingId(fee.id);
    setForm({
      fee_type: fee.fee_type,
      label: fee.label ?? '',
      amount: fee.amount ?? '',
      semester_no: fee.semester_no ?? '',
      effective_from: (fee.effective_from ?? today()).slice(0, 10),
      effective_to: fee.effective_to ? fee.effective_to.slice(0, 10) : '',
      is_active: fee.is_active,
    });
    setErrors({});
  };

  const resetForm = () => { setEditingId(null); setForm(EMPTY); setErrors({}); };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const payload = {
      fee_type: form.fee_type,
      label: form.label,
      amount: Number(form.amount),
      semester_no: form.semester_no ? Number(form.semester_no) : null,
      effective_from: form.effective_from,
      effective_to: form.effective_to || null,
      is_active: form.is_active,
    };
    try {
      if (editingId) {
        await api.put(`/programs/${id}/fee-structures/${editingId}`, payload);
        toast.success('Fee updated.');
      } else {
        await api.post(`/programs/${id}/fee-structures`, payload);
        toast.success('Fee added.');
      }
      resetForm();
      await load();
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
        toast.error('Please fix the highlighted fields.');
      }
    } finally { setSaving(false); }
  };

  const remove = async (fee) => {
    if (!window.confirm(`Remove "${fee.label}" (Rs. ${fee.amount})?`)) return;
    try {
      await api.delete(`/programs/${id}/fee-structures/${fee.id}`);
      toast.success('Fee removed.');
      await load();
    } catch { /* interceptor toasts */ }
  };

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const inputCls = (err) => `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${err ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`;
  const label = (s) => s.replace(/_/g, ' ');

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to={`${PORTAL}/programs/${id}`} className="text-sm text-gray-500 hover:underline">← {program?.name}</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Fee Structures</h1>
      </div>

      {/* Existing fees */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Current Fees</h2>
        {fees.length === 0 ? (
          <p className="text-sm text-gray-400">No fees yet. Add one below.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {fees.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-gray-900">
                    {f.label} <span className="text-xs text-gray-400 capitalize">· {label(f.fee_type)}{f.semester_no ? ` · Sem ${f.semester_no}` : ''}</span>
                    {!f.is_active && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    Rs. {Number(f.amount).toLocaleString()}
                    {f.effective_from && ` · from ${f.effective_from.slice(0,10)}`}
                    {f.effective_to && ` to ${f.effective_to.slice(0,10)}`}
                  </div>
                </div>
                <div className="flex gap-3 text-sm">
                  <button onClick={() => startEdit(f)} className="text-indigo-600 hover:underline">Edit</button>
                  <button onClick={() => remove(f)} className="text-red-600 hover:underline">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / edit form */}
      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">{editingId ? 'Edit Fee' : 'Add Fee'}</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fee Type <span className="text-red-500">*</span></label>
            <select value={form.fee_type} onChange={set('fee_type')} className={inputCls(errors.fee_type)}>
              {FEE_TYPES.map((t) => <option key={t} value={t} className="capitalize">{label(t)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label <span className="text-red-500">*</span></label>
            <input type="text" value={form.label} onChange={set('label')} placeholder="e.g. Admission Fee" className={inputCls(errors.label)} />
            {errors.label && <p className="text-xs text-red-600 mt-1">{errors.label[0]}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.) <span className="text-red-500">*</span></label>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} className={inputCls(errors.amount)} />
            {errors.amount && <p className="text-xs text-red-600 mt-1">{errors.amount[0]}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester <span className="font-normal text-gray-400">(optional)</span></label>
            <input type="number" min="1" max="20" value={form.semester_no} onChange={set('semester_no')} placeholder="e.g. 1" className={inputCls(errors.semester_no)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Effective From <span className="text-red-500">*</span></label>
            <input type="date" value={form.effective_from} onChange={set('effective_from')} className={inputCls(errors.effective_from)} />
            {errors.effective_from && <p className="text-xs text-red-600 mt-1">{errors.effective_from[0]}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Effective To <span className="font-normal text-gray-400">(optional)</span></label>
            <input type="date" value={form.effective_to} onChange={set('effective_to')} className={inputCls(errors.effective_to)} />
            {errors.effective_to && <p className="text-xs text-red-600 mt-1">{errors.effective_to[0]}</p>}
          </div>
        </div>

        <Toggle checked={form.is_active} onChange={(on) => setForm((f) => ({ ...f, is_active: on }))} label="Active" />

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving…' : editingId ? 'Update Fee' : 'Add Fee'}
          </button>
          {editingId && <button type="button" onClick={resetForm} className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>}
        </div>
      </form>
    </div>
  );
}