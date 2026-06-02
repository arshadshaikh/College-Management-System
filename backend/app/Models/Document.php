<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'college_id', 'application_id', 'student_id',
        'document_type', 'original_name', 'stored_path',
        'mime_type', 'file_size', 'verification_status',
        'verification_notes', 'verified_by', 'verified_at',
    ];

    protected $casts = [
        'file_size'   => 'integer',
        'verified_at' => 'datetime',
    ];

    // Hide the raw stored path from API responses — use url() instead
    protected $hidden = ['stored_path'];

    protected $appends = ['url'];

    public function getUrlAttribute(): string
    {
        return route('documents.download', $this->id);
    }

    public function application()
    {
        return $this->belongsTo(Application::class);
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }
}