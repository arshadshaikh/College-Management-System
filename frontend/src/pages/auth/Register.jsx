import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useAppConfig } from '../../context/AppConfigContext';
import AppIcon from '../../components/AppIcon';

const EMPTY = {
  name: '', father_name: '', cnic_no: '', phone: '', email: '',
  gender: '', date_of_birth: '', password: '', password_confirmation: '',
};

const input = 'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition';

export default function Register() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const appConfig = useAppConfig();

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrors({});

    if (!/^\d{13}$/.test(form.cnic_no)) {
      setErrors({ cnic_no: ['CNIC must be exactly 13 digits without dashes'] });
      return;
    }
    if (form.password !== form.password_confirmation) {
      setErrors({ password_confirmation: ['Passwords do not match'] });
      return;
    }

    setLoading(true);
    try {
      await api.post('/register', { ...form, email: form.email || null });
      // Sign in through the normal login flow so menus and privileges load.
      await login(form.cnic_no, form.password);
      toast.success('Account created. Please complete your admission profile.');
      navigate('/portal/my-profile');
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors || {});
        setError(err.response.data.message || 'Please fix the errors below.');
      } else {
        setError(err.response?.data?.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const Err = ({ k }) => errors[k] ? <p className="text-xs text-red-600 mt-1">{errors[k][0]}</p> : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
              <AppIcon className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{appConfig.name}</h1>
            <p className="text-gray-500 mt-1">Create your applicant account</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={set('name')} className={input} required />
                <Err k="name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Father's Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.father_name} onChange={set('father_name')} className={input} required />
                <Err k="father_name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNIC / B-Form Number <span className="text-red-500">*</span></label>
                <input type="text" maxLength={13} value={form.cnic_no}
                  onChange={(e) => setForm({ ...form, cnic_no: e.target.value.replace(/\D/g, '') })}
                  placeholder="0000000000000" className={`${input} tracking-widest`} required />
                <p className="text-xs text-gray-400 mt-1">13 digits without dashes. You will sign in with this.</p>
                <Err k="cnic_no" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number <span className="text-red-500">*</span></label>
                <input type="tel" maxLength={20} value={form.phone} onChange={set('phone')} placeholder="03001234567" className={input} required />
                <Err k="phone" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={set('email')} className={input} />
                <p className="text-xs text-gray-400 mt-1">Optional, used for password reset.</p>
                <Err k="email" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender <span className="text-red-500">*</span></label>
                <select value={form.gender} onChange={set('gender')} className={`${input} bg-white`} required>
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                <Err k="gender" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth <span className="text-red-500">*</span></label>
                <input type="date" value={form.date_of_birth} onChange={set('date_of_birth')} className={input} required />
                <Err k="date_of_birth" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-200">
              <div className="pt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                <input type="password" value={form.password} onChange={set('password')} className={input} required />
                <p className="text-xs text-gray-400 mt-1">At least 8 characters, with upper and lower case letters and a number.</p>
                <Err k="password" />
              </div>
              <div className="pt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password <span className="text-red-500">*</span></label>
                <input type="password" value={form.password_confirmation} onChange={set('password_confirmation')} className={input} required />
                <Err k="password_confirmation" />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 rounded-lg transition duration-200 cursor-pointer">
              {loading ? 'Creating account…' : 'Create Account'}
            </button>

            <p className="text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
