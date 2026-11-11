import DocumentCard from './DocumentCard';

// General documents (photo, CNIC, domicile ...). Certificates for each education
// level appear under that level in the Education section.
export default function DocumentsSection({ data, onSaved, profileLocked = false }) {
  const docs = data.documents ?? [];
  const types = (data.document_types ?? [])
    .filter((t) => !t.education_level)
    .sort((a, b) => Number(b.is_mandatory) - Number(a.is_mandatory));

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
        <p className="text-xs text-gray-500 mt-1">
          Clear scans or photos. They are kept in your profile and reused for every application.
          Education certificates are uploaded under each level above.
        </p>
      </div>
      <div className="space-y-2">
        {types.map((t) => (
          <DocumentCard key={t.slug} type={t} required={!!t.is_mandatory} locked={profileLocked}
            doc={docs.find((d) => d.document_type === t.slug)} onSaved={onSaved} />
        ))}
      </div>
    </div>
  );
}