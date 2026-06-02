<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class FeeStructure extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'college_id', 'program_id', 'fee_type', 'label',
        'amount', 'semester_no', 'effective_from',
        'effective_to', 'is_active',
    ];

    protected $casts = [
        'amount'         => 'decimal:2',
        'is_active'      => 'boolean',
        'effective_from' => 'date',
        'effective_to'   => 'date',
        'semester_no'    => 'integer',
    ];

    public function program()
    {
        return $this->belongsTo(Program::class);
    }
}