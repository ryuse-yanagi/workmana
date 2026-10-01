<?php

namespace App\Models\Task;

use App\Models\Organization\Organization;
use App\Models\User;
use App\Models\Workspace\BoardList;
use App\Models\Workspace\Workspace;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Task extends Model
{
    use SoftDeletes;

    /**
     * 更新時に親スペースの updated_at を進め、一覧の更新日時順へ反映する。
     *
     * @var list<string>
     */
    protected $touches = ['workspace'];

    protected $fillable = [
        'organization_id',
        'workspace_id',
        'list_id',
        'sort_order',
        'is_parent_task',
        'parent_task_id',
        'title',
        'description',
        'priority',
        'start_date',
        'due_date',
        'gantt_bar_color',
        'effort_hours',
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
            'archived_at' => 'datetime',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
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

    public function assignees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'task_assignees')->withTimestamps();
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    public function checklists(): HasMany
    {
        return $this->hasMany(TaskChecklist::class)->orderBy('sort_order')->orderBy('id');
    }

    public function labels(): BelongsToMany
    {
        return $this->belongsToMany(TaskLabel::class, 'task_task_label')->withTimestamps();
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TaskAttachment::class);
    }

    /** 論理削除だけを除外し、アーカイブ済みは残す。 */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('deleted_at');
    }

    /** アーカイブ済みを除外する。 */
    public function scopeNotArchived(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }

    public function scopeArchived(Builder $query): Builder
    {
        return $query->whereNotNull('archived_at');
    }
}
