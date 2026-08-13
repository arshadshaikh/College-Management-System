import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';

export default function PlatformHome() {
  const [colleges, setColleges] = useState([]);

  useEffect(() => {
    api.get('/public/colleges').then(({ data }) => setColleges(data)).catch(() => {});
  }, []);

  const preview = colleges.slice(0, 6);

  return (
    <div>
      {/* Hero */}
      <section className="bg-indigo-50 py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Admissions, simplified for every college.</h1>
          <p className="mt-4 text-lg text-gray-600">
            A complete platform for college admissions, fees, and student management — each college with its own website and portal.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/register-college" className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">
              Register Your College
            </Link>
            <Link to="/colleges" className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-white">
              Browse Colleges
            </Link>
          </div>
        </div>
      </section>

      {/* Directory preview */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Colleges on our platform</h2>
          {colleges.length > 6 && <Link to="/colleges" className="text-indigo-600 hover:underline text-sm">View all →</Link>}
        </div>
        {preview.length === 0 ? (
          <p className="text-gray-400">No colleges yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {preview.map((c) => <CollegeCard key={c.id} college={c} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function CollegeCard({ college }) {
  // Link to the college's own subdomain site.
  const href = `http://${college.slug}.localhost:3000`;   // adjust base for production
  return (
    <a href={href} className="block border border-gray-200 rounded-xl p-5 hover:shadow-md transition">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
          {college.name.charAt(0)}
        </span>
        <div>
          <div className="font-semibold text-gray-900">{college.name}</div>
          <div className="text-xs text-gray-500">{[college.city, college.province].filter(Boolean).join(', ')}</div>
        </div>
      </div>
    </a>
  );
}