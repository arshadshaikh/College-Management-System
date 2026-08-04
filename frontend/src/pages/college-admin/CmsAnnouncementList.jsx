import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import DataTable from '../../components/DataTable';
import { useAuth } from '../../context/AuthContext';

export default function CmsAnnouncementList() {
  const { hasPrv } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const remove = async (row) => {
    if (!window.confirm(`Delete "${row.title}"?`)) return;
    try {
      await api.delete(`/cms/announcements/${row.id}`);
      toast.success('Announcement deleted.');
      setRefreshKey((k) => k + 1);
    } catch { /* interceptor toasts */ }
  };

  const columns = [
    { key: 'title', label: 'Title', sortable: true,
      render: (r) => <span className="font-medium text-gray-900">{r.title}</span> },
    { key: 'is_published', label: 'Status', sortable: true,
      render: (r) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          r.is_published ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>{r.is_published ? 'Published' : 'Draft'}</span>
      )},
    { key: 'published_at', label: 'Published', sortable: true,
      render: (r) => r.published_at ? new Date(r.published_at).toLocaleDateString() : '—' },
  ];

  const actions = (row) => (
    <>
      {hasPrv('cms.announcements.update') && (
        <Link to={`/cms/announcements/${row.id}/edit`} className="text-indigo-600 hover:underline">Edit</Link>
      )}
      {hasPrv('cms.announcements.destroy') && (
        <button onClick={() => remove(row)} className="text-red-600 hover:underline">Delete</button>
      )}
    </>
  );

  return (
    <DataTable
      title="Announcements"
      endpoint="/cms/announcements"
      columns={columns}
      actions={actions}
      refreshKey={refreshKey}
      headerActions={
        hasPrv('cms.announcements.store') && (
          <Link to="/cms/announcements/create"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            + New Announcement
          </Link>
        )
      }
    />
  );
}