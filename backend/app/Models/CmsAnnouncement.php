<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CmsAnnouncement extends Model
{
    use BelongsToTenant, SoftDeletes;

    protected $table = 'cms_announcements';

    protected $fillable = [
        'college_id', 'title', 'body', 'is_published', 'published_at',
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'published_at' => 'datetime',
    ];
}