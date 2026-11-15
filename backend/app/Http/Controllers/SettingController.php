<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\Request;
use App\Models\CollegeDocumentType;
use App\Models\RequiredDocumentType;
use App\Services\ApplicantProfileService;

class SettingController extends Controller
{
    // GET /api/settings — all settings for the current college.
    // Returned as a flat key=>value map, which is what a frontend theme needs.
    public function index()
    {
        // BelongsToTenant global scope limits this to the current college.
        $settings = Setting::all(['key', 'value', 'group']);

        return response()->json([
            'settings' => $settings->pluck('value', 'key'),   // { "primary_color": "#1e40af", ... }
            'grouped'  => $settings->groupBy('group'),         // optional: organized by group
            // Level catalog for the "Required Education Levels" checkboxes.
            'education_levels' => collect(config('admission.education_levels', []))
                ->map(fn ($m, $k) => ['key' => $k, 'label' => $m['label']])->values(),
            'document_types' => $this->collegeDocumentTypes(),
        ]);
    }

    // PUT /api/settings — bulk-update text settings (college admin only).
    // Only updates keys that already exist for this college; ignores unknown keys.
    public function update(Request $request)
    {
        $request->validate([
            'settings'               => 'required|array',
            'settings.primary_color' => 'nullable|string|max:20',
            'settings.contact_email' => 'nullable|email|max:255',
            'settings.contact_phone' => 'nullable|string|max:50',
            'settings.admission_open'=> 'nullable|in:true,false',
            'settings.allow_multiple_admissions' => 'nullable|in:true,false',
            'settings.auto_generate_challan' => 'nullable|in:true,false',
            'settings.late_fee_mode'         => 'nullable|in:off,flat,per_week,per_month',
            'settings.late_fee_amount'       => 'nullable|numeric|min:0',
            'settings.late_fee_partial'      => 'nullable|in:from_day_one,full_period',
            'settings.require_complete_profile'  => 'nullable|in:true,false',
            'settings.required_education_levels' => ['nullable', 'string', function ($attr, $value, $fail) {
                $known = array_keys(config('admission.education_levels', []));
                foreach (array_filter(array_map('trim', explode(',', (string) $value))) as $k) {
                    if (!in_array($k, $known)) $fail("Unknown education level: {$k}.");
                }
            }],
            'document_types'               => 'nullable|array',
            'document_types.*.id'          => 'required|integer|exists:required_document_types,id',
            'document_types.*.is_active'   => 'required|boolean',
            'document_types.*.is_required' => 'required|boolean',
            // 'logo' is intentionally NOT handled here — it's a file upload,
            // done via a separate endpoint with the public disk.
            'settings.logo' => ['nullable', 'string', 'max:500', function ($attr, $value, $fail) {
                // Only an image from THIS college's Media Library (tenant scope applies).
                if (filled($value) && !\App\Models\Media::where('public_url', $value)->where('media_type', 'image')->exists()) {
                    $fail("Choose an image from this college's Media Library.");
                }
            }],
            'settings.favicon' => ['nullable', 'string', 'max:500', function ($attr, $value, $fail) {
                if (filled($value) && !\App\Models\Media::where('public_url', $value)->where('media_type', 'image')->exists()) {
                    $fail("Choose an image from this college's Media Library.");
                }
            }],
        ]);

        $incoming = $request->input('settings', []);
        $updated  = [];

        foreach ($incoming as $key => $value) {
            // Only update keys that already exist for THIS college.
            // Prevents injecting arbitrary settings. Global scope keeps it tenant-safe.
            $setting = Setting::where('key', $key)->first();

            if ($setting) {
                $setting->update(['value' => $value]);
                $updated[] = $key;
            }
        }

        // This college's applicant document choices (master list stays with super admin).
        foreach ($request->input('document_types', []) as $row) {
            CollegeDocumentType::updateOrCreate(
                ['college_id' => app('current_college')->id, 'required_document_type_id' => $row['id']],
                ['is_active' => $row['is_active'], 'is_required' => $row['is_active'] && $row['is_required']]
            );
        }

        $settings = Setting::all(['key', 'value', 'group']);

        return response()->json([
            'message'      => 'Settings updated.',
            'updated_keys' => $updated,
            'settings'     => $settings->pluck('value', 'key'),
        ]);
    }

    // Applicant document types for the Settings screen: master list + this college's choices.
    private function collegeDocumentTypes(): array
    {
        $collegeId = app('current_college')->id;
        // $certs     = app(ApplicantProfileService::class)->certificateSlugs();
        $choices   = CollegeDocumentType::where('college_id', $collegeId)->get()->keyBy('required_document_type_id');

        return RequiredDocumentType::where('scope', ApplicantProfileService::DOC_SCOPE)
            ->where('is_active', true)
            ->orderBy('sort_order')->orderBy('name')
            ->get()
            ->map(fn ($t) => [
                'id'             => $t->id,
                'name'           => $t->name,
                'slug'           => $t->slug,
                'is_certificate' => (bool) $t->education_level,   // tied to an education level
                'education_level'=> $t->education_level,
                'is_active'      => $choices->get($t->id)?->is_active ?? true,
                // Level documents default to Required (they count only when their level is required).
                'is_required'    => $choices->get($t->id)?->is_required ?? ($t->education_level ? true : (bool) $t->is_mandatory),
            ])
            ->values()
            ->all();
    }

    public function publicIndex()
    {
        $keys = ['logo', 'primary_color', 'contact_email', 'contact_phone', 'admission_open'];
        $settings = Setting::whereIn('key', $keys)->pluck('value', 'key');
        $college = app('current_college');
        return response()->json([
            'name'     => $college->name,
            'slug'     => $college->slug,
            'settings' => $settings,
        ]);
    }
}