<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'challan_id', 'college_id', 'student_id',
        'amount_paid', 'payment_reference', 'payment_method',
        'bank_name', 'paid_at', 'notes',
        'recorded_by', 'slip_path', 'slip_verified',
        'slip_verified_by', 'slip_verified_at',
    ];

    protected $casts = [
        'amount_paid'       => 'decimal:2',
        'paid_at'           => 'date',
        'slip_verified'     => 'boolean',
        'slip_verified_at'  => 'datetime',
    ];

    protected $hidden = ['slip_path'];

    public function challan()
    {
        return $this->belongsTo(Challan::class);
    }

    public function student()
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function recordedBy()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}