<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class StudentEducation extends Model
{
    use BelongsToTenant;

    protected $table = 'student_educations';

    protected $fillable = [
        'college_id', 'student_id', 'level', 'degree_title',
        'board_university', 'institution', 'roll_no', 'passing_year',
        'total_marks', 'obtained_marks', 'grade', 'cgpa', 'cgpa_scale',
        'document_id',
        'system', 'grades_summary', 'study_group',
    ];

    protected $casts = [
        'passing_year'   => 'integer',
        'total_marks'    => 'integer',
        'obtained_marks' => 'integer',
        'cgpa'           => 'decimal:2',
        'cgpa_scale'     => 'decimal:2',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function document()
    {
        return $this->belongsTo(Document::class);
    }
}