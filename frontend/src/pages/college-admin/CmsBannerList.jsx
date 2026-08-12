import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';
import DataTable from '../../components/DataTable';
import { useAuth } from '../../context/AuthContext';

export default function CmsBannerList() {
  const { hasPrv } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  const remove = async (row) => {
    if (!window.confirm(`Delete banner "${row.title || 'Untitled'}"?`)) return;
    try {
      await api.delete(`/cms/banners/${row.id}`);
      toast.success('Banner deleted.');
      setRefreshKey((k) => k + 1);
    } catch { /* interceptor toasts */ }
  };

  const columns = [
    { key: 'image', label: 'Image', sortable: false,
      render: (r) => r.image_url
        ? <img src={r.image_url} alt={r.title || 'banner'} className="h-12 w-20 object-cover rounded border border-gray-200" />
        : <span className="text-gray-300 text-xs">no image</span> },
    { key: 'title', label: 'Title', sortable: true,
      render: (r) => (
        <div>
          <div className="font-medium text-gray-900">{r.title || '—'}</div>
          {r.subtitle && <div className="text-xs text-gray-500">{r.subtitle}</div>}
        </div>
      )},
    { key: 'sort_order', label: 'Order', sortable: true },
    { key: 'is_active', label: 'Status', sortable: true,
      render: (r) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
          r.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>{r.is_active ? 'Active' : 'Inactive'}</span>
      )},
  ];

  const actions = (row) => (
    <>
      {hasPrv('cms.banners.update') && (
        <Link to={`${PORTAL}/cms/banners/${row.id}/edit`} className="text-indigo-600 hover:underline">Edit</Link>
      )}
      {hasPrv('cms.banners.destroy') && (
        <button onClick={() => remove(row)} className="text-red-600 hover:underline">Delete</button>
      )}
    </>
  );

  return (
    <DataTable
      title="Banners"
      endpoint="/cms/banners"
      columns={columns}
      actions={actions}
      refreshKey={refreshKey}
      showIndex={false}
      headerActions={
        hasPrv('cms.banners.store') && (
          <Link to={`${PORTAL}/cms/banners/create`}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            + New Banner
          </Link>
        )
      }
    />
  );
}