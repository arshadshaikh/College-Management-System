<?php

namespace App\Http\Controllers;

use App\Models\CmsAnnouncement;
use Illuminate\Http\Request;

class CmsAnnouncementController extends Controller
{
    // GET /api/cms/announcements
    // Students/public see only published; admins see all.
    public function index(Request $request)
    {
        $query = CmsAnnouncement::query();

        $user = $request->user();
        if (!$user || $user->isStudent()) {
            $query->where('is_published', true);
        }

        return response()->json(
            $query->latest('published_at')->latest()->get()
        );
    }

    // GET /api/cms/announcements/{cmsAnnouncement}
    public function show(CmsAnnouncement $cmsAnnouncement)
    {
        return response()->json($cmsAnnouncement);
    }

    // POST /api/cms/announcements — college admin only
    public function store(Request $request)
    {
        $request->validate([
            'title'        => 'required|string|max:255',
            'body'         => 'required|string',
            'is_published' => 'boolean',
            'published_at' => 'nullable|date',
        ]);

        $data = $request->only(['title', 'body', 'is_published', 'published_at']);

        // If publishing now and no explicit date, stamp it.
        if (($data['is_published'] ?? false) && empty($data['published_at'])) {
            $data['published_at'] = now();
        }

        $announcement = CmsAnnouncement::create($data);

        return response()->json($announcement, 201);
    }

    // PUT /api/cms/announcements/{cmsAnnouncement} — college admin only
    public function update(Request $request, CmsAnnouncement $cmsAnnouncement)
    {
        $request->validate([
            'title'        => 'sometimes|string|max:255',
            'body'         => 'sometimes|string',
            'is_published' => 'boolean',
            'published_at' => 'nullable|date',
        ]);

        $data = $request->only(['title', 'body', 'is_published', 'published_at']);

        // If flipping to published with no date set yet, stamp it.
        if (($data['is_published'] ?? false) && empty($cmsAnnouncement->published_at) && empty($data['published_at'])) {
            $data['published_at'] = now();
        }

        $cmsAnnouncement->update($data);

        return response()->json($cmsAnnouncement->fresh());
    }

    // DELETE /api/cms/announcements/{cmsAnnouncement} — college admin only
    public function destroy(CmsAnnouncement $cmsAnnouncement)
    {
        $cmsAnnouncement->delete();   // soft delete
        return response()->json(['message' => 'Announcement deleted.']);
    }
}