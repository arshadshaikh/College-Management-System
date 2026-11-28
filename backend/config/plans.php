<?php

/*
|--------------------------------------------------------------------------
| Subscription plan features
|--------------------------------------------------------------------------
| The switches a Super Admin turns on or off per plan. Everything NOT listed
| here (admissions, students, challans, payments, settings, dashboard) is the
| core every plan includes.
|
| 'privileges' / 'privilege_prefixes' / 'menus' name what the feature unlocks.
| App\Services\PlanGate hides these menus and refuses these API privileges for
| colleges whose plan (plus add-ons) does not include the feature. Keys are stored in plans.features, so never
| rename a key once plans use it.
*/

return [
    // Days of free use a newly approved college gets on the default plan (0 = no trial).
    'trial_days' => 30,

    // Days a college can keep working after its plan's end date before it goes read-only (step 2).
    'grace_days' => 7,

    'features' => [
        'reports' => [
            'label'       => 'Fee reports',
            'description' => 'Fee Collection and Fee Defaulters reports with PDF.',
            'privileges'  => ['reports.defaulters', 'reports.collections', 'reports.collections-pdf'],
            'menus'       => ['menu.collections', 'menu.defaulters'],
        ],
        'fee_statement' => [
            'label'       => 'Student fee statement',
            'description' => 'Statement of account per student, for admins and students, with PDF.',
            'privileges'  => ['students.statement', 'students.statement-pdf', 'statement.my', 'statement.my-pdf'],
            'menus'       => [],
        ],
        'bulk_challans' => [
            'label'       => 'Bill a whole class',
            'description' => 'Create challans for every student of a program and semester at once.',
            'privileges'  => ['challans.bulk-preview', 'challans.bulk'],
            'menus'       => [],
        ],
        'installments' => [
            'label'       => 'Fee installments',
            'description' => 'Split a challan into installments with their own due dates.',
            'privileges'  => ['challans.split'],
            'menus'       => [],
        ],
        'online_slips' => [
            'label'       => 'Online payment slips',
            'description' => 'Students upload bank slips; staff verify them in a review queue.',
            'privileges'  => ['challans.upload-slip', 'payments.slips', 'payments.verify-slip'],
            'menus'       => ['menu.payment-slips'],
        ],
        'service_challans' => [
            'label'       => 'Service requests',
            'description' => 'Students request paid services (transcript, ID card ...) and get a challan.',
            'privileges'  => ['challans.services', 'challans.request'],
            'menus'       => [],
        ],
        'student_import' => [
            'label'       => 'Import students from Excel',
            'description' => 'Add many students at once from a spreadsheet.',
            'privileges'  => ['students.import', 'students.import.template'],
            'menus'       => [],
        ],
        'timetable' => [
            'label'       => 'Class timetable',
            'description' => 'Courses, periods and weekly timetables for staff and students.',
            'privileges'  => ['courses.index', 'courses.store', 'courses.update', 'courses.destroy',
                              'timetable.index', 'timetable.save', 'timetable.destroy', 'timetable.copy', 'timetable.my'],
            'menus'       => ['menu.timetable', 'menu.student.timetable'],
        ],
        'website' => [
            'label'       => 'College website (CMS)',
            'description' => 'Public website pages, menus, banners, announcements and media.',
            'privileges'  => [],
            'privilege_prefixes' => ['cms.'],   // every CMS admin privilege; the public site itself stays up
            'menus'       => ['menu.cms'],
        ],
        'fee_reminders' => [
            'label'       => 'Fee reminders',
            'description' => 'Automatic reminders before and after a challan is due.',
            'coming_soon' => true,
            'privileges'  => [],
            'menus'       => [],
        ],
    ],
];
