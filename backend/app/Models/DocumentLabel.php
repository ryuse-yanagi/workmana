<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class DocumentLabel extends Model
{
    protected $fillable = [
        'organization_id',
        'category_id',
        'created_by',
        'name',
        'color_index',
        'sort_order',
    ];

    protected $casts = [
        'color_index' => 'integer',
        'sort_order' => 'integer',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(DocumentLabelCategory::class, 'category_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function documents(): BelongsToMany
    {
        return $this->belongsToMany(SharedDocument::class, 'document_document_label')->withTimestamps();
    }
}
