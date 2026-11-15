<?php

namespace App\Services;

use App\Models\College;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Default public website for a college: starter pages and a header menu.
 *
 * Used by CollegeInitializationService (new colleges) and
 * CollegeSiteBackfillSeeder (existing colleges). Safe to run again:
 *  - a missing page is created; a page the college deleted (soft-deleted) is NOT recreated;
 *  - an existing page is only rewritten while it still holds the old
 *    "Content coming soon." placeholder, so a college's own edits are never touched;
 *  - menu items are only added when the college has no menu items at all.
 *
 * Links inside page HTML are relative (e.g. "programs") so they work both on
 * subdomains (uos.localhost/programs) and in path mode (/cms/uos/programs).
 */
class DefaultCollegeSite
{
    public function seed(College $college): void
    {
        if ($college->is_platform) {
            return; // the main site has its own PlatformPageSeeder
        }

        DB::transaction(function () use ($college) {
            $this->seedPages($college);
            $this->seedMenus($college);
        });
    }

    // ── Pages ──────────────────────────────────────────────────
    private function seedPages(College $college): void
    {
        $now = Carbon::now();

        foreach ($this->pages($college) as $i => $page) {
            $row = DB::table('cms_pages')
                ->where('college_id', $college->id)
                ->where('slug', $page['slug'])
                ->first(); // includes soft-deleted rows (unique college_id + slug)

            if (!$row) {
                DB::table('cms_pages')->insert([
                    'college_id'       => $college->id,
                    'title'            => $page['title'],
                    'slug'             => $page['slug'],
                    'content'          => $page['content'],
                    'meta_description' => $page['summary'],
                    'is_published'     => true,
                    'sort_order'       => $i,
                    'created_at'       => $now,
                    'updated_at'       => $now,
                ]);
                continue;
            }

            if ($row->deleted_at === null && $this->isPlaceholder($row->content)) {
                DB::table('cms_pages')->where('id', $row->id)->update([
                    'content'          => $page['content'],
                    'meta_description' => $row->meta_description ?: $page['summary'],
                    'updated_at'       => $now,
                ]);
            }
        }
    }

    // The text CollegeInitializationService used to seed: "<h1>Title</h1><p>Content coming soon.</p>"
    public static function isPlaceholder(?string $content): bool
    {
        $text = trim(preg_replace('/\s+/', ' ', strip_tags((string) preg_replace('#<h1>.*?</h1>#is', '', (string) $content))));
        return $text === '' || strcasecmp($text, 'Content coming soon.') === 0;
    }

    // ── Header menu ────────────────────────────────────────────
    private function seedMenus(College $college): void
    {
        if (DB::table('cms_menus')->where('college_id', $college->id)->exists()) {
            return; // the college already manages its own menu
        }

        $pageIds = DB::table('cms_pages')
            ->where('college_id', $college->id)
            ->whereNull('deleted_at')
            ->where('is_published', true)
            ->pluck('id', 'slug');

        // label => page slug, or ['url' => ...] for app routes.
        $items = [
            'Home'       => 'home',
            'About'      => 'about',
            'Programs'   => ['url' => '/programs'],
            'Admissions' => 'admissions',
            'Contact'    => 'contact',
        ];

        $now = Carbon::now();
        $order = 0;
        foreach ($items as $label => $target) {
            $pageId = is_string($target) ? ($pageIds[$target] ?? null) : null;
            if (is_string($target) && !$pageId) {
                continue; // page missing or unpublished → no dead link
            }

            DB::table('cms_menus')->insert([
                'college_id' => $college->id,
                'label'      => $label,
                'url'        => is_array($target) ? $target['url'] : null,
                'page_id'    => $pageId,
                'parent_id'  => null,
                'sort_order' => $order++,
                'is_active'  => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    // ── Starter content ───────────────────────────────────────
    // Neutral wording that is true for any college; each college edits it in CMS → Pages.
    private function pages(College $college): array
    {
        $name = e($college->name);
        $place = collect([$college->city, $college->province])->filter()->map(fn ($v) => e($v))->implode(', ');
        $where = $place ? " in {$place}" : '';

        return [
            [
                'slug'    => 'home',
                'title'   => 'Home',
                'summary' => "Welcome to {$name}.",
                'content' => "<p>Welcome to the official website of {$name}.</p>",
            ],
            [
                'slug'    => 'about',
                'title'   => 'About Us',
                'summary' => "Who we are, what we stand for and what we offer.",
                'content' => <<<HTML
<h2>Welcome to {$name}</h2>
<p>{$name}{$where} is committed to providing quality education in a supportive environment, helping every student build the knowledge, skills and character to succeed.</p>
<h2>Our mission</h2>
<p>To offer accessible, high-quality programs that prepare students for further study, professional careers and responsible citizenship.</p>
<h2>Our vision</h2>
<p>To be a place of learning that students are proud to belong to, known for academic excellence, integrity and service to the community.</p>
<h2>What we offer</h2>
<ul>
<li>Programs at different levels, each with clear eligibility criteria.</li>
<li>A fully online admission process, from application to fee challan.</li>
<li>A fair and transparent admission process.</li>
<li>Support from our admissions office at every step.</li>
</ul>
<p>Explore our <a href="programs">programs</a> to find the one that fits your goals.</p>
HTML,
            ],
            [
                'slug'    => 'admissions',
                'title'   => 'Admissions',
                'summary' => "How to apply, what you need and what happens after you apply.",
                'content' => <<<HTML
<p>Admission to {$name} is completely online. You create one profile and can use it for every application.</p>
<h2>How to apply</h2>
<ol>
<li><strong>Create an account</strong> with your CNIC / B-Form number.</li>
<li><strong>Complete your profile:</strong> personal details, education history and the required documents.</li>
<li><strong>Choose a program</strong> and check that you meet its eligibility criteria.</li>
<li><strong>Review and submit</strong> your application.</li>
<li><strong>Track your status</strong> in your portal. If something needs fixing, your application is returned with a note so you can correct it and resubmit.</li>
<li><strong>Pay your fee</strong> using the challan issued after your admission is approved.</li>
</ol>
<h2>Eligibility</h2>
<p>Each program has its own eligibility criteria and number of seats. You can see them on the <a href="programs">programs page</a>.</p>
<h2>Documents</h2>
<p>The documents you need to upload are listed in your profile after you sign up. Keep clear scans or photos of your identity document, photograph and educational certificates ready before you start.</p>
<h2>Fees</h2>
<p>Once your admission is approved, your fee challan appears in your portal. Download it, pay at the bank before the due date and upload the paid slip.</p>
<h2>Need help?</h2>
<p>If you have any questions about admissions, please <a href="contact">contact us</a>.</p>
HTML,
            ],
            [
                'slug'    => 'contact',
                'title'   => 'Contact Us',
                'summary' => "Questions about admissions, programs or fees? We are here to help.",
                'content' => <<<HTML
<p>For questions about admissions, programs or fee challans, call or email our admissions office using the details below. We will get back to you as soon as possible.</p>
<h2>Before you contact us</h2>
<ul>
<li>Check your application status and any notes in your portal first.</li>
<li>Have your CNIC / B-Form number ready.</li>
<li>Mention the program you applied for in your message.</li>
</ul>
HTML,
            ],
        ];
    }
}
