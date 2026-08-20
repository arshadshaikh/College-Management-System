import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api';
import { PORTAL } from '../../config/app';

export default function StudentDetail() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/students/${id}`).then(({ data }) => setStudent(data)).catch(() => setStudent(null)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!student) return <div className="py-20 text-center text-gray-500">Student not found.</div>;

  const p = student.student_profile ?? student.studentProfile ?? {};
  const apps = student.applications ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to={`${PORTAL}/students`} className="text-sm text-gray-500 hover:underline">← Students</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{student.name}</h1>
        </div>
        <Link to={`${PORTAL}/students/${student.id}/edit`} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Edit</Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Profile</h2>
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <Row label="CNIC" value={student.cnic_no} />
          <Row label="Email" value={student.email} />
          <Row label="Phone" value={student.phone} />
          <Row label="Father Name" value={p.father_name} />
          <Row label="Gender" value={p.gender} />
          <Row label="Date of Birth" value={p.date_of_birth} />
          <Row label="Status" value={student.is_active ? 'Active' : 'Inactive'} />
        </dl>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Applications</h2>
        {apps.length === 0 ? <p className="text-sm text-gray-400">No applications.</p> : (
          <div className="space-y-2 text-sm">
            {apps.map((a) => (
              <div key={a.id} className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-700">{a.program?.name ?? '—'}</span>
                <span className="text-gray-500 capitalize">{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (<><dt className="text-gray-500">{label}</dt><dd className="text-gray-900 capitalize">{value ?? '—'}</dd></>);
}