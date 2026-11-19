<?php

namespace App\Providers;

use App\Observers\AuditObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Models whose create / update / delete go into the audit log.
     * Add new models here. Never add AuditLog itself.
     */
    private const AUDITED_MODELS = [
        \App\Models\AcademicTerm::class,
        \App\Models\Application::class,
        \App\Models\Challan::class,
        \App\Models\ChallanItem::class,
        \App\Models\CmsAnnouncement::class,
        \App\Models\CmsBanner::class,
        \App\Models\CmsMenu::class,
        \App\Models\CmsPage::class,
        \App\Models\College::class,
        \App\Models\CollegeDocument::class,
        \App\Models\CollegeDocumentType::class,
        \App\Models\Course::class,
        \App\Models\Document::class,
        \App\Models\FeeStructure::class,
        \App\Models\Media::class,
        \App\Models\Payment::class,
        \App\Models\Privilege::class,
        \App\Models\PrivilegeGroup::class,
        \App\Models\Program::class,
        \App\Models\RequiredDocumentType::class,
        \App\Models\Role::class,
        \App\Models\Setting::class,
        \App\Models\StudentEducation::class,
        \App\Models\StudentProfile::class,
        \App\Models\TimetableEntry::class,
        \App\Models\TimetablePeriod::class,
        \App\Models\User::class,
    ];

    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        foreach (self::AUDITED_MODELS as $model) {
            $model::observe(AuditObserver::class);
        }
    }
}
