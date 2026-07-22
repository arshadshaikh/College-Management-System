import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../api';

const PAGE_SIZES = [10, 25, 50, 100];

export default function DataTable({
  endpoint, columns, actions, filters = {}, refreshKey,
  title, headerActions,
  showIndex = true,          // the "#" column
  csvName,                   // e.g. "programs" — omit to hide the CSV button
}) {
  const [rows, setRows]       = useState([]);
  const [meta, setMeta]       = useState({ current_page: 1, last_page: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [search, setSearch]   = useState('');
  const [query, setQuery]     = useState('');
  const [sortBy, setSortBy]   = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setQuery(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const buildParams = (overrides = {}) => ({
    page,
    per_page: perPage,
    search: query || undefined,
    sort_by: sortBy || undefined,
    sort_dir: sortBy ? sortDir : undefined,
    ...filters,
    ...overrides,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(endpoint, { params: buildParams() });
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
  }, [endpoint, page, perPage, query, sortBy, sortDir, JSON.stringify(filters), refreshKey]);

  useEffect(() => { load(); }, [load]);

  const toggleSort = (key) => {
    if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('asc'); }
    setPage(1);
  };

  // CSV: refetch ALL filtered rows (capped at 1000 by the backend),
  // then build the file from the column definitions.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const { data } = await api.get(endpoint, {
        params: buildParams({ page: 1, per_page: 1000 }),
      });
      const all = Array.isArray(data) ? data : (data.data ?? []);

      const esc = (v) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };

      const header = columns.map((c) => esc(c.label)).join(',');
      const lines = all.map((row) =>
        columns.map((c) => esc(c.csv ? c.csv(row) : row[c.key])).join(',')
      );

      const blob = new Blob(['\uFEFF' + [header, ...lines].join('\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${csvName || 'export'}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const colSpan = columns.length + (showIndex ? 1 : 0) + (actions ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Title row: title + custom filters + create button */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="flex items-center gap-3 flex-wrap">{headerActions}</div>
      </div>

      {/* Toolbar row: search + page size + CSV + count */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={perPage}
          onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
        {csvName && (
          <button
            onClick={exportCsv}
            disabled={exporting}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : '⬇ CSV'}
          </button>
        )}
        <span className="ml-auto text-sm text-gray-500">
          {meta.total} record{meta.total === 1 ? '' : 's'}
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {showIndex && <th className="px-6 py-4 text-left font-semibold w-12">#</th>}
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
              <tr><td colSpan={colSpan} className="px-6 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={colSpan} className="px-6 py-10 text-center text-gray-400">No records found.</td></tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {showIndex && (
                    <td className="px-6 py-4 text-gray-400">
                      {(meta.current_page - 1) * perPage + i + 1}
                    </td>
                  )}
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

      <div className="flex items-center justify-end gap-2 text-sm text-gray-600">
        <button disabled={meta.current_page <= 1} onClick={() => setPage(page - 1)}
          className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Previous</button>
        <span>Page {meta.current_page} of {meta.last_page}</span>
        <button disabled={meta.current_page >= meta.last_page} onClick={() => setPage(page + 1)}
          className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
      </div>
    </div>
  );
}