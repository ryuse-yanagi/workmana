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
        'work_unit_label',
        'default_board_list_names',
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

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    public function projectLabels(): HasMany
    {
        return $this->hasMany(ProjectLabel::class)->orderBy('name');
    }

    public function taskLabels(): HasMany
    {
        return $this->hasMany(TaskLabel::class)->orderBy('name');
    }
}
