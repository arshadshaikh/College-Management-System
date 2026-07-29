<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    // GET /api/audit-logs
    public function index(Request $request)
    {
        $user  = $request->user();
        $query = AuditLog::with('user:id,name,cnic_no');

        // Tenant scoping is EXPLICIT here (the model has no global scope).
        // Super admin sees everything; everyone else sees only their college.
        if (!$user->isSuperAdmin()) {
            $query->where('college_id', $user->college_id);
        }

        if ($request->filled('action')) {
            $query->where('action', $request->action);
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('auditable_type')) {
            $query->where('auditable_type', $request->auditable_type);
        }

        if ($request->filled('auditable_id')) {
            $query->where('auditable_id', $request->auditable_id);
        }

        return response()->json($query->latest()->paginate(25));
    }
}