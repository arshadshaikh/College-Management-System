import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import DataTable from '../../components/DataTable';
import { useAuth } from '../../context/AuthContext';

export default function CmsPageList() {
  const { hasPrv } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const remove = async (row) => {
    if (!window.confirm(`Delete the page "${row.title}"?`)) return;
    try {
      await api.delete(`/cms/pages/${row.id}`);
      toast.success('Page deleted.');
      setRefreshKey((k) => k + 1);
    } catch { /* interceptor toasts */ }
  };

  const columns = [
    { key: 'title', label: 'Title', sortable: true,
      render: (r) => (
        <div>
          <div className="font-medium text-gray-900">{r.title}</div>
          <div className="text-xs text-gray-500">/{r.slug}</div>
        </div>
      )},
    { key: 'sort_order', label: 'Order', sortable: true },
    { key: 'is_published', label: 'Status', sortable: true,
      render: (r) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          r.is_published ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>{r.is_published ? 'Published' : 'Draft'}</span>
      )},
    { key: 'updated_at', label: 'Updated',
      render: (r) => new Date(r.updated_at).toLocaleDateString() },
  ];

  const actions = (row) => (
    <>
      {hasPrv('cms.pages.update') && (
        <Link to={`/cms/pages/${row.id}/edit`} className="text-indigo-600 hover:underline">Edit</Link>
      )}
      {hasPrv('cms.pages.destroy') && (
        <button onClick={() => remove(row)} className="text-red-600 hover:underline">Delete</button>
      )}
    </>
  );

  return (
    <DataTable
      title="Pages"
      endpoint="/cms/pages"
      columns={columns}
      actions={actions}
      refreshKey={refreshKey}
      headerActions={
        hasPrv('cms.pages.store') && (
          <Link to="/cms/pages/create"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            + New Page
          </Link>
        )
      }
    />
  );
}