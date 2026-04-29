<?php

namespace App\Http\Controllers\Api;

use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use App\Models\BoardList;
use App\Models\Organization;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TaskController extends ApiController
{
    public function index(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);

        $tasks = $project->tasks()
            ->orderByDesc('created_at')
            ->get([
                'id',
                'list_id',
                'title',
                'status',
                'priority',
                'due_date',
                'assignee_id',
                'reporter_id',
                'created_at',
            ]);

        return response()->json(['data' => $tasks]);
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
            'due_date' => ['nullable', 'date'],
            'assignee_id' => ['nullable', 'integer', 'exists:users,id'],
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
        if (! empty($validated['assignee_id'])) {
            $assignee = User::query()->find($validated['assignee_id']);
            if ($assignee === null || ! $assignee->isMemberOfProject($project)) {
                return response()->json(['message' => 'Assignee must be a project member.'], 422);
            }
        }

        $task = Task::query()->create([
            'organization_id' => $organization->id,
            'project_id' => $project->id,
            'list_id' => $validated['list_id'] ?? null,
            'title' => $title,
            'description' => $validated['description'] ?? null,
            'status' => $validated['status'] ?? TaskStatus::Todo->value,
            'priority' => $validated['priority'] ?? TaskPriority::Medium->value,
            'due_date' => $validated['due_date'] ?? null,
            'assignee_id' => $validated['assignee_id'] ?? null,
            'reporter_id' => $user->id,
        ]);

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

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'list_id' => ['nullable', 'integer', 'exists:lists,id'],
            'status' => ['sometimes', 'string', Rule::in(TaskStatus::values())],
            'priority' => ['sometimes', 'string', Rule::in(TaskPriority::values())],
            'due_date' => ['nullable', 'date'],
            'assignee_id' => ['nullable', 'integer', 'exists:users,id'],
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
            } else {
                $list = BoardList::query()->find($validated['list_id']);
                if ($list === null || (int) $list->project_id !== (int) $project->id) {
                    return response()->json(['message' => 'Invalid list for this project.'], 422);
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
        if (array_key_exists('due_date', $validated)) {
            $task->due_date = $validated['due_date'];
        }
        if (array_key_exists('assignee_id', $validated)) {
            if ($validated['assignee_id'] === null) {
                $task->assignee_id = null;
            } else {
                $assignee = User::query()->find($validated['assignee_id']);
                if ($assignee === null || ! $assignee->isMemberOfProject($project)) {
                    return response()->json(['message' => 'Assignee must be a project member.'], 422);
                }
                $task->assignee_id = $assignee->id;
            }
        }

        $task->save();

        return response()->json($this->taskPayload($task->fresh()));
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

        $task->delete();

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function taskPayload(Task $task): array
    {
        return [
            'id' => $task->id,
            'list_id' => $task->list_id,
            'title' => $task->title,
            'description' => $task->description,
            'status' => $task->status,
            'priority' => $task->priority,
            'due_date' => $task->due_date,
            'assignee_id' => $task->assignee_id,
            'reporter_id' => $task->reporter_id,
            'created_at' => $task->created_at,
            'updated_at' => $task->updated_at,
        ];
    }
}
