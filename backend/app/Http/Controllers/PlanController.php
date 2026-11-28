<?php

namespace App\Http\Controllers;

use App\Models\Addon;
use App\Models\AuditLog;
use App\Models\College;
use App\Models\Plan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Subscription plans. Super admin manages plans and assigns one to each college;
 * a college admin sees their own plan and usage (mine).
 */
class PlanController extends Controller
{
    // GET /api/plans — all plans + the feature catalog
    public function index()
    {
        $plans = Plan::withCount(['colleges' => fn ($q) => $q->where('is_platform', false)])
            ->orderBy('sort_order')->orderBy('price')->get();

        $addons = Addon::withCount('colleges')->orderBy('sort_order')->orderBy('name')->get();

        return response()->json([
            'plans'      => $plans,
            'addons'     => $addons,
            'features'   => Plan::featureCatalog(),
            'trial_days' => (int) config('plans.trial_days', 30),
            'grace_days' => (int) config('plans.grace_days', 7),
        ]);
    }

    // POST /api/plans
    public function store(Request $request)
    {
        $data = $this->validated($request);
        $plan = DB::transaction(function () use ($data) {
            $plan = Plan::create($data + ['slug' => $this->uniqueSlug($data['name'])]);
            $this->keepOneDefault($plan);
            AuditLog::record('plan.created', $plan, ['name' => $plan->name]);
            return $plan;
        });
        return response()->json(['message' => "Plan '{$plan->name}' created.", 'plan' => $plan], 201);
    }

    // GET /api/plans/{plan}
    public function show(Plan $plan)
    {
        return response()->json($plan->loadCount('colleges'));
    }

    // PUT /api/plans/{plan}
    public function update(Request $request, Plan $plan)
    {
        $data = $this->validated($request, $plan);
        DB::transaction(function () use ($plan, $data) {
            $old = $plan->only(['name', 'price', 'max_students', 'features', 'is_active']);
            $plan->update($data);
            $this->keepOneDefault($plan);
            AuditLog::record('plan.updated', $plan, $plan->only(array_keys($old)), $old);
        });
        return response()->json(['message' => "Plan '{$plan->name}' saved.", 'plan' => $plan->fresh()]);
    }

    // DELETE /api/plans/{plan} — only when no college is on it
    public function destroy(Plan $plan)
    {
        $used = $plan->colleges()->count();
        if ($used > 0) {
            return response()->json(['message' => "{$used} college(s) are on this plan. Move them to another plan first, or mark it inactive."], 422);
        }
        DB::transaction(function () use ($plan) {
            AuditLog::record('plan.deleted', $plan, [], ['name' => $plan->name]);
            $plan->delete();
        });
        return response()->json(['message' => 'Plan deleted.']);
    }

    // PUT /api/colleges/{college}/plan — super admin: plan, end date, trial and add-ons
    public function assign(Request $request, College $college)
    {
        $data = $request->validate([
            'plan_id'             => ['nullable', 'integer', Rule::exists('plans', 'id')],
            'plan_expires_at'     => 'nullable|date',
            'on_trial'            => 'boolean',
            'addons'              => 'array',
            'addons.*.addon_id'   => ['required', 'integer', 'distinct', Rule::exists('addons', 'id')],
            'addons.*.quantity'   => 'nullable|integer|min:1|max:1000',
        ]);
        abort_if($college->is_platform, 422, 'The platform site does not have a plan.');
        $data['plan_id'] = $data['plan_id'] ?? null;

        $plan = $data['plan_id'] ? Plan::find($data['plan_id']) : null;
        if ($plan && !$plan->is_active && $plan->id !== $college->plan_id) {
            return response()->json(['message' => "'{$plan->name}' is inactive and can't be given to a college."], 422);
        }

        // Add-ons: active ones only (a college keeps one it already has), no add-on for a feature
        // the plan already includes, and only "extra students" makes sense on a limited plan.
        $current = $college->addons()->get()->keyBy('id');
        $sync = [];
        foreach ($data['addons'] ?? [] as $row) {
            $addon = Addon::find($row['addon_id']);
            $fail = fn ($msg) => response()->json(['message' => $msg, 'errors' => ['addons' => [$msg]]], 422);
            if (!$plan) return $fail('Choose a plan before adding add-ons.');
            if (!$addon->is_active && !$current->has($addon->id)) return $fail("'{$addon->name}' is inactive and can't be added.");
            if ($addon->kind === 'feature' && $plan->hasFeature((string) $addon->feature)) return $fail("'{$addon->name}' is already in the {$plan->name} plan.");
            if ($addon->kind === 'students' && $plan->max_students === null) return $fail("The {$plan->name} plan has no student limit, so '{$addon->name}' is not needed.");
            $qty = $addon->kind === 'students' ? (int) ($row['quantity'] ?? 1) : 1;
            // Keep the price the college already has; a new add-on starts at today's price.
            $price = $current->has($addon->id) ? $current[$addon->id]->pivot->price : $addon->price;
            $sync[$addon->id] = ['quantity' => $qty, 'price' => $price];
        }

        $names = Addon::pluck('name', 'id');
        DB::transaction(function () use ($college, $data, $sync, $current, $names) {
            $snap = fn ($c, $addons) => [
                'plan_id' => $c->plan_id, 'plan_expires_at' => optional($c->plan_expires_at)->toDateString(), 'on_trial' => (bool) $c->on_trial,
                'addons'  => collect($addons)->map(fn ($v, $id) => ($names[$id] ?? "#{$id}") . ($v > 1 ? " x{$v}" : ''))->values()->all(),
            ];
            $old = $snap($college, $current->mapWithKeys(fn ($a) => [$a->id => $a->pivot->quantity])->all());
            $college->update([
                'plan_id'         => $data['plan_id'],
                'plan_expires_at' => $data['plan_expires_at'] ?? null,
                'on_trial'        => $data['plan_id'] ? (bool) ($data['on_trial'] ?? false) : false,
            ]);
            $college->addons()->sync($sync);
            AuditLog::record('college.plan_changed', $college,
                $snap($college, collect($sync)->map(fn ($v) => $v['quantity'])->all()), $old, null, $college->id);
        });
        \Illuminate\Support\Facades\Cache::forget("tenant:{$college->slug}");

        $college = $college->fresh(['plan', 'addons']);
        return response()->json([
            'message' => $plan ? "{$college->name} is now on the {$plan->name} plan." : "Plan removed from {$college->name}.",
            'college' => $college->setAttribute('subscription', $college->subscription())->setAttribute('monthly_total', $college->monthlyTotal()),
        ]);
    }

