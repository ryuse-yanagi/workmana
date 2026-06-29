<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'default_board_list_names',
        'effort_unit',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'default_board_list_names' => 'array',
        ];
    }

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
            ->withPivot(['role', 'invited_by'])
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
}
