<?php

namespace App\Http\Controllers\Api;

use App\Events\ListCreated;
use App\Events\ListDeleted;
use App\Events\ListsReordered;
use App\Events\ListUpdated;
use App\Events\TasksReordered;
use App\Models\BoardList;
use App\Models\Organization;
use App\Models\Project;
use App\Models\Task;
use App\Support\SafeBroadcast;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ListController extends ApiController
{
    public function index(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);

        $lists = $project->lists()->get(['id', 'name', 'sort_order', 'created_at']);

        return response()->json(['data' => $lists]);
    }

    public function store(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Name cannot be empty.'], 422);
        }

        $list = $project->lists()->create([
            'name' => $name,
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        SafeBroadcast::toOthers(new ListCreated($list));

        return response()->json([
            'id' => $list->id,
            'name' => $list->name,
            'sort_order' => $list->sort_order,
        ], 201);
    }

    public function update(Request $request, Organization $organization, Project $project, BoardList $boardList): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        if ((int) $boardList->project_id !== (int) $project->id) {
            abort(404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        if (array_key_exists('name', $validated)) {
            $name = trim($validated['name']);
            if ($name === '') {
                return response()->json(['message' => 'Name cannot be empty.'], 422);
            }
            $boardList->name = $name;
        }
        if (array_key_exists('sort_order', $validated)) {
            $boardList->sort_order = $validated['sort_order'];
        }
        $boardList->save();

        SafeBroadcast::toOthers(new ListUpdated($boardList));

        return response()->json([
            'id' => $boardList->id,
            'name' => $boardList->name,
            'sort_order' => $boardList->sort_order,
        ]);
    }

    public function destroy(Request $request, Organization $organization, Project $project, BoardList $boardList): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        if ((int) $boardList->project_id !== (int) $project->id) {
            abort(404);
        }

        $listId = (int) $boardList->id;
        $projectId = (int) $project->id;
        $boardList->delete();

        SafeBroadcast::toOthers(new ListDeleted($projectId, $listId));

        return response()->json(null, 204);
    }

    public function reorder(Request $request, Organization $organization, Project $project): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        $validated = $request->validate([
            'list_ids' => ['present', 'array'],
            'list_ids.*' => ['integer', 'distinct'],
        ]);

        /** @var array<int, int> $listIds */
        $listIds = array_map('intval', $validated['list_ids']);

        $activeListIds = $project->lists()
            ->pluck('id')
            ->sort()
            ->values()
            ->all();

        $sortedIncoming = $listIds;
        sort($sortedIncoming);

        if ($activeListIds !== $sortedIncoming) {
            return response()->json([
                'message' => 'list_ids must include every list in the project exactly once.',
            ], 422);
        }

        foreach ($listIds as $index => $listId) {
            BoardList::query()
                ->where('id', $listId)
                ->where('project_id', $project->id)
                ->update(['sort_order' => $index]);
        }

        SafeBroadcast::toOthers(new ListsReordered((int) $project->id, $listIds));

        return response()->json(['data' => ['ok' => true]]);
    }

    public function reorderTasks(Request $request, Organization $organization, Project $project, BoardList $boardList): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        if ((int) $boardList->project_id !== (int) $project->id) {
            abort(404);
        }

        $validated = $request->validate([
            'task_ids' => ['present', 'array'],
            'task_ids.*' => ['integer', 'distinct'],
        ]);

        /** @var array<int, int> $taskIds */
        $taskIds = array_map('intval', $validated['task_ids']);

        $activeTaskIds = Task::query()
            ->where('project_id', $project->id)
            ->where('list_id', $boardList->id)
            ->notArchived()
            ->pluck('id')
            ->sort()
            ->values()
            ->all();

        $sortedIncoming = $taskIds;
        sort($sortedIncoming);

        if ($activeTaskIds !== $sortedIncoming) {
            return response()->json([
                'message' => 'task_ids must include every task in the list exactly once.',
            ], 422);
        }

        foreach ($taskIds as $index => $taskId) {
            Task::query()
                ->where('id', $taskId)
                ->where('project_id', $project->id)
                ->update(['sort_order' => $index]);
        }

        SafeBroadcast::toOthers(new TasksReordered(
            (int) $project->id,
            (int) $boardList->id,
            $taskIds,
        ));

        return response()->json(['data' => ['ok' => true]]);
    }
}
