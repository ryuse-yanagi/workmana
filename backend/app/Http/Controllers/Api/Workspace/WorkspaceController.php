<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Events\Workspace\WorkspaceMembersUpdated;
use App\Http\Controllers\Api\ApiController;
use App\Http\Requests\Api\StoreWorkspaceRequest;
use App\Http\Requests\Api\UpdateWorkspaceRequest;
use App\Models\Document\Document;
use App\Models\Organization\Organization;
use App\Models\User;
use App\Models\Workspace\Workspace;
use App\Models\Workspace\WorkspaceLabel;
use App\Services\Notification\NotificationService;
use App\Support\Document\DefaultDocumentCategories;
use App\Support\ListQuery;
use App\Support\Organization\OrganizationAccess;
use App\Support\PermanentDeleter;
use App\Support\SafeBroadcast;
use App\Support\Workspace\DefaultBoardLists;
use App\Support\Workspace\DefaultWorkspaceStatuses;
use App\Support\Workspace\WorkspaceMembersBroadcast;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class WorkspaceController extends ApiController
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    /** 組織の未アーカイブスペースを一覧する。 */
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
            ->with($this->workspaceListRelations())
            ->orderByDesc('created_at');

        if ($labelIds !== []) {
            $query->whereHas('labels', function ($q) use ($labelIds, $organization) {
                $q->where('workspace_labels.organization_id', $organization->id)
                    ->whereIn('workspace_labels.id', $labelIds);
            });
        }

        $viewer = $request->user();
        $this->applyViewerPinSelect($query, $viewer);
        $result = ListQuery::all(
            $query,
            $request,
            fn (Workspace $workspace) => $this->workspacePayload($workspace, $organization, $viewer),
            ['workspaces.name'],
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
            ->with($this->workspaceListRelations())
            ->orderByDesc('archived_at');

        $viewer = $request->user();
        $this->applyViewerPinSelect($query, $viewer);
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

    /** スペースを作り、組織の既定ボード列を入れる。 */
    public function store(StoreWorkspaceRequest $request, Organization $organization): JsonResponse
    {
        $validated = $request->validated();

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

            OrganizationAccess::syncWorkspaceAssignees($workspace, $assigneeIds);

            DefaultBoardLists::seedForWorkspace($workspace, $organization);

            return $workspace;
        });

        $workspace->load(array_merge(
            [
                'labels:id,name,color_index',
                'assignees:id,name,email,avatar_path',
            ],
            $this->workspaceDetailOnlyRelations(),
        ));
        $this->loadViewerPin($workspace, $request->user());
        $this->notifyAddedWorkspaceMembers($workspace, $organization, $assigneeIds, $user->id);

        return response()->json($this->workspacePayload($workspace, $organization, $request->user()), 201);
    }

    public function members(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);

        $members = $workspace->assignees()
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
            ...$this->workspaceDetailOnlyRelations(),
        ]);
        $this->loadViewerPin($workspace, $request->user());

        return response()->json($this->workspacePayload($workspace, $organization, $request->user()));
    }

    /** アーカイブ済みは更新できない。外した担当者はタスク担当からも外す。 */
    public function update(UpdateWorkspaceRequest $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanEditWorkspace($request->user(), $workspace);

        if ($workspace->isArchived()) {
            abort(403, 'Cannot update an archived workspace.');
        }

        $validated = $request->validated();

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

        $removedAssigneeIds = [];
        $addedAssigneeIds = $assigneeIds === null
            ? []
            : array_values(array_diff($assigneeIds, $this->currentWorkspaceAssigneeIds($workspace)));

        DB::transaction(function () use ($workspace, $labelIds, $assigneeIds, $request, &$removedAssigneeIds) {
            $workspace->save();

            if ($labelIds !== null) {
                $workspace->labels()->sync($labelIds);
            }
            if ($assigneeIds !== null) {
                $removedAssigneeIds = $this->removedWorkspaceAssigneeIds($workspace, $assigneeIds);
                OrganizationAccess::syncWorkspaceAssignees($workspace, $assigneeIds);
                if ($removedAssigneeIds !== []) {
                    $this->removeTaskAssigneesForUsers($workspace, $removedAssigneeIds);
                }
            }

            // ラベルや担当者だけの変更でも、スペースの活動日時を更新する。
            if ($labelIds !== null || $assigneeIds !== null) {
                $workspace->recordActivity();
            }
        });

        $workspace->load([
            'labels:id,name,color_index',
            'assignees:id,name,email,avatar_path',
            ...$this->workspaceDetailOnlyRelations(),
        ]);
        $this->loadViewerPin($workspace, $request->user());

        if ($assigneeIds !== null) {
            SafeBroadcast::toOthers(new WorkspaceMembersUpdated(
                (int) $workspace->id,
                WorkspaceMembersBroadcast::membersPayload($workspace->assignees),
                $removedAssigneeIds,
            ));
            $this->notifyAddedWorkspaceMembers(
                $workspace,
                $organization,
                $addedAssigneeIds,
                $request->user()?->id,
            );
        }

        return response()->json($this->workspacePayload($workspace, $organization, $request->user()));
    }

    /** 組織管理者のみスペースをアーカイブする。 */
    public function archive(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanManageArchive($request);

        if ($workspace->isArchived()) {
            return response()->json(['message' => 'Workspace is already archived.'], 422);
        }

        $workspace->archived_at = now();
        $workspace->save();
        $this->loadViewerPin($workspace, $request->user());

        return response()->json($this->workspacePayload($workspace, $organization, $request->user()));
    }

    /** 組織管理者のみアーカイブ済みスペースを戻す。 */
    public function unarchive(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanManageArchive($request);

        if (! $workspace->isArchived()) {
            return response()->json(['message' => 'Workspace is not archived.'], 422);
        }

        $workspace->archived_at = null;
        $workspace->save();
        $this->loadViewerPin($workspace, $request->user());

        return response()->json($this->workspacePayload($workspace, $organization, $request->user()));
    }

    public function pin(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);

        $user = $request->user();
        $workspace->pinnedByUsers()->syncWithoutDetaching([
            $user->id => ['pinned_at' => now()],
        ]);

        $workspace->load([
            'labels:id,name,color_index',
            'assignees:id,name,email,avatar_path',
            ...$this->workspaceDetailOnlyRelations(),
        ]);
        $workspace->load([
            'pinnedByUsers' => fn ($q) => $q->where('users.id', $user->id),
        ]);

        return response()->json($this->workspacePayload($workspace, $organization, $user));
    }

    public function unpin(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);

        $user = $request->user();
        $workspace->pinnedByUsers()->detach($user->id);

        $workspace->load([
            'labels:id,name,color_index',
            'assignees:id,name,email,avatar_path',
            ...$this->workspaceDetailOnlyRelations(),
        ]);
        $workspace->setRelation('pinnedByUsers', collect());

        return response()->json($this->workspacePayload($workspace, $organization, $user));
    }

    /** アーカイブ済みのスペースだけを完全削除する。組織管理者のみ。 */
    public function destroy(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanManageArchive($request);

        if (! $workspace->isArchived()) {
            return response()->json([
                'message' => 'Archive the workspace before deleting it permanently.',
            ], 422);
        }

        PermanentDeleter::deleteWorkspace($workspace);

        return response()->json(null, 204);
    }

    /**
     * カンマ区切り文字列か配列を、重複のないラベル ID にする。
     *
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
     * 組織に属さないラベルは 422。
     *
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
     * 組織メンバー以外は担当者にできない。
     *
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
     * @param  array<int, int>  $newAssigneeIds
     * @return list<int>
     */
    private function removedWorkspaceAssigneeIds(Workspace $workspace, array $newAssigneeIds): array
    {
        return array_values(array_diff($this->currentWorkspaceAssigneeIds($workspace), $newAssigneeIds));
    }

    /**
     * @return list<int>
     */
    private function currentWorkspaceAssigneeIds(Workspace $workspace): array
    {
        return $workspace->assignees()
            ->pluck('users.id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /**
     * @param  list<int>  $userIds
     */
    private function notifyAddedWorkspaceMembers(
        Workspace $workspace,
        Organization $organization,
        array $userIds,
        ?int $exceptUserId,
    ): void {
        $this->notifications->notifyMany(
            $userIds,
            'workspace.member_added',
            [
                'workspace_id' => (int) $workspace->id,
                'workspace_name' => $workspace->name,
                'organization_slug' => $organization->slug,
                'title' => $workspace->name,
            ],
            $exceptUserId,
        );
    }

    /**
     * @param  list<int>  $userIds
     */
    private function removeTaskAssigneesForUsers(Workspace $workspace, array $userIds): void
    {
        if ($userIds === []) {
            return;
        }

        $taskIds = DB::table('tasks')
            ->where('workspace_id', $workspace->id)
            ->pluck('id');
        if ($taskIds->isEmpty()) {
            return;
        }

        DB::table('task_assignees')
            ->whereIn('user_id', $userIds)
            ->whereIn('task_id', $taskIds)
            ->delete();
    }

    /**
     * @return array<string, mixed>
     */
    private function workspaceListRelations(): array
    {
        return array_merge(
            [
                'labels:id,name,color_index',
                'assignees:id,name,email,avatar_path',
            ],
            $this->workspaceDetailOnlyRelations(),
        );
    }

    /**
     * 未アーカイブの資料だけを載せる。
     *
     * @return array<string, mixed>
     */
    private function workspaceDetailOnlyRelations(): array
    {
        return [
            'documents' => fn ($query) => $query
                ->notArchived()
                ->orderByDesc('shared_documents.created_at')
                ->select([
                    'shared_documents.id',
                    'shared_documents.name',
                    'shared_documents.description',
                    'shared_documents.category',
                    'shared_documents.organization_id',
                    'shared_documents.workspace_id',
                    'shared_documents.archived_at',
                ]),
        ];
    }

    /**
     * カテゴリは組織の既定カテゴリに解決して返す。
     *
     * @return array<string, mixed>
     */
    private function documentSummaryPayload(Document $document, Organization $organization): array
    {
        return [
            'id' => $document->id,
            'name' => $document->name,
            'description' => $document->description,
            'category' => DefaultDocumentCategories::resolvedCategoryPayload($document, $organization),
        ];
    }

    private function loadViewerPin(Workspace $workspace, User $viewer): void
    {
        $workspace->load([
            'pinnedByUsers' => fn ($q) => $q->where('users.id', $viewer->id),
        ]);
    }

    /**
     * ピンテーブルが無いときは viewer_pinned_at を null にする。
     *
     * @param  Builder<Workspace>  $query
     */
    private function applyViewerPinSelect($query, User $viewer): void
    {
        if (! Schema::hasTable('workspace_pins')) {
            $query->select('workspaces.*')->selectRaw('null as viewer_pinned_at');

            return;
        }

        $query->addSelect([
            'viewer_pinned_at' => DB::table('workspace_pins')
                ->select('pinned_at')
                ->whereColumn('workspace_pins.workspace_id', 'workspaces.id')
                ->where('workspace_pins.user_id', $viewer->id)
                ->limit(1),
        ]);
    }

    /**
     * 閲覧者のピン状態と、名前順の担当者を含めて返す。
     *
     * @return array<string, mixed>
     */
    private function workspacePayload(Workspace $workspace, Organization $organization, User $viewer): array
    {
        $pinned = $workspace->isPinnedBy($viewer);
        $pinnedAt = $pinned ? $workspace->pinnedAtFor($viewer) : null;

        return [
            'id' => $workspace->id,
            'name' => $workspace->name,
            'description' => $workspace->description,
            'status' => DefaultWorkspaceStatuses::resolvedStatusPayload($workspace, $organization),
            'archived_at' => $workspace->archived_at,
            'created_at' => $workspace->created_at,
            'updated_at' => $workspace->updated_at,
            'pinned' => $pinned,
            'pinned_at' => $pinnedAt,
            'labels' => $workspace->relationLoaded('labels')
                ? $workspace->labels
                : $workspace->labels()->get(['workspace_labels.id', 'workspace_labels.name', 'workspace_labels.color_index']),
            'assignees' => $workspace->relationLoaded('assignees')
                ? $workspace->assignees
                    ->sortBy([
                        fn ($user) => mb_strtolower((string) ($user->name ?: $user->email ?: '')),
                        fn ($user) => $user->id,
                    ])
                    ->values()
                    ->map(fn ($user) => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'avatar_url' => $this->avatarUrl($user->avatar_path),
                    ])
                : $workspace->assignees()
                    ->orderBy('users.name')
                    ->orderBy('users.id')
                    ->get(['users.id', 'users.name', 'users.email', 'users.avatar_path'])
                    ->map(fn ($user) => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'avatar_url' => $this->avatarUrl($user->avatar_path),
                    ])->values(),
            'documents' => $workspace->relationLoaded('documents')
                ? $workspace->documents
                    ->map(fn (Document $item) => $this->documentSummaryPayload($item, $organization))
                    ->values()
                : [],
        ];
    }
}
