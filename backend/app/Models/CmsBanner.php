<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class CmsBanner extends Model
{
    use BelongsToTenant;

    protected $table = 'cms_banners';

    protected $fillable = [
        'college_id', 'title', 'subtitle', 'image_path',
        'link_url', 'button_text', 'sort_order', 'is_active',
    ];

    protected $casts = [
        'is_active'  => 'boolean',
        'sort_order' => 'integer',
    ];

    // Expose a full public URL for the image, hide the raw path.
    protected $hidden = ['image_path'];
    protected $appends = ['image_url'];

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path
            ? Storage::disk('public')->url($this->image_path)
            : null;
    }
}