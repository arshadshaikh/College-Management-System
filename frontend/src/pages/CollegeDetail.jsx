import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import HistoryTimeline from '../components/HistoryTimeline';

const STATUS_STYLES = {
  pending:   'bg-amber-50 text-amber-700',
  approved:  'bg-green-50 text-green-700',
  rejected:  'bg-red-50 text-red-700',
  suspended: 'bg-gray-100 text-gray-600',
};

export default function CollegeDetail() {
  const { id } = useParams();
  const { hasPrv } = useAuth();

  const [college, setCollege] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'reject' | 'suspend' | null
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/colleges/${id}`);
      setCollege(data);
    } catch {
      setCollege(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const act = async (path, body, successMsg) => {
    setBusy(true);
    try {
      await api.post(`/colleges/${id}/${path}`, body);
      toast.success(successMsg);
      setPendingAction(null);
      setReason('');
      await load();
    } catch (err) {
      const msg = err.response?.data?.message;
      if (msg) toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const downloadDoc = async (doc) => {
    try {
      const res = await api.get(`/college-documents/${doc.id}/download`, { responseType: 'arraybuffer' });
      const type = res.headers['content-type'] || 'application/octet-stream';
      const blob = new Blob([res.data], { type });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.original_name || 'document';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error('Could not download document.'); }
  };

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading…</div>;
  }

  if (!college) {
    return (
      <div className="py-20 text-center">
        <p className="text-gray-500 mb-4">College not found.</p>
        <Link to="/colleges" className="text-indigo-600 hover:underline">Back to colleges</Link>
      </div>
    );
  }

  const canApprove = ['pending', 'rejected'].includes(college.status) && hasPrv('colleges.approve');
  // const canApprove = college.status === 'pending' && hasPrv('colleges.approve');
  const canReject  = college.status === 'pending' && hasPrv('colleges.reject');
  const canSuspend = college.status === 'approved' && hasPrv('colleges.suspend');
  const canReinstate = college.status === 'suspended' && hasPrv('colleges.reinstate');
  const hasActions = canApprove || canReject || canSuspend || canReinstate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/colleges" className="text-sm text-gray-500 hover:underline">← Colleges</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{college.name}</h1>
          <p className="text-sm text-gray-500">{college.slug}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize ${
          STATUS_STYLES[college.status] ?? 'bg-gray-100 text-gray-600'
        }`}>
          {college.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* College info */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">College Info</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Name"     value={college.name} />
            <Row label="Slug"     value={college.slug} />
            <Row label="Email"    value={college.email} />
            <Row label="Phone"    value={college.phone} />
            <Row label="Address"  value={college.address} />
            <Row label="City"     value={college.city} />
            <Row label="Province" value={college.province} />
          </dl>
        </div>

        {/* Status info */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Status</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Status"       value={college.status} />
            <Row label="Registered"  value={new Date(college.created_at).toLocaleString()} />
            <Row label="Approved At" value={college.approved_at ? new Date(college.approved_at).toLocaleString() : null} />
            <Row label="Admin Users" value={college.users?.length ?? 0} />
          </dl>
        </div>
      </div>

      {/* Rejection / suspension reason, if any */}
      {college.rejection_reason && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="text-sm font-medium text-red-800">
            {college.status === 'suspended' ? 'Suspension reason' : 'Rejection reason'}
          </div>
          <p className="text-sm text-red-700 mt-1">{college.rejection_reason}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Registration Documents</h2>
        {college.documents?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {college.documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3">  
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900">{doc.document_name}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {doc.original_name} · {(doc.file_size / 1024).toFixed(0)} KB
                  </div>
                </div>
                <button onClick={() => downloadDoc(doc)} className="ml-4 shrink-0 text-sm text-indigo-600 hover:underline">
                  Download
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No documents were uploaded with this registration.</p>
        )}
      </div>

      {/* Actions */}
      {hasActions && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>

          {!pendingAction ? (
            <div className="flex flex-wrap gap-3">
              {canApprove && (
                <button
                  disabled={busy}
                  onClick={() => act('approve', {}, `College '${college.name}' approved and initialized successfully.`)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  Approve
                </button>
              )}
              {canReinstate && (
                <button disabled={busy}
                  onClick={() => act('reinstate', {}, `College '${college.name}' reinstated.`)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                  Reinstate
                </button>
              )}
              {canReject && (
                <button
                  disabled={busy}
                  onClick={() => setPendingAction('reject')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              )}
              {canSuspend && (
                <button
                  disabled={busy}
                  onClick={() => setPendingAction('suspend')}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
                >
                  Suspend
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder={`Reason for ${pendingAction} (required)`}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 ${
                  pendingAction === 'suspend' ? 'focus:ring-amber-500' : 'focus:ring-red-500'
                }`}
              />
              <div className="flex gap-3">
                <button
                  disabled={busy || !reason.trim()}
                  onClick={() => act(
                    pendingAction,
                    { reason },
                    pendingAction === 'suspend'
                      ? `College '${college.name}' has been suspended.`
                      : `College '${college.name}' has been rejected.`
                  )}
                  className={`px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${
                    pendingAction === 'suspend' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  Confirm {pendingAction === 'suspend' ? 'Suspension' : 'Rejection'}
                </button>
                <button
                  onClick={() => { setPendingAction(null); setReason(''); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status History — add here, last card */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Status History</h2>
        <HistoryTimeline auditableType="App\Models\College" auditableId={college.id} />
      </div>

    </div>
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
