<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class PolicyService
{
    /**
     * Resolve a hierarchical policy.
     *
     * Platform row (college_id NULL) for $platformKey:
     *   - concrete value  → enforced platform-wide, college setting ignored
     *   - 'college_choice' (or missing) → the college's own $collegeKey decides
     *   - neither set → $default
     */
    public static function resolve(
        string $platformKey,
        string $collegeKey,
        ?int $collegeId,
        string $default = 'false'
    ): string {
        $platform = DB::table('settings')
            ->whereNull('college_id')
            ->where('key', $platformKey)
            ->value('value');

        if ($platform !== null && $platform !== 'college_choice') {
            return $platform;                       // super admin enforces
        }

        if ($collegeId) {
            $college = DB::table('settings')
                ->where('college_id', $collegeId)
                ->where('key', $collegeKey)
                ->value('value');
            if ($college !== null) return $college; // college decides
        }

        return $default;
    }

    public static function allows(string $platformKey, string $collegeKey, ?int $collegeId, string $default = 'false'): bool
    {
        return in_array(
            self::resolve($platformKey, $collegeKey, $collegeId, $default),
            ['true', 'allow', '1'],
            true
        );
    }
}