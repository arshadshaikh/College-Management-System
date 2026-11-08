<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class StudentProfile extends Model
{
    use BelongsToTenant, SoftDeletes;

    protected $fillable = [
        'user_id', 'college_id', 'registration_no',
        'father_name', 'cnic', 'date_of_birth', 'gender',
        'nationality', 'religion', 'permanent_address',
        'emergency_contact', 'matric_marks', 'matric_board',
        'matric_year', 'inter_marks', 'inter_board', 'inter_year',
        // Admission profile (added 2026_11_07)
        'domicile_province', 'domicile_district',
        'prc_no', 'marital_status', 'present_address',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}