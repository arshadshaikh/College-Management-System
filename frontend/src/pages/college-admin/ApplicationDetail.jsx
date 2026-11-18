import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';
import { useAuth } from '../../context/AuthContext';
import ApplicantProfile from './ApplicantProfile';

const STATUS_STYLES = {
  submitted:    'bg-blue-50 text-blue-700',
  under_review: 'bg-amber-50 text-amber-700',
  returned:     'bg-orange-50 text-orange-700',
  shortlisted:  'bg-purple-50 text-purple-700',
  approved:     'bg-green-50 text-green-700',
  rejected:     'bg-red-50 text-red-700',
  withdrawn:    'bg-gray-100 text-gray-600',
};

const DOC_LABELS = {
  cnic: 'CNIC',
  matric_certificate: 'Matric Certificate',
  inter_certificate: 'Intermediate Certificate',
  photo: 'Photograph',
  domicile: 'Domicile',
  character_certificate: 'Character Certificate',
  other: 'Other',
};

export default function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPrv } = useAuth();

  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/applications/${id}`);
      setApp(data);
    } catch {
      setApp(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Documents live on the private disk — fetch as a blob with the auth
  // header, then trigger a browser download. A plain <a href> would 401.
//   const downloadDoc = async (doc) => {
//     try {
//       const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
//       const url = window.URL.createObjectURL(new Blob([res.data]));
//       const a = document.createElement('a');
//       a.href = url;
//       a.download = doc.original_name || 'document';
//       document.body.appendChild(a);
//       a.click();
//       a.remove();
//       window.URL.revokeObjectURL(url);
//     } catch {
//       toast.error('Could not download this document.');
//     }
//   };

  const downloadDoc = async (doc) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, {
        responseType: 'arraybuffer',
      });

      const blob = new Blob([res.data], {
        type: doc.mime_type || 'application/octet-stream',
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_name || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
      toast.error('Could not download this document.');
    }
  };

  const act = async (path, body, successMsg) => {
    setBusy(true);
    try {
      await api.post(`/applications/${id}/${path}`, body);
      toast.success(successMsg);
      setShowReject(false);
      setReason('');
      await load();
    } catch (err) {
      const msg = err.response?.data?.message;
      if (msg) toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading…</div>;
  }

  if (!app) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500 mb-4">Application not found.</p>
        <Link to={`${PORTAL}/applications`} className="text-indigo-600 hover:underline">Back to applications</Link>
      </div>
    );
  }

  const canReview = ['submitted', 'under_review'].includes(app.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to={`${PORTAL}/applications`} className="text-sm text-gray-500 hover:underline">← Applications</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{app.application_no}</h1>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize ${
          STATUS_STYLES[app.status] ?? 'bg-gray-100 text-gray-600'
        }`}>
          {app.status.replace('_', ' ')}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Student */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Student</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Name"        value={app.student?.name} />
            <Row label="CNIC"        value={app.student?.cnic_no} />
            <Row label="Email"       value={app.student?.email} />
            <Row label="Phone"       value={app.student?.phone} />
            <Row label="Father Name" value={app.student?.student_profile?.father_name} />
            <Row label="Gender"      value={app.student?.student_profile?.gender} />
          </dl>
        </div>

        {/* Program */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Program</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Program"   value={app.program?.name} />
            <Row label="Code"      value={app.program?.code} />
            <Row label="Level"     value={app.program?.degree_level} />
            {(app.shift_options?.length > 1 || (app.shift && app.shift !== 'morning')) && (
              <Row label="Shift" value={<ShiftPicker app={app} canChange={hasPrv('applications.shift')} onChanged={load} />} />
            )}
            <Row label="Semester"  value={app.semester_no} />
            <Row label="Year"      value={app.admission_year} />
            <Row label="Submitted" value={new Date(app.created_at).toLocaleString()} />
          </dl>
        </div>
      </div>

      <ApplicantProfile app={app} onDownload={downloadDoc} />

      {/* Documents */}
      <div className={`bg-white rounded-xl shadow-sm p-6 ${app.documents?.length ? '' : 'hidden'}`}>
        <h2 className="font-semibold text-gray-900 mb-4">Application Documents</h2>
        {app.documents?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {app.documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900">
                    {DOC_LABELS[doc.document_type] ?? doc.document_type}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {doc.original_name} · {(doc.file_size / 1024).toFixed(0)} KB
                  </div>
                </div>
                <button
                  onClick={() => downloadDoc(doc)}
                  className="ml-4 shrink-0 text-sm text-indigo-600 hover:underline"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No documents uploaded.</p>
        )}
      </div>

      {/* Review outcome, if already decided */}
      {app.rejection_reason && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="text-sm font-medium text-red-800">Rejection reason</div>
          <p className="text-sm text-red-700 mt-1">{app.rejection_reason}</p>
        </div>
      )}

      <ReturnForCorrection app={app} onDone={load} />
      
      {/* Actions */}
      {canReview && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Review</h2>

          {!showReject ? (
            <div className="flex flex-wrap gap-3">
              {app.status === 'submitted' && hasPrv('applications.review') && (
                <button
                  disabled={busy}
                  onClick={() => act('review', {}, 'Marked as under review.')}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
                >
                  Mark Under Review
                </button>
              )}
              {hasPrv('applications.approve') && (
                <button
                  disabled={busy}
                  onClick={() => act('approve', {}, 'Application approved. Admission challan generated.')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
              )}
              {hasPrv('applications.reject') && (
                <button
                  disabled={busy}
                  onClick={() => setShowReject(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Reason for rejection (required)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="flex gap-3">
                <button
                  disabled={busy || !reason.trim()}
                  onClick={() => act('reject', { reason }, 'Application rejected.')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
                <button
                  onClick={() => { setShowReject(false); setReason(''); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Shows the application's shift; admins with applications.shift can move the student.
function ShiftPicker({ app, canChange, onChanged }) {
  const [saving, setSaving] = useState(false);
  const options = app.shift_options ?? [];
  const label = options.find((o) => o.key === app.shift)?.label ?? app.shift;
  const closed = ['rejected', 'withdrawn'].includes(app.status);

  if (!canChange || closed || options.length < 2) return label;

  const change = async (e) => {
    const shift = e.target.value;
    if (shift === app.shift) return;
    setSaving(true);
    try {
      await api.put(`/applications/${app.id}/shift`, { shift });
      toast.success('Shift updated.');
      onChanged();
    } catch { /* api.js shows the error */ }
    finally { setSaving(false); }
  };

  return (
    <select value={app.shift} onChange={change} disabled={saving}
      className="px-2 py-1 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
      {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      {!options.some((o) => o.key === app.shift) && <option value={app.shift}>{label} (not running)</option>}
    </select>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 text-right capitalize">{value || '—'}</dd>
    </div>
  );
}

const NoteBox = 'textarea'; // a plain multi-line text box

function ReturnForCorrection({ app, onDone }) {
  const { hasPrv } = useAuth();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Already returned: show the note the applicant was given.
  if (app.status === 'returned') {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <div className="text-sm font-medium text-orange-800">Returned to applicant for correction</div>
        <p className="text-sm text-orange-700 mt-1 whitespace-pre-line">{app.correction_note}</p>
        <p className="text-xs text-orange-600 mt-2">The applicant can edit their profile and resubmit.</p>
      </div>
    );
  }

  const canReturn = ['submitted', 'under_review', 'shortlisted'].includes(app.status)
    && hasPrv('applications.return');
  if (!canReturn) return null;

  const send = async () => {
    setBusy(true);
    try {
      await api.post(`/applications/${app.id}/return`, { note });
      toast.success('Returned to the applicant for correction.');
      setOpen(false);
      setNote('');
      await onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not return the application.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="font-semibold text-gray-900 mb-1">Needs a correction?</h2>
      <p className="text-sm text-gray-500 mb-4">
        Send it back with a note. The applicant's profile unlocks so they can fix it and resubmit.
      </p>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
        >
          Return for Correction
        </button>
      ) : (
        <div className="space-y-3">
          <NoteBox
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="What should the applicant fix? e.g. Matric marks don't match the uploaded certificate."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <div className="flex gap-3">
            <button
              disabled={busy || !note.trim()}
              onClick={send}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
            >
              Send Back
            </button>
            <button
              onClick={() => { setOpen(false); setNote(''); }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}