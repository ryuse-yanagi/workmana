<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Models\Workspace;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TaskAttachmentController extends ApiController
{
    private const ATTACHMENT_DISK = 'local';

    /** @var list<string> */
    private const ALLOWED_EXTENSIONS = [
        'pdf', 'txt', 'csv', 'md',
        'png', 'jpg', 'jpeg', 'gif', 'webp',
        'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        'zip',
    ];

    public function index(Request $request, Organization $organization, Workspace $workspace, Task $task): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);
        $this->assertTaskInWorkspace($task, $workspace);

        $attachments = $task->attachments()
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $attachments->map(fn (TaskAttachment $attachment) => $this->attachmentPayload($attachment)),
        ]);
    }

    public function store(Request $request, Organization $organization, Workspace $workspace, Task $task): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanEditWorkspace($request->user(), $workspace);
        $this->assertWorkspaceNotArchived($workspace);
        $this->assertTaskInWorkspace($task, $workspace);

        if ($task->trashed()) {
            abort(403, 'Cannot attach files to a deleted task.');
        }

        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'max:10240',
                'extensions:'.implode(',', self::ALLOWED_EXTENSIONS),
            ],
        ]);

        $file = $validated['file'];
        $path = $file->store('tasks/'.$task->id, self::ATTACHMENT_DISK);

        $attachment = TaskAttachment::query()->create([
            'task_id' => $task->id,
            'uploaded_by' => $request->user()->id,
            'original_name' => $file->getClientOriginalName(),
            'path' => $path,
            'mime_type' => $file->getClientMimeType(),
            'size_bytes' => $file->getSize(),
        ]);

        return response()->json($this->attachmentPayload($attachment), 201);
    }

    public function download(
        Request $request,
        Organization $organization,
        Workspace $workspace,
        Task $task,
        TaskAttachment $attachment,
    ): StreamedResponse {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);
        $this->assertTaskInWorkspace($task, $workspace);
        $this->assertAttachmentInTask($attachment, $task);

        $disk = $this->resolveAttachmentDisk($attachment->path);
        if ($disk === null) {
            abort(404);
        }

        return $disk->download($attachment->path, $attachment->original_name);
    }

    public function destroy(
        Request $request,
        Organization $organization,
        Workspace $workspace,
        Task $task,
        TaskAttachment $attachment,
    ): JsonResponse {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->assertCanEditWorkspace($request->user(), $workspace);
        $this->assertWorkspaceNotArchived($workspace);
        $this->assertTaskInWorkspace($task, $workspace);
        $this->assertAttachmentInTask($attachment, $task);

        $path = $attachment->path;
        $attachment->delete();

        $this->deleteAttachmentFile($path);

        return response()->json(null, 204);
    }

    private function assertTaskInWorkspace(Task $task, Workspace $workspace): void
    {
        if ((int) $task->workspace_id !== (int) $workspace->id) {
            abort(404);
        }
    }

    private function assertAttachmentInTask(TaskAttachment $attachment, Task $task): void
    {
        if ((int) $attachment->task_id !== (int) $task->id) {
            abort(404);
        }
    }

    /**
     * 新規は private（local）。移行前の public 配置も読み取り可能にする。
     */
    private function resolveAttachmentDisk(string $path): ?Filesystem
    {
        $local = Storage::disk(self::ATTACHMENT_DISK);
        if ($local->exists($path)) {
            return $local;
        }

        $public = Storage::disk('public');
        if ($public->exists($path)) {
            return $public;
        }

        return null;
    }

    private function deleteAttachmentFile(string $path): void
    {
        foreach ([self::ATTACHMENT_DISK, 'public'] as $diskName) {
            $disk = Storage::disk($diskName);
            if ($disk->exists($path)) {
                $disk->delete($path);
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function attachmentPayload(TaskAttachment $attachment): array
    {
        return [
            'id' => $attachment->id,
            'task_id' => $attachment->task_id,
            'original_name' => $attachment->original_name,
            'mime_type' => $attachment->mime_type,
            'size_bytes' => $attachment->size_bytes,
            'uploaded_by' => $attachment->uploaded_by,
            'created_at' => $attachment->created_at,
        ];
    }
}
