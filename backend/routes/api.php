<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SettingController;
use App\Http\Controllers\CollegeAdminController;
use App\Http\Controllers\CollegeController;
use App\Http\Controllers\StudentAuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\PrivilegeGroupController;
use App\Http\Controllers\PrivilegeController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\ProgramController;
use App\Http\Controllers\CourseController;
use App\Http\Controllers\TimetableController;
use App\Http\Controllers\ApplicationController;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\ChallanController;
use App\Http\Controllers\CmsPageController;
use App\Http\Controllers\CmsAnnouncementController;
use App\Http\Controllers\CmsMenuController;
use App\Http\Controllers\CmsBannerController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\RequiredDocumentTypeController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\BulkChallanController;
use App\Http\Controllers\PaymentSlipController;
use Illuminate\Support\Facades\Route;

// No 'tenant' guard: on the main domain there is no college and the platform defaults are returned.
Route::get('/app-config', function () {
    $base = [
        'name'          => config('site.name'),
        'short_name'    => config('site.short_name'),
        'icon'          => config('site.icon'),
        'primary_color' => config('site.primary_color'),
        'logo_url'      => null,
        'favicon_url'   => null,
        'is_college'    => false,
    ];

    $college = app()->bound('current_college') ? app('current_college') : null;
    if (!$college) {
        return response()->json($base);
    }

    $settings = \App\Models\Setting::where('college_id', $college->id)
        ->whereIn('key', ['primary_color', 'logo', 'favicon'])
        ->pluck('value', 'key');

    // Browser-tab icon: the chosen favicon, else the logo, else the built-in default (null).
    $favicon = ($settings['favicon'] ?? null) ?: (($settings['logo'] ?? null) ?: null);

    // Main site (super admin portal): the platform's own name and logo from Site Settings,
    // instead of the generic config('site.name') "Admin Panel". Colours stay the defaults.
    if ($college->is_platform) {
        $initials = collect(preg_split('/\s+/', trim($college->name)))->filter()
            ->map(fn ($w) => mb_strtoupper(mb_substr($w, 0, 1)))->take(3)->implode('');
        return response()->json(array_merge($base, [
            'name'        => $college->name ?: $base['name'],
            'short_name'  => $initials ?: $base['short_name'],
            'logo_url'    => ($settings['logo'] ?? null) ?: null,
            'favicon_url' => $favicon,
        ]));
    }

    return response()->json(array_merge($base, [
        'name'          => $college->name,
        'short_name'    => $college->slug ? strtoupper($college->slug) : $base['short_name'],
        'primary_color' => ($settings['primary_color'] ?? null) ?: $base['primary_color'],
        'logo_url'      => ($settings['logo'] ?? null) ?: null,   // a Media Library URL chosen in Settings
        'favicon_url'   => $favicon,
        'is_college'    => true,
    ]));
});



// College self-registration — public, main domain
Route::post('/colleges/register', [CollegeController::class, 'register']);
Route::get('public/required-documents', [RequiredDocumentTypeController::class, 'publicIndex']);
Route::get('public/colleges', [CollegeController::class, 'publicIndex']);

Route::middleware('throttle:5,1')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/forgot-password', [PasswordResetController::class, 'sendResetLink']);
    Route::post('/reset-password', [PasswordResetController::class, 'resetPassword']);
});


// ── College public endpoint (tenant required, no auth) ─────────
// e.g. GET uos.localhost/api/college-info → returns college details for the frontend
// Route::middleware('tenant')->group(function () {
//     Route::get('/college-info', function () {
//         $college = app('current_college');
//         return response()->json([
//             'id'   => $college->id,
//             'name' => $college->name,
//             'slug' => $college->slug,
//         ]);
//     });
// });

// ── Public — tenant required, no auth ────────────────────────
// Student self-registration — only on a college subdomain
Route::middleware(['tenant', 'throttle:10,1'])->group(function () {
    Route::get('/college-info', function () {
        $c = app('current_college');
        return response()->json(['id' => $c->id, 'name' => $c->name, 'slug' => $c->slug]);
    });
    Route::post('/register', [StudentAuthController::class, 'register']);
});


// ── Public college website — tenant required, no auth, read-only ──────
// Serves the public-facing site content for a college subdomain.
Route::middleware(['tenant', 'throttle:60,1'])->group(function () {
    Route::get('public/settings',           [SettingController::class, 'publicIndex']);
    Route::get('public/pages',              [CmsPageController::class, 'publicIndex']);
    Route::get('public/pages/{slug}',       [CmsPageController::class, 'publicShow']);
    Route::get('public/announcements',      [CmsAnnouncementController::class, 'publicIndex']);
    Route::get('public/menus',              [CmsMenuController::class, 'publicIndex']);
    Route::get('public/banners',            [CmsBannerController::class, 'publicIndex']);
    Route::get('public/programs',           [ProgramController::class, 'publicIndex']);
});

