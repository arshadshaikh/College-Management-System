<?php

namespace App\Services;

use App\Models\College;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * What a college's subscription allows, for enforcement:
 *  - features      : plan features + feature add-ons (config/plans.php keys)
 *  - student_limit : plan limit + extra student blocks (null = no limit)
 *  - status        : none | trial | active | grace | expired
 *
 * Cached per college for 10 minutes. Changing a college's plan forgets that
 * college; changing a plan or add-on bumps a version so every college reloads.
 *
 * The platform site and a college with no plan are not restricted.
 */
class PlanGate
{
    public static function forget(int $collegeId): void
    {
        Cache::forget(self::key($collegeId));
    }

    public static function forgetAll(): void
    {
        Cache::forever('plan_gate_v', (int) Cache::get('plan_gate_v', 0) + 1);
    }

    private static function key(int $collegeId): string
    {
        return 'plan_gate:' . (int) Cache::get('plan_gate_v', 0) . ':' . $collegeId;
    }

    public static function for(int $collegeId): array
    {
        return Cache::remember(self::key($collegeId), 600, function () use ($collegeId) {
            $college = College::with('plan', 'addons')->find($collegeId);
            if (!$college || $college->is_platform || !$college->plan) {
                return ['restricted' => false, 'features' => null, 'student_limit' => null,
                        'status' => $college?->plan ? 'active' : 'none', 'expires_at' => null, 'grace_ends_at' => null];
            }
            $sub = $college->subscription();
            return [
                'restricted'    => true,
                'features'      => $college->effectiveFeatures(),
                'student_limit' => $college->studentLimit(),
                'status'        => $sub['status'],
                'expires_at'    => $sub['expires_at'],
                'grace_ends_at' => $sub['grace_ends_at'],
            ];
        });
    }

    // Feature keys this college does NOT have (empty when unrestricted).
    public static function lockedFeatures(int $collegeId): array
    {
        $gate = self::for($collegeId);
        if (!$gate['restricted']) return [];
        return array_values(array_diff(array_keys(config('plans.features', [])), $gate['features']));
    }

    // The feature (key + label) a privilege slug belongs to, if that feature is locked for the college.
    public static function lockedFeatureFor(int $collegeId, string $privilegeSlug): ?array
    {
        foreach (self::lockedFeatures($collegeId) as $key) {
            if (self::featureCovers($key, $privilegeSlug)) {
                return ['key' => $key, 'label' => config("plans.features.{$key}.label")];
            }
        }
        return null;
    }

    public static function featureCovers(string $key, string $slug): bool
    {
        $f = config("plans.features.{$key}", []);
        if (in_array($slug, $f['privileges'] ?? [], true) || in_array($slug, $f['menus'] ?? [], true)) return true;
        foreach ($f['privilege_prefixes'] ?? [] as $prefix) {
            if (str_starts_with($slug, $prefix)) return true;
        }
        return false;
    }

    // Is this privilege/menu slug locked for the college?
    public static function isLocked(int $collegeId, string $slug): bool
    {
        return self::lockedFeatureFor($collegeId, $slug) !== null;
    }

    // Read-only once the grace period after the end date is over.
    public static function readOnly(int $collegeId): bool
    {
        return self::for($collegeId)['status'] === 'expired';
    }

    public static function activeStudents(int $collegeId): int
    {
        return DB::table('users')->where('college_id', $collegeId)
            ->where('user_type', 'student')->where('is_active', true)->count();
    }

    /**
     * null when $adding more active students fit the limit, otherwise the message to show.
     */
    public static function studentLimitMessage(int $collegeId, int $adding = 1): ?string
    {
        $limit = self::for($collegeId)['student_limit'];
        if ($limit === null) return null;
        $now = self::activeStudents($collegeId);
        if ($now + $adding <= $limit) return null;
        $room = max(0, $limit - $now);
        return $room === 0
            ? "Your plan allows {$limit} active students and you have {$now}. Ask the platform administrator for extra students or a bigger plan."
            : "Your plan allows {$limit} active students and you have {$now}, so only {$room} more can be added. Ask the platform administrator for extra students or a bigger plan.";
    }
}
