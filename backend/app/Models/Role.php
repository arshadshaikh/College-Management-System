<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Role extends Model
{
    protected $fillable = [
        'name', 'slug', 'description', 'is_active', 'college_id', 'scope'
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function users()
    {
        return $this->belongsToMany(User::class, 'role_user')
            ->withPivot('is_active', 'created_at', 'updated_at');
    }

    public function privileges()
    {
        return $this->belongsToMany(Privilege::class, 'privilege_role');
    }

    public function college()
    {
        return $this->belongsTo(College::class);
    }
}
