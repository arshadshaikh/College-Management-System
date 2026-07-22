import { useState, useEffect, useCallback } from 'react';
import api from '../api';

/**
 * Reusable server-driven table: search, sort, paginate.
 *
 * Props:
 *   endpoint  — API path, e.g. '/programs'
 *   columns   — [{ key, label, sortable, render? }]
 *   actions   — optional (row) => JSX for the Actions column
 *   filters   — optional extra query params object
 *   refreshKey— change this value to force a reload
 */
export default function DataTable({ endpoint, columns, actions, filters = {}, refreshKey, title, headerActions }) {
  const [rows, setRows]       = useState([]);
  const [meta, setMeta]       = useState({ current_page: 1, last_page: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [query, setQuery]     = useState('');      // debounced value actually sent
  const [sortBy, setSortBy]   = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 when filters change (new)
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(endpoint, {
        params: {
          page,
          search: query || undefined,
          sort_by: sortBy || undefined,
          sort_dir: sortBy ? sortDir : undefined,
          ...filters,
        },
      });

      // Handle both paginated and plain-array responses.
      if (Array.isArray(data)) {
        setRows(data);
        setMeta({ current_page: 1, last_page: 1, total: data.length });
      } else {
        setRows(data.data ?? []);
        setMeta({
          current_page: data.current_page ?? 1,
          last_page:    data.last_page ?? 1,
          total:        data.total ?? 0,
        });
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, page, query, sortBy, sortDir, JSON.stringify(filters), refreshKey]);

  useEffect(() => { load(); }, [load]);

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="flex items-center gap-3">
          <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          {headerActions}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && toggleSort(col.key)}
                  className={`px-6 py-4 text-left font-semibold ${col.sortable ? 'cursor-pointer select-none hover:text-gray-900' : ''}`}
                >
                  {col.label}
                  {sortBy === col.key && (
                    <span className="ml-1 text-indigo-600">{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
              {actions && <th className="px-6 py-4 text-right font-semibold">Actions</th>}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-10 text-center text-gray-400">No records found.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col.key} className="px-6 py-4">
                      {col.render ? col.render(row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                  {actions && <td className="px-6 py-4 text-right space-x-3">{actions(row)}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{meta.total} record{meta.total === 1 ? '' : 's'}</span>
        <div className="flex items-center gap-2">
          <button
            disabled={meta.current_page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >Previous</button>
          <span>Page {meta.current_page} of {meta.last_page}</span>
          <button
            disabled={meta.current_page >= meta.last_page}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >Next</button>
        </div>
      </div>
    </div>
  );
}