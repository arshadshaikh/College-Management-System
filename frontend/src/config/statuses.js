// Single source of truth for status values, labels, and colors.
// Every list/detail page imports from here instead of hard-coding.
// Add a status → edit one place, and it updates everywhere.

export const APPLICATION_STATUSES = {
  submitted:    { label: 'Submitted',    color: 'bg-blue-50 text-blue-700' },
  under_review: { label: 'Under Review', color: 'bg-amber-50 text-amber-700' },
  shortlisted:  { label: 'Shortlisted',  color: 'bg-purple-50 text-purple-700' },
  approved:     { label: 'Approved',     color: 'bg-green-50 text-green-700' },
  rejected:     { label: 'Rejected',     color: 'bg-red-50 text-red-700' },
  withdrawn:    { label: 'Withdrawn',    color: 'bg-gray-100 text-gray-600' },
};

export const CHALLAN_STATUSES = {
  unpaid:    { label: 'Unpaid',    color: 'bg-amber-50 text-amber-700' },
  paid:      { label: 'Paid',      color: 'bg-green-50 text-green-700' },
  overdue:   { label: 'Overdue',   color: 'bg-red-50 text-red-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
};

export const COLLEGE_STATUSES = {
  pending:   { label: 'Pending',   color: 'bg-amber-50 text-amber-700' },
  approved:  { label: 'Approved',  color: 'bg-green-50 text-green-700' },
  rejected:  { label: 'Rejected',  color: 'bg-red-50 text-red-700' },
  suspended: { label: 'Suspended', color: 'bg-gray-100 text-gray-600' },
};

export const CHALLAN_TYPES = ['admission', 'semester', 'exam', 'arrears', 'other'];

// Helpers so pages don't repeat the same lookups.
export const statusColor = (map, value) => map[value]?.color ?? 'bg-gray-100 text-gray-600';
export const statusLabel = (map, value) => map[value]?.label ?? value;

// Build a filter-dropdown list: [{value:'', label:'All'}, ...] from a status map.
export const filterOptions = (map, allLabel = 'All statuses') =>
  [{ value: '', label: allLabel }, ...Object.entries(map).map(([value, { label }]) => ({ value, label }))];