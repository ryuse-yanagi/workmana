<?php

namespace App\Http\Controllers\Api;

use App\Enums\MembershipRole;
use App\Models\ProjectLabel;
use App\Models\Organization;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectController extends ApiController
{
    public function index(Request $request, Organization $organization): JsonResponse
    {
        $labelIds = $this->normalizeLabelIds($request->query('label_ids'));

        $query = $request->user()
            ->projects()
            ->where('projects.organization_id', $organization->id)
            ->with(['labels:id,name,color'])
            ->orderByDesc('projects.created_at');

        if (! $request->boolean('archived')) {
            $query->whereNull('projects.archived_at');
        }

        if ($labelIds !== []) {
            $query->whereHas('labels', function ($q) use ($labelIds, $organization) {
                $q->where('project_labels.organization_id', $organization->id)
                    ->whereIn('project_labels.id', $labelIds);
            });
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
            'label_ids' => ['nullable', 'array'],
            'label_ids.*' => ['integer', 'distinct'],
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

        $labelIds = $this->validateProjectLabelIds(
            $organization,
            $validated['label_ids'] ?? [],
        );
        if ($labelIds !== []) {
            $project->labels()->sync($labelIds);
        }

        $project->memberships()->attach($user->id, [
            'role' => MembershipRole::Admin->value,
            'added_by' => $user->id,
        ]);

        return response()->json([
            'id' => $project->id,
            'name' => $project->name,
            'description' => $project->description,
            'archived_at' => $project->archived_at,
            'labels' => $project->labels()->get(['project_labels.id', 'project_labels.name', 'project_labels.color']),
        ], 201);
    }

    public function members(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);

        $members = $project->memberships()
            ->orderBy('users.name')
            ->get(['users.id', 'users.name', 'users.email', 'users.avatar_path']);

        return response()->json([
            'data' => $members->map(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar_url' => $this->avatarUrl($user->avatar_path),
            ]),
        ]);
    }

    public function show(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);

        $project->load(['labels:id,name,color']);

        return response()->json([
            'id' => $project->id,
            'name' => $project->name,
            'description' => $project->description,
            'archived_at' => $project->archived_at,
            'created_at' => $project->created_at,
            'labels' => $project->labels,
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
            'label_ids' => ['nullable', 'array'],
            'label_ids.*' => ['integer', 'distinct'],
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

        if (array_key_exists('label_ids', $validated)) {
            $labelIds = $this->validateProjectLabelIds($organization, $validated['label_ids'] ?? []);
            $project->labels()->sync($labelIds);
        }
        $project->load(['labels:id,name,color']);

        return response()->json([
            'id' => $project->id,
            'name' => $project->name,
            'description' => $project->description,
            'labels' => $project->labels,
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

    /**
     * @return array<int, int>
     */
    private function normalizeLabelIds(mixed $raw): array
    {
        if (is_string($raw)) {
            $parts = array_filter(array_map('trim', explode(',', $raw)), fn ($v) => $v !== '');
            return array_values(array_unique(array_map('intval', $parts)));
        }
        if (is_array($raw)) {
            return array_values(array_unique(array_map('intval', $raw)));
        }

        return [];
    }

    /**
     * @param array<int, mixed> $labelIds
     * @return array<int, int>
     */
    private function validateProjectLabelIds(Organization $organization, array $labelIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $labelIds)));
        if ($ids === []) {
            return [];
        }

        $count = ProjectLabel::query()
            ->where('organization_id', $organization->id)
            ->whereIn('id', $ids)
            ->count();
        if ($count !== count($ids)) {
            abort(422, 'One or more labels are invalid for this organization.');
        }

        return $ids;
    }
}
