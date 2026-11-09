<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A college's own choice for one master document type:
 * does it ask for it (is_active) and is it required (is_required)?
 * No row = use the master list's is_active / is_mandatory.
 */
class CollegeDocumentType extends Model
{
    protected $fillable = ['college_id', 'required_document_type_id', 'is_active', 'is_required'];

    protected $casts = [
        'is_active'   => 'boolean',
        'is_required' => 'boolean',
    ];

    public function documentType()
    {
        return $this->belongsTo(RequiredDocumentType::class, 'required_document_type_id');
    }
}
