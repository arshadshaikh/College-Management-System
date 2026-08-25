<?php

use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../vendor/autoload.php';

// Bootstrap Laravel and handle the request...
// (require_once __DIR__.'/../bootstrap/app.php')
//     ->handleRequest(Request::capture());

$app = require_once __DIR__.'/../bootstrap/app.php';

// When Laravel runs under a subdirectory (e.g. /cms), strip that prefix so
// routes match. Set via `SetEnv APP_BASE_PATH /cms` in the web-root .htaccess
// on the server; unset locally so nothing changes.
$basePath = $_SERVER['APP_BASE_PATH'] ?? '';
if ($basePath !== '') {
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    if (str_starts_with($uri, $basePath)) {
        $_SERVER['REQUEST_URI'] = substr($uri, strlen($basePath)) ?: '/';
    }
}

$app->handleRequest(Request::capture());
