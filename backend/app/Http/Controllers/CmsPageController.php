<?php

namespace App\Http\Controllers;

use App\Models\CmsPage;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CmsPageController extends Controller
{
    // GET /api/cms/pages — list this college's pages.
    // Students/public see only published; admins see all.
    public function index(Request $request)
    {
        $query = CmsPage::query();

        $user = $request->user();
        if (!$user || $user->isStudent()) {
            $query->where('is_published', true);
        }

        // return response()->json(
        //     $query->orderBy('sort_order')->paginate(15)
        // );

        $sortable = ['title', 'slug', 'sort_order', 'is_published', 'created_at'];
        $sortBy   = in_array($request->sort_by, $sortable) ? $request->sort_by : 'sort_order';
        $sortDir  = $request->sort_dir === 'asc' ? 'asc' : 'desc';
        $perPage  = min(max((int) ($request->per_page ?? 15), 1), 1000);

        return response()->json($query->orderBy($sortBy, $sortDir)->paginate($perPage));
    }

    // GET /api/cms/pages/{cmsPage}
    public function show(CmsPage $cmsPage)
    {
        return response()->json($cmsPage);
    }

    // POST /api/cms/pages — college admin only
    public function store(Request $request)
    {
        $college = app('current_college');

        $request->validate([
            'title'            => 'required|string|max:255',
            'slug'             => [
                'required', 'string', 'max:255',
                // slug unique WITHIN this college (tenant-scoped uniqueness)
                Rule::unique('cms_pages', 'slug')->where('college_id', $college->id),
            ],
            'content'          => 'nullable|string',
            'meta_title'       => 'nullable|string|max:255',
            'meta_description' => 'nullable|string|max:500',
            'is_published'     => 'boolean',
            'sort_order'       => 'nullable|integer|min:0',
        ]);

        $page = CmsPage::create($request->only([
            'title', 'slug', 'content', 'meta_title',
            'meta_description', 'is_published', 'sort_order',
        ]));

        return response()->json($page, 201);
    }

    // PUT /api/cms/pages/{cmsPage} — college admin only
    public function update(Request $request, CmsPage $cmsPage)
    {
        $college = app('current_college');

        $request->validate([
            'title'            => 'sometimes|string|max:255',
            'slug'             => [
                'sometimes', 'string', 'max:255',
                Rule::unique('cms_pages', 'slug')
                    ->where('college_id', $college->id)
                    ->ignore($cmsPage->id),
            ],
            'content'          => 'nullable|string',
            'meta_title'       => 'nullable|string|max:255',
            'meta_description' => 'nullable|string|max:500',
            'is_published'     => 'boolean',
            'sort_order'       => 'nullable|integer|min:0',
        ]);

        $cmsPage->update($request->only([
            'title', 'slug', 'content', 'meta_title',
            'meta_description', 'is_published', 'sort_order',
        ]));

        return response()->json($cmsPage->fresh());
    }

    // DELETE /api/cms/pages/{cmsPage} — college admin only
    public function destroy(CmsPage $cmsPage)
    {
        $cmsPage->delete();   // soft delete
        return response()->json(['message' => 'Page deleted.']);
    }

    public function publicIndex()
    {
        return response()->json(
            CmsPage::where('is_published', true)->orderBy('sort_order')->get(['title','slug','sort_order'])
        );
    }

    public function publicShow($slug)
    {
        $page = CmsPage::where('slug', $slug)->where('is_published', true)->firstOrFail();
        return response()->json($page);
    }
}