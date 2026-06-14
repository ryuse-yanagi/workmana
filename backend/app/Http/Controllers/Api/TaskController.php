<?php

namespace App\Http\Controllers\Api;

use App\Enums\TaskEffortUnit;
use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use App\Events\TaskArchived;
use App\Events\TaskCreated;
use App\Events\TaskDeleted;
use App\Events\TaskRestored;
use App\Events\TaskUpdated;
use App\Models\BoardList;
use App\Models\Organization;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskHistory;
use App\Models\TaskLabel;
use App\Models\User;
use App\Enums\TaskHistoryEventType;
use App\Support\SafeBroadcast;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

class TaskController extends ApiController
{
    public function index(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $labelIds = $this->normalizeLabelIds($request->query('label_ids'));

        $query = $project->tasks()
            ->notArchived();

        if ($labelIds !== []) {
            $query->whereHas('labels', function ($q) use ($organization, $labelIds) {
                $q->where('task_labels.organization_id', $organization->id)
                    ->whereIn('task_labels.id', $labelIds);
            });
        }

        $tasks = $query
            ->with([
                'labels:id,name,color',
                'assignees:id,name,email,avatar_path',
            ])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get([
                'id',
                'list_id',
                'sort_order',
                'is_parent_task',
                'parent_task_id',
                'title',
                'status',
                'priority',
                'start_date',
                'due_date',
                'effort_hours',
                'effort_value',
                'effort_unit',
                'assignee_id',
                'reporter_id',
                'created_at',
            ]);

        return response()->json([
            'data' => $tasks->map(fn (Task $task) => $this->taskListPayload($task)),
        ]);
    }

    public function wbsIndex(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);

        $tasks = $project->tasks()
            ->notArchived()
            ->with([
                'labels:id,name,color',
                'assignees:id,name,email,avatar_path',
                'list:id,name,project_id',
            ])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get([
                'id',
                'list_id',
                'sort_order',
                'is_parent_task',
                'parent_task_id',
                'title',
                'description',
                'status',
                'priority',
                'start_date',
                'due_date',
                'effort_hours',
                'effort_value',
                'effort_unit',
                'assignee_id',
                'reporter_id',
                'created_at',
            ]);

