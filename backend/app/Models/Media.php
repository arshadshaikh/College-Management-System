<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Media extends Model
{
    use BelongsToTenant;

    protected $table = 'media';

    protected $fillable = [
        'college_id', 'uploaded_by', 'media_type', 'original_name',
        'stored_path', 'public_url', 'mime_type', 'file_size',
        'width', 'height', 'alt_text',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'width'     => 'integer',
        'height'    => 'integer',
    ];

    protected $hidden = ['stored_path'];

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}