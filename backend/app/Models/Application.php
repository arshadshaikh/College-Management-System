<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Application extends Model
{
    use BelongsToTenant, SoftDeletes;

    protected $fillable = [
        'application_no', 'college_id', 'student_id',
        'program_id', 'status', 'rejection_reason',
        'reviewed_by', 'reviewed_at', 'semester_no', 'admission_year',
    ];

    protected $casts = [
        'reviewed_at'   => 'datetime',
        'semester_no'   => 'integer',
        'admission_year' => 'integer',
    ];

    // Generate a unique application number before creating
    protected static function booted(): void
    {
        static::creating(function (Application $application) {
            if (empty($application->application_no)) {
                $application->application_no = self::generateApplicationNo();
            }
        });
    }

    private static function generateApplicationNo(): string
    {
        $year   = date('Y');
        $latest = self::withoutGlobalScopes()
            ->where('application_no', 'like', "APP-{$year}-%")
            ->lockForUpdate()
            ->count();

        return 'APP-' . $year . '-' . str_pad($latest + 1, 5, '0', STR_PAD_LEFT);
    }

    // Relationships
    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function program()
    {
        return $this->belongsTo(Program::class);
    }

    public function college()
    {
        return $this->belongsTo(College::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function documents()
    {
        return $this->hasMany(Document::class);
    }

    // Status helpers
    public function isEditable(): bool
    {
        return $this->status === 'draft';
    }

    public function canBeReviewed(): bool
    {
        return in_array($this->status, ['submitted', 'under_review']);
    }
}