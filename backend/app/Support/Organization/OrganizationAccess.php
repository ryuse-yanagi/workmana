<?php

namespace App\Support\Organization;

use App\Enums\MembershipRole;
use App\Models\User;
use App\Models\Workspace\Workspace;
use Illuminate\Database\Eloquent\Builder;

/**
 * 組織メンバーシップで、スペースを閲覧できるかを判定する。
 */
final class OrganizationAccess
{
    public static function isOrganizationAdmin(?object $pivot): bool
    {
        return ($pivot->role ?? '') === MembershipRole::Admin->value;
    }

    /** メンバーシップが本人かつスペースの組織と一致するときだけ閲覧可。 */
    public static function canViewWorkspace(User $user, Workspace $workspace, ?object $orgPivot): bool
    {
        if ($orgPivot === null) {
            return false;
        }

        $memberUserId = (int) ($orgPivot->user_id ?? $user->id);
        $memberOrgId = (int) ($orgPivot->organization_id ?? $workspace->organization_id);

        return $memberUserId === (int) $user->id
            && $memberOrgId === (int) $workspace->organization_id;
    }

    /**
     * メンバーシップが本人でなければ 0 件にし、本人ならクエリをそのまま返す。
     *
     * @param  Builder<Workspace>  $query
     * @return Builder<Workspace>
     */
    public static function scopeVisibleWorkspaces(Builder $query, User $user, ?object $orgPivot): Builder
    {
        if ($orgPivot === null) {
            return $query->whereRaw('0 = 1');
        }

        $memberUserId = (int) ($orgPivot->user_id ?? $user->id);
        if ($memberUserId !== (int) $user->id) {
            return $query->whereRaw('0 = 1');
        }

        return $query;
    }

    /**
     * 担当者 ID を workspace_assignees に置き換える。組織メンバーかどうかは見ない。
     *
     * @param  array<int, int>  $assigneeIds
     */
    public static function syncWorkspaceAssignees(Workspace $workspace, array $assigneeIds): void
    {
        $ids = array_values(array_unique(array_map('intval', $assigneeIds)));
        $workspace->assignees()->sync($ids);
    }
}
