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
        'address', 'city', 'province', 'is_platform',
        'status', 'rejection_reason',
        'approved_at', 'approved_by',
        'plan_id', 'plan_expires_at', 'on_trial',
    ];

    protected $casts = [
        'is_platform' => 'boolean',
        'approved_at' => 'datetime',
        'plan_expires_at' => 'date:Y-m-d',
        'on_trial' => 'boolean',
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

    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }

    public function addons()
    {
        return $this->belongsToMany(Addon::class, 'college_addon')->withPivot('quantity', 'price')->withTimestamps();
    }

    // ---- Subscription -------------------------------------------------
    // What the college may use = its plan's features + its feature add-ons.

    public function effectiveFeatures(): array
    {
        $plan   = $this->plan?->features ?? [];
        $addons = $this->addons->where('kind', 'feature')->pluck('feature')->filter()->all();
        return array_values(array_unique(array_merge($plan, $addons)));
    }

    // Students allowed: plan limit + extra student blocks. null = unlimited (or no plan).
    public function studentLimit(): ?int
    {
        if (!$this->plan || $this->plan->max_students === null) return null;
        return $this->plan->max_students + $this->extraStudents();
    }

    public function extraStudents(): int
    {
        return (int) $this->addons->where('kind', 'students')
            ->sum(fn ($a) => (int) $a->pivot->quantity * (int) $a->students_per_unit);
    }

    /**
     * none | trial | active | grace | expired, with the dates behind it.
     * After the end date the college has grace_days before it counts as expired.
     */
    public function subscription(): array
    {
        $graceDays = (int) config('plans.grace_days', 7);
        $today     = now()->startOfDay();
        $ends      = $this->plan_expires_at ? \Illuminate\Support\Carbon::parse($this->plan_expires_at)->startOfDay() : null;
        $graceEnds = $ends?->copy()->addDays($graceDays);

        $status = match (true) {
            !$this->plan_id                    => 'none',
            !$ends || $today->lte($ends)       => $this->on_trial ? 'trial' : 'active',
            $today->lte($graceEnds)            => 'grace',
            default                            => 'expired',
        };

        return [
            'status'        => $status,
            'expires_at'    => $ends?->toDateString(),
            'days_left'     => $ends ? (int) $today->diffInDays($ends, false) : null,
            'grace_ends_at' => $graceEnds?->toDateString(),
        ];
    }

    // Plan (per month) + add-ons. Yearly plans are shown per month as price / 12.
    public function monthlyTotal(): float
    {
        $plan = $this->plan ? ((float) $this->plan->price / ($this->plan->billing_period === 'yearly' ? 12 : 1)) : 0;
        $add  = $this->addons->sum(fn ($a) => (float) $a->pivot->price * (int) $a->pivot->quantity);
        return round($plan + $add, 2);
    }
}
