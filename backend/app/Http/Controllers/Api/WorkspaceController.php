<?php

namespace App\Http\Controllers\Api;

use App\Enums\MembershipRole;
use App\Models\WorkspaceLabel;
use App\Models\Organization;
use App\Models\Workspace;
use App\Support\DefaultBoardLists;
use App\Support\FieldLengthLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkspaceController extends ApiController
{
    public function index(Request $request, Organization $organization): JsonResponse
    {
        $labelIds = $this->normalizeLabelIds($request->query('label_ids'));

        $query = $request->user()
            ->workspaces()
            ->where('workspaces.organization_id', $organization->id)
            ->with(['labels:id,name,color_index'])
            ->orderByDesc('workspaces.created_at');

        if (! $request->boolean('archived')) {
            $query->whereNull('workspaces.archived_at');
        }

        if ($labelIds !== []) {
            $query->whereHas('labels', function ($q) use ($labelIds, $organization) {
                $q->where('workspace_labels.organization_id', $organization->id)
                    ->whereIn('workspace_labels.id', $labelIds);
            });
        }

        $workspaces = $query->get([
            'workspaces.id',
            'workspaces.name',
            'workspaces.description',
            'workspaces.archived_at',
            'workspaces.created_at',
            'workspaces.updated_at',
        ]);

        return response()->json(['data' => $workspaces]);
    }

    public function store(Request $request, Organization $organization): JsonResponse
    {
        $this->assertCanManageWorkspacesInOrganization($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::WORKSPACE_NAME],
            'description' => ['nullable', 'string'],
            'label_ids' => ['nullable', 'array'],
            'label_ids.*' => ['integer', 'distinct'],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Name cannot be empty.'], 422);
        }

        $user = $request->user();

        $workspace = Workspace::query()->create([
            'organization_id' => $organization->id,
            'created_by' => $user->id,
            'name' => $name,
            'description' => $validated['description'] ?? null,
        ]);

        $labelIds = $this->validateWorkspaceLabelIds(
            $organization,
            $validated['label_ids'] ?? [],
        );
        if ($labelIds !== []) {
            $workspace->labels()->sync($labelIds);
        }

        $workspace->memberships()->attach($user->id, [
            'role' => MembershipRole::Admin->value,
            'added_by' => $user->id,
        ]);

        DefaultBoardLists::seedForWorkspace($workspace, $organization);

        return response()->json([
            'id' => $workspace->id,
            'name' => $workspace->name,
            'description' => $workspace->description,
            'archived_at' => $workspace->archived_at,
            'labels' => $workspace->labels()->get(['workspace_labels.id', 'workspace_labels.name', 'workspace_labels.color_index']),
        ], 201);
    }

    public function members(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);

        $members = $workspace->memberships()
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

    public function show(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);

        $workspace->load(['labels:id,name,color_index']);

        return response()->json([
            'id' => $workspace->id,
            'name' => $workspace->name,
            'description' => $workspace->description,
            'archived_at' => $workspace->archived_at,
            'created_at' => $workspace->created_at,
            'labels' => $workspace->labels,
        ]);
    }

    public function update(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);
        $this->denyIfWorkspaceViewer($request->user(), $workspace);

        if ($workspace->isArchived()) {
            abort(403, 'Cannot update an archived workspace.');
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:'.FieldLengthLimits::WORKSPACE_NAME],
            'description' => ['nullable', 'string'],
            'label_ids' => ['nullable', 'array'],
            'label_ids.*' => ['integer', 'distinct'],
        ]);

        if (array_key_exists('name', $validated)) {
            $name = trim($validated['name']);
            if ($name === '') {
                return response()->json(['message' => 'Name cannot be empty.'], 422);
            }
            $workspace->name = $name;
        }
        if (array_key_exists('description', $validated)) {
            $workspace->description = $validated['description'];
        }
        $workspace->save();

        if (array_key_exists('label_ids', $validated)) {
            $labelIds = $this->validateWorkspaceLabelIds($organization, $validated['label_ids'] ?? []);
            $workspace->labels()->sync($labelIds);
        }
        $workspace->load(['labels:id,name,color_index']);

        return response()->json([
            'id' => $workspace->id,
            'name' => $workspace->name,
            'description' => $workspace->description,
            'labels' => $workspace->labels,
        ]);
    }

    public function archive(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);
        $this->denyIfWorkspaceViewer($request->user(), $workspace);

        $validated = $request->validate([
            'archived' => ['required', 'boolean'],
        ]);

        $workspace->archived_at = $validated['archived'] ? now() : null;
        $workspace->save();

        return response()->json(['archived_at' => $workspace->archived_at]);
    }

    public function destroy(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);

        $orgPivot = $request->attributes->get('organization_membership');
        if (($orgPivot->role ?? '') !== 'admin') {
            abort(403, 'Only organization admins can delete workspaces.');
        }

        $workspace->delete();

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
    private function validateWorkspaceLabelIds(Organization $organization, array $labelIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $labelIds)));
        if ($ids === []) {
            return [];
        }

        $count = WorkspaceLabel::query()
            ->where('organization_id', $organization->id)
            ->whereIn('id', $ids)
            ->count();
        if ($count !== count($ids)) {
            abort(422, 'One or more labels are invalid for this organization.');
        }

        return $ids;
    }
}
