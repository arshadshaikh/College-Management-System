import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../../api';

// One document slot: thumbnail, status, Preview / Replace / Remove, drag & drop upload.
// File rules (types, size) come from the super admin's Document Types.

const FileInput = 'input';   // a hidden file picker

// Shows an image from a blob URL as a CSS background (no extra request).
const Shot = ({ url, className }) => (
  <div className={`bg-center bg-no-repeat ${className}`} style={{ backgroundImage: `url(${url})` }} />
);

// Save a blob URL under the original file name.
const saveAs = (url, name) => {
  const a = document.createElement('a');
  a.href = url; a.download = name || 'document';
  document.body.appendChild(a); a.click(); a.remove();
};

const STATUS = {
  pending:  { text: 'Awaiting verification', cls: 'bg-amber-50 text-amber-700' },
  verified: { text: 'Verified',              cls: 'bg-green-50 text-green-700' },
  rejected: { text: 'Rejected, upload again', cls: 'bg-red-50 text-red-700' },
};

// "image/jpeg,image/png,application/pdf" -> "JPG, PNG, PDF"
export const niceTypes = (mimes = '') =>
  mimes.split(',').map((m) => m.trim().split('/')[1]?.replace('jpeg', 'jpg').toUpperCase()).filter(Boolean).join(', ');

const mb = (kb) => `${Math.round((kb / 1024) * 10) / 10} MB`;
const size = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const isImage = (doc) => doc?.mime_type?.startsWith('image/');

// Fetch a profile document as a blob URL (the download route needs the auth header).
async function fetchBlobUrl(doc) {
  const res = await api.get(`/profile/documents/${doc.id}/download`, { responseType: 'arraybuffer' });
  return URL.createObjectURL(new Blob([res.data], { type: doc.mime_type || 'application/octet-stream' }));
}

