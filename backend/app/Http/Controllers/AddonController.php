<?php

namespace App\Http\Controllers;

use App\Models\Addon;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Paid add-ons (super admin). Listed with the plans by PlanController@index;
 * given to a college by PlanController@assign.
 */
class AddonController extends Controller
{
    // POST /api/addons
    public function store(Request $request)
    {
        $data = $this->validated($request);
        $addon = DB::transaction(function () use ($data) {
            $addon = Addon::create($data);
            AuditLog::record('addon.created', $addon, ['name' => $addon->name, 'price' => $addon->price]);
            return $addon;
        });
        return response()->json(['message' => "Add-on '{$addon->name}' created.", 'addon' => $addon], 201);
    }

    // PUT /api/addons/{addon} — a new price applies to colleges that get it from now on
    public function update(Request $request, Addon $addon)
    {
        $data = $this->validated($request, $addon);
        $used = $addon->colleges()->count();
        if ($used && ($data['kind'] !== $addon->kind || ($data['feature'] ?? null) !== $addon->feature)) {
            return response()->json(['message' => "{$used} college(s) have this add-on, so what it unlocks can't be changed. Create a new add-on instead."], 422);
        }
        DB::transaction(function () use ($addon, $data) {
            $old = $addon->only(['name', 'price', 'students_per_unit', 'is_active']);
            $addon->update($data);
            AuditLog::record('addon.updated', $addon, $addon->only(array_keys($old)), $old);
        });
        return response()->json(['message' => "Add-on '{$addon->name}' saved.", 'addon' => $addon->fresh()]);
    }

    // DELETE /api/addons/{addon} — only when no college has it
    public function destroy(Addon $addon)
    {
        $used = $addon->colleges()->count();
        if ($used > 0) {
            return response()->json(['message' => "{$used} college(s) have this add-on. Remove it from them first, or mark it inactive."], 422);
        }
        DB::transaction(function () use ($addon) {
            AuditLog::record('addon.deleted', $addon, [], ['name' => $addon->name]);
            $addon->delete();
        });
        return response()->json(['message' => 'Add-on deleted.']);
    }

    private function validated(Request $request, ?Addon $addon = null): array
    {
        $data = $request->validate([
            'name'              => ['required', 'string', 'max:100', Rule::unique('addons', 'name')->ignore($addon?->id)],
            'description'       => 'nullable|string|max:500',
            'kind'              => 'required|in:feature,students',
            'feature'           => ['required_if:kind,feature', 'nullable', 'string', Rule::in(array_keys(config('plans.features', [])))],
            'students_per_unit' => 'required_if:kind,students|nullable|integer|min:1|max:100000',
            'price'             => 'required|numeric|min:0|max:99999999',
            'is_active'         => 'boolean',
            'sort_order'        => 'nullable|integer|min:0|max:1000',
        ], ['feature.required_if' => 'Choose the feature this add-on unlocks.', 'students_per_unit.required_if' => 'Enter how many students one unit adds.']);

        if ($data['kind'] === 'feature') $data['students_per_unit'] = null;
        else $data['feature'] = null;
        $data['sort_order'] = $data['sort_order'] ?? 0;
        return $data;
    }
}
