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
        if (! $user->canAccessWorkspace($workspace)) {
            abort(403, 'Not a member of this organization.');
        }
    }

    protected function assertOrganizationAdmin(Request $request): void
    {
        $pivot = $request->attributes->get('organization_membership');
        if (($pivot->role ?? '') !== 'admin') {
            abort(403, 'Only organization admins can manage organization settings.');
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
