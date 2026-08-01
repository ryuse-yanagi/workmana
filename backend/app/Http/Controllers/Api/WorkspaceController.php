<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use App\Models\SharedDocument;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceLabel;
use App\Support\BidirectionalRelationSync;
use App\Support\DefaultBoardLists;
use App\Support\DefaultWorkspaceStatuses;
use App\Support\FieldLengthLimits;
use App\Support\ListQuery;
use App\Support\PermanentDeleter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkspaceController extends ApiController
{
    public function index(Request $request, Organization $organization): JsonResponse
    {
        $pivot = $request->attributes->get('organization_membership');
        if (! $pivot) {
            abort(403);
        }

        $labelIds = $this->normalizeLabelIds($request->query('label_ids'));

        $query = Workspace::query()
            ->where('organization_id', $organization->id)
            ->notArchived();
        $this->scopeWorkspacesVisibleTo($request->user(), $query)
            ->with([
                'labels:id,name,color_index',
                'assignees:id,name,email,avatar_path',
            ])
            ->orderByDesc('created_at');

        if ($labelIds !== []) {
            $query->whereHas('labels', function ($q) use ($labelIds, $organization) {
                $q->where('workspace_labels.organization_id', $organization->id)
                    ->whereIn('workspace_labels.id', $labelIds);
            });
        }

        $viewer = $request->user();
        $result = ListQuery::paginate(
            $query,
            $request,
            fn (Workspace $workspace) => $this->workspacePayload($workspace, $organization, $viewer),
            ['workspaces.name', 'workspaces.description'],
        );

        return response()->json($result);
    }

    public function archivedIndex(Request $request, Organization $organization): JsonResponse
    {
        if (! $request->attributes->get('organization_membership')) {
            abort(403);
        }

        $query = Workspace::query()
            ->where('organization_id', $organization->id)
            ->archived();
        $this->scopeWorkspacesVisibleTo($request->user(), $query)
            ->with([
                'labels:id,name,color_index',
                'assignees:id,name,email,avatar_path',
            ])
            ->orderByDesc('archived_at');

        $viewer = $request->user();
        if ($request->has('page') || $request->has('per_page')) {
            $result = ListQuery::paginate(
                $query,
                $request,
                fn (Workspace $workspace) => $this->workspacePayload($workspace, $organization, $viewer),
            );

            return response()->json($result);
        }

        $workspaces = $query->get();

        return response()->json([
            'data' => $workspaces->map(fn (Workspace $workspace) => $this->workspacePayload($workspace, $organization, $viewer)),
        ]);
    }

    public function store(Request $request, Organization $organization): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:'.FieldLengthLimits::WORKSPACE_NAME],
            'description' => ['nullable', 'string', 'max:'.FieldLengthLimits::TASK_DESCRIPTION],
            'status' => ['nullable', 'string', 'max:'.FieldLengthLimits::DEFAULT_NAMED_ITEM_NAME],
            'label_ids' => ['nullable', 'array'],
            'label_ids.*' => ['integer', 'distinct'],
            'assignee_ids' => ['nullable', 'array'],
            'assignee_ids.*' => ['integer', 'distinct'],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Name cannot be empty.'], 422);
        }

        $user = $request->user();

        $labelIds = $this->validateWorkspaceLabelIds(
            $organization,
            $validated['label_ids'] ?? [],
        );
        $assigneeIds = $this->validateWorkspaceAssigneeIds(
            $organization,
            $validated['assignee_ids'] ?? [],
        );

        $workspace = DB::transaction(function () use (
            $organization,
            $user,
            $name,
            $validated,
            $labelIds,
            $assigneeIds,
        ) {
            $workspace = Workspace::query()->create([
                'organization_id' => $organization->id,
                'created_by' => $user->id,
                'name' => $name,
                'description' => $validated['description'] ?? null,
                'status' => DefaultWorkspaceStatuses::validateStatusForOrganization(
                    $organization,
                    $validated['status'] ?? null,
                ),
            ]);

            if ($labelIds !== []) {
                $workspace->labels()->sync($labelIds);
            }

            if ($assigneeIds !== []) {
                $workspace->assignees()->sync($assigneeIds);
            }

            DefaultBoardLists::seedForWorkspace($workspace, $organization);

            return $workspace;
        });

        $workspace->load([
            'labels:id,name,color_index',
            'assignees:id,name,email,avatar_path',
        ]);

        return response()->json($this->workspacePayload($workspace, $organization, $request->user()), 201);
    }

    public function members(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);

        $members = $organization->members()
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

        $workspace->load([
            'labels:id,name,color_index',
            'assignees:id,name,email,avatar_path',
            'relatedWorkspaces:id,name,description,organization_id,archived_at',
            'relatedDocuments:id,name,description,organization_id',
        ]);

        return response()->json($this->workspacePayload($workspace, $organization, $request->user()));
    }

    public function syncRelatedWorkspaces(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanEditWorkspace($request->user(), $workspace);

        if ($workspace->isArchived()) {
            abort(403, 'Cannot update an archived workspace.');
        }

        $validated = $request->validate([
            'workspace_ids' => ['present', 'array'],
            'workspace_ids.*' => ['integer', 'distinct'],
        ]);

        $relatedIds = $this->validateRelatedWorkspaceIds(
            $request,
            $organization,
            $workspace,
            $validated['workspace_ids'] ?? [],
            allowEmpty: true,
        );
        BidirectionalRelationSync::syncRelatedWorkspaces($workspace, $relatedIds);
        $workspace->load([
            'relatedWorkspaces:id,name,description,organization_id,archived_at',
        ]);

        $viewer = $request->user();

        return response()->json([
            'data' => $this->filterAccessibleWorkspaces($viewer, $workspace->relatedWorkspaces)
                ->map(fn (Workspace $item) => $this->relatedWorkspacePayload($item))
                ->values(),
        ]);
    }

    public function syncRelatedDocuments(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanEditWorkspace($request->user(), $workspace);

        if ($workspace->isArchived()) {
            abort(403, 'Cannot update an archived workspace.');
        }

        $validated = $request->validate([
            'document_ids' => ['present', 'array'],
            'document_ids.*' => ['integer', 'distinct'],
        ]);

        $documentIds = $this->validateRelatedDocumentIds(
            $organization,
            $validated['document_ids'] ?? [],
        );
        $workspace->relatedDocuments()->sync($documentIds);
        $workspace->load([
            'relatedDocuments:id,name,description,organization_id',
        ]);

        return response()->json([
            'data' => $workspace->relatedDocuments
                ->map(fn (SharedDocument $item) => $this->relatedDocumentPayload($item))
                ->values(),
        ]);
    }

    public function detachRelatedWorkspace(
        Request $request,
        Organization $organization,
        Workspace $workspace,
        Workspace $relatedWorkspace,
    ): JsonResponse {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanEditWorkspace($request->user(), $workspace);

        if ($workspace->isArchived()) {
            abort(403, 'Cannot update an archived workspace.');
        }

        $this->ensureWorkspaceBelongsToOrganization($relatedWorkspace, $organization);
        BidirectionalRelationSync::detachRelatedWorkspace($workspace, $relatedWorkspace);
        $workspace->load([
            'relatedWorkspaces:id,name,description,organization_id,archived_at',
        ]);

        $viewer = $request->user();

        return response()->json([
            'data' => $this->filterAccessibleWorkspaces($viewer, $workspace->relatedWorkspaces)
                ->map(fn (Workspace $item) => $this->relatedWorkspacePayload($item))
                ->values(),
        ]);
    }

    public function detachRelatedDocument(
        Request $request,
        Organization $organization,
        Workspace $workspace,
        SharedDocument $document,
    ): JsonResponse {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanEditWorkspace($request->user(), $workspace);

        if ($workspace->isArchived()) {
            abort(403, 'Cannot update an archived workspace.');
        }

        if ($document->organization_id !== $organization->id) {
            abort(404);
        }

        $workspace->relatedDocuments()->detach($document->id);
        $workspace->load([
            'relatedDocuments:id,name,description,organization_id',
        ]);

        return response()->json([
            'data' => $workspace->relatedDocuments
                ->map(fn (SharedDocument $item) => $this->relatedDocumentPayload($item))
                ->values(),
        ]);
    }

    public function update(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanEditWorkspace($request->user(), $workspace);

        if ($workspace->isArchived()) {
            abort(403, 'Cannot update an archived workspace.');
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:'.FieldLengthLimits::WORKSPACE_NAME],
            'description' => ['nullable', 'string', 'max:'.FieldLengthLimits::TASK_DESCRIPTION],
            'status' => ['nullable', 'string', 'max:'.FieldLengthLimits::DEFAULT_NAMED_ITEM_NAME],
            'label_ids' => ['nullable', 'array'],
            'label_ids.*' => ['integer', 'distinct'],
            'assignee_ids' => ['nullable', 'array'],
            'assignee_ids.*' => ['integer', 'distinct'],
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
        if (array_key_exists('status', $validated)) {
            $workspace->status = DefaultWorkspaceStatuses::validateStatusForOrganization(
                $organization,
                $validated['status'],
            );
        }
        $labelIds = array_key_exists('label_ids', $validated)
            ? $this->validateWorkspaceLabelIds($organization, $validated['label_ids'] ?? [])
            : null;
        $assigneeIds = array_key_exists('assignee_ids', $validated)
            ? $this->validateWorkspaceAssigneeIds($organization, $validated['assignee_ids'] ?? [])
            : null;

        DB::transaction(function () use ($workspace, $labelIds, $assigneeIds) {
            $workspace->save();

            if ($labelIds !== null) {
                $workspace->labels()->sync($labelIds);
            }
            if ($assigneeIds !== null) {
                $workspace->assignees()->sync($assigneeIds);
            }
        });

        $workspace->load([
            'labels:id,name,color_index',
            'assignees:id,name,email,avatar_path',
            'relatedWorkspaces:id,name,description,organization_id,archived_at',
            'relatedDocuments:id,name,description,organization_id',
        ]);

        return response()->json($this->workspacePayload($workspace, $organization, $request->user()));
    }

    public function archive(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanEditWorkspace($request->user(), $workspace);

        if ($workspace->isArchived()) {
            return response()->json(['message' => 'Workspace is already archived.'], 422);
        }

        $workspace->archived_at = now();
        $workspace->save();

        return response()->json($this->workspacePayload($workspace, $organization, $request->user()));
    }

    public function unarchive(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanRestoreOrPermanentlyDelete($request);

        if (! $workspace->isArchived()) {
            return response()->json(['message' => 'Workspace is not archived.'], 422);
        }

        $workspace->archived_at = null;
        $workspace->save();

        return response()->json($this->workspacePayload($workspace, $organization, $request->user()));
    }

    public function destroy(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanRestoreOrPermanentlyDelete($request);

        if (! $workspace->isArchived()) {
            return response()->json([
                'message' => 'Archive the workspace before deleting it permanently.',
            ], 422);
        }

        PermanentDeleter::deleteWorkspace($workspace);

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
     * @param  array<int, mixed>  $labelIds
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

    /**
     * @param  array<int, mixed>  $assigneeIds
     * @return array<int, int>
     */
    private function validateWorkspaceAssigneeIds(Organization $organization, array $assigneeIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $assigneeIds)));
        if ($ids === []) {
            return [];
        }

        $count = $organization->members()
            ->whereIn('users.id', $ids)
            ->count();
        if ($count !== count($ids)) {
            abort(422, 'One or more assignees are invalid for this organization.');
        }

        return $ids;
    }

    /**
     * @param  array<int, mixed>  $workspaceIds
     * @return array<int, int>
     */
    private function validateRelatedWorkspaceIds(
        Request $request,
        Organization $organization,
        Workspace $workspace,
        array $workspaceIds,
        bool $allowEmpty = false,
    ): array {
        $ids = array_values(array_unique(array_map('intval', $workspaceIds)));
        $ids = array_values(array_filter($ids, fn (int $id) => $id !== (int) $workspace->id));
        if ($ids === []) {
            if ($allowEmpty) {
                return [];
            }

            abort(422, 'One or more workspaces are invalid for this organization.');
        }

        $workspaces = Workspace::query()
            ->where('organization_id', $organization->id)
            ->whereNull('archived_at')
            ->whereIn('id', $ids)
            ->get(['id', 'organization_id', 'archived_at']);
        if ($workspaces->count() !== count($ids)) {
            abort(422, 'One or more workspaces are invalid for this organization.');
        }

        $user = $request->user();
        foreach ($workspaces as $related) {
            if (! $user->canAccessWorkspace($related)) {
                abort(422, 'One or more workspaces are invalid for this organization.');
            }
        }

        return $ids;
    }

    /**
     * @param  array<int, mixed>  $documentIds
     * @return array<int, int>
     */
    private function validateRelatedDocumentIds(Organization $organization, array $documentIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $documentIds)));
        if ($ids === []) {
            return [];
        }

        $count = SharedDocument::query()
            ->where('organization_id', $organization->id)
            ->notArchived()
            ->whereIn('id', $ids)
            ->count();
        if ($count !== count($ids)) {
            abort(422, 'One or more documents are invalid for this organization.');
        }

        return $ids;
    }

    /**
     * @return array<string, mixed>
     */
    private function relatedWorkspacePayload(Workspace $workspace): array
    {
        return [
            'id' => $workspace->id,
            'name' => $workspace->name,
            'description' => $workspace->description,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function relatedDocumentPayload(SharedDocument $document): array
    {
        return [
            'id' => $document->id,
            'name' => $document->name,
            'description' => $document->description,
        ];
    }



    /**
     * @return array<string, mixed>
     */
    private function workspacePayload(Workspace $workspace, Organization $organization, User $viewer): array
    {
        return [
            'id' => $workspace->id,
            'name' => $workspace->name,
            'description' => $workspace->description,
            'status' => DefaultWorkspaceStatuses::resolvedStatusPayload($workspace, $organization),
            'archived_at' => $workspace->archived_at,
            'created_at' => $workspace->created_at,
            'updated_at' => $workspace->updated_at,
            'labels' => $workspace->relationLoaded('labels')
                ? $workspace->labels
                : $workspace->labels()->get(['workspace_labels.id', 'workspace_labels.name', 'workspace_labels.color_index']),
            'assignees' => $workspace->relationLoaded('assignees')
                ? $workspace->assignees->map(fn ($user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'avatar_url' => $this->avatarUrl($user->avatar_path),
                ])->values()
                : $workspace->assignees()
                    ->get(['users.id', 'users.name', 'users.email', 'users.avatar_path'])
                    ->map(fn ($user) => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'avatar_url' => $this->avatarUrl($user->avatar_path),
                    ])->values(),
            'related_workspaces' => $workspace->relationLoaded('relatedWorkspaces')
                ? $this->filterAccessibleWorkspaces($viewer, $workspace->relatedWorkspaces)
                    ->map(fn (Workspace $item) => $this->relatedWorkspacePayload($item))
                    ->values()
                : [],
            'related_documents' => $workspace->relationLoaded('relatedDocuments')
                ? $workspace->relatedDocuments
                    ->map(fn (SharedDocument $item) => $this->relatedDocumentPayload($item))
                    ->values()
                : [],
        ];
    }
}
