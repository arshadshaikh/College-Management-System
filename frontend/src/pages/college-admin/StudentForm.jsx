import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';

const EMPTY = { name: '', cnic_no: '', email: '', phone: '', password: '', password_confirmation: '', father_name: '', gender: 'male', date_of_birth: '' };

export default function StudentForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => {
    const v = key === 'cnic_no' ? e.target.value.replace(/\D/g, '').slice(0, 13) : e.target.value;
    setForm((f) => ({ ...f, [key]: v }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await api.post('/students', form);
      toast.success('Student created.');
      navigate(`${PORTAL}/students`);
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors ?? {});
        toast.error('Please fix the highlighted fields.');
      }
    } finally { setSaving(false); }
  };

  const cls = (er) => `w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${er ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to={`${PORTAL}/students`} className="text-sm text-gray-500 hover:underline">← Students</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Create Student</h1>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <F label="Full Name" err={errors.name} req>
          <input value={form.name} onChange={set('name')} className={cls(errors.name)} />
        </F>
        <div className="grid grid-cols-2 gap-4">
          <F label="CNIC (13 digits)" err={errors.cnic_no} req>
            <input value={form.cnic_no} onChange={set('cnic_no')} maxLength={13} placeholder="0000000000000" className={`${cls(errors.cnic_no)} font-mono tracking-widest`} />
          </F>
          <F label="Father Name" err={errors.father_name} req>
            <input value={form.father_name} onChange={set('father_name')} className={cls(errors.father_name)} />
          </F>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="Email" err={errors.email}>
            <input type="email" value={form.email} onChange={set('email')} className={cls(errors.email)} />
          </F>
          <F label="Phone" err={errors.phone}>
            <input value={form.phone} onChange={set('phone')} className={cls(errors.phone)} />
          </F>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="Gender" err={errors.gender} req>
            <select value={form.gender} onChange={set('gender')} className={cls(errors.gender)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </F>
          <F label="Date of Birth" err={errors.date_of_birth} req>
            <input type="date" value={form.date_of_birth} onChange={set('date_of_birth')} className={cls(errors.date_of_birth)} />
          </F>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="Password" err={errors.password} req>
            <input type="password" value={form.password} onChange={set('password')} className={cls(errors.password)} />
          </F>
          <F label="Confirm Password" req>
            <input type="password" value={form.password_confirmation} onChange={set('password_confirmation')} className={cls()} />
          </F>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Student'}
          </button>
          <Link to={`${PORTAL}/students`} className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function F({ label, err, req, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label} {req && <span className="text-red-500">*</span>}</label>
      {children}
      {err && <p className="text-xs text-red-600 mt-1">{err[0]}</p>}
    </div>
  );
}