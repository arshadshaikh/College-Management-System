// Known document scopes. Add a row here when a new module needs documents.
// This is soft-coded config (one place to edit), not scattered hard-coding,
// and not a DB table we don't need yet.
export const DOCUMENT_SCOPES = [
  { value: 'college_registration', label: 'College Registration' },
  // { value: 'student_application', label: 'Student Application' },  // enable when built
];

export const DEFAULT_SCOPE = 'college_registration';