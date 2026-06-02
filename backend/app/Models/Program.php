<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Program extends Model
{
    use BelongsToTenant, SoftDeletes;

    protected $fillable = [
        'college_id', 'name', 'code', 'degree_level',
        'duration_years', 'total_semesters', 'total_seats',
        'eligibility_criteria', 'description', 'is_active',
    ];

    protected $casts = [
        'is_active'       => 'boolean',
        'duration_years'  => 'integer',
        'total_semesters' => 'integer',
        'total_seats'     => 'integer',
    ];

    public function college()
    {
        return $this->belongsTo(College::class);
    }

    public function feeStructures()
    {
        return $this->hasMany(FeeStructure::class);
    }

    public function applications()
    {
        return $this->hasMany(Application::class);
    }

    // How many seats are still available
    public function availableSeats(): int
    {
        $taken = $this->applications()
            ->whereIn('status', ['approved', 'shortlisted'])
            ->count();

        return max(0, $this->total_seats - $taken);
    }
}