function PreviewModal({ doc, title, onClose }) {
  const [url, setUrl] = useState(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    let alive = true;
    let made = null;
    fetchBlobUrl(doc)
      .then((u) => { made = u; if (alive) setUrl(u); })
      .catch(() => { toast.error('Could not open the file.'); closeRef.current(); });
    const esc = (e) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', esc);
    return () => { alive = false; window.removeEventListener('keydown', esc); if (made) URL.revokeObjectURL(made); };
  }, [doc.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{title}</p>
            <p className="text-xs text-gray-500 truncate">{doc.original_name} · {size(doc.file_size)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {url && (
              <button type="button" onClick={() => saveAs(url, doc.original_name)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-gray-50">
                Download
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close"
              className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 text-xl leading-none">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center p-4 min-h-[50vh]">
          {!url ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : isImage(doc) ? (
            <Shot url={url} className="w-full h-[75vh] bg-contain" />
          ) : (
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">PDF files open in your browser's PDF viewer.</p>
              <button type="button" onClick={() => window.open(url, '_blank')}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                Open PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Thumb({ doc }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!isImage(doc)) { setUrl(null); return; }
    let alive = true;
    let made = null;
    fetchBlobUrl(doc).then((u) => { made = u; if (alive) setUrl(u); }).catch(() => {});
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
  }, [doc?.id, doc?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!doc) {
    return (
      <div className="w-12 h-12 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-lg">
        ↑
      </div>
    );
  }
  if (url) return <Shot url={url} className="w-12 h-12 rounded-lg bg-cover border border-gray-200" />;
  return (
    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-[10px] font-bold ${
      isImage(doc) ? 'bg-gray-100 text-gray-400' : 'bg-red-50 text-red-600'
    }`}>
      {isImage(doc) ? 'IMG' : 'PDF'}
    </div>
  );
}

/**
 * type     = document type ({ slug, name, allowed_mime_types, max_size_kb })
 * doc      = the uploaded document or undefined
 * required = show the Required pill
 * locked   = profile locked (view only)
 * onSaved  = receives the API payload after upload / remove
 */
export default function DocumentCard({ type, doc, required, locked = false, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drag, setDrag] = useState(false);
  const picker = useRef(null);

  const verified = doc?.verification_status === 'verified';
  const canEdit = !locked && !verified;
  const status = doc ? STATUS[doc.verification_status] ?? STATUS.pending : null;

  const upload = async (file) => {
    if (!file) return;
    const allowed = (type.allowed_mime_types || '').split(',').map((m) => m.trim());
    if (!allowed.includes(file.type)) { setError(`Allowed file types: ${niceTypes(type.allowed_mime_types)}.`); return; }
    if (file.size > type.max_size_kb * 1024) { setError(`File is larger than ${mb(type.max_size_kb)}.`); return; }

    setBusy(true); setError(null); setProgress(0);
    try {
      const fd = new FormData();
      fd.append('document_type', type.slug);
      fd.append('file', file);
      const { data } = await api.post('/profile/documents', fd, {
        onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded * 100) / e.total)),
      });
      onSaved(data);
      toast.success(data.message ?? 'Uploaded.');
    } catch (err) {
      const errs = err.response?.data?.errors;
      setError(errs?.file?.[0] ?? errs?.document_type?.[0] ?? err.response?.data?.message ?? 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const { data } = await api.delete(`/profile/documents/${doc.id}`);
      onSaved(data);
      toast.success(data.message ?? 'Removed.');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not remove the file.');
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  const dropProps = canEdit ? {
    onDragOver: (e) => { e.preventDefault(); setDrag(true); },
    onDragLeave: () => setDrag(false),
    onDrop: (e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]); },
  } : {};

  return (
    <div {...dropProps}
      className={`relative rounded-lg border p-3 transition ${
        drag ? 'border-indigo-400 bg-indigo-50' : confirm ? 'border-red-200 bg-red-50/40' : 'border-gray-200 bg-white'
      }`}>
      <div className="flex items-center gap-3">
        <button type="button" disabled={!doc} onClick={() => setPreview(true)} className="shrink-0 disabled:cursor-default"
          title={doc ? 'Preview' : ''}>
          <Thumb doc={doc} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">
            {type.name}{' '}
            {required
              ? <span className="ml-1 px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-semibold uppercase">Required</span>
              : <span className="ml-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-semibold uppercase">Optional</span>}
          </p>
          {doc ? (
            <p className="text-xs mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`px-1.5 py-0.5 rounded ${status.cls}`}>{status.text}</span>
              <span className="text-gray-500 break-all">{doc.original_name} · {size(doc.file_size)}</span>
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              {canEdit ? 'Drop a file here or choose Upload. ' : ''}{niceTypes(type.allowed_mime_types)} · max {mb(type.max_size_kb)}
            </p>
          )}
          {doc?.verification_notes && <p className="text-xs text-gray-600 mt-1">Note: {doc.verification_notes}</p>}
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {confirm ? (
            <>
              <span className="text-xs text-red-700 mr-1 hidden sm:inline">Remove this file?</span>
              <button type="button" onClick={() => setConfirm(false)} disabled={busy}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs hover:bg-white">Cancel</button>
              <button type="button" onClick={remove} disabled={busy}
                className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                {busy ? 'Removing…' : 'Remove'}
              </button>
            </>
          ) : (
            <>
              {doc && (
                <button type="button" onClick={() => setPreview(true)}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs hover:bg-gray-50">Preview</button>
              )}
              {canEdit && (
                <button type="button" onClick={() => picker.current?.click()} disabled={busy}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-60 ${
                    doc ? 'border border-gray-300 hover:bg-gray-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}>
                  {busy ? `Uploading ${progress}%` : doc ? 'Replace' : 'Upload'}
                </button>
              )}
              {canEdit && doc && (
                <button type="button" onClick={() => setConfirm(true)} disabled={busy} title="Remove"
                  aria-label={`Remove ${type.name}`}
                  className="w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 text-lg leading-none">
                  ×
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {busy && progress > 0 && progress < 100 && (
        <div className="absolute left-3 right-3 bottom-1 h-1 bg-gray-100 rounded">
          <div className="h-1 bg-indigo-500 rounded" style={{ width: `${progress}%` }} />
        </div>
      )}

      <FileInput ref={picker} type="file" className="hidden" accept={type.allowed_mime_types}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; upload(f); }} />

      {preview && doc && <PreviewModal doc={doc} title={type.name} onClose={() => setPreview(false)} />}
    </div>
  );
}