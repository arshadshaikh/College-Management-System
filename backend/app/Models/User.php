<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use PHPOpenSourceSaver\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasFactory;

    protected $fillable = [
        'name',
        'cnic_no',
        'email',
        'phone',
        'password',
        'is_active',
        'active_role_id',
        'college_id',   // ← added
        'user_type',    // ← added
    ];

    protected $hidden = [
        'password',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    // ── JWT ──────────────────────────────────────────────────────
    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    // Embed college_id + user_type into every token — no DB hit needed
    // to know which tenant and role type the bearer belongs to
    public function getJWTCustomClaims()
    {
        return [
            'college_id' => $this->college_id,
            'user_type' => $this->user_type,
        ];
    }

    public function roles()
    {
        return $this->belongsToMany(Role::class, 'role_user')
            ->withPivot('is_active', 'created_at', 'updated_at');
    }

    public function activeRoles()
    {
        return $this->belongsToMany(Role::class, 'role_user')
            ->wherePivot('is_active', true)
            ->withPivot('is_active', 'created_at', 'updated_at');
    }

    public function activeRole()
    {
        return $this->belongsTo(Role::class, 'active_role_id');
    }

    // ── Privilege helpers (unchanged) ────────────────────────────
    public function hasPrivilege(string $slug): bool
    {
        if (!$this->active_role_id) return false;

        return Role::where('id', $this->active_role_id)
            ->where('is_active', true)
            ->whereHas('privileges', function ($q) use ($slug) {
                $q->where('privileges.slug', $slug)->where('privileges.is_active', true);
            })->exists();
    }

    public function hasRole(string $slug): bool
    {
        return $this->activeRoles()->where('slug', $slug)->where('is_active', true)->exists();
    }

    public function getAllPrivileges()
    {
        if (!$this->active_role_id) return collect();

        return Privilege::whereHas('roles', function ($q) {
            $q->where('roles.id', $this->active_role_id)
              ->where('roles.is_active', true);
        })->where('is_active', true)->get();
    }

    public function getMenuItems()
    {
        if (!$this->active_role_id) return collect();

        $userPrivilegeIds = Privilege::whereHas('roles', function ($q) {
            $q->where('roles.id', $this->active_role_id)
              ->where('roles.is_active', true);
        })->where('is_active', true)->pluck('id');

        return Privilege::whereIn('id', $userPrivilegeIds)
            ->where('show_in_menu', true)
            ->whereNull('parent_id')
            ->with('menuChildren')
            ->orderBy('sort_order')
            ->get();
    }

    // public function college()
    // {
    //     return $this->belongsTo(\App\Models\College::class);
    // }

    public function college()
    {
        return $this->belongsTo(College::class);
    }

    public function studentProfile()
    {
        return $this->hasOne(StudentProfile::class);
    }

    public function isSuperAdmin(): bool
    {
        return $this->user_type === 'super_admin';
    }

    public function isCollegeAdmin(): bool
    {
        return $this->user_type === 'college_admin';
    }

    public function isStudent(): bool
    {
        return $this->user_type === 'student';
    }

}
