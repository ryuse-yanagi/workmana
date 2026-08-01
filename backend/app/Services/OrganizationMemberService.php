<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class OrganizationMemberService
{
    public function updateRole(Organization $organization, User $target, string $role, User $actor): void
    {
        DB::transaction(function () use ($organization, $target, $role, $actor) {
            $this->lockOrganizationMemberships($organization);

            if ((int) $actor->id === (int) $target->id && $role !== 'admin') {
                $this->assertNotLastAdmin($organization, $target, '最後の管理者のロールは変更できません。');
            }

            if (! $organization->members()->where('users.id', $target->id)->exists()) {
                throw new RuntimeException('メンバーが見つかりません。');
            }

            if ($role !== 'admin') {
                $this->assertNotLastAdmin($organization, $target, '最後の管理者のロールは変更できません。');
            }

            $organization->members()->updateExistingPivot($target->id, ['role' => $role]);
        });
    }

    public function remove(Organization $organization, User $target, User $actor): void
    {
        if ((int) $actor->id === (int) $target->id) {
            throw new RuntimeException('自分自身を削除することはできません。別の管理者に依頼してください。');
        }

        DB::transaction(function () use ($organization, $target) {
            $this->lockOrganizationMemberships($organization);

            if (! $organization->members()->where('users.id', $target->id)->exists()) {
                throw new RuntimeException('メンバーが見つかりません。');
            }

            $this->assertNotLastAdmin($organization, $target, '最後の管理者は削除できません。');

            $workspaceIds = Workspace::query()
                ->where('organization_id', $organization->id)
                ->pluck('id')
                ->all();

            if ($workspaceIds !== []) {
                DB::table('workspace_assignees')
                    ->where('user_id', $target->id)
                    ->whereIn('workspace_id', $workspaceIds)
                    ->delete();

                $taskIds = DB::table('tasks')
                    ->whereIn('workspace_id', $workspaceIds)
                    ->pluck('id');
                if ($taskIds->isNotEmpty()) {
                    DB::table('task_assignees')
                        ->where('user_id', $target->id)
                        ->whereIn('task_id', $taskIds)
                        ->delete();
                }
            }

            $organization->members()->detach($target->id);
        });
    }

    private function lockOrganizationMemberships(Organization $organization): void
    {
        DB::table('memberships')
            ->where('organization_id', $organization->id)
            ->orderBy('user_id')
            ->lockForUpdate()
            ->get();
    }

    private function assertNotLastAdmin(Organization $organization, User $target, string $message): void
    {
        $targetIsAdmin = $organization->members()
            ->where('users.id', $target->id)
            ->wherePivot('role', 'admin')
            ->exists();
        if (! $targetIsAdmin) {
            return;
        }

        $adminCount = $organization->members()->wherePivot('role', 'admin')->count();
        if ($adminCount <= 1) {
            throw new RuntimeException($message);
        }
    }
}
