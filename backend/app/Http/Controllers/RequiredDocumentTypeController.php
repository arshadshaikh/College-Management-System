<?php

namespace App\Http\Controllers;

use App\Models\RequiredDocumentType;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class RequiredDocumentTypeController extends Controller
{
    public function index(Request $request)
    {
        $query = RequiredDocumentType::query();
        if ($request->filled('scope')) $query->where('scope', $request->scope);
        // return response()->json($query->orderBy('sort_order')->orderBy('name')->get());

        $rows = $query->orderBy('sort_order')->orderBy('name')->get();

        // The form asks for the education level catalog too (config/admission.php).
        if ($request->boolean('with_levels')) {
            return response()->json([
                'data' => $rows,
                'education_levels' => collect(config('admission.education_levels', []))
                    ->map(fn ($m, $k) => [
                        'key'     => $k,
                        'label'   => $m['label'],
                        'systems' => collect($m['systems'] ?? [])
                            ->map(fn ($s, $sk) => ['key' => $sk, 'label' => $s['label']])->values(),
                    ])->values(),
            ]);
        }
        return response()->json($rows);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'scope'              => 'required|string|max:50',
            'name'               => 'required|string|max:255',
            'is_mandatory'       => 'boolean',
            'is_active'          => 'boolean',
            'education_level'    => ['nullable', Rule::in(array_keys(config('admission.education_levels', [])))],
            'education_system'   => ['nullable', Rule::in(collect(config('admission.education_levels', []))->flatMap(fn ($m) => array_keys($m['systems'] ?? []))->all())],
            'sort_order'         => 'nullable|integer|min:0',
            'allowed_mime_types' => 'required|string|max:500',   // e.g. "image/jpeg,image/png,application/pdf"
            'max_size_kb'        => 'nullable|integer|min:1|max:20480',
            'max_dimension'      => 'nullable|integer|min:1|max:10000',
        ]);

        $data['slug'] = Str::slug($data['name'], '_');
        $data['max_size_kb'] = $data['max_size_kb'] ?? 4096;

        // Slug must be unique within the scope.
        $request->merge(['slug' => $data['slug']]);
        $request->validate([
            'slug' => Rule::unique('required_document_types')->where('scope', $data['scope']),
        ]);

        return response()->json(RequiredDocumentType::create($data), 201);
    }

    public function update(Request $request, RequiredDocumentType $requiredDocumentType)
    {
        $data = $request->validate([
            'name'         => 'sometimes|string|max:255',
            'is_mandatory' => 'boolean',
            'is_active'    => 'boolean',
            'education_level'    => ['nullable', Rule::in(array_keys(config('admission.education_levels', [])))],
            'education_system'   => ['nullable', Rule::in(collect(config('admission.education_levels', []))->flatMap(fn ($m) => array_keys($m['systems'] ?? []))->all())],
            'sort_order'   => 'nullable|integer|min:0',
            'allowed_mime_types' => 'sometimes|string|max:500',
            'max_size_kb'        => 'nullable|integer|min:1|max:20480',
            'max_dimension'      => 'nullable|integer|min:1|max:10000',
        ]);
        
        // Slug is stable once created — editing the name doesn't re-slug,
        // so existing uploaded documents keep matching their type.
        $requiredDocumentType->update($data);
        return response()->json($requiredDocumentType->fresh());
    }

    public function destroy(RequiredDocumentType $requiredDocumentType)
    {
        $requiredDocumentType->delete();
        return response()->json(['message' => 'Document type removed.']);
    }


    // GET /api/public/required-documents?scope=college_registration
    // Public — the registration form needs this before anyone logs in.
    public function publicIndex(Request $request)
    {
        $scope = $request->get('scope', 'college_registration');
        return response()->json(
            RequiredDocumentType::where('scope', $scope)
                ->where('is_active', true)
                ->orderBy('sort_order')->orderBy('name')
                ->get(['name', 'slug', 'is_mandatory'])
        );
    }
}