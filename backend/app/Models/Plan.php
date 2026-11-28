<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A subscription plan. Platform level: NOT tenant scoped (no BelongsToTenant).
 */
class Plan extends Model
{
    protected $fillable = [
        'name', 'slug', 'description', 'price', 'billing_period',
        'max_students', 'features', 'is_default', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'features'     => 'array',
        'price'        => 'decimal:2',
        'max_students' => 'integer',
        'is_default'   => 'boolean',
        'is_active'    => 'boolean',
    ];

    public function colleges()
    {
        return $this->hasMany(College::class);
    }

    public function hasFeature(string $key): bool
    {
        return in_array($key, $this->features ?? [], true);
    }

    public static function featureCatalog(): array
    {
        return collect(config('plans.features', []))
            ->map(fn ($f, $key) => ['key' => $key, 'label' => $f['label'], 'description' => $f['description'], 'coming_soon' => (bool) ($f['coming_soon'] ?? false)])
            ->values()->all();
    }
}
