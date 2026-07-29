<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CollegeDocument extends Model
{
    protected $fillable = ['college_id','document_slug','document_name','original_name','stored_path','mime_type','file_size'];
    protected $hidden = ['stored_path'];
    public function college() { return $this->belongsTo(College::class); }
}
