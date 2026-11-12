<?php

namespace Database\Seeders;

use App\Models\CmsMenu;
use App\Models\CmsPage;
use App\Models\College;
use Illuminate\Database\Seeder;

// Starter pages + header menu for the main platform site (the is_platform tenant).
// Safe to re-run: existing pages/menu items (matched by slug / page) are never overwritten,
// so edits made in CMS → Pages are kept.
class PlatformPageSeeder extends Seeder
{
    public function run(): void
    {
        $platform = College::where('is_platform', true)->first();
        if (!$platform) {
            $this->command->warn('No platform tenant. Run PlatformTenantSeeder first.');
            return;
        }

        $pages = [
            // slug, title, summary (meta_description), published, in header menu, content
            ['about', 'About us', 'Who we are and why we built an admission platform for every college.', true, true, <<<'HTML'
<h2>Our mission</h2>
<p>Admissions should be simple for students and manageable for colleges. We give every college its own website and admission portal, so applicants can apply online and staff can process applications, documents and fees in one place.</p>
<h2>What we offer</h2>
<ul>
<li>Online applications with eligibility checks for every program.</li>
<li>One applicant profile with education records and documents.</li>
<li>Document verification and return-for-correction.</li>
<li>Bank fee challans with late fees and payment verification.</li>
<li>A website for each college, managed by its own staff.</li>
</ul>
<h2>Who it is for</h2>
<p>Universities, colleges and institutes of any size. Each college sets its own programs, required documents, fees and policies.</p>
HTML],
            ['how-it-works', 'How it works', 'From registering your college to issuing fee challans, step by step.', true, true, <<<'HTML'
<h2>For colleges</h2>
<ol>
<li><strong>Register your college.</strong> Fill in the short registration form.</li>
<li><strong>Get approved.</strong> Our team reviews and approves your college.</li>
<li><strong>Set up.</strong> Add your programs, fee structures, required documents and website pages.</li>
<li><strong>Open admissions.</strong> Turn admissions on in Settings and start receiving applications.</li>
</ol>
<h2>For students</h2>
<ol>
<li><strong>Find your college</strong> in the directory and open its website.</li>
<li><strong>Create an account</strong> and complete your profile, education and documents.</li>
<li><strong>Apply</strong> to a program and track your application status.</li>
<li><strong>Pay your fee</strong> using the challan issued after approval.</li>
</ol>
HTML],
            ['faq', 'Frequently asked questions', 'Quick answers for students and colleges.', true, true, <<<'HTML'
<h3>Where do I apply?</h3>
<p>Every college has its own admission site. Find your college in the directory, open its site and create an account there.</p>
<h3>Can I apply to more than one program?</h3>
<p>Yes, if the college allows it. Your profile and documents are reused for every application.</p>
<h3>My application was returned. What should I do?</h3>
<p>Open My Profile, fix the items in the college's note, and press Resubmit.</p>
<h3>How do I pay my fee?</h3>
<p>After approval a fee challan appears under My Challans. Download it and pay at the bank before the due date.</p>
<h3>How can my college join?</h3>
<p>Use Register college at the top of this site. You will be able to log in once your college is approved.</p>
HTML],
            ['contact', 'Contact us', 'Questions about the platform or registering your college? Get in touch.', true, true, <<<'HTML'
<p>For questions about a specific admission, application or fee, please contact your college directly using the details on its website.</p>
<p>For questions about the platform or registering a college, use the contact details on this page.</p>
HTML],
            ['privacy', 'Privacy policy', 'How we collect, use and protect personal data.', false, false, <<<'HTML'
<p><strong>Draft.</strong> Replace this text with your privacy policy before publishing. It should cover what data is collected (account, profile, education, documents, payments), why, who can see it (the college you apply to), how long it is kept, and how to request access or deletion.</p>
HTML],
            ['terms', 'Terms of use', 'The rules for using the platform.', false, false, <<<'HTML'
<p><strong>Draft.</strong> Replace this text with your terms of use before publishing.</p>
HTML],
        ];

        $menuOrder = 1;
        foreach ($pages as $i => [$slug, $title, $summary, $published, $inMenu, $content]) {
            $page = CmsPage::withoutGlobalScopes()->firstOrCreate(
                ['college_id' => $platform->id, 'slug' => $slug],
                [
                    'title'            => $title,
                    'content'          => trim($content),
                    'meta_title'       => $title,
                    'meta_description' => $summary,
                    'is_published'     => $published,
                    'sort_order'       => $i + 1,
                ]
            );

            if ($inMenu) {
                CmsMenu::withoutGlobalScopes()->firstOrCreate(
                    ['college_id' => $platform->id, 'page_id' => $page->id],
                    ['label' => $title === 'Frequently asked questions' ? 'FAQ' : ($slug === 'about' ? 'About' : ($slug === 'contact' ? 'Contact' : $title)),
                     'sort_order' => $menuOrder, 'is_active' => true]
                );
                $menuOrder++;
            }
        }

        $this->command->info('PlatformPageSeeder done.');
    }
}
