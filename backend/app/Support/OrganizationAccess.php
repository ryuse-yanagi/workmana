<?php

namespace App\Support;

use App\Enums\MembershipRole;
use App\Models\Organization;
use App\Models\SharedDocument;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Builder;

/**
 * 組織ロールに基づく閲覧・破壊的操作の判定。
 *
 * - 管理者: 全スペース・全資料を閲覧／復元／完全削除可
 * - 一般メンバー: 担当スペース・閲覧者資料のみ閲覧。復元・完全削除不可
 */
final class OrganizationAccess
{
    public static function isOrganizationAdmin(?object $pivot): bool
    {
        return ($pivot->role ?? '') === MembershipRole::Admin->value;
    }

    public static function canRestoreOrPermanentlyDelete(?object $pivot): bool
    {
        return self::isOrganizationAdmin($pivot);
    }

    public static function canViewWorkspace(User $user, Workspace $workspace, ?object $orgPivot): bool
    {
        if (self::isOrganizationAdmin($orgPivot)) {
            return true;
        }

        return $workspace->assignees()->where('users.id', $user->id)->exists();
    }

    public static function canViewDocument(User $user, SharedDocument $document, ?object $orgPivot): bool
    {
        if (self::isOrganizationAdmin($orgPivot)) {
            return true;
        }

        return $document->viewers()->where('users.id', $user->id)->exists();
    }

    /**
     * @param  Builder<Workspace>  $query
     * @return Builder<Workspace>
     */
    public static function scopeVisibleWorkspaces(Builder $query, User $user, ?object $orgPivot): Builder
    {
        if (self::isOrganizationAdmin($orgPivot)) {
            return $query;
        }

        return $query->whereHas(
            'assignees',
            fn (Builder $q) => $q->where('users.id', $user->id),
        );
    }

    /**
     * @param  Builder<SharedDocument>  $query
     * @return Builder<SharedDocument>
     */
    public static function scopeVisibleDocuments(Builder $query, User $user, ?object $orgPivot): Builder
    {
        if (self::isOrganizationAdmin($orgPivot)) {
            return $query;
        }

        return $query->whereHas(
            'viewers',
            fn (Builder $q) => $q->where('users.id', $user->id),
        );
    }

    /**
     * スペース担当者を ACL の正とし、workspace_memberships を同期する。
     * （タスク担当者候補は memberships を参照するため）
     *
     * @param  array<int, int>  $assigneeIds
     */
    public static function syncWorkspaceAssignees(
        Workspace $workspace,
        array $assigneeIds,
        ?int $addedBy = null,
    ): void {
        $ids = array_values(array_unique(array_map('intval', $assigneeIds)));
        $workspace->assignees()->sync($ids);

        $existing = $workspace->memberships()->get()->keyBy('id');
        $sync = [];
        foreach ($ids as $id) {
            $prior = $existing->get($id);
            $sync[$id] = [
                'role' => $prior?->pivot?->role ?? MembershipRole::Member->value,
                'added_by' => $prior?->pivot?->added_by ?? $addedBy,
            ];
        }
        $workspace->memberships()->sync($sync);
    }

    /**
     * @param  array<int, int>  $viewerIds
     * @return array<int, int>
     */
    public static function ensureCreatorIncluded(array $ids, int $creatorId): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if (! in_array($creatorId, $ids, true)) {
            $ids[] = $creatorId;
        }

        return $ids;
    }

    public static function organizationPivotFor(User $user, Organization|int $organization): ?object
    {
        $organizationId = $organization instanceof Organization
            ? (int) $organization->id
            : (int) $organization;

        return $user->organizations()
            ->where('organizations.id', $organizationId)
            ->first()
            ?->pivot;
    }
}
