<?php

use App\Http\Controllers\AuthController;
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
use Illuminate\Support\Facades\Route;

// Public
Route::get('/app-config', function () {
    return response()->json([
        'name'          => config('site.name'),
        'short_name'    => config('site.short_name'),
        'icon'          => config('site.icon'),
        'primary_color' => config('site.primary_color'),
    ]);
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

    // Applications
    Route::get('applications/my', [ApplicationController::class, 'myApplications']);
    Route::post('applications', [ApplicationController::class, 'store']);
    Route::get('applications', [ApplicationController::class, 'index']);
    Route::get('applications/{application}', [ApplicationController::class, 'show']);
    Route::post('applications/{application}/review', [ApplicationController::class, 'markUnderReview']);
    Route::post('applications/{application}/approve', [ApplicationController::class, 'approve']);
    Route::post('applications/{application}/reject', [ApplicationController::class, 'reject']);
    Route::post('applications/{application}/withdraw', [ApplicationController::class, 'withdraw']);

    // Student
    Route::get('students', [StudentController::class, 'index']);
    Route::post('students', [StudentController::class, 'store']);
    Route::get('students/{student}', [StudentController::class, 'show']);
    Route::put('students/{student}', [StudentController::class, 'update']);

    // Documents
    Route::get('documents/{document}/download', [ApplicationController::class, 'downloadDocument'])
         ->name('documents.download');

    // Challans
    Route::get('challans/my', [ChallanController::class, 'myChallans']);
    Route::get('challans', [ChallanController::class, 'index']);
    Route::post('challans', [ChallanController::class, 'store']);
    Route::get('challans/{challan}', [ChallanController::class, 'show']);
    Route::post('challans/{challan}/cancel', [ChallanController::class, 'cancel']);
    Route::post('challans/{challan}/mark-paid', [ChallanController::class, 'markPaid']);
    Route::post('challans/{challan}/upload-slip', [ChallanController::class, 'uploadSlip']);
    Route::get('challans/{challan}/pdf', [ChallanController::class, 'pdf']);

    // Payments
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