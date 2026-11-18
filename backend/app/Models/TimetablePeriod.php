<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class TimetablePeriod extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'college_id', 'shift', 'name', 'start_time', 'end_time', 'is_break', 'sort_order',
    ];

    protected $casts = [
        'is_break'   => 'boolean',
        'sort_order' => 'integer',
    ];

    public function entries()
    {
        return $this->hasMany(TimetableEntry::class);
    }
}
