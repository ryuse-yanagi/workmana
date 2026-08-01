<?php

namespace App\Support;

use App\Models\BoardList;
use App\Models\SharedDocument;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Models\TaskChecklist;
use App\Models\TaskComment;
use App\Models\TaskHistory;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * 完全削除（物理削除）を関連データごと一括で行う。
 * 外部キーの ON DELETE 挙動に依存せず、削除順序を明示する。
 */
final class PermanentDeleter
{
    public static function deleteTask(Task $task): void
    {
        DB::transaction(function () use ($task) {
            $taskIds = self::taskTreeIds((int) $task->id);

            self::purgeTaskRelations($taskIds);
            Task::withTrashed()->whereIn('id', array_reverse($taskIds))->forceDelete();
        });
    }

    public static function deleteDocument(SharedDocument $document): void
    {
        DB::transaction(function () use ($document) {
            $documentId = (int) $document->id;

            DB::table('document_document_label')
                ->where('shared_document_id', $documentId)
                ->delete();
            DB::table('document_related_document')
                ->where('document_id', $documentId)
                ->orWhere('related_document_id', $documentId)
                ->delete();
            DB::table('workspace_related_document')
                ->where('shared_document_id', $documentId)
                ->delete();

            $document->forceDelete();
        });

        self::purgeDocumentFiles($document);
    }

    public static function deleteWorkspace(Workspace $workspace): void
    {
        DB::transaction(function () use ($workspace) {
            $workspaceId = (int) $workspace->id;

            $taskIds = Task::withTrashed()
                ->where('workspace_id', $workspaceId)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
            self::purgeTaskRelations($taskIds);
            Task::withTrashed()
                ->where('workspace_id', $workspaceId)
                ->forceDelete();

            // tasks.list_id は RESTRICT のため、リストはタスク削除後に消す。
            BoardList::query()
                ->where('workspace_id', $workspaceId)
                ->delete();

            DB::table('workspace_assignees')->where('workspace_id', $workspaceId)->delete();
            DB::table('workspace_workspace_label')->where('workspace_id', $workspaceId)->delete();
            DB::table('workspace_related_document')->where('workspace_id', $workspaceId)->delete();
            DB::table('workspace_related_workspace')
                ->where('workspace_id', $workspaceId)
                ->orWhere('related_workspace_id', $workspaceId)
                ->delete();

            $workspace->forceDelete();
        });
    }

    /**
     * 資料に紐づくアップロード済みファイルを保存ディレクトリごと削除する。
     * ロールバック時にファイルだけ失わないよう、コミット後に呼ぶ。
     */
    private static function purgeDocumentFiles(SharedDocument $document): void
    {
        $directory = 'documents/'.$document->id;
        $disk = Storage::disk('public');

        if ($disk->exists($directory)) {
            $disk->deleteDirectory($directory);
        }
    }

    /**
     * 親タスク自身と、論理削除済みを含むすべての子孫タスクIDを返す。
     *
     * @return array<int, int>
     */
    private static function taskTreeIds(int $rootTaskId): array
    {
        $taskIds = [$rootTaskId];
        $parentIds = [$rootTaskId];

        while ($parentIds !== []) {
            $childIds = Task::withTrashed()
                ->whereIn('parent_task_id', $parentIds)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
            $childIds = array_values(array_diff($childIds, $taskIds));

            $taskIds = [...$taskIds, ...$childIds];
            $parentIds = $childIds;
        }

        return $taskIds;
    }

    /**
     * @param  array<int, int>  $taskIds
     */
    private static function purgeTaskRelations(array $taskIds): void
    {
        if ($taskIds === []) {
            return;
        }

        $commentIds = TaskComment::withTrashed()
            ->whereIn('task_id', $taskIds)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
        if ($commentIds !== []) {
            DB::table('task_comment_reactions')->whereIn('task_comment_id', $commentIds)->delete();
            TaskComment::withTrashed()->whereIn('id', $commentIds)->forceDelete();
        }

        $checklistIds = TaskChecklist::query()
            ->whereIn('task_id', $taskIds)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
        if ($checklistIds !== []) {
            DB::table('task_checklist_items')->whereIn('task_checklist_id', $checklistIds)->delete();
            TaskChecklist::query()->whereIn('id', $checklistIds)->delete();
        }

        TaskHistory::query()->whereIn('task_id', $taskIds)->delete();
        DB::table('task_assignees')->whereIn('task_id', $taskIds)->delete();
        DB::table('task_task_label')->whereIn('task_id', $taskIds)->delete();

        $attachments = TaskAttachment::query()->whereIn('task_id', $taskIds)->get();
        // 新規は local、移行前は public に残っている場合がある
        $disks = [Storage::disk('local'), Storage::disk('public')];
        $purgedDirectories = [];
        foreach ($attachments as $attachment) {
            foreach ($disks as $disk) {
                if ($disk->exists($attachment->path)) {
                    $disk->delete($attachment->path);
                }
            }
            $directory = 'tasks/'.$attachment->task_id;
            $purgedDirectories[$directory] = true;
        }
        TaskAttachment::query()->whereIn('task_id', $taskIds)->delete();
        foreach (array_keys($purgedDirectories) as $directory) {
            foreach ($disks as $disk) {
                if ($disk->exists($directory)) {
                    $disk->deleteDirectory($directory);
                }
            }
        }
    }
}
