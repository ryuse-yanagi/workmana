<?php

namespace App\Http\Controllers\Api;

use App\Enums\MembershipRole;
use App\Models\Organization;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectController extends ApiController
{
    public function index(Request $request, Organization $organization): JsonResponse
    {
        $query = $request->user()
            ->projects()
            ->where('projects.organization_id', $organization->id)
            ->orderByDesc('projects.created_at');

        if (! $request->boolean('archived')) {
            $query->whereNull('projects.archived_at');
        }

        $projects = $query->get([
            'projects.id',
            'projects.name',
            'projects.description',
            'projects.archived_at',
            'projects.created_at',
            'projects.updated_at',
        ]);

        return response()->json(['data' => $projects]);
    }

    public function store(Request $request, Organization $organization): JsonResponse
    {
        $this->assertCanManageProjectsInOrganization($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Name cannot be empty.'], 422);
        }

        $user = $request->user();

        $project = Project::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => $name,
            'description' => $validated['description'] ?? null,
        ]);

        $project->memberships()->attach($user->id, [
            'role' => MembershipRole::Admin->value,
            'added_by' => $user->id,
        ]);

        return response()->json([
            'id' => $project->id,
            'name' => $project->name,
            'description' => $project->description,
            'archived_at' => $project->archived_at,
        ], 201);
    }

    public function show(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);

        return response()->json([
            'id' => $project->id,
            'name' => $project->name,
            'description' => $project->description,
            'archived_at' => $project->archived_at,
            'created_at' => $project->created_at,
        ]);
    }

    public function update(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);

        if ($project->isArchived()) {
            abort(403, 'Cannot update an archived project.');
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ]);

        if (array_key_exists('name', $validated)) {
            $name = trim($validated['name']);
            if ($name === '') {
                return response()->json(['message' => 'Name cannot be empty.'], 422);
            }
            $project->name = $name;
        }
        if (array_key_exists('description', $validated)) {
            $project->description = $validated['description'];
        }
        $project->save();

        return response()->json([
            'id' => $project->id,
            'name' => $project->name,
            'description' => $project->description,
        ]);
    }

    public function archive(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);

        $validated = $request->validate([
            'archived' => ['required', 'boolean'],
        ]);

        $project->archived_at = $validated['archived'] ? now() : null;
        $project->save();

        return response()->json(['archived_at' => $project->archived_at]);
    }

    public function destroy(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);

        $orgPivot = $request->attributes->get('organization_membership');
        if (($orgPivot->role ?? '') !== 'admin') {
            abort(403, 'Only organization admins can delete projects.');
        }

        $project->delete();

        return response()->json(null, 204);
    }
}
