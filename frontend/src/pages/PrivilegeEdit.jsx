import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';
import { PORTAL } from '../config/app';

export default function PrivilegeEdit() {
  const { id } = useParams();
  const [form, setForm] = useState({
    privilege_group_id: '', parent_id: '', name: '', slug: '', frontend_route: '', api_route: '', method: '',
    menu_type: 'none', icon: '', sort_order: 0, show_in_menu: false, description: '', is_active: true,
  });
  const [groups, setGroups] = useState([]);
  const [parentOptions, setParentOptions] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', slug: '', description: '' });
  const [groupLoading, setGroupLoading] = useState(false);
  const navigate = useNavigate();

  const fetchGroups = () => api.get('/privilege-groups').then(({ data }) => setGroups(data));

  const handleCreateGroup = async () => {
    if (!newGroup.name.trim()) return;
    setGroupLoading(true);
    try {
      const { data } = await api.post('/privilege-groups', { ...newGroup, is_active: true });
      await fetchGroups();
      setForm((f) => ({ ...f, privilege_group_id: data.id }));
      setNewGroup({ name: '', slug: '', description: '' });
      setShowNewGroup(false);
    } catch { /* ignore */ }
    setGroupLoading(false);
  };

  useEffect(() => {
    Promise.all([
      api.get(`/privileges/${id}`),
      api.get('/privilege-groups'),
      api.get('/privileges'),
    ]).then(([prvRes, groupsRes, allPrvRes]) => {
      const p = prvRes.data;
      setForm({
        privilege_group_id: p.privilege_group_id || '',
        parent_id: p.parent_id || '',
        name: p.name,
        slug: p.slug,
        frontend_route: p.frontend_route || '',
        api_route: p.api_route || '',
        method: p.method || '',
        menu_type: p.menu_type || 'none',
        icon: p.icon || '',
        sort_order: p.sort_order || 0,
        show_in_menu: p.show_in_menu,
        description: p.description || '',
        is_active: p.is_active,
      });
      setGroups(groupsRes.data);
      setParentOptions(allPrvRes.data.filter(pr => pr.menu_type === 'menu' && pr.id !== Number(id)));
      setFetching(false);
    });
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    const payload = { ...form };
    if (!payload.privilege_group_id) delete payload.privilege_group_id;
    if (!payload.parent_id) delete payload.parent_id;
    if (!payload.method) delete payload.method;
    try {
      await api.put(`/privileges/${id}`, payload);
      toast.success('Privilege updated successfully');
      // navigate('/privileges');
      navigate(`${PORTAL}/privileges`);
    } catch (err) {
      if (err.response?.status === 422) {
        setErrors(err.response.data.errors || {});
        toast.error('Please fix the validation errors');
      }
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <button type="button" onClick={() => navigate(`${PORTAL}/privileges`)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Privilege</h1>
          <p className="text-sm text-gray-500 mt-0.5">Update privilege configuration</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 md:px-8 py-4 bg-gray-50/80 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Basic Information</h2>
          </div>
          <div className="p-6 md:p-8 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input name="name" value={form.name} onChange={handleChange} required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name[0]}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
            <input name="slug" value={form.slug} onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono" />
            {errors.slug && <p className="text-red-500 text-xs mt-1">{errors.slug[0]}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Group</label>
              <button type="button" onClick={() => setShowNewGroup(!showNewGroup)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                {showNewGroup ? 'Cancel' : '+ New Group'}
              </button>
            </div>
            {showNewGroup ? (
              <div className="space-y-2 p-3 border border-indigo-200 bg-indigo-50/50 rounded-lg">
                <input value={newGroup.name} onChange={(e) => setNewGroup(g => ({ ...g, name: e.target.value }))}
                  placeholder="Group name *" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                <input value={newGroup.slug} onChange={(e) => setNewGroup(g => ({ ...g, slug: e.target.value }))}
                  placeholder="Slug (auto-generated)" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono" />
                <input value={newGroup.description} onChange={(e) => setNewGroup(g => ({ ...g, description: e.target.value }))}
                  placeholder="Description (optional)" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                <button type="button" onClick={handleCreateGroup} disabled={groupLoading || !newGroup.name.trim()}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 transition">
                  {groupLoading ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            ) : (
              <select name="privilege_group_id" value={form.privilege_group_id} onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
                <option value="">None</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Menu</label>
            <select name="parent_id" value={form.parent_id} onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
              <option value="">None (Top Level)</option>
              {parentOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 md:px-8 py-4 bg-gray-50/80 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Routes & Method</h2>
          </div>
          <div className="p-6 md:p-8 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Frontend Route</label>
            <input name="frontend_route" value={form.frontend_route} onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Route</label>
            <input name="api_route" value={form.api_route} onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HTTP Method</label>
            <select name="method" value={form.method} onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
              <option value="">None</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
        </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 md:px-8 py-4 bg-gray-50/80 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Menu Configuration</h2>
          </div>
          <div className="p-6 md:p-8 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Menu Type</label>
            <select name="menu_type" value={form.menu_type} onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
              <option value="none">None</option>
              <option value="menu">Menu</option>
              <option value="submenu">Submenu</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
            <input name="icon" value={form.icon} onChange={handleChange} placeholder="fa-users"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
            <input name="sort_order" type="number" value={form.sort_order} onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea name="description" value={form.description} onChange={handleChange} rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none" />
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2">
            <input name="show_in_menu" type="checkbox" checked={form.show_in_menu} onChange={handleChange}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300" />
            <span className="text-sm text-gray-700">Show in menu</span>
          </label>
          <label className="flex items-center gap-2">
            <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300" />
            <span className="text-sm text-gray-700">Active</span>
          </label>
        </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-indigo-800 disabled:from-indigo-400 disabled:to-indigo-400 shadow-sm shadow-indigo-200 transition">
            {loading ? 'Saving...' : 'Update Privilege'}
          </button>
          <button type="button" onClick={() => navigate(`${PORTAL}/privileges`)}
            className="px-8 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
