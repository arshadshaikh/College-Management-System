<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class AcademicTerm extends Model
{
    use BelongsToTenant;

    protected $fillable = ['college_id', 'name', 'start_date', 'end_date', 'is_current'];

    protected $casts = [
        'start_date' => 'date:Y-m-d',
        'end_date'   => 'date:Y-m-d',
        'is_current' => 'boolean',
    ];

    public function timetableEntries()
    {
        return $this->hasMany(TimetableEntry::class);
    }

    // This college's current term (tenant scope applies), or null.
    public static function current(): ?self
    {
        return static::where('is_current', true)->first();
    }
}