    // GET /api/my-plan — college admin: plan, add-ons, usage and features
    public function mine()
    {
        $college = app('current_college')->fresh(['plan', 'addons']);
        $plan = $college->plan;

        $students = DB::table('users')->where('college_id', $college->id)
            ->where('user_type', 'student')->where('is_active', true)->count();

        $planFeatures = $plan?->features ?? [];
        $effective    = $college->effectiveFeatures();

        return response()->json([
            'plan' => $plan ? $plan->only(['id', 'name', 'description', 'price', 'billing_period', 'max_students']) : null,
            'subscription'   => $college->subscription(),
            'students'       => $students,
            'student_limit'  => $college->studentLimit(),
            'extra_students' => $college->extraStudents(),
            'monthly_total'  => $college->monthlyTotal(),
            'addons'         => $college->addons->sortBy('sort_order')->values()->map(fn ($a) => [
                'id' => $a->id, 'name' => $a->name, 'kind' => $a->kind, 'quantity' => (int) $a->pivot->quantity,
                'students' => $a->kind === 'students' ? (int) $a->pivot->quantity * (int) $a->students_per_unit : null,
                'price' => (float) $a->pivot->price * (int) $a->pivot->quantity,
            ]),
            'features' => collect(Plan::featureCatalog())->map(fn ($f) => $f + [
                'included' => in_array($f['key'], $effective, true),
                'source'   => in_array($f['key'], $planFeatures, true) ? 'plan' : (in_array($f['key'], $effective, true) ? 'addon' : null),
            ])->values(),
        ]);
    }

    // ---------------------------------------------------------------------

    private function validated(Request $request, ?Plan $plan = null): array
    {
        $keys = array_keys(config('plans.features', []));
        $data = $request->validate([
            'name'           => ['required', 'string', 'max:100', Rule::unique('plans', 'name')->ignore($plan?->id)],
            'description'    => 'nullable|string|max:500',
            'price'          => 'required|numeric|min:0|max:99999999',
            'billing_period' => 'required|in:monthly,yearly',
            'max_students'   => 'nullable|integer|min:1|max:1000000',
            'features'       => 'present|array',
            'features.*'     => ['string', Rule::in($keys)],
            'is_default'     => 'boolean',
            'is_active'      => 'boolean',
            'sort_order'     => 'nullable|integer|min:0|max:1000',
        ]);
        $data['features'] = array_values(array_unique($data['features']));
        $data['sort_order'] = $data['sort_order'] ?? 0;
        if (($data['is_default'] ?? false) && !($data['is_active'] ?? true)) {
            abort(response()->json(['message' => 'The default plan must be active.', 'errors' => ['is_default' => ['The default plan must be active.']]], 422));
        }
        return $data;
    }

    // Only one plan can be the default for newly approved colleges.
    private function keepOneDefault(Plan $plan): void
    {
        if ($plan->is_default) {
            Plan::where('id', '!=', $plan->id)->where('is_default', true)->update(['is_default' => false]);
        }
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'plan';
        $slug = $base;
        for ($i = 2; Plan::where('slug', $slug)->exists(); $i++) {
            $slug = "{$base}-{$i}";
        }
        return $slug;
    }
}
