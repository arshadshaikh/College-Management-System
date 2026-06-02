<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureTenantContext
{
    public function handle(Request $request, Closure $next)
    {
        if (!app()->bound('current_college')) {
            return response()->json([
                'message' => 'No tenant context. Please use a college subdomain.',
            ], 400);
        }

        return $next($request);
    }
}