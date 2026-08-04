<?php

namespace App\Http\Controllers;

use App\Models\Media;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MediaController extends Controller
{
    // GET /api/cms/media — list this college's media, newest first.
    public function index(Request $request)
    {
        $query = Media::query();

        if ($request->filled('media_type')) {
            $query->where('media_type', $request->media_type);
        }

        // return response()->json($query->latest()->paginate(20));

        $sortable = ['original_name', 'media_type', 'file_size', 'created_at'];
        $sortBy   = in_array($request->sort_by, $sortable) ? $request->sort_by : 'created_at';
        $sortDir  = $request->sort_dir === 'asc' ? 'asc' : 'desc';
        $perPage  = min(max((int) ($request->per_page ?? 20), 1), 1000);

        return response()->json($query->orderBy($sortBy, $sortDir)->paginate($perPage));
    }

    // POST /api/cms/media — upload a file (college admin only).
    public function store(Request $request)
    {
        $college = app('current_college');

        $request->validate([
            'file'     => 'required|file|mimes:jpg,jpeg,png,webp,gif,pdf,doc,docx|max:8192',
            'alt_text' => 'nullable|string|max:255',
        ]);

        $file = $request->file('file');

        // Store on the PUBLIC disk so media is web-accessible.
        $path = $file->store("colleges/{$college->id}/media", 'public');

        // Determine media_type from mime.
        // $mime = $file->getMimeType();
        // $mediaType = str_starts_with($mime, 'image/') ? 'image'
        //     : ($mime === 'application/pdf' ? 'document' : 'file');


        $mime = $file->getMimeType();

        if (str_starts_with($mime, 'image/')) {
            $mediaType = 'image';
        } elseif (str_starts_with($mime, 'video/')) {
            $mediaType = 'video';
        } elseif (in_array($mime, [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
        ])) {
            $mediaType = 'document';
        } else {
            $mediaType = 'other';   // enum's catch-all — NOT 'file'
        }

        // Capture image dimensions if it's an image.
        $width = $height = null;
        if (str_starts_with($mime, 'image/')) {
            $dimensions = @getimagesize($file->getPathname());
            if ($dimensions) {
                [$width, $height] = $dimensions;
            }
        }

        $media = Media::create([
            'uploaded_by'   => $request->user()->id,
            'media_type'    => $mediaType,
            'original_name' => $file->getClientOriginalName(),
            'stored_path'   => $path,
            'public_url'    => Storage::disk('public')->url($path),
            'mime_type'     => $mime,
            'file_size'     => $file->getSize(),
            'width'         => $width,
            'height'        => $height,
            'alt_text'      => $request->alt_text,
        ]);

        return response()->json($media, 201);
    }

    // GET /api/cms/media/{media}
    public function show(Media $media)
    {
        return response()->json($media);
    }

    // DELETE /api/cms/media/{media} — college admin only.
    public function destroy(Media $media)
    {
        if ($media->stored_path) {
            Storage::disk('public')->delete($media->stored_path);
        }

        $media->delete();
        return response()->json(['message' => 'Media deleted.']);
    }
}