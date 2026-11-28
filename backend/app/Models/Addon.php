<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A paid add-on a college can have on top of its plan. Platform level (not tenant scoped).
 * Price is per month, per unit.
 */
class Addon extends Model
{
    protected $fillable = ['name', 'description', 'kind', 'feature', 'students_per_unit', 'price', 'is_active', 'sort_order'];

    protected $casts = [
        'price'             => 'decimal:2',
        'students_per_unit' => 'integer',
        'is_active'         => 'boolean',
        'sort_order'        => 'integer',
    ];

    public function colleges()
    {
        return $this->belongsToMany(College::class, 'college_addon')->withPivot('quantity', 'price')->withTimestamps();
    }
}
