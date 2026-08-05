<?php

return [
    // The media library's supported file types. One place to change what's
    // accepted — referenced by MediaController validation.
    'allowed_mime_types' => [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'video/mp4',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],

    'max_size_kb' => 8192,
];