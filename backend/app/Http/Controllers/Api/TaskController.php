<?php

namespace App\Http\Controllers\Api;

use App\Enums\TaskHistoryEventType;
use App\Enums\TaskPriority;
use App\Events\TaskArchived;
use App\Events\TaskCreated;
use App\Events\TaskDeleted;
use App\Events\TaskRestored;
use App\Events\TaskUpdated;
use App\Events\WbsTasksReordered;
use App\Http\Requests\Api\StoreTaskRequest;
use App\Models\BoardList;
use App\Models\Organization;
use App\Models\Task;
use App\Models\TaskChecklist;
use App\Models\TaskChecklistItem;
use App\Models\TaskHistory;
use App\Models\TaskLabel;
use App\Models\User;
use App\Models\Workspace;
use App\Services\NotificationService;
use App\Support\FieldLengthLimits;
use App\Support\ListQuery;
use App\Support\PermanentDeleter;
use App\Support\SafeBroadcast;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TaskController extends ApiController
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    public function index(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);
        $labelIds = $this->normalizeLabelIds($request->query('label_ids'));

        $query = $workspace->tasks()
            ->notArchived();

        if ($labelIds !== []) {
            $query->whereHas('labels', function ($q) use ($organization, $labelIds) {
                $q->where('task_labels.organization_id', $organization->id)
                    ->whereIn('task_labels.id', $labelIds);
            });
        }

        $query->with([
            'labels:id,name,color_index',
            'assignees:id,name,email,avatar_path',
            'checklists.items',
        ])
            ->orderBy('sort_order')
            ->orderBy('id');

        $columns = [
            'id',
            'list_id',
            'sort_order',
            'is_parent_task',
            'parent_task_id',
            'title',
            'description',
            'priority',
            'start_date',
            'due_date',
            'gantt_bar_color',
            'effort_hours',
            'progress_rate',
            'reporter_id',
            'created_at',
        ];

        if ($request->has('page') || $request->has('per_page')) {
            $result = ListQuery::paginate(
                $query,
                $request,
                fn (Task $task) => $this->taskListPayload($task),
                ['tasks.title'],
            );

            return response()->json($result);
        }

        $q = trim((string) $request->query('q', ''));
        if ($q !== '') {
            ListQuery::applySearch($query, $q, ['tasks.title']);
        }

        $tasks = $query->get($columns);

        return response()->json([
            'data' => $tasks->map(fn (Task $task) => $this->taskListPayload($task)),
        ]);
    }

    public function wbsIndex(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);

        $query = $workspace->tasks()
            ->notArchived()
            ->with([
                'labels:id,name,color_index',
                'assignees:id,name,email,avatar_path',
                'list:id,name,workspace_id',
                'checklists.items',
            ])
            ->orderBy('sort_order')
            ->orderBy('id');

        $q = trim((string) $request->query('q', ''));
        if ($q !== '') {
            ListQuery::applySearch($query, $q, ['tasks.title']);
        }

        $tasks = $query->get([
                'id',
                'list_id',
                'sort_order',
                'is_parent_task',
                'parent_task_id',
                'title',
                'description',
                'priority',
                'start_date',
                'due_date',
                'gantt_bar_color',
                'effort_hours',
                'progress_rate',
                'reporter_id',
                'created_at',
            ]);

        return response()->json([
            'data' => $tasks->map(fn (Task $task) => $this->taskWbsPayload($task)),
        ]);
    }

    public function wbsReorder(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanEditWorkspace($request->user(), $workspace);
        $this->assertWorkspaceNotArchived($workspace);

        $validated = $request->validate([
            'tasks' => ['required', 'array', 'min:1'],
            'tasks.*.id' => ['required', 'integer', 'distinct'],
            'tasks.*.sort_order' => ['required', 'integer', 'min:0'],
            'tasks.*.parent_task_id' => ['nullable', 'integer'],
        ]);

        /** @var array<int, array{id: int, sort_order: int, parent_task_id: int|null}> $items */
        $items = collect($validated['tasks'])
            ->map(fn (array $item) => [
                'id' => (int) $item['id'],
                'sort_order' => (int) $item['sort_order'],
                'parent_task_id' => array_key_exists('parent_task_id', $item) && $item['parent_task_id'] !== null
                    ? (int) $item['parent_task_id']
                    : null,
            ])
            ->values()
            ->all();

        $taskIds = array_column($items, 'id');
        $activeTaskIds = $workspace->tasks()
            ->notArchived()
            ->pluck('id')
            ->sort()
            ->values()
            ->all();

        $sortedIncoming = $taskIds;
        sort($sortedIncoming);

        if ($activeTaskIds !== $sortedIncoming) {
            return response()->json([
                'message' => 'tasks must include every active task in the workspace exactly once.',
            ], 422);
        }

        $parentIds = Task::query()
            ->where('workspace_id', $workspace->id)
            ->whereIn('id', $taskIds)
            ->where('is_parent_task', true)
            ->pluck('id')
            ->all();
        $parentIdSet = array_fill_keys($parentIds, true);

        $proposedParents = [];
        foreach ($items as $item) {
            $taskId = (int) $item['id'];
            $parentTaskId = $item['parent_task_id'];
            $proposedParents[$taskId] = $parentTaskId === null ? null : (int) $parentTaskId;

            if ($parentTaskId === null) {
                continue;
            }

            if (! isset($parentIdSet[$parentTaskId])) {
                return response()->json([
                    'message' => 'Invalid parent task for this workspace.',
                ], 422);
            }

            if ((int) $parentTaskId === $taskId) {
                return response()->json([
                    'message' => 'A task cannot be its own parent.',
                ], 422);
            }

            // 親タスク同士のネストは許可しない（1階層のみ）
            if (isset($parentIdSet[$taskId])) {
                return response()->json([
                    'message' => 'Parent tasks cannot have a parent.',
                ], 422);
            }
        }

        foreach ($proposedParents as $taskId => $parentTaskId) {
            if ($parentTaskId === null) {
                continue;
            }

            $seen = [$taskId => true];
            $cursor = $parentTaskId;
            while ($cursor !== null) {
                if (isset($seen[$cursor])) {
                    return response()->json([
                        'message' => 'Task hierarchy cycle is not allowed.',
                    ], 422);
                }
                $seen[$cursor] = true;
                $cursor = $proposedParents[$cursor] ?? null;
            }
        }

        DB::transaction(function () use ($items, $workspace) {
            foreach ($items as $item) {
                Task::query()
                    ->where('id', $item['id'])
                    ->where('workspace_id', $workspace->id)
                    ->update([
                        'sort_order' => $item['sort_order'],
                        'parent_task_id' => $item['parent_task_id'],
                    ]);
            }
            $workspace->recordActivity();
        });

        SafeBroadcast::toOthers(new WbsTasksReordered((int) $workspace->id, $items));

        return response()->json(['data' => ['ok' => true]]);
    }

    public function parentTasksIndex(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);

        $tasks = $workspace->tasks()
            ->notArchived()
            ->where('is_parent_task', true)
            ->orderBy('title')
            ->orderBy('id')
            ->get(['id', 'title']);

        return response()->json([
            'data' => $tasks->map(fn (Task $task) => [
                'id' => $task->id,
                'title' => $task->title,
            ]),
        ]);
    }

    public function archivedIndex(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);
        $labelIds = $this->normalizeLabelIds($request->query('label_ids'));

        $query = $workspace->tasks()
            ->archived()
            ->orderByDesc('archived_at');
        if ($labelIds !== []) {
            $query->whereHas('labels', function ($q) use ($organization, $labelIds) {
                $q->where('task_labels.organization_id', $organization->id)
                    ->whereIn('task_labels.id', $labelIds);
            });
        }

        $tasks = $query
            ->with([
                'labels:id,name,color_index',
                'assignees:id,name,email,avatar_path',
                'parentTask:id,title',
            ])
            ->get([
                'id',
                'list_id',
                'title',
                'priority',
                'start_date',
                'due_date',
                'gantt_bar_color',
                'effort_hours',
                'progress_rate',
                'reporter_id',
                'is_parent_task',
                'parent_task_id',
                'archived_at',
                'created_at',
            ]);

        return response()->json([
            'data' => $tasks->map(function (Task $task) {
                $payload = $this->taskListPayload($task);
                $payload['parent_task_title'] = $task->parentTask?->title;

                return $payload;
            }),
        ]);
    }

    public function store(StoreTaskRequest $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanEditWorkspace($request->user(), $workspace);
        $this->assertWorkspaceNotArchived($workspace);

        $validated = $request->validated();

        if ($invalidRange = $this->assertValidTaskDateRange($validated)) {
            return $invalidRange;
        }

        $title = trim($validated['title']);
        if ($title === '') {
            return response()->json(['message' => 'Title cannot be empty.'], 422);
        }

        $list = BoardList::query()->find($validated['list_id']);
        if ($list === null || (int) $list->workspace_id !== (int) $workspace->id) {
            return response()->json(['message' => 'Invalid list for this workspace.'], 422);
        }

        $user = $request->user();
        $assigneeIds = $this->resolveAssigneeIds($workspace, $validated);
        [$isParentTask, $parentTaskId] = $this->resolveParentTaskFields($workspace, $validated);

        $maxOrder = Task::query()
            ->where('workspace_id', $workspace->id)
            ->where('list_id', $validated['list_id'])
            ->notArchived()
            ->max('sort_order');
        $sortOrder = $maxOrder === null ? 0 : ((int) $maxOrder + 1);

        $labelIds = $this->validateTaskLabelIds(
            $organization,
            $validated['label_ids'] ?? [],
        );

        $newAssigneeIds = [];
        $task = DB::transaction(function () use (
            $organization,
            $workspace,
            $validated,
            $sortOrder,
            $isParentTask,
            $parentTaskId,
            $title,
            $assigneeIds,
            $user,
            $labelIds,
            &$newAssigneeIds,
        ) {
            $task = Task::query()->create([
                'organization_id' => $organization->id,
                'workspace_id' => $workspace->id,
                'list_id' => $validated['list_id'],
                'sort_order' => $sortOrder,
                'is_parent_task' => $isParentTask,
                'parent_task_id' => $parentTaskId,
                'title' => $title,
                'description' => $validated['description'] ?? null,
                'priority' => $validated['priority'] ?? TaskPriority::Medium->value,
                'start_date' => $validated['start_date'] ?? null,
                'due_date' => $validated['due_date'] ?? null,
                'gantt_bar_color' => $validated['gantt_bar_color'] ?? null,
                'reporter_id' => $user->id,
            ]);

            $this->applyEffortFields($task, $validated);
            $this->applyProgressRateFields($task, $validated);

            if ($assigneeIds !== []) {
                $newAssigneeIds = $this->syncAssigneesWithHistory($task, $assigneeIds);
            }

            if ($labelIds !== []) {
                $task->labels()->sync($labelIds);
            }

            $task->save();

            return $task;
        });

        $this->notifyNewAssignees($task, $newAssigneeIds);

        SafeBroadcast::toOthers(new TaskCreated($task->fresh()));

        return response()->json($this->taskPayload($task), 201);
    }

    public function show(Request $request, Organization $organization, Workspace $workspace, Task $task): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);

        if ((int) $task->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        return response()->json($this->taskPayload($task));
    }

    public function update(Request $request, Organization $organization, Workspace $workspace, Task $task): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanEditWorkspace($request->user(), $workspace);
        $this->assertWorkspaceNotArchived($workspace);

        if ((int) $task->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        if ($task->trashed()) {
            abort(403, 'Cannot update a deleted task.');
        }

        if ($task->archived_at !== null) {
            return response()->json(['message' => 'Cannot update an archived task. Restore it first.'], 422);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:'.FieldLengthLimits::TASK_TITLE],
            'description' => ['nullable', 'string', 'max:'.FieldLengthLimits::TASK_DESCRIPTION],
            'list_id' => ['sometimes', 'integer', 'exists:lists,id'],
            'priority' => ['sometimes', 'string', Rule::in(TaskPriority::values())],
            'start_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'gantt_bar_color' => ['nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'effort_hours' => ['nullable', 'numeric', 'min:0', 'max:99999.99'],
            'progress_rate' => ['nullable', 'integer', 'min:0', 'max:100'],
            'assignee_ids' => ['nullable', 'array'],
            'assignee_ids.*' => ['integer', 'distinct'],
            'label_ids' => ['nullable', 'array'],
            'label_ids.*' => ['integer', 'distinct'],
            'is_parent_task' => ['sometimes', 'boolean'],
            'parent_task_id' => ['sometimes', 'nullable', 'integer'],
            'checklists' => ['sometimes', 'array'],
            'checklists.*.id' => ['sometimes', 'integer', 'distinct'],
            'checklists.*.title' => ['required', 'string', 'max:'.FieldLengthLimits::CHECKLIST_TITLE],
            'checklists.*.items' => ['sometimes', 'array'],
            'checklists.*.items.*.id' => ['required', 'uuid'],
            'checklists.*.items.*.text' => ['required', 'string', 'max:'.FieldLengthLimits::CHECKLIST_ITEM_TEXT],
            'checklists.*.items.*.checked' => ['required', 'boolean'],
        ]);

        if ($invalidRange = $this->assertValidTaskDateRange($validated, $task)) {
            return $invalidRange;
        }

        if (array_key_exists('title', $validated)) {
            $title = trim($validated['title']);
            if ($title === '') {
                return response()->json(['message' => 'Title cannot be empty.'], 422);
            }
            $task->title = $title;
        }
        if (array_key_exists('description', $validated)) {
            $task->description = $validated['description'];
        }

        if (array_key_exists('list_id', $validated)) {
            $list = BoardList::query()->find($validated['list_id']);
            if ($list === null || (int) $list->workspace_id !== (int) $workspace->id) {
                return response()->json(['message' => 'Invalid list for this workspace.'], 422);
            }
            // 並び順はドラッグ操作でのみ変更する。リスト変更では sort_order を維持する。
            $task->list_id = $list->id;
        }

        if (array_key_exists('priority', $validated)) {
            $task->priority = $validated['priority'];
        }
        if (array_key_exists('start_date', $validated)) {
            $task->start_date = $validated['start_date'];
        }
        if (array_key_exists('due_date', $validated)) {
            $task->due_date = $validated['due_date'];
        }
        if (array_key_exists('gantt_bar_color', $validated)) {
            $task->gantt_bar_color = $validated['gantt_bar_color'];
        }
        $this->applyEffortFields($task, $validated);
        $this->applyProgressRateFields($task, $validated);

        $assigneeIdsToSync = null;
        if (array_key_exists('assignee_ids', $validated)) {
            $assigneeIdsToSync = $this->resolveAssigneeIds($workspace, $validated);
        }

        $detachFormerChildren = false;
        if (array_key_exists('is_parent_task', $validated) || array_key_exists('parent_task_id', $validated)) {
            $wasParent = (bool) $task->is_parent_task;
            [$isParentTask, $parentTaskId] = $this->resolveParentTaskFields($workspace, $validated, $task);
            $task->is_parent_task = $isParentTask;
            $task->parent_task_id = $parentTaskId;
            $detachFormerChildren = $wasParent && ! $isParentTask;
        }

        $labelIds = array_key_exists('label_ids', $validated)
            ? $this->validateTaskLabelIds($organization, $validated['label_ids'] ?? [])
            : null;

        $newAssigneeIds = [];
        DB::transaction(function () use (
            $task,
            $assigneeIdsToSync,
            $labelIds,
            $validated,
            $detachFormerChildren,
            &$newAssigneeIds,
        ) {
            $task->save();

            if ($detachFormerChildren) {
                Task::query()
                    ->where('parent_task_id', $task->id)
                    ->update(['parent_task_id' => null]);
            }

            if ($assigneeIdsToSync !== null) {
                $newAssigneeIds = $this->syncAssigneesWithHistory($task, $assigneeIdsToSync);
            }

            if ($labelIds !== null) {
                $beforeLabelIds = $task->labels()->pluck('task_labels.id')->sort()->values()->all();
                $task->labels()->sync($labelIds);
                $afterLabelIds = $labelIds;
                sort($afterLabelIds);
                if ($beforeLabelIds !== $afterLabelIds) {
                    $task->touch();
                }
            }

            if (array_key_exists('checklists', $validated)) {
                $this->syncTaskChecklists($task, $validated['checklists']);
            }
        });

        $this->notifyNewAssignees($task, $newAssigneeIds);

        $fresh = $task->fresh();
        SafeBroadcast::toOthers(new TaskUpdated($fresh));

        return response()->json($this->taskPayload($fresh));
    }

    public function archive(Request $request, Organization $organization, Workspace $workspace, Task $task): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanManageArchive($request);
        $this->assertWorkspaceNotArchived($workspace);

        if ((int) $task->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        if ($task->trashed()) {
            abort(403, 'Cannot archive a deleted task.');
        }

        if ($task->archived_at !== null) {
            return response()->json(['message' => 'Task is already archived.'], 422);
        }

        $fresh = DB::transaction(function () use ($task) {
            // 子はボード上に残す。親子リンクを切らないと WBS 並び替えが壊れ、
            // 完全削除時にアクティブな子まで巻き込まれる温床になる。
            Task::query()
                ->where('parent_task_id', $task->id)
                ->update(['parent_task_id' => null]);

            $task->archived_at = now();
            $task->save();

            return $task->fresh();
        });

        $fresh->loadMissing([
            'labels:id,name,color_index',
            'assignees:id,name,email,avatar_path',
            'parentTask:id,title',
        ]);
        $archivedPayload = $this->taskListPayload($fresh);
        $archivedPayload['parent_task_title'] = $fresh->parentTask?->title;
        SafeBroadcast::toOthers(TaskArchived::fromSnapshot(
            (int) $fresh->workspace_id,
            (int) $fresh->id,
            $archivedPayload,
        ));

        return response()->json($this->taskPayload($fresh));
    }

    public function unarchive(Request $request, Organization $organization, Workspace $workspace, Task $task): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanManageArchive($request);
        $this->assertWorkspaceNotArchived($workspace);

        if ((int) $task->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        if ($task->trashed()) {
            abort(403, 'Cannot restore a deleted task.');
        }

        if ($task->archived_at === null) {
            return response()->json(['message' => 'Task is not archived.'], 422);
        }

        $task->archived_at = null;
        $task->save();

        $fresh = $task->fresh();
        SafeBroadcast::toOthers(new TaskRestored($fresh));

        return response()->json($this->taskPayload($fresh));
    }

    public function destroy(Request $request, Organization $organization, Workspace $workspace, Task $task): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanManageArchive($request);
        $this->assertWorkspaceNotArchived($workspace);

        if ((int) $task->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        if ($task->archived_at === null) {
            return response()->json(['message' => 'Archive the task before deleting it permanently.'], 422);
        }

        $taskId = (int) $task->id;
        $workspaceId = (int) $task->workspace_id;
        PermanentDeleter::deleteTask($task);

        SafeBroadcast::toOthers(new TaskDeleted($workspaceId, $taskId));

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function taskPayload(Task $task): array
    {
        $task->loadMissing([
            'labels:id,name,color_index',
            'assignees:id,name,email,avatar_path',
            'checklists.items',
            'parentTask:id,title,workspace_id',
        ]);

        [$parentTask, $childTasks] = $this->formatTaskHierarchy($task);

        return [
            'id' => $task->id,
            'list_id' => $task->list_id,
            'sort_order' => $task->sort_order,
            'is_parent_task' => (bool) $task->is_parent_task,
            'parent_task_id' => $task->parent_task_id,
            'parent_task' => $parentTask,
            'child_tasks' => $childTasks,
            'title' => $task->title,
            'description' => $task->description,
            'priority' => $task->priority,
            'start_date' => $task->start_date,
            'due_date' => $task->due_date,
            'gantt_bar_color' => $task->gantt_bar_color,
            'effort_hours' => $task->effort_hours,
            'progress_rate' => $task->progress_rate,
            'assignees' => $this->formatAssignees($task->assignees),
            'reporter_id' => $task->reporter_id,
            'archived_at' => $task->archived_at,
            'labels' => $task->labels,
            'checklists' => $this->formatChecklists($task->checklists),
            'created_at' => $task->created_at,
            'updated_at' => $task->updated_at,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function taskListPayload(Task $task): array
    {
        return [
            'id' => $task->id,
            'list_id' => $task->list_id,
            'sort_order' => $task->sort_order,
            'is_parent_task' => (bool) $task->is_parent_task,
            'parent_task_id' => $task->parent_task_id,
            'title' => $task->title,
            'description' => $task->description,
            'priority' => $task->priority,
            'start_date' => $task->start_date,
            'due_date' => $task->due_date,
            'gantt_bar_color' => $task->gantt_bar_color,
            'effort_hours' => $task->effort_hours,
            'progress_rate' => $task->progress_rate,
            'assignees' => $this->formatAssignees($task->assignees),
            'reporter_id' => $task->reporter_id,
            'archived_at' => $task->archived_at,
            'created_at' => $task->created_at,
            'labels' => $task->labels,
            'checklists' => $this->formatChecklists($task->checklists),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function taskWbsPayload(Task $task): array
    {
        $payload = $this->taskListPayload($task);
        $payload['description'] = $task->description;
        $payload['list_name'] = $task->relationLoaded('list') && $task->list !== null
            ? $task->list->name
            : null;

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array{0: bool, 1: int|null}
     */
    private function resolveParentTaskFields(Workspace $workspace, array $validated, ?Task $task = null): array
    {
        $isParent = (bool) ($validated['is_parent_task'] ?? false);
        $parentId = null;
        if (array_key_exists('parent_task_id', $validated) && $validated['parent_task_id'] !== null) {
            $parentId = (int) $validated['parent_task_id'];
        }

        if ($isParent) {
            if ($parentId !== null) {
                abort(422, 'Parent tasks cannot have a parent task.');
            }

            return [true, null];
        }

        if ($parentId === null) {
            return [false, null];
        }

        if ($task !== null && $parentId === (int) $task->id) {
            abort(422, 'A task cannot be its own parent.');
        }

        $parent = Task::query()
            ->where('workspace_id', $workspace->id)
            ->where('id', $parentId)
            ->notArchived()
            ->first();

        if ($parent === null || ! $parent->is_parent_task) {
            abort(422, 'Invalid parent task for this workspace.');
        }

        if ($task !== null && (int) $parent->parent_task_id === (int) $task->id) {
            abort(422, 'Invalid parent task relationship.');
        }

        return [false, $parentId];
    }

    /**
     * @param  Collection<int, User>  $assignees
     * @return array<int, array<string, mixed>>
     */
    private function formatAssignees(Collection $assignees): array
    {
        return $assignees
            ->sortBy([
                fn (User $user) => mb_strtolower((string) ($user->name ?: $user->email ?: '')),
                fn (User $user) => $user->id,
            ])
            ->values()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar_url' => $this->avatarUrl($user->avatar_path),
            ])
            ->all();
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<int, int>
     */
    private function resolveAssigneeIds(Workspace $workspace, array $validated): array
    {
        if (array_key_exists('assignee_ids', $validated)) {
            return $this->validateAssigneeIds($workspace, $validated['assignee_ids'] ?? []);
        }

        return [];
    }

    /**
     * @param  array<int, mixed>  $assigneeIds
     * @return array<int, int>
     */
    private function validateAssigneeIds(Workspace $workspace, array $assigneeIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $assigneeIds)));
        if ($ids === []) {
            return [];
        }

        $validCount = $workspace->assignees()
            ->whereIn('users.id', $ids)
            ->count();
        if ($validCount !== count($ids)) {
            abort(422, 'Assignees must be members of this workspace.');
        }

        return $ids;
    }

    /**
     * @param  array<int, int>  $assigneeIds
     * @return array<int, int> Newly added assignee user IDs
     */
    private function syncAssigneesWithHistory(Task $task, array $assigneeIds): array
    {
        $before = $task->assignees()->pluck('users.id')->sort()->values()->all();
        $task->assignees()->sync($assigneeIds);
        $after = $assigneeIds;
        sort($after);

        if ($before === $after) {
            return [];
        }

        $task->touch();

        TaskHistory::query()->create([
            'task_id' => $task->id,
            'organization_id' => $task->organization_id,
            'workspace_id' => $task->workspace_id,
            'actor_id' => auth()->id(),
            'event_type' => TaskHistoryEventType::AssigneeChanged->value,
            'field_name' => 'assignee_ids',
            'before_value' => $before === [] ? null : json_encode($before),
            'after_value' => $after === [] ? null : json_encode($after),
            'created_at' => now(),
        ]);

        return array_values(array_diff($after, $before));
    }

    /**
     * @param  array<int, int>  $newAssigneeIds
     */
    private function notifyNewAssignees(Task $task, array $newAssigneeIds): void
    {
        if ($newAssigneeIds === []) {
            return;
        }

        $task->loadMissing('organization:id,slug');
        $this->notifications->notifyMany(
            $newAssigneeIds,
            'task.assigned',
            [
                'task_id' => $task->id,
                'workspace_id' => $task->workspace_id,
                'organization_slug' => $task->organization?->slug,
                'title' => $task->title,
            ],
            (int) auth()->id(),
        );
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
    private function validateTaskLabelIds(Organization $organization, array $labelIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $labelIds)));
        if ($ids === []) {
            return [];
        }

        $count = TaskLabel::query()
            ->where('organization_id', $organization->id)
            ->whereIn('id', $ids)
            ->count();
        if ($count !== count($ids)) {
            abort(422, 'One or more labels are invalid for this organization.');
        }

        return $ids;
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function applyEffortFields(Task $task, array $validated): void
    {
        if (! array_key_exists('effort_hours', $validated)) {
            return;
        }

        if ($validated['effort_hours'] === null) {
            $task->effort_hours = null;

            return;
        }

        $task->effort_hours = round((float) $validated['effort_hours'], 6);
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function applyProgressRateFields(Task $task, array $validated): void
    {
        if (! array_key_exists('progress_rate', $validated)) {
            return;
        }

        if ($validated['progress_rate'] === null) {
            $task->progress_rate = null;

            return;
        }

        $task->progress_rate = (int) $validated['progress_rate'];
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function assertValidTaskDateRange(array $validated, ?Task $existing = null): ?JsonResponse
    {
        $start = array_key_exists('start_date', $validated)
            ? $this->normalizeDateOnly($validated['start_date'])
            : $this->normalizeDateOnly($existing?->start_date);
        $due = array_key_exists('due_date', $validated)
            ? $this->normalizeDateOnly($validated['due_date'])
            : $this->normalizeDateOnly($existing?->due_date);

        if ($start === null || $due === null) {
            return null;
        }

        if ($start > $due) {
            return response()->json([
                'message' => 'End date must be on or after start date.',
            ], 422);
        }

        return null;
    }

    private function normalizeDateOnly(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        $trimmed = trim((string) $value);
        if ($trimmed === '') {
            return null;
        }

        try {
            return \Carbon\Carbon::parse($trimmed)->format('Y-m-d');
        } catch (\Throwable) {
            return substr($trimmed, 0, 10) ?: null;
        }
    }

    /**
     * @return array{0: array{id: int, title: string}|null, 1: list<array{id: int, title: string, due_date: mixed, list_name: string|null}>}
     */
    private function formatTaskHierarchy(Task $task): array
    {
        if ($task->is_parent_task) {
            return [
                [
                    'id' => $task->id,
                    'title' => $task->title,
                ],
                $this->fetchChildTaskSummaries($task->workspace_id, $task->id),
            ];
        }

        if ($task->parent_task_id === null) {
            return [null, []];
        }

        $task->loadMissing('parentTask:id,title,workspace_id');
        if ($task->parentTask === null) {
            return [null, []];
        }

        return [
            [
                'id' => $task->parentTask->id,
                'title' => $task->parentTask->title,
            ],
            $this->fetchChildTaskSummaries($task->workspace_id, $task->parentTask->id),
        ];
    }

    /**
     * @return list<array{id: int, title: string, due_date: mixed, list_name: string|null}>
     */
    private function fetchChildTaskSummaries(int $workspaceId, int $parentTaskId): array
    {
        return Task::query()
            ->where('workspace_id', $workspaceId)
            ->where('parent_task_id', $parentTaskId)
            ->notArchived()
            ->with('list:id,name')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['id', 'title', 'due_date', 'list_id'])
            ->map(fn (Task $child) => [
                'id' => $child->id,
                'title' => $child->title,
                'due_date' => $child->due_date,
                'list_name' => $child->list?->name,
            ])
            ->values()
            ->all();
    }

    /**
     * @param  \Illuminate\Support\Collection<int, TaskChecklist>|iterable<int, TaskChecklist>|null  $checklists
     * @return list<array{id: int, title: string, items: list<array{id: string, text: string, checked: bool}>}>
     */
    private function formatChecklists(mixed $checklists): array
    {
        if ($checklists === null) {
            return [];
        }

        return collect($checklists)->map(fn (TaskChecklist $checklist) => [
            'id' => (int) $checklist->id,
            'title' => $checklist->title,
            'items' => $checklist->items->map(fn (TaskChecklistItem $item) => [
                'id' => $item->id,
                'text' => $item->text,
                'checked' => (bool) $item->checked,
            ])->values()->all(),
        ])->values()->all();
    }

    /**
     * @param  list<array<string, mixed>>  $checklistsData
     */
    private function syncTaskChecklists(Task $task, array $checklistsData): void
    {
        DB::transaction(function () use ($task, $checklistsData) {
            $keptIds = [];

            foreach ($checklistsData as $index => $checklistData) {
                $title = trim((string) ($checklistData['title'] ?? ''));
                if ($title === '') {
                    $title = 'チェックリスト';
                }

                $checklist = null;
                $incomingId = $checklistData['id'] ?? null;
                if (is_numeric($incomingId) && (int) $incomingId > 0) {
                    $checklist = TaskChecklist::query()
                        ->where('task_id', $task->id)
                        ->where('id', (int) $incomingId)
                        ->first();
                }

                if ($checklist === null) {
                    $checklist = new TaskChecklist([
                        'task_id' => $task->id,
                        'organization_id' => $task->organization_id,
                        'workspace_id' => $task->workspace_id,
                    ]);
                }

                $checklist->organization_id = $task->organization_id;
                $checklist->workspace_id = $task->workspace_id;
                $checklist->title = $title;
                $checklist->sort_order = $index;
                $checklist->save();
                $keptIds[] = $checklist->id;

                $items = $checklistData['items'] ?? [];
                $incomingIds = collect($items)->pluck('id')->filter()->values()->all();

                $checklist->items()->whereNotIn('id', $incomingIds)->delete();

                foreach ($items as $itemIndex => $item) {
                    $text = trim((string) ($item['text'] ?? ''));
                    if ($text === '') {
                        continue;
                    }

                    TaskChecklistItem::query()->updateOrCreate(
                        [
                            'id' => $item['id'],
                            'task_checklist_id' => $checklist->id,
                        ],
                        [
                            'text' => $text,
                            'checked' => (bool) ($item['checked'] ?? false),
                            'sort_order' => $itemIndex,
                        ]
                    );
                }
            }

            $query = TaskChecklist::query()->where('task_id', $task->id);
            if ($keptIds !== []) {
                $query->whereNotIn('id', $keptIds);
            }
            $query->delete();
        });
    }
}
