<?php

namespace App\Http\Controllers\Api;

use App\Events\ListCreated;
use App\Events\ListDeleted;
use App\Events\ListsReordered;
use App\Events\ListUpdated;
use App\Events\TasksReordered;
use App\Models\BoardList;
use App\Models\Organization;
use App\Models\Workspace;
use App\Models\Task;
use App\Support\BoardListColors;
use App\Support\SafeBroadcast;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ListController extends ApiController
{
    public function index(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);

        $lists = $workspace->lists()->get(['id', 'name', 'color_index', 'sort_order', 'created_at']);

        return response()->json(['data' => $lists]);
    }

    public function store(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);
        $this->denyIfWorkspaceViewer($request->user(), $workspace);
        $this->assertWorkspaceNotArchived($workspace);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'color_index' => ['required', 'integer', 'min:0', 'max:'.(BoardListColors::STANDARD_COUNT - 1)],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['message' => 'Name cannot be empty.'], 422);
        }

        $colorIndex = (int) $validated['color_index'];
        if (! BoardListColors::isValidIndex($colorIndex)) {
            return response()->json(['message' => 'Invalid list color index.'], 422);
        }

        $list = $workspace->lists()->create([
            'name' => $name,
            'color_index' => $colorIndex,
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        SafeBroadcast::toOthers(new ListCreated($list));

        return response()->json([
            'id' => $list->id,
            'name' => $list->name,
            'color_index' => $list->color_index,
            'sort_order' => $list->sort_order,
        ], 201);
    }

    public function update(Request $request, Organization $organization, Workspace $workspace, BoardList $boardList): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);
        $this->denyIfWorkspaceViewer($request->user(), $workspace);
        $this->assertWorkspaceNotArchived($workspace);

        if ((int) $boardList->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'color_index' => ['sometimes', 'integer', 'min:0', 'max:'.(BoardListColors::STANDARD_COUNT - 1)],
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
        if (array_key_exists('color_index', $validated)) {
            $colorIndex = (int) $validated['color_index'];
            if (! BoardListColors::isValidIndex($colorIndex)) {
                return response()->json(['message' => 'Invalid list color index.'], 422);
            }
            $boardList->color_index = $colorIndex;
        }
        $boardList->save();

        SafeBroadcast::toOthers(new ListUpdated($boardList));

        return response()->json([
            'id' => $boardList->id,
            'name' => $boardList->name,
            'color_index' => $boardList->color_index,
            'sort_order' => $boardList->sort_order,
        ]);
    }

    public function destroy(Request $request, Organization $organization, Workspace $workspace, BoardList $boardList): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);
        $this->denyIfWorkspaceViewer($request->user(), $workspace);
        $this->assertWorkspaceNotArchived($workspace);

        if ((int) $boardList->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        $otherList = $workspace->lists()
            ->where('id', '!=', $boardList->id)
            ->orderBy('sort_order')
            ->first();

        if ($otherList === null) {
            return response()->json(['message' => 'Cannot delete the last list in the workspace.'], 422);
        }

        $tasksToMove = Task::query()
            ->where('workspace_id', $workspace->id)
            ->where('list_id', $boardList->id)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        if ($tasksToMove->isNotEmpty()) {
            $maxOrder = Task::query()
                ->where('workspace_id', $workspace->id)
                ->where('list_id', $otherList->id)
                ->notArchived()
                ->max('sort_order');
            $nextOrder = $maxOrder === null ? 0 : ((int) $maxOrder + 1);

            foreach ($tasksToMove as $task) {
                $task->list_id = $otherList->id;
                $task->sort_order = $nextOrder;
                $task->save();
                $nextOrder++;
            }
        }

        $listId = (int) $boardList->id;
        $workspaceId = (int) $workspace->id;
        $boardList->delete();

        SafeBroadcast::toOthers(new ListDeleted($workspaceId, $listId));

        return response()->json(null, 204);
    }

    public function reorder(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);
        $this->denyIfWorkspaceViewer($request->user(), $workspace);
        $this->assertWorkspaceNotArchived($workspace);

        $validated = $request->validate([
            'list_ids' => ['present', 'array'],
            'list_ids.*' => ['integer', 'distinct'],
        ]);

        /** @var array<int, int> $listIds */
        $listIds = array_map('intval', $validated['list_ids']);

        $activeListIds = $workspace->lists()
            ->pluck('id')
            ->sort()
            ->values()
            ->all();

        $sortedIncoming = $listIds;
        sort($sortedIncoming);

        if ($activeListIds !== $sortedIncoming) {
            return response()->json([
                'message' => 'list_ids must include every list in the workspace exactly once.',
            ], 422);
        }

        foreach ($listIds as $index => $listId) {
            BoardList::query()
                ->where('id', $listId)
                ->where('workspace_id', $workspace->id)
                ->update(['sort_order' => $index]);
        }

        SafeBroadcast::toOthers(new ListsReordered((int) $workspace->id, $listIds));

        return response()->json(['data' => ['ok' => true]]);
    }

    public function reorderTasks(Request $request, Organization $organization, Workspace $workspace, BoardList $boardList): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);
        $this->denyIfWorkspaceViewer($request->user(), $workspace);
        $this->assertWorkspaceNotArchived($workspace);

        if ((int) $boardList->workspace_id !== (int) $workspace->id) {
            abort(404);
        }

        $validated = $request->validate([
            'task_ids' => ['present', 'array'],
            'task_ids.*' => ['integer', 'distinct'],
        ]);

        /** @var array<int, int> $taskIds */
        $taskIds = array_map('intval', $validated['task_ids']);

        $activeTaskIds = Task::query()
            ->where('workspace_id', $workspace->id)
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
                ->where('workspace_id', $workspace->id)
                ->update(['sort_order' => $index]);
        }

        SafeBroadcast::toOthers(new TasksReordered(
            (int) $workspace->id,
            (int) $boardList->id,
            $taskIds,
        ));

        return response()->json(['data' => ['ok' => true]]);
    }
}
