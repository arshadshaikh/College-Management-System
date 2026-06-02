<?php

namespace App\Http\Middleware;

use App\Models\Privilege;
use Closure;
use Illuminate\Http\Request;

class CheckPrivilege
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $method = $request->method();
        $path = '/' . ltrim($request->path(), '/');

        // Normalize: replace numeric segments with {id}
        $normalized = preg_replace('#/\d+#', '/{id}', $path);

        // ── Temporary debug line ──────────────────────────────────
        \Illuminate\Support\Facades\Log::info('CheckPrivilege', [
            'user_id'    => $user->id,
            'role_id'    => $user->active_role_id,
            'method'     => $method,
            'path'       => $path,
            'normalized' => $normalized,
        ]);
        // ─────────────────────────────────────────────────────────

        // Whitelist: routes that don't need privilege check
        $openRoutes = ['/api/me', '/api/logout', '/api/refresh', '/api/change-password', '/api/change-role'];
        if (in_array($normalized, $openRoutes)) {
            return $next($request);
        }

        // Find matching privilege:
        // 1. First try exact method match
        // 2. If not found, try method = NULL (allows all methods)
        $privilege = Privilege::where('api_route', $normalized)
            ->where('is_active', true)
            ->where(function ($query) use ($method) {
                $query->where('method', $method)
                      ->orWhereNull('method');
            })
            ->first();

        // If no privilege is registered for this route, deny by default (fail-closed)
        if (!$privilege) {
            return response()->json(['message' => 'Access denied — no privilege configured for this route'], 403);
        }

        // Check if user has this privilege
        if (!$user->hasPrivilege($privilege->slug)) {
            return response()->json(['message' => 'You do not have permission to access this resource'], 403);
        }

        return $next($request);
    }
}
