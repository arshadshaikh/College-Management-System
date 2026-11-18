<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Course extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'college_id', 'program_id', 'semester_no', 'code', 'title',
        'credit_hours', 'is_active',
    ];

    protected $casts = [
        'semester_no'  => 'integer',
        'credit_hours' => 'decimal:1',
        'is_active'    => 'boolean',
    ];

    public function program()
    {
        return $this->belongsTo(Program::class);
    }

    public function timetableEntries()
    {
        return $this->hasMany(TimetableEntry::class);
    }
}
