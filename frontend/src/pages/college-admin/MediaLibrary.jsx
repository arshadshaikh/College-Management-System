import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { MEDIA_ACCEPT } from '../../config/media';

export default function MediaLibrary() {
  const { hasPrv } = useAuth();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState('grid');   // 'grid' | 'list'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/cms/media', {
        params: { page, media_type: typeFilter || undefined },
      });
      setItems(data.data ?? []);
      setMeta({
        current_page: data.current_page ?? 1,
        last_page: data.last_page ?? 1,
        total: data.total ?? 0,
      });
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [page, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const upload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error('File must be under 8 MB.'); e.target.value = ''; return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post('/cms/media', fd);
      toast.success('File uploaded.');
      setPage(1);
      await load();
    } catch (err) {
      if (err.response?.status === 422) toast.error(err.response.data.message ?? 'Upload failed.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.original_name}"?`)) return;
    try {
      await api.delete(`/cms/media/${item.id}`);
      toast.success('File deleted.');
      await load();
    } catch { /* interceptor toasts */ }
  };

  const copyUrl = (url) => {
    navigator.clipboard?.writeText(url);
    toast.success('URL copied.');
  };

  const TYPES = [
    { value: '', label: 'All files' },
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Videos' },
    { value: 'document', label: 'Documents' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
        <div className="flex items-center gap-3">
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button type="button" onClick={() => setView('grid')}
              className={`px-3 py-2 text-sm ${view === 'grid' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="Grid view">▦</button>
            <button type="button" onClick={() => setView('list')}
              className={`px-3 py-2 text-sm ${view === 'list' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              title="List view">☰</button>
          </div>
          {hasPrv('cms.media.store') && (
            <label className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
              {uploading ? 'Uploading…' : '+ Upload File'}
              <input type="file" accept={MEDIA_ACCEPT} onChange={upload} disabled={uploading} className="hidden" />
            </label>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-gray-400">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center text-gray-400">No files yet. Upload your first.</div>
      ) : view === 'grid' ? (
        // ── your existing grid, unchanged ──
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((m) => (
            <div key={m.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="h-32 bg-gray-50 flex items-center justify-center">
                {m.media_type === 'image'
                  ? <img src={m.public_url} alt={m.alt_text || m.original_name} className="h-full w-full object-cover" />
                  : <span className="text-4xl">📄</span>}
              </div>
              <div className="p-3">
                <div className="text-xs font-medium text-gray-900 truncate" title={m.original_name}>{m.original_name}</div>
                <div className="text-xs text-gray-500">
                  {(m.file_size / 1024).toFixed(0)} KB
                  {m.width ? ` · ${m.width}×${m.height}` : ''}
                </div>
                <div className="flex gap-2 mt-2 text-xs">
                  <button onClick={() => copyUrl(m.public_url)} className="text-indigo-600 hover:underline">Copy URL</button>
                  {hasPrv('cms.media.destroy') && (
                    <button onClick={() => remove(m)} className="text-red-600 hover:underline">Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // ── list view ──
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {items.map((m) => (
            <div key={m.id} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
              <div className="h-10 w-10 shrink-0 flex items-center justify-center bg-gray-50 rounded">
                {m.media_type === 'image'
                ? <img src={m.public_url} alt={m.alt_text || m.original_name} className="h-full w-full object-cover rounded" />
                : <span className="text-lg">📄</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate" title={m.original_name}>{m.original_name}</div>
                <div className="text-xs text-gray-500">
                  <span className="capitalize">{m.media_type}</span> · {(m.file_size / 1024).toFixed(0)} KB
                    {m.width ? ` · ${m.width}×${m.height}` : ''}
                </div>
              </div>
              <div className="flex gap-3 text-xs shrink-0">
                <button onClick={() => copyUrl(m.public_url)} className="text-indigo-600 hover:underline">Copy URL</button>
                {hasPrv('cms.media.destroy') && (
                <button onClick={() => remove(m)} className="text-red-600 hover:underline">Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {meta.last_page > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-gray-600">
          <button disabled={meta.current_page <= 1} onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
          <span>Page {meta.current_page} of {meta.last_page}</span>
          <button disabled={meta.current_page >= meta.last_page} onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
        </div>
      )}
    </div>
  );
}