// ── Protected — platform level ────────────────────────────────
Route::middleware(['auth:api', 'privilege'])->group(function () {

    // Auth
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/refresh', [AuthController::class, 'refresh']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);
    Route::post('/change-role', [AuthController::class, 'changeRole']);

    // Users
    Route::apiResource('users', UserController::class)->except(['destroy']);
    Route::post('users/{user}/assign-roles', [UserController::class, 'assignRoles']);

    // Roles
    Route::apiResource('roles', RoleController::class)->except(['destroy']);
    Route::post('roles/{role}/assign-privileges', [RoleController::class, 'assignPrivileges']);

    // Privilege Groups
    Route::apiResource('privilege-groups', PrivilegeGroupController::class)->except(['destroy']);

    // Privileges
    Route::apiResource('privileges', PrivilegeController::class)->except(['destroy']);

    // College Admins (super admin manages college admin accounts)
    Route::get('college-admins',          [CollegeAdminController::class, 'index']);
    Route::post('college-admins',         [CollegeAdminController::class, 'store']);
    Route::put('college-admins/{user}',   [CollegeAdminController::class, 'update']);

    // Super admin: download college document
    Route::get('college-documents/{collegeDocument}/download', [CollegeController::class, 'downloadDocument']);

    // College admin management — super admin only
    Route::apiResource('college-admins', CollegeAdminController::class)
         ->except(['show', 'destroy']);
    Route::patch('college-admins/{user}/toggle-active', [CollegeAdminController::class, 'toggleActive']);
    
    // College management (super admin)
    Route::get('colleges', [CollegeController::class, 'index']);
    Route::get('colleges/{college}', [CollegeController::class, 'show']);
    Route::put('colleges/{college}', [CollegeController::class, 'update']);
    Route::post('colleges/{college}/approve', [CollegeController::class, 'approve']);
    Route::post('colleges/{college}/reject', [CollegeController::class, 'reject']);
    Route::post('colleges/{college}/suspend', [CollegeController::class, 'suspend']);
    Route::post('colleges/{college}/reinstate', [CollegeController::class, 'reinstate']);

    // Required Document Types
    Route::get('required-document-types',    [RequiredDocumentTypeController::class, 'index']);
    Route::post('required-document-types',   [RequiredDocumentTypeController::class, 'store']);
    Route::put('required-document-types/{requiredDocumentType}',    [RequiredDocumentTypeController::class, 'update']);
    Route::delete('required-document-types/{requiredDocumentType}', [RequiredDocumentTypeController::class, 'destroy']);

    // Audit Logs
    Route::get('audit-logs', [AuditLogController::class, 'index']);
});


