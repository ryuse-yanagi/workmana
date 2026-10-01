<?php

namespace App\Http\Controllers\Api\Task;

use App\Http\Controllers\Api\ApiController;
use App\Models\Organization\Organization;
use App\Models\Task\Task;
use App\Models\Task\TaskAttachment;
use App\Models\Workspace\Workspace;
use App\Support\MediaStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TaskAttachmentController extends ApiController
{
    /**
     * Content-Type は拡張子から決め、申告 MIME による HTML プレビューを防ぐ。
     *
     * @var array<string, string>
     */
    private const EXTENSION_CONTENT_TYPES = [
        'pdf' => 'application/pdf',
        'txt' => 'text/plain; charset=UTF-8',
        'csv' => 'text/csv; charset=UTF-8',
        'md' => 'text/plain; charset=UTF-8',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'doc' => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls' => 'application/vnd.ms-excel',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt' => 'application/vnd.ms-powerpoint',
        'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'zip' => 'application/zip',
    ];

    /** 未アーカイブタスクの添付を、タスク ID ごとに返す。 */
    public function workspaceIndex(Request $request, Organization $organization, Workspace $workspace): JsonResponse
    {
        $this->ensureWorkspaceBelongsToOrganization($workspace, $organization);
        $this->ensureWorkspaceMember($request->user(), $workspace);

        $attachments = TaskAttachment::query()
            ->whereHas('task', fn ($query) => $query
                ->where('workspace_id', $workspace->id)
                ->notArchived())
            ->orderByDesc('created_at')
            ->get();

        $grouped = [];
        foreach ($attachments->groupBy('task_id') as $taskId => $taskAttachments) {
            $grouped[(string) $taskId] = $taskAttachments
                ->map(fn (TaskAttachment $attachment) => $this->attachmentPayload($attachment))
                ->values()
                ->all();
        }

        return response()->json(['data' => $grouped]);
    }

    /** タスクの添付を新しい順に返す。メンバーのみ。 */
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

    /** アーカイブ済みスペースと削除済みタスクには添付できない。許可拡張子のみ。 */
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
            ],
        ]);

        $file = $validated['file'];
        $extension = strtolower((string) $file->getClientOriginalExtension());
        if (! isset(self::EXTENSION_CONTENT_TYPES[$extension])) {
            return response()->json([
                'message' => 'The file field must have one of the following extensions: '.implode(', ', array_keys(self::EXTENSION_CONTENT_TYPES)).'.',
                'errors' => [
                    'file' => ['The file field must have a valid extension.'],
                ],
            ], 422);
        }

        $path = MediaStorage::storePrivate($file, 'tasks/'.$task->id);

        $attachment = TaskAttachment::query()->create([
            'task_id' => $task->id,
            'uploaded_by' => $request->user()->id,
            'original_name' => $file->getClientOriginalName(),
            'path' => $path,
            'mime_type' => self::EXTENSION_CONTENT_TYPES[$extension],
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

        $disk = MediaStorage::resolvePrivateDisk($attachment->path);
        if ($disk === null) {
            abort(404);
        }

        $contentType = $this->contentTypeForAttachment($attachment);
        $inline = $request->boolean('inline') && $this->canPreviewInline($contentType);
        $headers = [
            'X-Content-Type-Options' => 'nosniff',
            'Content-Type' => $contentType,
            // HTML ではないプレビュータブは link 要素を読めないため、オリジン直下の favicon を示す
            'Link' => '</favicon.ico>; rel="icon"; type="image/x-icon"',
        ];
        // テキストのインライン表示ではスクリプトを禁止する。
        if ($inline && str_starts_with($contentType, 'text/')) {
            $headers['Content-Security-Policy'] = "default-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'";
        }

        return $disk->response(
            $attachment->path,
            $this->downloadFileName($attachment),
            $headers,
            $inline ? 'inline' : 'attachment',
        );
    }

    /** アーカイブ済みスペースでは添付を消せない。 */
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

        MediaStorage::deletePrivate($path);

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

    private function contentTypeForAttachment(TaskAttachment $attachment): string
    {
        $extension = strtolower(pathinfo($this->downloadFileName($attachment), PATHINFO_EXTENSION));

        return self::EXTENSION_CONTENT_TYPES[$extension] ?? 'application/octet-stream';
    }

    private function canPreviewInline(string $contentType): bool
    {
        return str_starts_with($contentType, 'image/')
            || str_starts_with($contentType, 'text/')
            || $contentType === 'application/pdf';
    }

    /** パス区切りと改行を除いた元ファイル名を返す。 */
    private function downloadFileName(TaskAttachment $attachment): string
    {
        $name = basename(str_replace('\\', '/', (string) $attachment->original_name));
        $name = str_replace(["\r", "\n", '"'], '', $name);
        if ($name === '' || $name === '.' || $name === '..') {
            return 'download';
        }

        return $name;
    }

    /**
     * mime_type は保存値ではなく拡張子から決める。
     *
     * @return array<string, mixed>
     */
    private function attachmentPayload(TaskAttachment $attachment): array
    {
        return [
            'id' => $attachment->id,
            'task_id' => $attachment->task_id,
            'original_name' => $attachment->original_name,
            'mime_type' => $this->contentTypeForAttachment($attachment),
            'size_bytes' => $attachment->size_bytes,
            'uploaded_by' => $attachment->uploaded_by,
            'created_at' => $attachment->created_at,
        ];
    }
}
