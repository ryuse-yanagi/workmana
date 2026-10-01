<?php

namespace App\Models\Workspace;

use App\Models\Document\Document;
use App\Models\Organization\Organization;
use App\Models\Task\Task;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Workspace extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'organization_id',
        'created_by',
        'name',
        'description',
        'status',
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

    public function lists(): HasMany
    {
        return $this->hasMany(BoardList::class)->orderBy('sort_order');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    public function labels(): BelongsToMany
    {
        return $this->belongsToMany(WorkspaceLabel::class, 'workspace_workspace_label')->withTimestamps();
    }

    public function assignees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'workspace_assignees')->withTimestamps();
    }

    public function pinnedByUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'workspace_pins')
            ->withPivot(['pinned_at'])
            ->withTimestamps();
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
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

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    public function isPinnedBy(User $viewer): bool
    {
        return $this->pinnedAtFor($viewer) !== null;
    }

    /** 追加クエリは出さず、select の viewer_pinned_at か読み込み済みのピンだけを見る。 */
    public function pinnedAtFor(User $viewer): ?string
    {
        $value = $this->getAttribute('viewer_pinned_at');
        if ($value !== null && $value !== '') {
            return is_string($value) ? $value : (string) $value;
        }

        if ($this->relationLoaded('pinnedByUsers')) {
            $pivot = $this->pinnedByUsers->firstWhere('id', $viewer->id)?->pivot;
            $pinnedAt = $pivot?->pinned_at ?? null;
            if ($pinnedAt !== null && $pinnedAt !== '') {
                return is_string($pinnedAt) ? $pinnedAt : (string) $pinnedAt;
            }
        }

        return null;
    }

    /** スペース一覧の更新日時順に反映するため、updated_at を進める。 */
    public function recordActivity(): bool
    {
        return $this->touch();
    }
}
