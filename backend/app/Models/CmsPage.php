<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CmsPage extends Model
{
    use BelongsToTenant, SoftDeletes;

    protected $table = 'cms_pages';

    protected $fillable = [
        'college_id', 'title', 'slug', 'content',
        'meta_title', 'meta_description', 'is_published', 'sort_order',
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'sort_order'   => 'integer',
    ];
}