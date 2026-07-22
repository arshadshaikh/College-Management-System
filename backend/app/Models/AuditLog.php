<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

class AuditLog extends Model
{
    protected $table = 'audit_logs';

    protected $fillable = [
        'college_id', 'user_id', 'action',
        'auditable_type', 'auditable_id',
        'old_values', 'new_values',
        'ip_address', 'user_agent',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
    ];

    /**
     * Record an audit entry.
     *
     * @param string $action  e.g. 'application.approved'
     * @param Model|null $subject  the model acted upon
     * @param array $newValues  optional context / changed values
     * @param array $oldValues  optional prior values
     */
    public static function record(
        string $action,
        ?Model $subject = null,
        array $newValues = [],
        array $oldValues = []
    ): self {
        return self::create([
            // Tenant from the resolved college; null on the main domain.
            'college_id'     => app()->bound('current_college') ? app('current_college')->id : null,
            'user_id'        => Auth::id(),
            'action'         => $action,
            'auditable_type' => $subject ? get_class($subject) : null,
            'auditable_id'   => $subject?->getKey(),
            'old_values'     => $oldValues ?: null,
            'new_values'     => $newValues ?: null,
            'ip_address'     => Request::ip(),
            'user_agent'     => substr((string) Request::userAgent(), 0, 500),
        ]);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function college()
    {
        return $this->belongsTo(College::class);
    }
}