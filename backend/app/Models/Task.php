<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Task extends Model
{
    use SoftDeletes;
    protected $fillable = [
        'organization_id',
        'project_id',
        'list_id',
        'sort_order',
        'is_parent_task',
        'parent_task_id',
        'title',
        'description',
        'status',
        'priority',
        'start_date',
        'due_date',
        'gantt_bar_color',
        'effort_hours',
        'effort_value',
        'effort_unit',
        'assignee_id',
        'reporter_id',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'is_parent_task' => 'boolean',
            'start_date' => 'datetime',
            'due_date' => 'datetime',
            'effort_hours' => 'decimal:6',
            'effort_value' => 'decimal:4',
            'archived_at' => 'datetime',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function list(): BelongsTo
    {
        return $this->belongsTo(BoardList::class, 'list_id');
    }

    public function parentTask(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'parent_task_id');
    }

    public function childTasks(): HasMany
    {
        return $this->hasMany(Task::class, 'parent_task_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function assignees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'task_assignees')->withTimestamps();
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(TaskComment::class);
    }

    public function checklist(): HasOne
    {
        return $this->hasOne(TaskChecklist::class);
    }

    public function labels(): BelongsToMany
    {
        return $this->belongsToMany(TaskLabel::class, 'task_task_label')->withTimestamps();
    }

    public function histories(): HasMany
    {
        return $this->hasMany(TaskHistory::class)->orderBy('created_at');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('deleted_at');
    }

    public function scopeNotArchived(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }

    public function scopeArchived(Builder $query): Builder
    {
        return $query->whereNotNull('archived_at');
    }
}
