<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * A college affiliated with this university (managed under Affiliated Colleges).
 * Not to be confused with College, which is the tenant itself.
 */
class AffiliatedCollege extends Model
{
    use BelongsToTenant;

    protected $fillable = ['college_id', 'code', 'name', 'city', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
