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

        // ── Super admin bypass ──────────────────────────────────────
        // Platform owner has total access; never gated by privilege rows.
        // Safe because isSuperAdmin() checks user_type === 'super_admin',
        // which a college admin or student can never hold.
        if ($user->isSuperAdmin()) {
            return $next($request);
        }
        // ────────────────────────────────────────────────────────────

        $method = $request->method();
        $path = '/' . ltrim($request->path(), '/');

        // Normalize: replace numeric segments with {id}
        $normalized = preg_replace('#/\d+#', '/{id}', $path);

        // ── Temporary debug line ──────────────────────────────────
        // \Illuminate\Support\Facades\Log::info('CheckPrivilege', [
        //     'user_id'    => $user->id,
        //     'role_id'    => $user->active_role_id,
        //     'method'     => $method,
        //     'path'       => $path,
        //     'normalized' => $normalized,
        // ]);
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

        // ── Subscription plan ───────────────────────────────────────
        if ($user->college_id) {
            // A feature the college's plan (and add-ons) does not include.
            if ($feature = \App\Services\PlanGate::lockedFeatureFor((int) $user->college_id, $privilege->slug)) {
                return response()->json([
                    'message' => "{$feature['label']} is not included in your plan. Contact the platform administrator to add it.",
                    'error'   => 'feature_locked',
                    'feature' => $feature['key'],
                ], 403);
            }
            // Plan ended and the grace period is over: look, but don't change anything.
            if (!in_array($method, ['GET', 'HEAD', 'OPTIONS'], true) && \App\Services\PlanGate::readOnly((int) $user->college_id)) {
                return response()->json([
                    'message' => 'Your subscription has ended, so the portal is read-only. Contact the platform administrator to renew.',
                    'error'   => 'plan_expired',
                ], 403);
            }
        }

        return $next($request);
    }
}
