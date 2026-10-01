<?php

namespace App\Models\Organization;

use App\Models\Document\Document;
use App\Models\Task\TaskLabel;
use App\Models\Task\TaskLabelCategory;
use App\Models\User;
use App\Models\Workspace\Workspace;
use App\Models\Workspace\WorkspaceLabel;
use App\Models\Workspace\WorkspaceLabelCategory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'icon_path',
        'default_board_list_names',
        'default_workspace_status_names',
        'default_document_category_names',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'default_board_list_names' => 'array',
            'default_workspace_status_names' => 'array',
            'default_document_category_names' => 'array',
        ];
    }

    /** URL の組織キーは id ではなく slug。 */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'memberships')
            ->withPivot(['role'])
            ->withTimestamps();
    }

    public function workspaces(): HasMany
    {
        return $this->hasMany(Workspace::class);
    }

    public function workspaceLabelCategories(): HasMany
    {
        return $this->hasMany(WorkspaceLabelCategory::class)->orderBy('sort_order')->orderBy('name');
    }

    public function workspaceLabels(): HasMany
    {
        return $this->hasMany(WorkspaceLabel::class)->orderBy('sort_order')->orderBy('name');
    }

    public function taskLabelCategories(): HasMany
    {
        return $this->hasMany(TaskLabelCategory::class)->orderBy('sort_order')->orderBy('name');
    }

    public function taskLabels(): HasMany
    {
        return $this->hasMany(TaskLabel::class)->orderBy('sort_order')->orderBy('name');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function invites(): HasMany
    {
        return $this->hasMany(OrganizationInvite::class);
    }
}
