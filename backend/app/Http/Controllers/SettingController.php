<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\Request;
use App\Models\CollegeDocumentType;
use App\Models\RequiredDocumentType;
use App\Models\TimetablePeriod;
use App\Models\AcademicTerm;
use App\Models\FeeType;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
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
            // Catalog for the "Editable after approval" checkboxes.
            'post_approval_field_options' => collect(config('admission.post_approval_field_options', []))
                ->map(fn ($label, $k) => ['key' => $k, 'label' => $label])->values(),
            'document_types' => $this->collegeDocumentTypes(),
            // Timetable: the college's daily periods (working days are the setting timetable_days).
            'timetable_periods' => $this->timetablePeriods(),
            'academic_terms'    => $this->academicTerms(),
            'fee_types'         => $this->feeTypes(),
            // Catalogs for the Timetable section (choices live in config/timetable.php).
            'shift_options' => collect(config('timetable.shifts'))->map(fn ($l, $k) => ['key' => $k, 'label' => $l])->values(),
            'day_options'   => collect(config('timetable.days'))->map(fn ($l, $k) => ['key' => $k, 'label' => $l])->values(),
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
            'settings.show_login_link' => 'nullable|in:true,false',
            'settings.allow_multiple_admissions' => 'nullable|in:true,false',
            'settings.auto_generate_challan' => 'nullable|in:true,false',
            'settings.late_fee_mode'         => 'nullable|in:off,flat,per_week,per_month',
            'settings.late_fee_amount'       => 'nullable|numeric|min:0',
            'settings.late_fee_partial'      => 'nullable|in:from_day_one,full_period',
            'settings.service_challan_due_days' => 'nullable|integer|min:1|max:90',
            'settings.require_complete_profile'  => 'nullable|in:true,false',
            'settings.required_education_levels' => ['nullable', 'string', function ($attr, $value, $fail) {
                $known = array_keys(config('admission.education_levels', []));
                foreach (array_filter(array_map('trim', explode(',', (string) $value))) as $k) {
                    if (!in_array($k, $known)) $fail("Unknown education level: {$k}.");
                }
            }],
            // Profile fields approved students may still edit: CSV of config keys, empty = none.
            'settings.post_approval_editable_fields' => ['nullable', 'string', function ($attr, $value, $fail) {
                $known = array_keys(config('admission.post_approval_field_options', []));
                foreach (array_filter(array_map('trim', explode(',', (string) $value))) as $k) {
                    if (!in_array($k, $known)) $fail("Unknown profile field: {$k}.");
                }
            }],
            // Timetable working days: CSV of ISO day numbers, 1 = Monday ... 7 = Sunday.
            'settings.timetable_days' => ['nullable', 'string', 'regex:/^[1-7](,[1-7])*$/'],
            // Shifts the college runs: CSV of keys from config/timetable.php, at least one.
            'settings.shifts' => ['nullable', 'string', function ($attr, $value, $fail) {
                $keys = array_filter(array_map('trim', explode(',', (string) $value)));
                if (!$keys) $fail('Choose at least one shift.');
                foreach ($keys as $k) {
                    if (!array_key_exists($k, config('timetable.shifts'))) $fail("Unknown shift: {$k}.");
                }
            }],
            // Timetable periods: the FULL list (rows missing from it are deleted).
            'timetable_periods'              => 'nullable|array|max:20',
            'timetable_periods.*.id'         => 'nullable|integer',
            'timetable_periods.*.shift'      => ['required', 'string', \Illuminate\Validation\Rule::in(array_keys(config('timetable.shifts')))],
            'timetable_periods.*.name'       => 'required|string|max:50',
            'timetable_periods.*.start_time' => 'required|date_format:H:i',
            'timetable_periods.*.end_time'   => 'required|date_format:H:i',
            'timetable_periods.*.is_break'   => 'required|boolean',
            // Academic terms: the FULL list (rows missing from it are deleted with their timetables).
            'academic_terms'              => 'nullable|array|max:50',
            'academic_terms.*.id'         => 'nullable|integer',
            'academic_terms.*.name'       => 'required|string|max:50|distinct:ignore_case',
            'academic_terms.*.start_date' => 'required|date',
            'academic_terms.*.end_date'   => 'required|date',
            'academic_terms.*.is_current' => 'required|boolean',
            'fee_types'             => 'nullable|array|max:100',
            'fee_types.*.id'        => 'nullable|integer',
            'fee_types.*.name'      => 'required|string|max:100|distinct:ignore_case',
            'fee_types.*.is_active' => 'required|boolean',
            'fee_types.*.service_amount' => 'nullable|numeric|min:1|max:9999999',
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

        if ($request->has('timetable_periods')) {
            $this->validatePeriodTimes($request->input('timetable_periods', []));
        }
        $terms = $request->input('academic_terms', []);
        foreach ($terms as $i => $t) {
            if (strtotime($t['end_date']) <= strtotime($t['start_date'])) {
                throw \Illuminate\Validation\ValidationException::withMessages(["academic_terms.{$i}.end_date" => "\"{$t['name']}\" must end after it starts."]);
            }
        }
        if ($request->has('academic_terms') && count($terms) && collect($terms)->where('is_current', true)->count() !== 1) {
            throw \Illuminate\Validation\ValidationException::withMessages(['academic_terms' => 'Mark exactly one term as current.']);
        }

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

        // Only when the screen sent the list, so older callers never wipe periods.
        if ($request->has('timetable_periods')) {
            $this->syncTimetablePeriods($request->input('timetable_periods', []));
        }
        if ($request->has('academic_terms')) {
            $this->syncAcademicTerms($request->input('academic_terms', []));
        }
        if ($request->has('fee_types')) {
            $this->syncFeeTypes($request->input('fee_types', []));
        }

        $settings = Setting::all(['key', 'value', 'group']);

        return response()->json([
            'message'      => 'Settings updated.',
            'updated_keys' => $updated,
            'settings'     => $settings->pluck('value', 'key'),
            'timetable_periods' => $this->timetablePeriods(),
            'academic_terms'    => $this->academicTerms(),
            'fee_types'         => $this->feeTypes(),
        ]);
    }

    // ── Fee types ────────────────────────────────────────────────

    private function feeTypes(): array
    {
        return FeeType::orderBy('sort_order')->orderBy('name')->get()
            ->map(fn ($t) => [
                'id'        => $t->id,
                'slug'      => $t->slug,
                'name'      => $t->name,
                'is_active' => $t->is_active,
                'service_amount' => $t->service_amount,   // null = students cannot request it
                'in_use'    => $t->usageCount(),   // fee lines using it; such a type is never deleted
            ])
            ->values()
            ->all();
    }

    // Keep sent ids (rename / switch on-off), create new rows (slug from the name),
    // and for rows not sent: delete if unused, otherwise just switch them off.
    // A slug never changes, so fee lines that use it keep working after a rename.
    private function syncFeeTypes(array $rows): void
    {
        DB::transaction(function () use ($rows) {
            $keep = [];
            foreach (array_values($rows) as $i => $row) {
                $data = [
                    'name'           => trim($row['name']),
                    'is_active'      => (bool) $row['is_active'],
                    'service_amount' => isset($row['service_amount']) && $row['service_amount'] !== '' ? $row['service_amount'] : null,
                    'sort_order'     => $i + 1,
                ];
                $type = !empty($row['id']) ? FeeType::find($row['id']) : null;
                if ($type) {
                    $type->update($data);
                } else {
                    $base = Str::slug($data['name'], '_') ?: 'fee';
                    $slug = $base;
                    for ($n = 2; FeeType::where('slug', $slug)->exists(); $n++) {
                        $slug = $base . '_' . $n;
                    }
                    $type = FeeType::create($data + ['slug' => $slug]);
                }
                $keep[] = $type->id;
            }

            FeeType::whereNotIn('id', $keep)->get()->each(function ($t) {
                $t->usageCount() ? $t->update(['is_active' => false]) : $t->delete();
            });
        });
    }

    // ── Academic terms ───────────────────────────────────────────

    private function academicTerms(): array
    {
        return AcademicTerm::withCount('timetableEntries')
            ->orderByDesc('start_date')->get()
            ->map(fn ($t) => [
                'id'            => $t->id,
                'name'          => $t->name,
                'start_date'    => $t->start_date?->format('Y-m-d'),
                'end_date'      => $t->end_date?->format('Y-m-d'),
                'is_current'    => $t->is_current,
                'entries_count' => $t->timetable_entries_count,   // classes on this term's timetables
            ])
            ->values()
            ->all();
    }

    // Same pattern as periods: keep sent ids, create new rows, delete the rest
    // (a deleted term takes its timetables with it).
    private function syncAcademicTerms(array $rows): void
    {
        DB::transaction(function () use ($rows) {
            $keep = [];
            foreach ($rows as $row) {
                $data = [
                    'name'       => trim($row['name']),
                    'start_date' => $row['start_date'],
                    'end_date'   => $row['end_date'],
                    'is_current' => (bool) $row['is_current'],
                ];
                $term = !empty($row['id']) ? AcademicTerm::find($row['id']) : null;
                if ($term) {
                    $term->update($data);
                } else {
                    $term = AcademicTerm::create($data);
                }
                $keep[] = $term->id;
            }

            AcademicTerm::whereNotIn('id', $keep)->get()->each->delete();
        });
    }

    // ── Timetable periods ────────────────────────────────────────

    private function timetablePeriods(): array
    {
        // Tenant scope limits this to the current college.
        return TimetablePeriod::withCount('entries')
            ->orderBy('sort_order')->orderBy('start_time')->get()
            ->map(fn ($p) => [
                'id'            => $p->id,
                'shift'         => $p->shift,
                'name'          => $p->name,
                'start_time'    => substr($p->start_time, 0, 5),   // "08:30"
                'end_time'      => substr($p->end_time, 0, 5),
                'is_break'      => $p->is_break,
                'entries_count' => $p->entries_count,             // classes placed in this period
            ])
            ->values()
            ->all();
    }

    // End after start, and no two periods of the SAME shift overlap
    // (morning and evening plans are separate, so they may share clock times).
    private function validatePeriodTimes(array $rows): void
    {
        $errors = [];
        $byShift = collect($rows)->map(fn ($r, $i) => $r + ['_i' => $i])->groupBy('shift');

        foreach ($byShift as $shiftRows) {
            $sorted = $shiftRows->sortBy('start_time')->values();
            foreach ($sorted as $n => $row) {
                if ($row['end_time'] <= $row['start_time']) {
                    $errors["timetable_periods.{$row['_i']}.end_time"] = "\"{$row['name']}\" must end after it starts.";
                }
                $next = $sorted[$n + 1] ?? null;
                if ($next && $next['start_time'] < $row['end_time']) {
                    $errors["timetable_periods.{$next['_i']}.start_time"] = "\"{$next['name']}\" overlaps \"{$row['name']}\".";
                }
            }
        }

        if ($errors) {
            throw \Illuminate\Validation\ValidationException::withMessages($errors);
        }
    }

    // Replace this college's periods with the submitted list, keeping the ids that were sent
    // (so classes already placed in a period stay). Deleting a period deletes its classes.
    private function syncTimetablePeriods(array $rows): void
    {
        DB::transaction(function () use ($rows) {
            $keep = [];
            // Saved in time order, so sort_order follows the clock.
            $sorted = collect($rows)->sortBy('start_time')->values();

            foreach ($sorted as $order => $row) {
                $data = [
                    'shift'      => $row['shift'],
                    'name'       => trim($row['name']),
                    'start_time' => $row['start_time'],
                    'end_time'   => $row['end_time'],
                    'is_break'   => (bool) $row['is_break'],
                    'sort_order' => $order + 1,
                ];

                // Tenant scope: an id from another college is not found, so a new row is made.
                $period = !empty($row['id']) ? TimetablePeriod::find($row['id']) : null;
                if ($period) {
                    $period->update($data);
                } else {
                    $period = TimetablePeriod::create($data);
                }
                $keep[] = $period->id;
            }

            TimetablePeriod::whereNotIn('id', $keep)->get()->each->delete();
        });
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
        $keys = ['logo', 'primary_color', 'contact_email', 'contact_phone', 'admission_open', 'show_login_link', 'shifts'];
        $settings = Setting::whereIn('key', $keys)->pluck('value', 'key');
        $college = app('current_college');
        return response()->json([
            'name'     => $college->name,
            'slug'     => $college->slug,
            'settings' => $settings,
        ]);
    }
}