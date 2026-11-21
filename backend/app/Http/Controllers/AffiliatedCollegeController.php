<?php

namespace App\Http\Controllers;

use App\Models\AffiliatedCollege;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Affiliated colleges of the current tenant (university).
 * Tenant scope applies through BelongsToTenant and route model binding.
 */
class AffiliatedCollegeController extends Controller
{
    // GET /api/affiliated-colleges  (?search=, ?active=1, ?sort_by=, ?sort_dir=, ?per_page=)
    public function index(Request $request)
    {
        $search   = trim((string) $request->query('search', ''));
        $sortable = ['code', 'name', 'city', 'is_active', 'created_at'];
        $sortBy   = in_array($request->query('sort_by'), $sortable, true) ? $request->query('sort_by') : 'name';
        $sortDir  = $request->query('sort_dir') === 'desc' ? 'desc' : 'asc';

        $query = AffiliatedCollege::query()
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w
                ->where('code', 'like', "%{$search}%")
                ->orWhere('name', 'like', "%{$search}%")
                ->orWhere('city', 'like', "%{$search}%")))
            ->when($request->boolean('active'), fn ($q) => $q->where('is_active', true))
            ->orderBy($sortBy, $sortDir)
            ->orderBy('id');

        // Up to 1000 so the DataTable CSV export gets every row.
        $perPage = min(max((int) $request->query('per_page', 25), 1), 1000);

        return response()->json($query->paginate($perPage));
    }

    // POST /api/affiliated-colleges
    public function store(Request $request)
    {
        $college = AffiliatedCollege::create($this->validated($request) + ['is_active' => true]);
        AuditLog::record('affiliated_college.created', $college, ['code' => $college->code, 'name' => $college->name]);

        return response()->json($college, 201);
    }

    // PUT /api/affiliated-colleges/{affiliatedCollege}
    public function update(Request $request, AffiliatedCollege $affiliatedCollege)
    {
        $affiliatedCollege->update($this->validated($request, $affiliatedCollege));
        AuditLog::record('affiliated_college.updated', $affiliatedCollege, ['code' => $affiliatedCollege->code]);

        return response()->json($affiliatedCollege->fresh());
    }

    // DELETE /api/affiliated-colleges/{affiliatedCollege}
    // Exam enrolments will refer to these; once they do, this checks usage first.
    public function destroy(AffiliatedCollege $affiliatedCollege)
    {
        AuditLog::record('affiliated_college.deleted', $affiliatedCollege, ['code' => $affiliatedCollege->code, 'name' => $affiliatedCollege->name]);
        $affiliatedCollege->delete();

        return response()->json(['message' => 'Affiliated college deleted.']);
    }

    private function validated(Request $request, ?AffiliatedCollege $existing = null): array
    {
        $tenantId = app('current_college')->id;

        $data = $request->validate([
            'code'      => [
                'required', 'string', 'max:20',
                Rule::unique('affiliated_colleges', 'code')->where('college_id', $tenantId)->ignore($existing?->id),
            ],
            'name'      => 'required|string|max:191',
            'city'      => 'nullable|string|max:100',
            'is_active' => 'sometimes|boolean',
        ], [
            'code.unique' => 'Another affiliated college already has this code.',
        ]);

        $data['code'] = strtoupper(trim($data['code']));
        $data['name'] = trim($data['name']);
        $data['city'] = isset($data['city']) ? (trim($data['city']) ?: null) : null;

        return $data;
    }
}
