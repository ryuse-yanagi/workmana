<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use App\Models\Workspace;
use App\Models\User;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

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
        if (! $user->isMemberOfWorkspace($workspace)) {
            abort(403, 'Not a member of this workspace.');
        }
    }

    protected function denyIfWorkspaceViewer(User $user, Workspace $workspace): void
    {
        $role = $user->workspacePivot($workspace)?->role ?? '';
        if ($role === 'viewer') {
            abort(403, 'Viewer role is read-only.');
        }
    }

    protected function assertCanManageWorkspacesInOrganization(Request $request): void
    {
        $pivot = $request->attributes->get('organization_membership');
        $role = $pivot->role ?? '';
        if (! in_array($role, ['admin', 'leader'], true)) {
            abort(403, 'Insufficient organization role to manage workspaces.');
        }
    }

    protected function assertWorkspaceNotArchived(Workspace $workspace): void
    {
        if ($workspace->isArchived()) {
            abort(403, 'Workspace is archived.');
        }
    }

    protected function avatarUrl(?string $avatarPath): ?string
    {
        if (! $avatarPath) {
            return null;
        }

        return Storage::disk('public')->url($avatarPath);
    }
}
