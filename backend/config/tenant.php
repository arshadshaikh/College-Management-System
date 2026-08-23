<?php

return [
    // 'subdomain' = detect college from web address (local)
    // 'path'      = detect college from a header (server)
    'mode' => env('TENANT_MODE', 'subdomain'),
];