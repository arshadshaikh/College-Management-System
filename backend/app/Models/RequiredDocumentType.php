<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RequiredDocumentType extends Model
{
    protected $fillable = ['scope', 'name', 'slug', 'is_mandatory', 'allowed_mime_types', 'max_size_kb', 'max_dimension', 'is_active', 'sort_order'];

    protected $casts = [
        'is_mandatory' => 'boolean',
        'is_active'    => 'boolean',
        'sort_order'   => 'integer',
        'max_size_kb'  => 'integer',
        'max_dimension'=> 'integer',
    ];
}