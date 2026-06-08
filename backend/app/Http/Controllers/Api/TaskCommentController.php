<?php

namespace App\Http\Controllers\Api;

use App\Enums\TaskHistoryEventType;
use App\Models\Organization;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskCommentReaction;
use App\Models\TaskHistory;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class TaskCommentController extends ApiController
{
    public function index(Request $request, Organization $organization, Project $project, Task $task): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->assertTaskInProject($task, $project);

        $comments = $task->comments()
            ->with(['author:id,name,email,avatar_path', 'reactions.user:id,name,email,avatar_path'])
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'data' => $comments->map(fn (TaskComment $comment) => $this->serializeComment($comment, $request->user())),
        ]);
    }

    public function store(Request $request, Organization $organization, Project $project, Task $task): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);
        $this->assertTaskInProject($task, $project);

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

        $comment->load(['author:id,name,email,avatar_path', 'reactions.user:id,name,email,avatar_path']);

        return response()->json($this->serializeComment($comment, $user), 201);
    }

    public function update(Request $request, Organization $organization, Project $project, Task $task, TaskComment $comment): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);
        $this->assertTaskInProject($task, $project);
        $this->assertCommentInTask($comment, $task);

        $user = $request->user();
        if ((int) $comment->author_id !== (int) $user->id) {
            abort(403, 'Only the comment author can edit this comment.');
        }

        $validated = $request->validate([
            'body' => ['required', 'string'],
        ]);

        $body = trim($validated['body']);
        if ($body === '') {
            return response()->json(['message' => 'Body cannot be empty.'], 422);
        }

        $comment->body = $body;
        $comment->edited_at = now();
        $comment->save();

        TaskHistory::query()->create([
            'task_id' => $task->id,
            'organization_id' => $organization->id,
            'project_id' => $project->id,
            'actor_id' => $user->id,
            'event_type' => TaskHistoryEventType::CommentEdited->value,
            'field_name' => null,
            'before_value' => null,
            'after_value' => null,
            'created_at' => now(),
        ]);

        $comment->load(['author:id,name,email,avatar_path', 'reactions.user:id,name,email,avatar_path']);

        return response()->json($this->serializeComment($comment, $user));
    }

    public function destroy(Request $request, Organization $organization, Project $project, Task $task, TaskComment $comment): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);
        $this->assertTaskInProject($task, $project);
        $this->assertCommentInTask($comment, $task);

        $user = $request->user();
        if ((int) $comment->author_id !== (int) $user->id) {
            abort(403, 'Only the comment author can delete this comment.');
        }

        $comment->delete();

        TaskHistory::query()->create([
            'task_id' => $task->id,
            'organization_id' => $organization->id,
            'project_id' => $project->id,
            'actor_id' => $user->id,
            'event_type' => TaskHistoryEventType::CommentDeleted->value,
            'field_name' => null,
            'before_value' => null,
            'after_value' => null,
            'created_at' => now(),
        ]);

        return response()->json(['message' => 'Comment deleted.']);
    }

    public function toggleReaction(Request $request, Organization $organization, Project $project, Task $task, TaskComment $comment): JsonResponse
    {
        $this->ensureProjectBelongsToOrganization($project, $organization);
        $this->ensureProjectMember($request->user(), $project);
        $this->denyIfProjectViewer($request->user(), $project);
        $this->assertProjectNotArchived($project);
        $this->assertTaskInProject($task, $project);
        $this->assertCommentInTask($comment, $task);

        if ($task->trashed()) {
            abort(403, 'Cannot react to a comment on a deleted task.');
        }

        $validated = $request->validate([
            'emoji' => ['required', 'string', 'max:32'],
        ]);

        $emoji = trim($validated['emoji']);
        if ($emoji === '') {
            return response()->json(['message' => 'Emoji cannot be empty.'], 422);
        }

        $user = $request->user();

        $existing = TaskCommentReaction::query()
            ->where('task_comment_id', $comment->id)
            ->where('user_id', $user->id)
            ->where('emoji', $emoji)
            ->first();

        if ($existing) {
            $existing->delete();
        } else {
            TaskCommentReaction::query()->create([
                'task_comment_id' => $comment->id,
                'user_id' => $user->id,
                'emoji' => $emoji,
            ]);
        }

        $comment->load(['author:id,name,email,avatar_path', 'reactions.user:id,name,email,avatar_path']);

        return response()->json($this->serializeComment($comment, $user));
    }

    protected function assertTaskInProject(Task $task, Project $project): void
    {
        if ((int) $task->project_id !== (int) $project->id) {
            abort(404);
        }
    }

    protected function assertCommentInTask(TaskComment $comment, Task $task): void
    {
        if ((int) $comment->task_id !== (int) $task->id) {
            abort(404);
        }
    }

    protected function serializeComment(TaskComment $comment, User $viewer): array
    {
        return [
            'id' => $comment->id,
            'author_id' => $comment->author_id,
            'author' => $this->serializeUser($comment->author),
            'body' => $comment->body,
            'created_at' => $comment->created_at,
            'updated_at' => $comment->updated_at,
            'edited_at' => $comment->edited_at,
            'edited' => $comment->edited_at !== null,
            'reactions' => $this->serializeReactions($comment->reactions, $viewer),
        ];
    }

    protected function serializeUser(?User $user): ?array
    {
        if (! $user) {
            return null;
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'avatar_url' => $this->avatarUrl($user->avatar_path),
        ];
    }

    protected function serializeReactions(Collection $reactions, User $viewer): array
    {
        return $reactions
            ->groupBy('emoji')
            ->map(function (Collection $group, string $emoji) use ($viewer) {
                return [
                    'emoji' => $emoji,
                    'count' => $group->count(),
                    'reacted_by_me' => $group->contains(fn (TaskCommentReaction $reaction) => (int) $reaction->user_id === (int) $viewer->id),
                    'users' => $group
                        ->map(fn (TaskCommentReaction $reaction) => $this->serializeUser($reaction->user))
                        ->filter()
                        ->values()
                        ->all(),
                ];
            })
            ->values()
            ->all();
    }
}
