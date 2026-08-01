import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';

export default function ForgotPassword() {
  const [cnic, setCnic] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cnic.length !== 13 || !/^\d{13}$/.test(cnic)) {
      toast.error('CNIC must be exactly 13 digits');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/forgot-password', { cnic_no: cnic });
      setSent(true);
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Forgot Password</h1>
            <p className="text-gray-500 mt-1">Enter your CNIC to receive a reset link via email</p>
          </div>

          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-green-100 rounded-full mx-auto flex items-center justify-center">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium">Check your email</p>
              <p className="text-sm text-gray-500">A password reset link has been sent to the email registered with CNIC <strong className="text-gray-700 font-mono">{cnic}</strong></p>
              <p className="text-xs text-gray-400">Didn't receive it? Check your spam folder or try again.</p>
              <div className="flex flex-col gap-2 pt-2">
                <button onClick={() => setSent(false)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition">
                  Try again
                </button>
                <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700 transition">
                  Back to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNIC Number</label>
                  <input
                    type="text"
                    maxLength={13}
                    value={cnic}
                    onChange={(e) => setCnic(e.target.value.replace(/\D/g, ''))}
                    placeholder="0000000000000"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-lg tracking-widest font-mono"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">13 digits without dashes</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 rounded-lg transition duration-200 cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Sending...
                    </span>
                  ) : 'Send Reset Link'}
                </button>
              </form>

              <div className="text-center mt-6">
                <Link to="/login" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition">
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
