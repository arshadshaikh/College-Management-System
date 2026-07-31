<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class College extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name', 'slug', 'email', 'phone',
        'address', 'city', 'province',
        'status', 'rejection_reason',
        'approved_at', 'approved_by',
    ];

    protected $casts = [
        'approved_at' => 'datetime',
    ];

    // Users belonging to this college
    public function users()
    {
        return $this->hasMany(User::class);
    }

    // Convenience scopes
    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    public function documents()
    {
        return $this->hasMany(CollegeDocument::class);
    }
}