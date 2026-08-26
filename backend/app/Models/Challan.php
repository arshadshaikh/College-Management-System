<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Challan extends Model
{
    use BelongsToTenant, SoftDeletes;

    // protected $fillable = [
    //     'challan_no', 'college_id', 'application_id', 'student_id',
    //     'challan_type', 'semester_no', 'total_amount',
    //     'issue_date', 'due_date', 'status', 'fee_breakdown',
    // ];

    protected $fillable = [
        'challan_no', 'college_id', 'application_id', 'student_id',
        'challan_type', 'title', 'semester_no', 'installment_no', 'scope',
        'total_amount', 'issue_date', 'due_date', 'status', 'fee_breakdown',
    ];

    protected $casts = [
        'fee_breakdown' => 'array',
        'total_amount'  => 'decimal:2',
        'issue_date'    => 'date',
        'due_date'      => 'date',
    ];

    protected static function booted(): void
    {
        static::creating(function (Challan $challan) {
            if (empty($challan->challan_no)) {
                $challan->challan_no = self::generateChallanNo();
            }
        });
    }

    private static function generateChallanNo(): string
    {
        $year   = date('Y');
        $latest = self::withoutGlobalScopes()
            ->where('challan_no', 'like', "CHN-{$year}-%")
            ->count();

        return 'CHN-' . $year . '-' . str_pad($latest + 1, 5, '0', STR_PAD_LEFT);
    }

    // Route model binding respects tenant scope
    public function resolveRouteBinding($value, $field = null): ?self
    {
        $query = $this->where($field ?? $this->getRouteKeyName(), $value);

        if (app()->bound('current_college')) {
            $query->where('college_id', app('current_college')->id);
        }

        return $query->firstOrFail();
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function application()
    {
        return $this->belongsTo(Application::class);
    }

    public function college()
    {
        return $this->belongsTo(College::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function items()
    {
        return $this->hasMany(ChallanItem::class)->orderBy('sort_order');
    }

    public function isOverdue(): bool
    {
        return $this->status === 'unpaid' && $this->due_date->isPast();
    }

    public function isPaid(): bool
    {
        return $this->status === 'paid';
    }

    /**
     * Recompute total_amount as the sum of this challan's items and save.
     * Call after adding/editing/removing items so the header total always
     * matches the printed lines.
     */
    public function recomputeTotal(): void
    {
        $this->total_amount = $this->items()->sum('amount');
        $this->save();
    }
}