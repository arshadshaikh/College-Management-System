<?php

namespace App\Services;

use App\Models\Setting;

/**
 * Reads the college's timetable settings (Settings → Timetable).
 * Catalogs (all possible shifts and days) live in config/timetable.php.
 */
class TimetableService
{
    // Enabled shift keys in catalog order, e.g. ['morning', 'evening']. Never empty.
    public function enabledShifts(): array
    {
        $keys = array_filter(array_map('trim', explode(',', (string) Setting::where('key', 'shifts')->value('value'))));
        $keys = array_values(array_intersect(array_keys(config('timetable.shifts')), $keys));

        return $keys ?: ['morning'];
    }

    // [['key' => 'morning', 'label' => 'Morning'], ...]
    public function shiftOptions(): array
    {
        return collect($this->enabledShifts())
            ->map(fn ($k) => ['key' => $k, 'label' => $this->shiftLabel($k)])
            ->values()->all();
    }

    public function shiftLabel(?string $key): string
    {
        return config("timetable.shifts.{$key}", ucfirst((string) $key));
    }

    // ISO day numbers, sorted. Never empty (falls back to Monday–Friday).
    public function workingDays(): array
    {
        $days = array_map('intval', array_filter(explode(',', (string) Setting::where('key', 'timetable_days')->value('value'))));
        $days = array_values(array_unique(array_filter($days, fn ($d) => $d >= 1 && $d <= 7)));
        sort($days);

        return $days ?: [1, 2, 3, 4, 5];
    }
}
