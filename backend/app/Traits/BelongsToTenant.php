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

    public function resolveRouteBinding($value, $field = null)
    {
        // return $this->where($field ?? $this->getRouteKeyName(), $value)->firstOrFail();

        $query = $this->where($field ?? $this->getRouteKeyName(), $value);

        // Explicitly enforce the tenant boundary on route-model binding.
        // Do NOT rely on the global scope here — bind queries can bypass it,
        // which would let one college fetch another college's records by id.
        if (app()->bound('current_college')) {
            $query->where($this->getTable() . '.college_id', app('current_college')->id);
        }

        return $query->firstOrFail();
    }
}