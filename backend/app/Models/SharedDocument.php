<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class SharedDocument extends Model
{
    protected $fillable = [
        'organization_id',
        'created_by',
        'category',
        'name',
        'description',
        'body',
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function labels(): BelongsToMany
    {
        return $this->belongsToMany(DocumentLabel::class, 'document_document_label')->withTimestamps();
    }

    public function relatedWorkspaces(): BelongsToMany
    {
        return $this->belongsToMany(
            Workspace::class,
            'workspace_related_document',
            'shared_document_id',
            'workspace_id',
        )->withTimestamps();
    }

    public function relatedDocuments(): BelongsToMany
    {
        return $this->belongsToMany(
            SharedDocument::class,
            'document_related_document',
            'document_id',
            'related_document_id',
        )->withTimestamps();
    }
}
