<?php

namespace App\Http\Controllers\Api;

use App\Enums\TaskHistoryEventType;
use App\Models\Organization;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskCommentController extends ApiController
{
    public function index(Request $request, Organization $organization, Project $project, Task $task): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);

        if ((int) $task->project_id !== (int) $project->id) {
            abort(404);
        }

        $comments = $task->comments()
            ->orderBy('created_at')
            ->get(['id', 'author_id', 'body', 'created_at']);

        return response()->json(['data' => $comments]);
    }

    public function store(Request $request, Organization $organization, Project $project, Task $task): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);

        if ((int) $task->project_id !== (int) $project->id) {
            abort(404);
        }

        if ($task->trashed()) {
            abort(403, 'Cannot comment on a deleted task.');
        }

        $validated = $request->validate([
            'body' => ['required', 'string'],
        ]);

        $body = trim($validated['body']);
        if ($body === '') {
            return response()->json(['message' => 'Body cannot be empty.'], 422);
        }

        $user = $request->user();

        $comment = TaskComment::query()->create([
            'task_id' => $task->id,
            'organization_id' => $organization->id,
            'project_id' => $project->id,
            'author_id' => $user->id,
            'body' => $body,
        ]);

        TaskHistory::query()->create([
            'task_id' => $task->id,
            'organization_id' => $organization->id,
            'project_id' => $project->id,
            'actor_id' => $user->id,
            'event_type' => TaskHistoryEventType::CommentAdded->value,
            'field_name' => null,
            'before_value' => null,
            'after_value' => null,
            'created_at' => now(),
        ]);

        return response()->json([
            'id' => $comment->id,
            'author_id' => $comment->author_id,
            'body' => $comment->body,
            'created_at' => $comment->created_at,
        ], 201);
    }
}
