<?php

namespace App\Observers;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Logs every create / update / delete / restore of an observed model into
 * audit_logs, with the fields that changed (old and new values).
 *
 * Registered for each model in AppServiceProvider::boot().
 * Action names: "<model>.<event>", e.g. "program.updated", "cms_page.deleted".
 *
 * Not covered (no model events fire): pivot attach/detach/sync
 * (e.g. role privileges) and query-builder mass updates
 * (Model::where(...)->update([...])). Those get explicit
 * AuditLog::record() calls where they matter.
 */
class AuditObserver
{
    /** Never stored: noise. */
    private const IGNORED = ['created_at', 'updated_at', 'deleted_at', 'remember_token'];

    /** Shown only as "[hidden]" so a change is visible but the value is not. */
    private const SECRETS = ['password'];

    /** Long text (e.g. CMS page HTML) is cut to this many characters. */
    private const MAX_LEN = 1000;

    public function created(Model $model): void
    {
        $this->log($model, 'created', $this->clean($model, $model->getAttributes()), []);
    }

    public function updated(Model $model): void
    {
        $changed = array_diff_key($model->getChanges(), array_flip(self::IGNORED));
        if (!$changed) {
            return; // only timestamps changed
        }

        $old = [];
        foreach (array_keys($changed) as $key) {
            $old[$key] = $model->getRawOriginal($key);
        }

        $this->log($model, 'updated', $this->clean($model, $changed), $this->clean($model, $old));
    }

    public function deleted(Model $model): void
    {
        // Keep a copy of what was deleted.
        $this->log($model, 'deleted', [], $this->clean($model, $model->getAttributes()));
    }

    public function restored(Model $model): void
    {
        $this->log($model, 'restored', [], []);
    }

    private function log(Model $model, string $event, array $new, array $old): void
    {
        // Seeders, migrations and artisan commands would flood the log.
        if (app()->runningInConsole() && !app()->runningUnitTests()) {
            return;
        }

        // A readable name for the record, so the log says
        // "Program: BS Computer Science" and not only "Program #2".
        $label = $this->label($model);
        if ($label !== null) {
            $new = ['_label' => $label] + $new;
        }

        AuditLog::record(
            Str::snake(class_basename($model)) . '.' . $event,
            $model,
            $new,
            $old,
            null,
            // Tenant = the record's own college when it has one.
            $model->getAttribute('college_id') ?: null
        );
    }

    private function clean(Model $model, array $values): array
    {
        $hidden = $model->getHidden();
        $out = [];

        foreach ($values as $key => $value) {
            if (in_array($key, self::IGNORED, true)) {
                continue;
            }
            if (in_array($key, self::SECRETS, true) || in_array($key, $hidden, true)) {
                $out[$key] = '[hidden]';
                continue;
            }
            if (is_string($value) && mb_strlen($value) > self::MAX_LEN) {
                $value = mb_substr($value, 0, self::MAX_LEN) . '…';
            }
            $out[$key] = $value;
        }

        return $out;
    }

    private function label(Model $model): ?string
    {
        foreach (['name', 'title', 'key', 'slug', 'label', 'code'] as $field) {
            $value = $model->getAttribute($field);
            if (is_string($value) && $value !== '') {
                return Str::limit($value, 120);
            }
        }
        return null;
    }
}
