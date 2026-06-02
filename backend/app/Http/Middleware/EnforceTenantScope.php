<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnforceTenantScope
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        // Super admins (college_id = null) can access any tenant context
        if ($user->user_type === 'super_admin') {
            return $next($request);
        }

        $college = app()->bound('current_college') ? app('current_college') : null;

        if (!$college) {
            return response()->json(['message' => 'No tenant context.'], 400);
        }

        // The authenticated user must belong to the current college
        if ((int) $user->college_id !== (int) $college->id) {
            return response()->json([
                'message' => 'Access denied. You do not belong to this college.',
            ], 403);
        }

        return $next($request);
    }
}