<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {

        // ── Override the default Authenticate middleware ────────
        $middleware->redirectGuestsTo(fn() => null);

        // ── Aliases ────────────────────────────────────────────
        $middleware->alias([
            'privilege'    => \App\Http\Middleware\CheckPrivilege::class,
            'tenant'       => \App\Http\Middleware\EnsureTenantContext::class,
            'tenant.scope' => \App\Http\Middleware\EnforceTenantScope::class,
            'auth'         => \App\Http\Middleware\Authenticate::class,
        ]);

        // ── Aliases ────────────────────────────────────────────
        // $middleware->alias([
        //     'privilege'      => \App\Http\Middleware\CheckPrivilege::class,
        //     'tenant'         => \App\Http\Middleware\EnsureTenantContext::class,
        //     'tenant.scope'   => \App\Http\Middleware\EnforceTenantScope::class,
        // ]);

        // ── Global API stack ───────────────────────────────────
        // ResolveTenant runs on EVERY API request, before auth
        $middleware->api(prepend: [
            \Illuminate\Http\Middleware\HandleCors::class,
            \App\Http\Middleware\ResolveTenant::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
        // Tell Laravel to return JSON 401 instead of redirecting to "login" route
        $exceptions->shouldRenderJsonWhen(function ($request, $e) {
            return true; // Always JSON — this is a pure API
        });

        // Explicitly handle unauthenticated — return 401 JSON
        $exceptions->render(function (
            \Illuminate\Auth\AuthenticationException $e,
            \Illuminate\Http\Request $request
        ) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        });

    })->create();