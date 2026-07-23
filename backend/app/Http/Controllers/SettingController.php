<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\Request;

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
            // 'logo' is intentionally NOT handled here — it's a file upload,
            // done via a separate endpoint with the public disk.
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

        $settings = Setting::all(['key', 'value', 'group']);

        return response()->json([
            'message'      => 'Settings updated.',
            'updated_keys' => $updated,
            'settings'     => $settings->pluck('value', 'key'),
        ]);
    }
}