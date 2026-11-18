<?php

/*
 * Timetable catalogs. Colleges choose from these in Settings → Timetable
 * (settings `shifts` and `timetable_days`); the lists themselves live in code.
 */
return [
    // Shifts a college can run. Setting `shifts` holds the enabled keys (CSV, default "morning").
    'shifts' => [
        'morning' => 'Morning',
        'noon'    => 'Noon',
        'evening' => 'Evening',
    ],

    // ISO day numbers (1 = Monday ... 7 = Sunday), same as Carbon's dayOfWeekIso.
    'days' => [
        1 => 'Monday', 2 => 'Tuesday', 3 => 'Wednesday', 4 => 'Thursday',
        5 => 'Friday', 6 => 'Saturday', 7 => 'Sunday',
    ],
];
