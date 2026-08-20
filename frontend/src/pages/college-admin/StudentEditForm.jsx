import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';

export default function StudentEditForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/students/${id}`).then(({ data }) => {
      const p = data.student_profile ?? data.studentProfile ?? {};
      setForm({
        name: data.name ?? '', email: data.email ?? '', phone: data.phone ?? '',
        father_name: p.father_name ?? '', gender: p.gender ?? 'male',
        date_of_birth: p.date_of_birth ? p.date_of_birth.slice(0, 10) : '',
        password: '', password_confirmation: '',
      });
    }).catch(() => toast.error('Could not load student.'));
  }, [id]);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((er) => ({ ...er, [k]: undefined })); };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const payload = { ...form };
    if (!payload.password) { delete payload.password; delete payload.password_confirmation; }
    try {
      await api.put(`/students/${id}`, payload);
      toast.success('Student updated.');
      navigate(`${PORTAL}/students/${id}`);
    } catch (err) {
      if (err.response?.status === 422) { setErrors(err.response.data.errors ?? {}); toast.error('Please fix the highlighted fields.'); }
    } finally { setSaving(false); }
  };

  if (!form) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const cls = (er) => `w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${er ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to={`${PORTAL}/students/${id}`} className="text-sm text-gray-500 hover:underline">← Back</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Edit Student</h1>
      </div>
      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <F label="Full Name" err={errors.name}><input value={form.name} onChange={set('name')} className={cls(errors.name)} /></F>
        <div className="grid grid-cols-2 gap-4">
          <F label="Email" err={errors.email}><input type="email" value={form.email} onChange={set('email')} className={cls(errors.email)} /></F>
          <F label="Phone" err={errors.phone}><input value={form.phone} onChange={set('phone')} className={cls(errors.phone)} /></F>
        </div>
        <F label="Father Name" err={errors.father_name}><input value={form.father_name} onChange={set('father_name')} className={cls(errors.father_name)} /></F>
        <div className="grid grid-cols-2 gap-4">
          <F label="Gender" err={errors.gender}>
            <select value={form.gender} onChange={set('gender')} className={cls(errors.gender)}>
              <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
            </select>
          </F>
          <F label="Date of Birth" err={errors.date_of_birth}><input type="date" value={form.date_of_birth} onChange={set('date_of_birth')} className={cls(errors.date_of_birth)} /></F>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="New Password (optional)" err={errors.password}><input type="password" value={form.password} onChange={set('password')} className={cls(errors.password)} /></F>
          <F label="Confirm New Password"><input type="password" value={form.password_confirmation} onChange={set('password_confirmation')} className={cls()} /></F>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving…' : 'Update Student'}</button>
          <Link to={`${PORTAL}/students/${id}`} className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

function F({ label, err, children }) {
  return (<div><label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>{children}{err && <p className="text-xs text-red-600 mt-1">{err[0]}</p>}</div>);
}