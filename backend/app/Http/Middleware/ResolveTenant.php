<?php

namespace App\Http\Middleware;

use App\Models\College;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ResolveTenant
{
    public function handle(Request $request, Closure $next)
    {
        $host = $request->getHost(); // e.g. "uos.localhost" or "localhost"

        // $slug = $this->extractSlug($host);

        // Path mode (server): read college from a header. Subdomain mode (local): read from host.
        if (config('tenant.mode') === 'path') {
            $slug = $request->header('X-College') ?: null;
        } else {
            $slug = $this->extractSlug($host);
        }

        // No subdomain → this is the main domain (super admin / onboarding area)
        // if (!$slug) {
        //     return $next($request);
        // }
        // No subdomain → main domain → resolve to the PLATFORM tenant
        if (!$slug) {
            $platform = Cache::get('tenant:__platform__');

            if (!$platform) {
                $platform = College::where('is_platform', true)->first();
                if ($platform) {
                    Cache::put('tenant:__platform__', $platform, 3600);
                }
            }

            if ($platform) {
                app()->instance('current_college', $platform);
                $request->merge(['_college_id' => $platform->id]);
                view()->share('currentCollege', $platform);
            }

            return $next($request);
        }

        // Cache the college lookup to avoid a DB hit on every request
        // $college = Cache::remember("tenant:{$slug}", 3600, function () use ($slug) {
        //     return College::where('slug', $slug)
        //                   ->where('status', 'approved')
        //                   ->first();
        // });

        $college = Cache::get("tenant:{$slug}");

        if (!$college) {
            $college = College::where('slug', $slug)
                      ->where('status', 'approved')
                      ->first();
            if ($college) {
                Cache::put("tenant:{$slug}", $college, 3600);
            }
        }


        if (!$college) {
            return response()->json([
                'message' => "College '{$slug}' not found or not yet approved.",
            ], 404);
        }

        // Bind into the app container — accessible anywhere via app('current_college')
        app()->instance('current_college', $college);

        // Also stamp it on the request for convenience in controllers
        $request->merge(['_college_id' => $college->id]);

        // Share with all views (if ever used server-side)
        view()->share('currentCollege', $college);

        return $next($request);
    }

    private function extractSlug(string $host): ?string
    {
        // Handles: uos.localhost, uos.yourdomain.com, uos.192.168.1.1.nip.io
        // Does NOT treat "localhost" or "yourdomain.com" as having a subdomain

        // Remove port if present (e.g. localhost:8000)
        $host = strtolower(explode(':', $host)[0]);

        $parts = explode('.', $host);

        // "localhost" → 1 part → no subdomain
        // "uos.localhost" → 2 parts → slug = "uos"
        // "uos.college.com" → 3 parts → slug = "uos"
        // "www.college.com" → 3 parts, but "www" is reserved
        if (count($parts) < 2) {
            return null;
        }

        $slug = $parts[0];

        // Reserved slugs that are never tenant subdomains
        $reserved = ['www', 'api', 'admin', 'mail', 'ftp', 'app', 'localhost'];
        if (in_array($slug, $reserved)) {
            return null;
        }

        return $slug;
    }
}