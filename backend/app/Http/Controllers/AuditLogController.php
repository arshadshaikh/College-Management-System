<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    // GET /api/audit-logs
    // Filters: action, module (e.g. "program" = all program.*), user_id,
    // date_from, date_to (Y-m-d), auditable_type, auditable_id, search, per_page.
    // ?with_options=1 also returns the dropdown lists (actions, users).
    public function index(Request $request)
    {
        $request->validate([
            'date_from' => 'nullable|date',
            'date_to'   => 'nullable|date',
            'per_page'  => 'nullable|integer|min:1|max:1000',
        ]);

        $user  = $request->user();
        $base  = AuditLog::query();

        // Tenant scoping is EXPLICIT here (the model has no global scope).
        // Super admin sees everything; everyone else sees only their college.
        if (!$user->isSuperAdmin()) {
            $base->where('college_id', $user->college_id);
        }

        $query = (clone $base)->with('user:id,name,cnic_no');

        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        if ($request->filled('module')) {
            $query->where('action', 'like', $request->module . '.%');
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('date_from')) {
            $query->where('created_at', '>=', $request->date('date_from')->startOfDay());
        }

        if ($request->filled('date_to')) {
            $query->where('created_at', '<=', $request->date('date_to')->endOfDay());
        }

        if ($request->filled('auditable_type')) {
            $query->where('auditable_type', $request->auditable_type);
        }

        if ($request->filled('auditable_id')) {
            $query->where('auditable_id', $request->auditable_id);
        }

        // Free text: action, the changed values (incl. the record's _label),
        // IP, or the user's name / CNIC.
        if ($request->filled('search')) {
            $s = '%' . $request->search . '%';
            $query->where(function ($q) use ($s) {
                $q->where('action', 'like', $s)
                  ->orWhere('new_values', 'like', $s)
                  ->orWhere('old_values', 'like', $s)
                  ->orWhere('ip_address', 'like', $s)
                  ->orWhereHas('user', fn ($u) => $u->where('name', 'like', $s)->orWhere('cnic_no', 'like', $s));
            });
        }

        $page = $query->latest('id')->paginate($request->integer('per_page', 25));

        if (!$request->boolean('with_options')) {
            return response()->json($page);
        }

        // Dropdown lists, built only from this tenant's own log rows.
        $actions = (clone $base)->distinct()->orderBy('action')->pluck('action');
        $userIds = (clone $base)->whereNotNull('user_id')->distinct()->pluck('user_id');
        $users   = User::whereIn('id', $userIds)->orderBy('name')->get(['id', 'name', 'cnic_no']);

        return response()->json(array_merge($page->toArray(), [
            'options' => ['actions' => $actions, 'users' => $users],
        ]));
    }
}
