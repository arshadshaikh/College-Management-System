import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function CmsMenuList() {
  const { hasPrv } = useAuth();
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/cms/menus');
      setTree(Array.isArray(data) ? data : (data.data ?? []));
    } catch { setTree([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.label}"? Its child items will move to the top level.`)) return;
    try {
      await api.delete(`/cms/menus/${item.id}`);
      toast.success('Menu item deleted.');
      await load();
    } catch { /* interceptor toasts */ }
  };

  const linkLabel = (item) => {
    if (item.page_id) return 'Page';
    if (item.url) return item.url;
    return '—';
  };

  const Row = ({ item, depth }) => (
    <>
      <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 24}px` }}>
          {depth > 0 && <span className="text-gray-300">└</span>}
          <span className="font-medium text-gray-900">{item.label}</span>
          <span className="text-xs text-gray-400">· {linkLabel(item)}</span>
          {!item.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
        </div>
        <div className="flex gap-3 text-sm">
          {hasPrv('cms.menus.update') && (
            <Link to={`/cms/menus/${item.id}/edit`} className="text-indigo-600 hover:underline">Edit</Link>
          )}
          {hasPrv('cms.menus.destroy') && (
            <button onClick={() => remove(item)} className="text-red-600 hover:underline">Delete</button>
          )}
        </div>
      </div>
      {(item.children ?? []).map((child) => <Row key={child.id} item={child} depth={depth + 1} />)}
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Menus</h1>
        {hasPrv('cms.menus.store') && (
          <Link to="/cms/menus/create"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            + New Menu Item
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-4 py-10 text-center text-gray-400">Loading…</div>
        ) : tree.length === 0 ? (
          <div className="px-4 py-10 text-center text-gray-400">No menu items yet.</div>
        ) : (
          tree.map((item) => <Row key={item.id} item={item} depth={0} />)
        )}
      </div>
    </div>
  );
}