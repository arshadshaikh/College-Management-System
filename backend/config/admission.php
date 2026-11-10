<?php

// Education levels an applicant can enter. Which ones a college REQUIRES
// comes from the college setting `required_education_levels` (comma list of keys).
// 'document' = required_document_types slug (scope student_application) for the certificate.
// 'result'   = 'marks' or 'cgpa' – which result fields the form shows first.
return [
    'education_levels' => [
        'matric'       => ['label' => 'Matric / SSC',                    'document' => 'matric_certificate', 'result' => 'marks'],
        'intermediate' => ['label' => 'Intermediate / HSSC',             'document' => 'inter_certificate',  'result' => 'marks'],
        'bachelors'    => ['label' => "Bachelor's (14 / 16 years)",      'document' => 'bachelors_degree',   'result' => 'cgpa'],
        'masters'      => ['label' => "Master's (16 years)",             'document' => 'masters_degree',     'result' => 'cgpa'],
        'mphil'        => ['label' => 'M.Phil / MS (18 years)',          'document' => 'mphil_degree',       'result' => 'cgpa'],
    ],
    // Earliest realistic age for passing the first level; passing years earlier than
    // (birth year + this) are rejected. Change here if your region differs.
    'min_passing_age' => 10,
];