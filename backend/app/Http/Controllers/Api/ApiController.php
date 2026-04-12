<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use App\Models\Project;
use App\Models\User;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

abstract class ApiController extends Controller
{
    protected function ensureProjectBelongsToOrganization(Project $project, Organization $organization): void
    {
        if ((int) $project->organization_id !== (int) $organization->id) {
            abort(404);
        }
    }

    protected function ensureProjectMember(User $user, Project $project): void
    {
        if (! $user->isMemberOfProject($project)) {
            abort(403, 'Not a member of this project.');
        }
    }

    protected function denyIfProjectViewer(User $user, Project $project): void
    {
        $role = $user->projectPivot($project)?->role ?? '';
        if ($role === 'viewer') {
            abort(403, 'Viewer role is read-only.');
        }
    }

    protected function assertCanManageProjectsInOrganization(Request $request): void
    {
        $pivot = $request->attributes->get('organization_membership');
        $role = $pivot->role ?? '';
        if (! in_array($role, ['admin', 'project_leader'], true)) {
            abort(403, 'Insufficient organization role to manage projects.');
        }
    }

    protected function assertProjectNotArchived(Project $project): void
    {
        if ($project->isArchived()) {
            abort(403, 'Project is archived.');
        }
    }
}
