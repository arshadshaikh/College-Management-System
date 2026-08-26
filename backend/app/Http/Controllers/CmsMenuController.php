<?php

namespace App\Http\Controllers;

use App\Models\CmsMenu;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CmsMenuController extends Controller
{
    // GET /api/cms/menus — returns the menu as a NESTED TREE (top-level items with children).
    public function index(Request $request)
    {
        $query = CmsMenu::with('children')
            ->whereNull('parent_id')    // top-level only; children come via the relation
            ->orderBy('sort_order');

        $user = $request->user();
        if (!$user || $user->isStudent()) {
            $query->where('is_active', true);
        }

        return response()->json($query->get());   // full tree, not paginated
    }

    // GET /api/cms/menus/{cmsMenu}
    public function show(CmsMenu $cmsMenu)
    {
        return response()->json($cmsMenu->load('children', 'page'));
    }

    // POST /api/cms/menus — college admin only
    public function store(Request $request)
    {
        $college = app('current_college');

        $request->validate([
            'label'      => 'required|string|max:255',
            'url'        => 'nullable|string|max:500',
            // page_id must belong to THIS college
            'page_id'    => ['nullable', Rule::exists('cms_pages', 'id')->where('college_id', $college->id)],
            // parent_id must be a menu in THIS college
            'parent_id'  => ['nullable', Rule::exists('cms_menus', 'id')->where('college_id', $college->id)],
            'sort_order' => 'nullable|integer|min:0',
            'is_active'  => 'boolean',
        ]);

        $menu = CmsMenu::create($request->only([
            'label', 'url', 'page_id', 'parent_id', 'sort_order', 'is_active',
        ]));

        return response()->json($menu, 201);
    }

    // PUT /api/cms/menus/{cmsMenu} — college admin only
    public function update(Request $request, CmsMenu $cmsMenu)
    {
        $college = app('current_college');

        $request->validate([
            'label'      => 'sometimes|string|max:255',
            'url'        => 'nullable|string|max:500',
            'page_id'    => ['nullable', Rule::exists('cms_pages', 'id')->where('college_id', $college->id)],
            'parent_id'  => ['nullable', Rule::exists('cms_menus', 'id')->where('college_id', $college->id)],
            'sort_order' => 'nullable|integer|min:0',
            'is_active'  => 'boolean',
        ]);

        // Prevent a menu from being its own parent (simplest cycle).
        if ((int) $request->input('parent_id') === (int) $cmsMenu->id) {
            return response()->json(['message' => 'A menu item cannot be its own parent.'], 422);
        }

        $cmsMenu->update($request->only([
            'label', 'url', 'page_id', 'parent_id', 'sort_order', 'is_active',
        ]));

        return response()->json($cmsMenu->fresh()->load('children'));
    }

    // DELETE /api/cms/menus/{cmsMenu} — college admin only
    public function destroy(CmsMenu $cmsMenu)
    {
        // Re-parent children to top level so they aren't orphaned/hidden.
        CmsMenu::where('parent_id', $cmsMenu->id)->update(['parent_id' => null]);

        $cmsMenu->delete();
        return response()->json(['message' => 'Menu item deleted.']);
    }

    public function publicIndex()
    {
        return response()->json(
            CmsMenu::with([
                'page:id,slug',
                'children' => fn($q) => $q->where('is_active', true)
                                          ->orderBy('sort_order')
                                          ->with('page:id,slug'),
            ])
                ->whereNull('parent_id')->where('is_active', true)->orderBy('sort_order')->get()
        );
    }

    

}