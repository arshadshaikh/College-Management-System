import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';
import DataTable from '../../components/DataTable';
import { useAuth } from '../../context/AuthContext';
import { DOCUMENT_SCOPES, DEFAULT_SCOPE } from '../../config/documentScopes';

export default function DocumentTypeList() {
  const { hasPrv } = useAuth();
  const [scope, setScope] = useState(DEFAULT_SCOPE);
  const [refreshKey, setRefreshKey] = useState(0);

  const remove = async (row) => {
    if (!window.confirm(`Remove "${row.name}"? Colleges will no longer be asked for it.`)) return;
    try {
      await api.delete(`/required-document-types/${row.id}`);
      toast.success('Document type removed.');
      setRefreshKey((k) => k + 1);
    } catch { /* interceptor toasts */ }
  };

  const columns = [
    { key: 'name', label: 'Document', sortable: false,
      render: (r) => (
        <div>
          <div className="font-medium text-gray-900">{r.name}</div>
          <div className="text-xs text-gray-500">{r.slug}</div>
        </div>
      )},
    { key: 'is_mandatory', label: 'Required',
      render: (r) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          r.is_mandatory ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
        }`}>{r.is_mandatory ? 'Mandatory' : 'Optional'}</span>
      )},
    { key: 'allowed_mime_types', label: 'Allowed Types',
      render: (r) => <span className="text-xs text-gray-600">{prettyTypes(r.allowed_mime_types)}</span> },
    { key: 'max_size_kb', label: 'Max Size',
      render: (r) => `${(r.max_size_kb / 1024).toFixed(0)} MB` },
    { key: 'max_dimension', label: 'Max Dim',
      render: (r) => r.max_dimension ? `${r.max_dimension}px` : '—' },
    { key: 'is_active', label: 'Status',
      render: (r) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          r.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>{r.is_active ? 'Active' : 'Inactive'}</span>
      )},
  ];

  const actions = (row) => (
    <>
      {hasPrv('doc-types.update') && (
        <Link to={`${PORTAL}/document-types/${row.id}/edit`} className="text-indigo-600 hover:underline">Edit</Link>
      )}
      {hasPrv('doc-types.destroy') && (
        <button onClick={() => remove(row)} className="text-red-600 hover:underline">Remove</button>
      )}
    </>
  );

  return (
    <DataTable
      title="Registration Document Types"
      endpoint="/required-document-types"
      columns={columns}
      actions={actions}
      refreshKey={refreshKey}
      // filters={{ scope: 'college_registration' }}
      filters={{ scope }}
      headerActions={
        
        <div className="flex items-center gap-3">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {DOCUMENT_SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          {hasPrv('doc-types.store') && (
            <Link to={`${PORTAL}/document-types/create?scope=${scope}`} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              + Add Document Type
            </Link>
          )}
        </div>
      }
    />
  );
}

function prettyTypes(csv) {
  if (!csv) return '—';
  return csv.split(',').map((m) => ({
    'image/jpeg': 'JPG', 'image/png': 'PNG', 'application/pdf': 'PDF',
  }[m.trim()] ?? m.trim())).join(', ');
}