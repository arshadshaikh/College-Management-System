import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';

export default function StudentImport() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const downloadTemplate = async () => {
    try {
      const res = await api.get('/students/import/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'students_template.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download template.');
    }
  };

  const submit = async () => {
    if (!file) { toast.error('Choose a file first.'); return; }
    setUploading(true);
    setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post('/students/import', fd);
      setResult(data);
      if (data.created > 0) toast.success(`${data.created} student${data.created > 1 ? 's' : ''} imported.`);
      if (data.created === 0 && data.skipped > 0) toast.error('No students imported — see errors below.');
    } catch (err) {
      if (err.response?.status === 422) {
        toast.error(err.response.data.message || 'Invalid file.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link to={`${PORTAL}/students`} className="text-sm text-gray-500 hover:underline">← Students</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Import Students</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <div className="text-sm text-gray-600 space-y-2">
          <p>Upload an Excel (.xlsx) or CSV file with student details. Each row becomes a student account.</p>
          <p>Start from the template so your columns match: <span className="font-medium">name, cnic_no, email, phone, father_name, gender, date_of_birth, password</span>.</p>
        </div>

        <button onClick={downloadTemplate}
          className="inline-flex items-center gap-2 px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Template
        </button>

        <div className="border-t border-gray-100 pt-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Choose file</label>
          <input type="file" accept=".xlsx,.xls,.csv"
            onChange={(e) => { setFile(e.target.files[0] || null); setResult(null); }}
            className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
        </div>

        <button onClick={submit} disabled={uploading || !file}
          className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {uploading ? 'Importing…' : 'Import'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Import Result</h2>
          <div className="flex gap-4">
            <div className="flex-1 bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{result.created}</div>
              <div className="text-xs text-green-600 mt-1">Created</div>
            </div>
            <div className="flex-1 bg-red-50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-700">{result.skipped}</div>
              <div className="text-xs text-red-600 mt-1">Skipped</div>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Rows that need fixing</h3>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <div key={i} className="flex gap-3 px-4 py-2.5 text-sm">
                    <span className="font-medium text-gray-500 shrink-0">Row {e.row}</span>
                    <span className="text-gray-700">{e.message}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">Fix these rows in your file and import again — the students already created won't be duplicated (their CNIC/email will show as taken).</p>
            </div>
          )}

          <Link to={`${PORTAL}/students`} className="inline-block text-sm text-indigo-600 hover:underline">View all students →</Link>
        </div>
      )}
    </div>
  );
}