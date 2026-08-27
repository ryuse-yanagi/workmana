<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use App\Models\User;
use App\Models\Workspace;
use App\Http\Controllers\Controller;
use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

abstract class ApiController extends Controller
{
    protected function ensureWorkspaceBelongsToOrganization(Workspace $workspace, Organization $organization): void
    {
        if ((int) $workspace->organization_id !== (int) $organization->id) {
            abort(404);
        }
    }

    protected function ensureWorkspaceMember(User $user, Workspace $workspace): void
    {
        if (! $user->canAccessWorkspace($workspace)) {
            abort(403, 'Not allowed to access this workspace.');
        }
    }

    protected function assertCanEditWorkspace(User $user, Workspace $workspace): void
    {
        $this->ensureWorkspaceMember($user, $workspace);
        if (! $user->canEditWorkspace($workspace)) {
            abort(403, 'Not allowed to modify this workspace.');
        }
    }

    protected function assertOrganizationAdmin(Request $request): void
    {
        if (! $this->isOrganizationAdmin($request)) {
            abort(403, 'Only organization admins can perform this action.');
        }
    }

    protected function isOrganizationAdmin(Request $request): bool
    {
        $pivot = $request->attributes->get('organization_membership');

        return ($pivot->role ?? '') === 'admin';
    }

    /**
     * アーカイブの復元・完全削除は組織管理者のみ。
     */
    protected function assertCanRestoreOrPermanentlyDelete(Request $request): void
    {
        $this->assertOrganizationAdmin($request);
    }

    protected function assertWorkspaceNotArchived(Workspace $workspace): void
    {
        if ($workspace->isArchived()) {
            abort(403, 'Workspace is archived.');
        }
    }

    protected function avatarUrl(?string $avatarPath): ?string
    {
        return MediaUrl::avatar($avatarPath);
    }

    protected function iconUrl(?string $iconPath): ?string
    {
        return MediaUrl::publicPath($iconPath);
    }

    /**
     * @return array<string, mixed>
     */
    protected function userPayload(User $user): array
    {
        $user->loadMissing('organizations');

        return [
            'id' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'avatar_url' => $this->avatarUrl($user->avatar_path),
            'last_organization_id' => $user->last_organization_id,
            'organizations' => $user->organizations->map(fn ($o) => [
                'id' => $o->id,
                'name' => $o->name,
                'slug' => $o->slug,
                'role' => $o->pivot->role,
                'icon_url' => $this->iconUrl($o->icon_path),
            ]),
        ];
    }

    /**
     * @return array{id: int, name: string, slug: string, icon_url: ?string}
     */
    protected function organizationPayload(Organization $organization): array
    {
        return [
            'id' => $organization->id,
            'name' => $organization->name,
            'slug' => $organization->slug,
            'icon_url' => $this->iconUrl($organization->icon_path),
        ];
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<\App\Models\Workspace>  $query
     * @return \Illuminate\Database\Eloquent\Builder<\App\Models\Workspace>
     */
    protected function scopeWorkspacesVisibleTo(User $user, $query)
    {
        // 組織メンバーであれば全スペースが可視（組織所属は呼び出し側で担保）
        return $query;
    }

    /**
     * @param  iterable<int, Workspace>  $workspaces
     * @return Collection<int, Workspace>
     */
    protected function filterAccessibleWorkspaces(User $user, iterable $workspaces): Collection
    {
        return collect($workspaces)
            ->filter(fn (Workspace $workspace) => $user->canAccessWorkspace($workspace))
            ->values();
    }
}
