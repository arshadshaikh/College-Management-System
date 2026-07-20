<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class CmsMenu extends Model
{
    use BelongsToTenant;

    protected $table = 'cms_menus';

    protected $fillable = [
        'college_id', 'label', 'url', 'page_id',
        'parent_id', 'sort_order', 'is_active',
    ];

    protected $casts = [
        'is_active'  => 'boolean',
        'sort_order' => 'integer',
    ];

    // Child menu items (one level down)
    public function children()
    {
        return $this->hasMany(CmsMenu::class, 'parent_id')->orderBy('sort_order');
    }

    // Parent item
    public function parent()
    {
        return $this->belongsTo(CmsMenu::class, 'parent_id');
    }

    // Optional linked CMS page
    public function page()
    {
        return $this->belongsTo(CmsPage::class, 'page_id');
    }
}