<?php

namespace App\Models\Workspace;

use App\Models\Organization\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class WorkspaceLabel extends Model
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
        return $this->belongsTo(WorkspaceLabelCategory::class, 'category_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function workspaces(): BelongsToMany
    {
        return $this->belongsToMany(Workspace::class, 'workspace_workspace_label')->withTimestamps();
    }
}
