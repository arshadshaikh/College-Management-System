import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../../api';

// One row per active document type (scope student_application).
// File rules (types, size) come from the super-admin's Document Types settings.

const STATUS = {
  pending:  { text: 'Uploaded · awaiting verification', cls: 'text-amber-700' },
  verified: { text: 'Verified',                         cls: 'text-green-700' },
  rejected: { text: 'Rejected · please upload again',   cls: 'text-red-600' },
};

// "image/jpeg,image/png,application/pdf" -> "JPG, PNG, PDF"
const niceTypes = (mimes) =>
  mimes.split(',').map((m) => m.trim().split('/')[1]?.replace('jpeg', 'jpg').toUpperCase()).filter(Boolean).join(', ');

function DocRow({ type, doc, required, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const upload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    // Quick client-side checks; the server checks again with the same rules.
    const allowed = type.allowed_mime_types.split(',').map((m) => m.trim());
    if (!allowed.includes(file.type)) {
      setError(`Allowed file types: ${niceTypes(type.allowed_mime_types)}.`);
      return;
    }
    if (file.size > type.max_size_kb * 1024) {
      setError(`File is larger than ${Math.round(type.max_size_kb / 1024 * 10) / 10} MB.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('document_type', type.slug);
      fd.append('file', file);
      const { data } = await api.post('/profile/documents', fd);
      onSaved(data);
      toast.success(data.message ?? 'Uploaded.');
    } catch (err) {
      if (err.response?.status === 422) {
        const errs = err.response.data.errors;
        setError(errs?.file?.[0] ?? errs?.document_type?.[0] ?? err.response.data.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const view = async () => {
    try {
      const res = await api.get(`/profile/documents/${doc.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      toast.error('Could not open the file.');
    }
  };

  const status = doc ? STATUS[doc.verification_status] ?? STATUS.pending : null;
  const locked = doc?.verification_status === 'verified';
  const inputId = `doc-${type.slug}`;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border border-gray-200 rounded-lg p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">
          {type.name}{' '}
          {required
            ? <span className="text-xs font-normal text-red-600">Required</span>
            : <span className="text-xs font-normal text-gray-400">Optional</span>}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {niceTypes(type.allowed_mime_types)} · max {Math.round(type.max_size_kb / 1024 * 10) / 10} MB
        </p>
        {doc && (
          <p className={`text-xs mt-1 ${status.cls}`}>
            {status.text} · <span className="text-gray-600 break-all">{doc.original_name}</span>
            {doc.verification_notes && <span className="block text-gray-600">Note: {doc.verification_notes}</span>}
          </p>
        )}
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>

      <div className="flex gap-2 shrink-0">
        {doc && (
          <button type="button" onClick={view}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs hover:bg-gray-50">
            View
          </button>
        )}
        {!locked && (
          <label htmlFor={inputId}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              busy ? 'bg-gray-200 text-gray-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}>
            {busy ? 'Uploading…' : doc ? 'Replace' : 'Upload'}
            <input id={inputId} type="file" className="hidden" disabled={busy}
              accept={type.allowed_mime_types} onChange={upload} />
          </label>
        )}
      </div>
    </div>
  );
}

export default function DocumentsSection({ data, onSaved }) {
  const docs = data.documents ?? [];
  // Required = mandatory type, or the certificate of a level the college requires.
  const levelDocs = (data.levels ?? []).filter((l) => l.required).map((l) => l.document);
  const isRequired = (t) => t.is_mandatory || levelDocs.includes(t.slug);
  const types = [...(data.document_types ?? [])].sort((a, b) => Number(isRequired(b)) - Number(isRequired(a)));

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
        <p className="text-xs text-gray-500 mt-1">
          Upload clear scans or photos. These are kept in your profile and reused for every application.
        </p>
      </div>
      <div className="space-y-3">
        {types.map((t) => (
          <DocRow key={t.slug} type={t} required={isRequired(t)}
            doc={docs.find((d) => d.document_type === t.slug)} onSaved={onSaved} />
        ))}
      </div>
    </div>
  );
}
