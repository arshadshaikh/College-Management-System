<?php

namespace App\Http\Controllers;

use App\Models\CmsBanner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CmsBannerController extends Controller
{
    // GET /api/cms/banners
    public function index(Request $request)
    {
        $query = CmsBanner::query()->orderBy('sort_order');

        $user = $request->user();
        if (!$user || $user->isStudent()) {
            $query->where('is_active', true);
        }

        // return response()->json($query->paginate(15));

        $sortable = ['title', 'sort_order', 'is_active', 'created_at'];
        $sortBy   = in_array($request->sort_by, $sortable) ? $request->sort_by : 'sort_order';
        $sortDir  = $request->sort_dir === 'asc' ? 'asc' : 'desc';
        $perPage  = min(max((int) ($request->per_page ?? 15), 1), 1000);

        return response()->json($query->orderBy($sortBy, $sortDir)->paginate($perPage));
    }

    // GET /api/cms/banners/{cmsBanner}
    public function show(CmsBanner $cmsBanner)
    {
        return response()->json($cmsBanner);
    }

    // POST /api/cms/banners — college admin only. Multipart (image upload).
    public function store(Request $request)
    {
        $college = app('current_college');

        $request->validate([
            'title'       => 'nullable|string|max:255',
            'subtitle'    => 'nullable|string|max:500',
            'image'       => 'required|image|mimes:jpg,jpeg,png,webp|max:4096',
            'link_url'    => 'nullable|string|max:500',
            'button_text' => 'nullable|string|max:100',
            'sort_order'  => 'nullable|integer|min:0',
            'is_active'   => 'boolean',
        ]);

        // Store on the PUBLIC disk — web-accessible for display.
        $path = $request->file('image')->store(
            "colleges/{$college->id}/banners",
            'public'
        );

        $banner = CmsBanner::create([
            'title'       => $request->title,
            'subtitle'    => $request->subtitle,
            'image_path'  => $path,
            'link_url'    => $request->link_url,
            'button_text' => $request->button_text,
            'sort_order'  => $request->sort_order ?? 0,
            'is_active'   => $request->boolean('is_active', true),
        ]);

        return response()->json($banner, 201);
    }

    // PUT /api/cms/banners/{cmsBanner} — college admin only.
    public function update(Request $request, CmsBanner $cmsBanner)
    {
        $college = app('current_college');

        $request->validate([
            'title'       => 'sometimes|nullable|string|max:255',
            'subtitle'    => 'sometimes|nullable|string|max:500',
            'image'       => 'sometimes|image|mimes:jpg,jpeg,png,webp|max:4096',
            'link_url'    => 'sometimes|nullable|string|max:500',
            'button_text' => 'sometimes|nullable|string|max:100',
            'sort_order'  => 'sometimes|integer|min:0',
            'is_active'   => 'boolean',
        ]);

        $data = $request->only([
            'title', 'subtitle', 'link_url', 'button_text', 'sort_order', 'is_active',
        ]);

        // If a new image is uploaded, replace the old one (and delete the old file).
        if ($request->hasFile('image')) {
            if ($cmsBanner->image_path) {
                Storage::disk('public')->delete($cmsBanner->image_path);
            }
            $data['image_path'] = $request->file('image')->store(
                "colleges/{$college->id}/banners",
                'public'
            );
        }

        $cmsBanner->update($data);

        return response()->json($cmsBanner->fresh());
    }

    // DELETE /api/cms/banners/{cmsBanner} — college admin only.
    public function destroy(CmsBanner $cmsBanner)
    {
        // Delete the image file too (no soft-delete on banners).
        if ($cmsBanner->image_path) {
            Storage::disk('public')->delete($cmsBanner->image_path);
        }

        $cmsBanner->delete();
        return response()->json(['message' => 'Banner deleted.']);
    }
}