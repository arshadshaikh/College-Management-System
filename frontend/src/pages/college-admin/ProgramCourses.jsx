import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';
import { useAuth } from '../../context/AuthContext';

// Courses (subjects) of a program, one tab per semester. Used by the timetable.
const EMPTY = { code: '', title: '', credit_hours: '' };

export default function ProgramCourses() {
  const { id } = useParams();
  const { hasPrv } = useAuth();
  const canAdd = hasPrv('courses.store');
  const canEdit = hasPrv('courses.update');
  const canDelete = hasPrv('courses.destroy');

  const [program, setProgram] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [semester, setSemester] = useState(1);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/programs/${id}/courses`);
      setProgram(data.program);
      setCourses(data.courses ?? []);
    } catch {
      setProgram(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm(EMPTY); setEditingId(null); setErrors({}); };

  const pickSemester = (n) => { setSemester(n); resetForm(); };

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setForm({ code: c.code, title: c.title, credit_hours: c.credit_hours ?? '' });
    setErrors({});
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const payload = {
      semester_no: semester,
      code: form.code,
      title: form.title,
      credit_hours: form.credit_hours === '' ? null : form.credit_hours,
    };
    try {
      if (editingId) {
        await api.put(`/courses/${editingId}`, payload);
        toast.success('Course updated.');
      } else {
        await api.post(`/programs/${id}/courses`, { ...payload, is_active: true });
        toast.success('Course added.');
      }
      resetForm();
      load();
    } catch (err) {
      if (err.response?.status === 422) setErrors(err.response.data.errors ?? {});
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c) => {
    try {
      await api.put(`/courses/${c.id}`, {
        semester_no: c.semester_no, code: c.code, title: c.title,
        credit_hours: c.credit_hours, is_active: !c.is_active,
      });
      load();
    } catch { /* api.js shows the error */ }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.code} ${c.title}?`)) return;
    try {
      await api.delete(`/courses/${c.id}`);
      toast.success('Course deleted.');
      if (editingId === c.id) resetForm();
      load();
    } catch (err) {
      if (err.response?.status === 422) toast.error(err.response.data.message);
    }
  };

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!program) return (
    <div className="py-20 text-center">
      <p className="text-gray-500 mb-4">Program not found.</p>
      <Link to={`${PORTAL}/programs`} className="text-indigo-600 hover:underline">Back to programs</Link>
    </div>
  );

  const semesters = Array.from({ length: Math.max(1, program.total_semesters || 1) }, (_, i) => i + 1);
  const list = courses.filter((c) => c.semester_no === semester);
  const credits = list.filter((c) => c.is_active).reduce((sum, c) => sum + Number(c.credit_hours || 0), 0);
  const fieldErr = (k) => errors[k]?.[0];
  const inputCls = (k) => `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
    fieldErr(k) ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to={`${PORTAL}/programs/${program.id}`} className="text-sm text-gray-500 hover:underline">← {program.name}</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Courses</h1>
        <p className="text-sm text-gray-500">The subjects taught in each semester. The timetable uses these.</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {semesters.map((n) => {
          const count = courses.filter((c) => c.semester_no === n).length;
          return (
            <button type="button" key={n} onClick={() => pickSemester(n)}
              className={`px-4 py-2 text-sm -mb-px border-b-2 ${n === semester
                ? 'border-indigo-600 text-indigo-700 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Semester {n}
              {count > 0 && <span className="ml-1 text-xs text-gray-400">({count})</span>}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        {list.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">No courses in semester {semester} yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="px-6 py-3 font-medium">Code</th>
                <th className="px-3 py-3 font-medium">Title</th>
                <th className="px-3 py-3 font-medium text-center">Credit Hrs</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((c) => (
                <tr key={c.id} className={editingId === c.id ? 'bg-indigo-50' : ''}>
                  <td className="px-6 py-3 font-mono text-gray-900">{c.code}</td>
                  <td className="px-3 py-3 text-gray-800">
                    {c.title}
                    {c.timetable_entries_count > 0 && (
                      <span className="block text-xs text-gray-400">{c.timetable_entries_count} class(es) on the timetable</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-gray-700">{c.credit_hours ?? '—'}</td>
                  <td className="px-3 py-3">
                    <button type="button" disabled={!canEdit} onClick={() => toggleActive(c)}
                      title={canEdit ? 'Click to change' : undefined}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active
                        ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-3 text-right whitespace-nowrap">
                    {canEdit && (
                      <button type="button" onClick={() => startEdit(c)}
                        className="px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded-lg">Edit</button>
                    )}
                    {canDelete && (
                      <button type="button" onClick={() => remove(c)}
                        className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg">Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 text-xs text-gray-500">
                <td className="px-6 py-2" colSpan={2}>{list.length} course(s)</td>
                <td className="px-3 py-2 text-center">{credits || '—'}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {(editingId ? canEdit : canAdd) && (
        <form onSubmit={submit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">
            {editingId ? 'Edit course' : `Add a course to semester ${semester}`}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
              <input value={form.code} onChange={set('code')} placeholder="CS-101" maxLength={30} className={inputCls('code')} />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
              <input value={form.title} onChange={set('title')} placeholder="Programming Fundamentals" className={inputCls('title')} />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Credit Hrs</label>
              <input type="number" min="0" max="20" step="0.5" value={form.credit_hours} onChange={set('credit_hours')} className={inputCls('credit_hours')} />
            </div>
          </div>
          {['code', 'title', 'credit_hours', 'semester_no'].map((k) => fieldErr(k) && (
            <p key={k} className="text-xs text-red-600">{fieldErr(k)}</p>
          ))}
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add course'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
