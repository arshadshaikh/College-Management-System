<?php

// Education levels an applicant can enter. Which ones a college REQUIRES
// comes from the college setting `required_education_levels` (comma list of keys).
// 'document' = required_document_types slug (scope student_application) for the certificate.
// 'result'   = 'marks' or 'cgpa' – which result fields the form shows first.
return [
    'education_levels' => [
        'matric'       => ['label' => 'Matric / SSC',                    'document' => 'matric_certificate', 'result' => 'marks', 'min_age' => 13,
                            'systems'      => ['ssc'   => ['label' => 'Matric (SSC)'], 'o_level' => ['label' => 'O Level', 'grades' => true]],
                            // Group studied (required; O Level: as on the IBCC equivalence). Stored in student_educations.study_group.
                            'groups'       => [
                                'science_biology'  => 'Science (Biology)',
                                'science_computer' => 'Science (Computer Science)',
                                'general'          => 'General / Arts',
                                'technical'        => 'Technical',
                            ]],
        'intermediate' => ['label' => 'Intermediate / HSSC',             'document' => 'inter_certificate',  'result' => 'marks', 'min_age' => 15,
                           'systems' => ['hssc' => ['label' => 'Intermediate (HSSC)'], 'a_level' => ['label' => 'A Level', 'grades' => true]],
                           // Group studied (required). Stored in student_educations.study_group.
                           'groups'  => [
                               'pre_medical'      => 'Pre-Medical',
                               'pre_engineering'  => 'Pre-Engineering',
                               'computer_science' => 'Computer Science (ICS)',
                               'commerce'         => 'Commerce (I.Com)',
                               'humanities'       => 'Humanities / Arts',
                               'general_science'  => 'General Science',
                               'home_economics'   => 'Home Economics',
                           ]],
        'bachelors'    => ['label' => "Bachelor's (14 / 16 years)",      'document' => 'bachelors_degree',   'result' => 'cgpa', 'min_age' => 17],
        'masters'      => ['label' => "Master's (16 years)",             'document' => 'masters_degree',     'result' => 'cgpa', 'min_age' => 19],
        'mphil'        => ['label' => 'M.Phil / MS (18 years)',          'document' => 'mphil_degree',       'result' => 'cgpa', 'min_age' => 21],
    ],
    // Application statuses that lock the applicant's profile. 'returned' never locks.
    'lock_profile_statuses' => ['under_review', 'shortlisted', 'approved'],
    // Fields a college MAY reopen for approved students (catalog; logic in code).
    // Which ones are actually open comes from the college setting `post_approval_editable_fields`.
    'post_approval_field_options' => [
        'phone'             => 'Mobile number',
        'email'             => 'Email',
        'present_address'   => 'Present address',
        'permanent_address' => 'Permanent address',
        'emergency_contact' => 'Emergency contact',
        'marital_status'    => 'Marital status',
    ],
];