// ── Tenant-scoped protected routes ────────────────────────────
Route::middleware(['auth:api', 'privilege', 'tenant', 'tenant.scope'])->group(function () {

    // Programs
    Route::apiResource('programs', ProgramController::class);
    Route::post('programs/{program}/fee-structures', [ProgramController::class, 'storeFeeStructure']);
    Route::post('programs/{program}/fee-structures', [ProgramController::class, 'storeFeeStructure']);
    Route::put('programs/{program}/fee-structures/{feeStructure}', [ProgramController::class, 'updateFeeStructure']);
    Route::delete('programs/{program}/fee-structures/{feeStructure}', [ProgramController::class, 'destroyFeeStructure']);

    // Courses per program semester (timetable)
    Route::get('programs/{program}/courses', [CourseController::class, 'index']);
    Route::post('programs/{program}/courses', [CourseController::class, 'store']);
    Route::put('courses/{course}', [CourseController::class, 'update']);
    Route::delete('courses/{course}', [CourseController::class, 'destroy']);
    
    // Class timetable (admin editor)
    Route::get('timetable', [TimetableController::class, 'index']);
    Route::post('timetable', [TimetableController::class, 'save']);
    Route::post('timetable/copy', [TimetableController::class, 'copy']);
    Route::get('timetable/my', [TimetableController::class, 'my']);
    Route::delete('timetable/{entry}', [TimetableController::class, 'destroy']);

    // Applicant profile (student, own data only)
    Route::get('profile', [ProfileController::class, 'show']);
    Route::put('profile', [ProfileController::class, 'update']);
    Route::put('profile/educations', [ProfileController::class, 'saveEducation']);
    Route::delete('profile/educations/{education}', [ProfileController::class, 'destroyEducation']);
    Route::post('profile/documents', [ProfileController::class, 'uploadDocument']);
    Route::get('profile/documents/{document}/download', [ProfileController::class, 'downloadDocument']);
    Route::delete('profile/documents/{document}', [ProfileController::class, 'destroyDocument']);

    // Applications
    Route::get('applications/my', [ApplicationController::class, 'myApplications']);
    Route::post('applications', [ApplicationController::class, 'store']);
    Route::get('applications', [ApplicationController::class, 'index']);
    Route::get('applications/{application}', [ApplicationController::class, 'show']);
    Route::post('applications/{application}/review', [ApplicationController::class, 'markUnderReview']);
    Route::post('applications/{application}/approve', [ApplicationController::class, 'approve']);
    Route::post('applications/{application}/reject', [ApplicationController::class, 'reject']);
    Route::post('applications/{application}/withdraw', [ApplicationController::class, 'withdraw']);
    Route::post('applications/{application}/return', [ApplicationController::class, 'returnForCorrection']);
    Route::put('applications/{application}/shift', [ApplicationController::class, 'updateShift']);
    Route::post('applications/{application}/resubmit', [ApplicationController::class, 'resubmit']);

    // Student
    Route::get('students/import/template', [StudentController::class, 'importTemplate']);
    Route::post('students/import', [StudentController::class, 'import']);
    // ... then the existing students/{student} routes
    Route::get('students', [StudentController::class, 'index']);
    Route::post('students', [StudentController::class, 'store']);
    Route::get('students/{student}', [StudentController::class, 'show']);
    Route::put('students/{student}', [StudentController::class, 'update']);

    // Documents
    Route::get('documents/{document}/download', [ApplicationController::class, 'downloadDocument'])
         ->name('documents.download');

    // Challans
    Route::get('challans/my', [ChallanController::class, 'myChallans']);
    Route::get('challans/services', [ChallanController::class, 'services']);       // student: requestable services
    Route::post('challans/request', [ChallanController::class, 'requestService']); // student: challan for a service
    Route::post('challans/bulk/preview', [BulkChallanController::class, 'preview']); // admin: who/what a class bill covers
    Route::post('challans/bulk', [BulkChallanController::class, 'store']);           // admin: bill the class
    Route::get('challans', [ChallanController::class, 'index']);
    Route::post('challans', [ChallanController::class, 'store']);
    Route::get('challans/{challan}', [ChallanController::class, 'show']);
    Route::post('challans/{challan}/cancel', [ChallanController::class, 'cancel']);
    Route::post('challans/{challan}/mark-paid', [ChallanController::class, 'markPaid']);
    Route::post('challans/{challan}/upload-slip', [ChallanController::class, 'uploadSlip']);
    Route::get('challans/{challan}/pdf', [ChallanController::class, 'pdf']);
    Route::post('challans/{challan}/items',                [ChallanController::class, 'addItem']);
    Route::put('challans/{challan}/items/{item}',          [ChallanController::class, 'updateItem']);
    Route::delete('challans/{challan}/items/{item}',       [ChallanController::class, 'deleteItem']);

    // Reports
    Route::get('reports/defaulters', [ReportController::class, 'defaulters']);

    // Payments
    Route::get('payments/slips', [PaymentSlipController::class, 'index']);   // admin: slip review queue
    Route::post('payments/{payment}/verify-slip', [ChallanController::class, 'verifySlip']);
    Route::get('payments/{payment}/slip', [ChallanController::class, 'downloadSlip']);

    // Step 7: CMS
    // CMS Pages
    Route::get('cms/pages',            [CmsPageController::class, 'index']);
    Route::post('cms/pages',           [CmsPageController::class, 'store']);
    Route::get('cms/pages/{cmsPage}',  [CmsPageController::class, 'show']);
    Route::put('cms/pages/{cmsPage}',  [CmsPageController::class, 'update']);
    Route::delete('cms/pages/{cmsPage}',[CmsPageController::class, 'destroy']);

    // CMS Announcements
    Route::get('cms/announcements',                        [CmsAnnouncementController::class, 'index']);
    Route::post('cms/announcements',                       [CmsAnnouncementController::class, 'store']);
    Route::get('cms/announcements/{cmsAnnouncement}',      [CmsAnnouncementController::class, 'show']);
    Route::put('cms/announcements/{cmsAnnouncement}',      [CmsAnnouncementController::class, 'update']);
    Route::delete('cms/announcements/{cmsAnnouncement}',   [CmsAnnouncementController::class, 'destroy']);

    // CMS Menus
    Route::get('cms/menus',            [CmsMenuController::class, 'index']);
    Route::post('cms/menus',           [CmsMenuController::class, 'store']);
    Route::get('cms/menus/{cmsMenu}',  [CmsMenuController::class, 'show']);
    Route::put('cms/menus/{cmsMenu}',  [CmsMenuController::class, 'update']);
    Route::delete('cms/menus/{cmsMenu}',[CmsMenuController::class, 'destroy']);

    // CMS Banners
    Route::get('cms/banners',            [CmsBannerController::class, 'index']);
    Route::post('cms/banners',           [CmsBannerController::class, 'store']);
    Route::get('cms/banners/{cmsBanner}',  [CmsBannerController::class, 'show']);
    Route::put('cms/banners/{cmsBanner}',  [CmsBannerController::class, 'update']);
    Route::delete('cms/banners/{cmsBanner}',[CmsBannerController::class, 'destroy']);

    // Settings (CMS)
    Route::get('settings',  [SettingController::class, 'index']);
    Route::put('settings',  [SettingController::class, 'update']);
    
    // Media (CMS)
    Route::get('cms/media',  [MediaController::class, 'index']);
    Route::post('cms/media', [MediaController::class, 'store']);
    Route::get('cms/media/{media}', [MediaController::class, 'show']);
    Route::delete('cms/media/{media}', [MediaController::class, 'destroy']);

    // Student: view single challan
    Route::get('my-challans/{challan}', [ChallanController::class, 'myShow']);
});