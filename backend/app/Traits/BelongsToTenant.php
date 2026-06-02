<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;

trait BelongsToTenant
{
    /**
     * Boot the trait — auto-scope all queries to the current tenant.
     * Also auto-fills college_id on create.
     */
    protected static function bootBelongsToTenant(): void
    {
        // Auto-scope SELECT / UPDATE / DELETE to current college
        static::addGlobalScope('tenant', function (Builder $query) {
            if (app()->bound('current_college')) {
                $query->where(
                    (new static)->getTable() . '.college_id',
                    app('current_college')->id
                );
            }
        });

        // Auto-fill college_id on INSERT
        static::creating(function ($model) {
            if (app()->bound('current_college') && empty($model->college_id)) {
                $model->college_id = app('current_college')->id;
            }
        });
    }

    /**
     * Bypass the global tenant scope when needed (e.g. super admin queries).
     */
    public static function withoutTenantScope(): Builder
    {
        return static::withoutGlobalScope('tenant');
    }

    public function college()
    {
        return $this->belongsTo(\App\Models\College::class);
    }
}