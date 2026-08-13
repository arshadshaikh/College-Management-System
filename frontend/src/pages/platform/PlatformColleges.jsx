import { useState, useEffect } from 'react';
import api from '../../api';

export default function PlatformColleges() {
  const [colleges, setColleges] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = (q = '') => {
    setLoading(true);
    api.get('/public/colleges', { params: { search: q || undefined } })
      .then(({ data }) => setColleges(data))
      .catch(() => setColleges([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Colleges</h1>

      <div className="flex gap-2 mb-8 max-w-md">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(search)}
          placeholder="Search colleges…"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        <button onClick={() => load(search)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Search</button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : colleges.length === 0 ? (
        <p className="text-gray-400">No colleges found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {colleges.map((c) => {
            const href = `http://${c.slug}.localhost:3000`;
            return (
              <a key={c.id} href={href} className="block border border-gray-200 rounded-xl p-5 hover:shadow-md transition">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">{c.name.charAt(0)}</span>
                  <div>
                    <div className="font-semibold text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-500">{[c.city, c.province].filter(Boolean).join(', ')}</div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}