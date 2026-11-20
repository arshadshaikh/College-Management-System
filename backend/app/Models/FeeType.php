<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * A kind of fee a college charges (Tuition, Exam, Hostel, Transcript ...).
 * Each college manages its own list in Settings -> Fees & Challans.
 * fee_structures.fee_type stores the slug.
 */
class FeeType extends Model
{
    use BelongsToTenant;

    protected $fillable = ['college_id', 'slug', 'name', 'is_active', 'service_amount', 'sort_order'];

    protected $casts = [
        'is_active'  => 'boolean',
        'service_amount' => 'decimal:2', // set = students can request it from the portal
        'sort_order' => 'integer',
    ];

    // Starter list for every new college (same as the old fixed enum).
    public const DEFAULTS = [
        'admission'        => 'Admission',
        'semester'         => 'Semester',
        'exam'             => 'Exam',
        'library'          => 'Library',
        'sports'           => 'Sports',
        'security_deposit' => 'Security Deposit',
        'arrears'          => 'Arrears',
        'other'            => 'Other',
    ];

    // Idempotent: adds missing defaults only, never touches existing rows.
    public static function seedDefaults(int $collegeId): void
    {
        $i = 0;
        foreach (self::DEFAULTS as $slug => $name) {
            static::withoutTenantScope()->firstOrCreate(
                ['college_id' => $collegeId, 'slug' => $slug],
                ['name' => $name, 'is_active' => true, 'sort_order' => ++$i]
            );
        }
    }

    // Number of fee lines (any program) that use this type.
    public function usageCount(): int
    {
        return FeeStructure::where('fee_type', $this->slug)->count();
    }
}
