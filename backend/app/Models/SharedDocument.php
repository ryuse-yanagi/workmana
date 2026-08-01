<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SharedDocument extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'organization_id',
        'created_by',
        'category',
        'name',
        'description',
        'body',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'archived_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

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
        )
            ->whereNull('workspaces.archived_at')
            ->withTimestamps();
    }

    public function relatedDocuments(): BelongsToMany
    {
        return $this->belongsToMany(
            SharedDocument::class,
            'document_related_document',
            'document_id',
            'related_document_id',
        )
            ->whereNull('shared_documents.archived_at')
            ->withTimestamps();
    }

    public function scopeNotArchived(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }

    public function scopeArchived(Builder $query): Builder
    {
        return $query->whereNotNull('archived_at');
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }
}