        return response()->json([
            'data' => $tasks->map(fn (Task $task) => $this->taskWbsPayload($task)),
        ]);
    }

    public function parentTasksIndex(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);

        $tasks = $project->tasks()
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

    public function archivedIndex(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $labelIds = $this->normalizeLabelIds($request->query('label_ids'));

        $query = $project->tasks()
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
                'labels:id,name,color',
                'assignees:id,name,email,avatar_path',
            ])
            ->get([
                'id',
                'list_id',
                'title',
                'status',
                'priority',
                'start_date',
                'due_date',
                'effort_hours',
                'effort_value',
                'effort_unit',
                'assignee_id',
                'reporter_id',
                'archived_at',
                'created_at',
            ]);

        return response()->json([
            'data' => $tasks->map(fn (Task $task) => $this->taskListPayload($task)),
        ]);
    }

    public function store(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'list_id' => ['nullable', 'integer', 'exists:lists,id'],
            'status' => ['nullable', 'string', Rule::in(TaskStatus::values())],
            'priority' => ['nullable', 'string', Rule::in(TaskPriority::values())],
            'start_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'effort_hours' => ['nullable', 'numeric', 'min:0', 'max:99999.99'],
            'effort_value' => ['nullable', 'numeric', 'min:0', 'max:9999999.9999'],
            'effort_unit' => ['nullable', 'string', Rule::in(TaskEffortUnit::values())],
            'assignee_id' => ['nullable', 'integer', 'exists:users,id'],
            'assignee_ids' => ['nullable', 'array'],
            'assignee_ids.*' => ['integer', 'distinct'],
            'label_ids' => ['nullable', 'array'],
            'label_ids.*' => ['integer', 'distinct'],
            'is_parent_task' => ['sometimes', 'boolean'],
            'parent_task_id' => ['sometimes', 'nullable', 'integer'],
        ]);

        $title = trim($validated['title']);
        if ($title === '') {
            return response()->json(['message' => 'Title cannot be empty.'], 422);
        }

        if (! empty($validated['list_id'])) {
            $list = BoardList::query()->find($validated['list_id']);
            if ($list === null || (int) $list->project_id !== (int) $project->id) {
                return response()->json(['message' => 'Invalid list for this project.'], 422);
            }
        }

        $user = $request->user();
        $assigneeIds = $this->resolveAssigneeIds($project, $validated);
        [$isParentTask, $parentTaskId] = $this->resolveParentTaskFields($project, $validated);

        $sortOrder = 0;
        if (! empty($validated['list_id'])) {
            $maxOrder = Task::query()
                ->where('project_id', $project->id)
                ->where('list_id', $validated['list_id'])
                ->notArchived()
                ->max('sort_order');
            $sortOrder = $maxOrder === null ? 0 : ((int) $maxOrder + 1);
        }

        $task = Task::query()->create([
            'organization_id' => $organization->id,
            'project_id' => $project->id,
            'list_id' => $validated['list_id'] ?? null,
            'sort_order' => $sortOrder,
            'is_parent_task' => $isParentTask,
            'parent_task_id' => $parentTaskId,
            'title' => $title,
            'description' => $validated['description'] ?? null,
            'status' => $validated['status'] ?? TaskStatus::Todo->value,
            'priority' => $validated['priority'] ?? TaskPriority::Medium->value,
            'start_date' => $validated['start_date'] ?? null,
            'due_date' => $validated['due_date'] ?? null,
            'assignee_id' => $assigneeIds[0] ?? null,
            'reporter_id' => $user->id,
        ]);

        $this->applyEffortFields($task, $validated);

        if ($assigneeIds !== []) {
            $task->assignees()->sync($assigneeIds);
        }

        $labelIds = $this->validateTaskLabelIds(
            $organization,
            $validated['label_ids'] ?? [],
        );
        if ($labelIds !== []) {
            $task->labels()->sync($labelIds);
        }

        $task->save();

        SafeBroadcast::toOthers(new TaskCreated($task->fresh()));

        return response()->json($this->taskPayload($task), 201);
    }

    public function show(Request $request, Organization $organization, Project $project, Task $task): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);

        if ((int) $task->project_id !== (int) $project->id) {
            abort(404);
        }

        return response()->json($this->taskPayload($task));
    }

    public function update(Request $request, Organization $organization, Project $project, Task $task): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        if ((int) $task->project_id !== (int) $project->id) {
            abort(404);
        }

        if ($task->trashed()) {
            abort(403, 'Cannot update a deleted task.');
        }

        if ($task->archived_at !== null) {
            return response()->json(['message' => 'Cannot update an archived task. Restore it first.'], 422);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'list_id' => ['nullable', 'integer', 'exists:lists,id'],
            'status' => ['sometimes', 'string', Rule::in(TaskStatus::values())],
            'priority' => ['sometimes', 'string', Rule::in(TaskPriority::values())],
            'start_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'effort_hours' => ['nullable', 'numeric', 'min:0', 'max:99999.99'],
            'effort_value' => ['nullable', 'numeric', 'min:0', 'max:9999999.9999'],
            'effort_unit' => ['nullable', 'string', Rule::in(TaskEffortUnit::values())],
            'assignee_id' => ['nullable', 'integer', 'exists:users,id'],
            'assignee_ids' => ['nullable', 'array'],
            'assignee_ids.*' => ['integer', 'distinct'],
            'label_ids' => ['nullable', 'array'],
            'label_ids.*' => ['integer', 'distinct'],
            'is_parent_task' => ['sometimes', 'boolean'],
            'parent_task_id' => ['sometimes', 'nullable', 'integer'],
        ]);

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
            if ($validated['list_id'] === null) {
                $task->list_id = null;
                $task->sort_order = 0;
            } else {
                $list = BoardList::query()->find($validated['list_id']);
                if ($list === null || (int) $list->project_id !== (int) $project->id) {
                    return response()->json(['message' => 'Invalid list for this project.'], 422);
                }
                if ((int) $task->list_id !== (int) $list->id) {
                    $maxOrder = Task::query()
                        ->where('project_id', $project->id)
                        ->where('list_id', $list->id)
                        ->notArchived()
                        ->max('sort_order');
                    $task->sort_order = $maxOrder === null ? 0 : ((int) $maxOrder + 1);
                }
                $task->list_id = $list->id;
            }
        }
        if (array_key_exists('status', $validated)) {
            $task->status = $validated['status'];
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
        $this->applyEffortFields($task, $validated);

        $assigneeIdsToSync = null;
        if (array_key_exists('assignee_ids', $validated) || array_key_exists('assignee_id', $validated)) {
            $assigneeIdsToSync = $this->resolveAssigneeIds($project, $validated);
            $task->assignee_id = $assigneeIdsToSync[0] ?? null;
        }

        if (array_key_exists('is_parent_task', $validated) || array_key_exists('parent_task_id', $validated)) {
            [$isParentTask, $parentTaskId] = $this->resolveParentTaskFields($project, $validated, $task);
            $task->is_parent_task = $isParentTask;
            $task->parent_task_id = $parentTaskId;
        }

        $task->save();

        if ($assigneeIdsToSync !== null) {
            $this->syncAssigneesWithHistory($task, $assigneeIdsToSync);
        }

        if (array_key_exists('label_ids', $validated)) {
            $labelIds = $this->validateTaskLabelIds($organization, $validated['label_ids'] ?? []);
            $task->labels()->sync($labelIds);
        }

        $fresh = $task->fresh();
        SafeBroadcast::toOthers(new TaskUpdated($fresh));

        return response()->json($this->taskPayload($fresh));
    }

    public function archive(Request $request, Organization $organization, Project $project, Task $task): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        if ((int) $task->project_id !== (int) $project->id) {
            abort(404);
        }

        if ($task->trashed()) {
            abort(403, 'Cannot archive a deleted task.');
        }

        if ($task->archived_at !== null) {
            return response()->json(['message' => 'Task is already archived.'], 422);
        }

        $task->archived_at = now();
        $task->save();

        $fresh = $task->fresh();
        $fresh->loadMissing([
            'labels:id,name,color',
            'assignees:id,name,email,avatar_path',
        ]);
        SafeBroadcast::toOthers(TaskArchived::fromSnapshot(
            (int) $fresh->project_id,
            (int) $fresh->id,
            $this->taskListPayload($fresh),
        ));

        return response()->json($this->taskPayload($fresh));
    }

    public function unarchive(Request $request, Organization $organization, Project $project, Task $task): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        if ((int) $task->project_id !== (int) $project->id) {
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

    public function destroy(Request $request, Organization $organization, Project $project, Task $task): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        if ((int) $task->project_id !== (int) $project->id) {
            abort(404);
        }

        if ($task->archived_at === null) {
            return response()->json(['message' => 'Archive the task before deleting it permanently.'], 422);
        }

        $taskId = (int) $task->id;
        $projectId = (int) $task->project_id;
        $task->forceDelete();

        SafeBroadcast::toOthers(new TaskDeleted($projectId, $taskId));

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function taskPayload(Task $task): array
    {
        $task->loadMissing([
            'labels:id,name,color',
            'assignees:id,name,email,avatar_path',
        ]);

        return [
            'id' => $task->id,
            'list_id' => $task->list_id,
            'sort_order' => $task->sort_order,
            'is_parent_task' => (bool) $task->is_parent_task,
            'parent_task_id' => $task->parent_task_id,
            'title' => $task->title,
            'description' => $task->description,
            'status' => $task->status,
            'priority' => $task->priority,
            'start_date' => $task->start_date,
            'due_date' => $task->due_date,
            'effort_hours' => $task->effort_hours,
            'effort_value' => $task->effort_value,
            'effort_unit' => $task->effort_unit,
            'assignee_id' => $task->assignee_id,
            'assignees' => $this->formatAssignees($task->assignees),
            'reporter_id' => $task->reporter_id,
            'archived_at' => $task->archived_at,
            'labels' => $task->labels,
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
            'status' => $task->status,
            'priority' => $task->priority,
            'start_date' => $task->start_date,
            'due_date' => $task->due_date,
            'effort_hours' => $task->effort_hours,
            'effort_value' => $task->effort_value,
            'effort_unit' => $task->effort_unit,
            'assignee_id' => $task->assignee_id,
            'assignees' => $this->formatAssignees($task->assignees),
            'reporter_id' => $task->reporter_id,
            'archived_at' => $task->archived_at,
            'created_at' => $task->created_at,
            'labels' => $task->labels,
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
     * @param array<string, mixed> $validated
     * @return array{0: bool, 1: int|null}
     */
    private function resolveParentTaskFields(Project $project, array $validated, ?Task $task = null): array
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
            ->where('project_id', $project->id)
            ->where('id', $parentId)
            ->notArchived()
            ->first();

        if ($parent === null || ! $parent->is_parent_task) {
            abort(422, 'Invalid parent task for this project.');
        }

        if ($task !== null && (int) $parent->parent_task_id === (int) $task->id) {
            abort(422, 'Invalid parent task relationship.');
        }

        return [false, $parentId];
    }

    /**
     * @param Collection<int, User> $assignees
     * @return array<int, array<string, mixed>>
     */
    private function formatAssignees(Collection $assignees): array
    {
        return $assignees->map(fn (User $user) => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'avatar_url' => $this->avatarUrl($user->avatar_path),
        ])->values()->all();
    }

    /**
     * @param array<string, mixed> $validated
     * @return array<int, int>
     */
    private function resolveAssigneeIds(Project $project, array $validated): array
    {
        if (array_key_exists('assignee_ids', $validated)) {
            return $this->validateAssigneeIds($project, $validated['assignee_ids'] ?? []);
        }

        if (array_key_exists('assignee_id', $validated) && $validated['assignee_id'] !== null) {
            return $this->validateAssigneeIds($project, [(int) $validated['assignee_id']]);
        }

        if (array_key_exists('assignee_id', $validated) && $validated['assignee_id'] === null) {
            return [];
        }

        return [];
    }

    /**
     * @param array<int, mixed> $assigneeIds
     * @return array<int, int>
     */
    private function validateAssigneeIds(Project $project, array $assigneeIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $assigneeIds)));
        if ($ids === []) {
            return [];
        }

        foreach ($ids as $id) {
            $assignee = User::query()->find($id);
            if ($assignee === null || ! $assignee->isMemberOfProject($project)) {
                abort(422, 'Assignees must be project members.');
            }
        }

        return $ids;
    }

    /**
     * @param array<int, int> $assigneeIds
     */
    private function syncAssigneesWithHistory(Task $task, array $assigneeIds): void
    {
        $before = $task->assignees()->pluck('users.id')->sort()->values()->all();
        $task->assignees()->sync($assigneeIds);
        $after = $assigneeIds;
        sort($after);

        if ($before === $after) {
            return;
        }

        TaskHistory::query()->create([
            'task_id' => $task->id,
            'organization_id' => $task->organization_id,
            'project_id' => $task->project_id,
            'actor_id' => auth()->id(),
            'event_type' => TaskHistoryEventType::AssigneeChanged->value,
            'field_name' => 'assignee_ids',
            'before_value' => $before === [] ? null : json_encode($before),
            'after_value' => $after === [] ? null : json_encode($after),
            'created_at' => now(),
        ]);
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
     * @param array<string, mixed> $validated
     */
    private function applyEffortFields(Task $task, array $validated): void
    {
        if (array_key_exists('effort_value', $validated) || array_key_exists('effort_unit', $validated)) {
            if (($validated['effort_value'] ?? null) === null) {
                $task->effort_value = null;
                $task->effort_unit = null;
                $task->effort_hours = null;

                return;
            }

            $value = round((float) $validated['effort_value'], 4);
            $unit = $this->resolveEffortUnit($value, $validated['effort_unit'] ?? $task->effort_unit);
            $task->effort_value = $value;
            $task->effort_unit = $unit;
            $task->effort_hours = $this->effortValueToHours($value, $unit);

            return;
        }

        if (! array_key_exists('effort_hours', $validated)) {
            return;
        }

        if ($validated['effort_hours'] === null) {
            $task->effort_hours = null;
            $task->effort_value = null;
            $task->effort_unit = null;

            return;
        }

        $hours = round((float) $validated['effort_hours'], 6);
        $unit = $this->resolveEffortUnit($hours, $validated['effort_unit'] ?? $task->effort_unit);
        $task->effort_hours = $hours;
        $task->effort_unit = $unit;
        $task->effort_value = $this->effortHoursToValue($hours, $unit);
    }

    private function effortValueToHours(float $value, string $unit): float
    {
        return match ($unit) {
            TaskEffortUnit::Minute->value => round($value / 60, 6),
            TaskEffortUnit::Day->value => round($value * 24, 6),
            default => round($value, 6),
        };
    }

    private function effortHoursToValue(float $hours, string $unit): float
    {
        return match ($unit) {
            TaskEffortUnit::Minute->value => round($hours * 60, 4),
            TaskEffortUnit::Day->value => round($hours / 24, 4),
            default => round($hours, 4),
        };
    }

    private function resolveEffortUnit(mixed $effortAmount, mixed $effortUnit): ?string
    {
        if ($effortAmount === null || $effortAmount === '') {
            return null;
        }

        $unit = is_string($effortUnit) ? $effortUnit : null;
        if ($unit !== null && in_array($unit, TaskEffortUnit::values(), true)) {
            return $unit;
        }

        return TaskEffortUnit::Hour->value;
    }
}
