<?php

namespace App\Support;

use App\Models\Document\Document;
use App\Models\Task\Task;
use App\Models\Task\TaskAttachment;
use App\Models\Task\TaskChecklist;
use App\Models\Workspace\BoardList;
use App\Models\Workspace\Workspace;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 削除（物理削除）を関連データごと一括で行う。
 * 外部キーの ON DELETE 挙動に依存せず、削除順序を明示する。
 */
final class PermanentDeleter
{
    /** 子孫を含め関連を消してから子から順に物理削除し、添付ファイルはトランザクション確定後に消す。 */
    public static function deleteTask(Task $task): void
    {
        $attachmentFiles = ['paths' => [], 'directories' => []];

        DB::transaction(function () use ($task, &$attachmentFiles) {
            $taskIds = self::taskTreeIds((int) $task->id);

            $attachmentFiles = self::attachmentFileTargets($taskIds);
            self::purgeTaskRelations($taskIds);
            Task::withTrashed()->whereIn('id', array_reverse($taskIds))->forceDelete();
        });

        self::purgeAttachmentFiles($attachmentFiles);
    }

    /** 行の物理削除が確定してから、資料ファイルを消す。 */
    public static function deleteDocument(Document $document): void
    {
        DB::transaction(function () use ($document) {
            $document->forceDelete();
        });

        self::purgeDocumentFiles($document);
    }

    /** 資料・タスク・ボード列の順に物理削除し、ファイルはトランザクション確定後に消す。 */
    public static function deleteWorkspace(Workspace $workspace): void
    {
        $documentFileTargets = [];
        $attachmentFiles = ['paths' => [], 'directories' => []];

        DB::transaction(function () use ($workspace, &$documentFileTargets, &$attachmentFiles) {
            $workspaceId = (int) $workspace->id;

            $documents = Document::withTrashed()
                ->where('workspace_id', $workspaceId)
                ->get();
            foreach ($documents as $document) {
                $documentFileTargets[] = $document;
                $document->forceDelete();
            }

            if (Schema::hasTable('workspace_pins')) {
                DB::table('workspace_pins')->where('workspace_id', $workspaceId)->delete();
            }
            $taskIds = Task::withTrashed()
                ->where('workspace_id', $workspaceId)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
            $attachmentFiles = self::attachmentFileTargets($taskIds);
            self::purgeTaskRelations($taskIds);
            Task::withTrashed()
                ->where('workspace_id', $workspaceId)
                ->forceDelete();

            // tasks.list_id は RESTRICT のため、ボード列はタスク削除後に消す。
            BoardList::query()
                ->where('workspace_id', $workspaceId)
                ->delete();

            DB::table('workspace_assignees')->where('workspace_id', $workspaceId)->delete();
            DB::table('workspace_workspace_label')->where('workspace_id', $workspaceId)->delete();

            $workspace->forceDelete();
        });

        self::purgeAttachmentFiles($attachmentFiles);
        foreach ($documentFileTargets as $document) {
            self::purgeDocumentFiles($document);
        }
    }

    /** コミット後に呼び、資料の保存ディレクトリごと消す。 */
    private static function purgeDocumentFiles(Document $document): void
    {
        $directory = 'documents/'.$document->id;
        MediaStorage::deletePrivateDirectory($directory);
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
     * タスク本体より先に、チェックリスト・担当・ラベル・添付の行を消す。
     *
     * @param  array<int, int>  $taskIds
     */
    private static function purgeTaskRelations(array $taskIds): void
    {
        if ($taskIds === []) {
            return;
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

        DB::table('task_assignees')->whereIn('task_id', $taskIds)->delete();
        DB::table('task_task_label')->whereIn('task_id', $taskIds)->delete();
        TaskAttachment::query()->whereIn('task_id', $taskIds)->delete();
    }

    /**
     * コミット後に消すため、添付パスとタスクごとのディレクトリを先に集める。
     *
     * @param  array<int, int>  $taskIds
     * @return array{paths: list<string>, directories: list<string>}
     */
    private static function attachmentFileTargets(array $taskIds): array
    {
        if ($taskIds === []) {
            return ['paths' => [], 'directories' => []];
        }

        $paths = [];
        $directories = [];
        $attachments = TaskAttachment::query()->whereIn('task_id', $taskIds)->get();
        foreach ($attachments as $attachment) {
            if (is_string($attachment->path) && $attachment->path !== '') {
                $paths[] = $attachment->path;
            }
            $directories['tasks/'.$attachment->task_id] = true;
        }

        return [
            'paths' => $paths,
            'directories' => array_keys($directories),
        ];
    }

    /**
     * @param  array{paths: list<string>, directories: list<string>}  $targets
     */
    private static function purgeAttachmentFiles(array $targets): void
    {
        foreach ($targets['paths'] as $path) {
            MediaStorage::deletePrivate($path);
        }
        foreach ($targets['directories'] as $directory) {
            MediaStorage::deletePrivateDirectory($directory);
        }
    }
}
