import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { PORTAL } from '../../config/app';
import { useAuth } from '../../context/AuthContext';

export default function ProgramDetail() {
  const { id } = useParams();
  const { hasPrv } = useAuth();
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/programs/${id}`)
      .then(({ data }) => setProgram(data))
      .catch(() => setProgram(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!program) return (
    <div className="py-20 text-center">
      <p className="text-gray-500 mb-4">Program not found.</p>
      <Link to={`${PORTAL}/programs`} className="text-indigo-600 hover:underline">Back to programs</Link>
    </div>
  );

  const fees = program.fee_structures ?? program.feeStructures ?? program.fees ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to={`${PORTAL}/programs`} className="text-sm text-gray-500 hover:underline">← Programs</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{program.name}</h1>
        </div>
        {hasPrv('programs.update') && (
          <Link to={`${PORTAL}/programs/${program.id}/edit`}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            Edit
          </Link>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Details</h2>
        <dl className="grid grid-cols-2 gap-y-3 text-sm">
          <Row label="Code" value={program.code} />
          <Row label="Degree Level" value={program.degree_level} />
          <Row label="Duration" value={`${program.duration_years} yr / ${program.total_semesters} sem`} />
          <Row label="Total Seats" value={program.total_seats} />
          <Row label="Available Seats" value={`${program.available_seats ?? '—'} / ${program.total_seats}`} />
          <Row label="Status" value={program.is_active ? 'Active' : 'Inactive'} />
        </dl>
        {program.eligibility_criteria && (
          <div className="mt-4">
            <div className="text-xs text-gray-500 mb-1">Eligibility</div>
            <p className="text-sm text-gray-800">{program.eligibility_criteria}</p>
          </div>
        )}
        {program.description && (
          <div className="mt-4">
            <div className="text-xs text-gray-500 mb-1">Description</div>
            <p className="text-sm text-gray-800">{program.description}</p>
          </div>
        )}
      </div>

      {fees.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Fee Structures</h2>
          <div className="space-y-2 text-sm">
            {fees.map((f) => (
              <div key={f.id} className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-700 capitalize">{f.label || f.fee_type}</span>
                <span className="text-gray-900">Rs. {Number(f.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 capitalize">{value ?? '—'}</dd>
    </>
  );
}