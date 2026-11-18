<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class TimetableEntry extends Model
{
    use BelongsToTenant;

    // day: 1 = Monday ... 7 = Sunday; shift: a key of config('timetable.shifts').

    protected $fillable = [
        'college_id', 'academic_term_id', 'program_id', 'semester_no', 'shift', 'day',
        'timetable_period_id', 'course_id', 'teacher_name', 'room',
    ];

    protected $casts = [
        'semester_no' => 'integer',
        'day'         => 'integer',
    ];

    public function term()
    {
        return $this->belongsTo(AcademicTerm::class, 'academic_term_id');
    }

    public function program()
    {
        return $this->belongsTo(Program::class);
    }

    public function period()
    {
        return $this->belongsTo(TimetablePeriod::class, 'timetable_period_id');
    }

    public function course()
    {
        return $this->belongsTo(Course::class);
    }
}
