<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkspaceLabelCategory extends Model
{
    protected $fillable = [
        'organization_id',
        'created_by',
        'name',
        'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function labels(): HasMany
    {
        return $this->hasMany(WorkspaceLabel::class, 'category_id')->orderBy('sort_order')->orderBy('name');
    }
}
