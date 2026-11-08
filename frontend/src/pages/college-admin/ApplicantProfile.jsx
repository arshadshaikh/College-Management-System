// Full applicant profile for the college admin, shown on Application Detail.
// Data comes from GET /api/applications/{id}:
//   student.student_profile, student.educations, student.profile_documents,
//   education_levels (config/admission.php), document_types (slug => name).

const VERIFY = {
  pending:  'bg-amber-50 text-amber-700',
  verified: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
};

function Field({ label, value, wide }) {
  return (
    <div className={wide ? 'md:col-span-2' : ''}>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5 whitespace-pre-line">{value || '—'}</dd>
    </div>
  );
}

const result = (e) => {
  if (e.total_marks) {
    const pct = ((e.obtained_marks / e.total_marks) * 100).toFixed(1);
    return `${e.obtained_marks}/${e.total_marks} (${pct}%)`;
  }
  if (e.cgpa) return `${Number(e.cgpa).toFixed(2)} / ${Number(e.cgpa_scale).toFixed(2)}`;
  return '—';
};

export default function ApplicantProfile({ app, onDownload }) {
  const s = app.student ?? {};
  const p = s.student_profile ?? {};
  const levels = app.education_levels ?? {};
  const docNames = app.document_types ?? {};
  const levelOrder = Object.keys(levels);
  const educations = [...(s.educations ?? [])].sort(
    (a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level)
  );
  const docs = s.profile_documents ?? [];
  const dob = p.date_of_birth ? String(p.date_of_birth).slice(0, 10) : null;
  const cap = (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

  return (
    <div className="space-y-6">
      {/* Personal */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Applicant Profile</h2>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
          <Field label="Name" value={s.name} />
          <Field label="Father's Name" value={p.father_name} />
          <Field label="CNIC" value={s.cnic_no} />
          <Field label="Date of Birth" value={dob} />
          <Field label="Gender" value={cap(p.gender)} />
          <Field label="Marital Status" value={cap(p.marital_status)} />
          <Field label="Mobile" value={s.phone} />
          <Field label="Email" value={s.email} />
          <Field label="Nationality" value={p.nationality} />
          <Field label="Religion" value={p.religion} />
          <Field label="Domicile" value={[p.domicile_district, p.domicile_province].filter(Boolean).join(', ')} />
          <Field label="PRC No." value={p.prc_no} />
          <Field label="Emergency Contact" value={p.emergency_contact} />
          <Field label="Permanent Address" value={p.permanent_address} wide />
          <Field label="Present Address" value={p.present_address} wide />
        </dl>
      </div>

      {/* Education */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Education</h2>
        {educations.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-4 font-medium">Level</th>
                  <th className="py-2 pr-4 font-medium">Degree / Group</th>
                  <th className="py-2 pr-4 font-medium">Board / University</th>
                  <th className="py-2 pr-4 font-medium">Institution</th>
                  <th className="py-2 pr-4 font-medium">Roll No</th>
                  <th className="py-2 pr-4 font-medium">Year</th>
                  <th className="py-2 pr-4 font-medium">Result</th>
                  <th className="py-2 pr-4 font-medium">Grade</th>
                  <th className="py-2 font-medium">Certificate</th>
                </tr>
              </thead>
              <tbody>
                {educations.map((e) => {
                  const cert = docs.find((d) => d.id === e.document_id);
                  return (
                    <tr key={e.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 pr-4 font-medium text-gray-900">{levels[e.level]?.label ?? e.level}</td>
                      <td className="py-2 pr-4">{e.degree_title || '—'}</td>
                      <td className="py-2 pr-4">{e.board_university}</td>
                      <td className="py-2 pr-4">{e.institution || '—'}</td>
                      <td className="py-2 pr-4">{e.roll_no || '—'}</td>
                      <td className="py-2 pr-4">{e.passing_year}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{result(e)}</td>
                      <td className="py-2 pr-4">{e.grade || '—'}</td>
                      <td className="py-2">
                        {cert
                          ? <button onClick={() => onDownload(cert)} className="text-indigo-600 hover:underline">Download</button>
                          : <span className="text-gray-400">Not uploaded</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No education records.</p>
        )}
      </div>

      {/* Profile documents */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Profile Documents</h2>
        {docs.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900">{docNames[doc.document_type] ?? doc.document_type}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {doc.original_name} · {(doc.file_size / 1024).toFixed(0)} KB
                  </div>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs capitalize ${VERIFY[doc.verification_status] ?? VERIFY.pending}`}>
                    {doc.verification_status}
                  </span>
                </div>
                <button onClick={() => onDownload(doc)} className="ml-4 shrink-0 text-sm text-indigo-600 hover:underline">
                  Download
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No profile documents uploaded.</p>
        )}
      </div>
    </div>
  );
}
