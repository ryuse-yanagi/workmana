<?php

namespace App\Support;

use App\Exceptions\ConflictException;
use App\Models\Document\Document;
use App\Models\Notification\AppNotification;
use App\Models\Organization\Organization;
use App\Models\Task\Task;
use App\Models\Task\TaskAttachment;
use App\Models\Task\TaskChecklist;
use App\Models\Workspace\BoardList;
use App\Models\Workspace\Workspace;
use App\Support\Concurrency\MutationLock;
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
            $locked = Task::withTrashed()->whereKey($task->id)->lockForUpdate()->first();
            if ($locked === null) {
                abort(404);
            }
            if ($locked->archived_at === null) {
                throw new ConflictException('このタスクは復元されたため、削除しませんでした。');
            }
            $attachmentFiles = self::deleteTaskRows($locked);
        });

        self::purgeAttachmentFiles($attachmentFiles);
    }

    /** 行の物理削除が確定してから、資料ファイルを消す。 */
    public static function deleteDocument(Document $document): void
    {
        DB::transaction(function () use ($document) {
            $locked = Document::withTrashed()->whereKey($document->id)->lockForUpdate()->first();
            if ($locked === null) {
                abort(404);
            }
            if ($locked->archived_at === null) {
                throw new ConflictException('この資料は復元されたため、削除しませんでした。');
            }
            self::deleteDocumentRows($locked);
        });

        self::purgeDocumentFiles($document);
    }

    /** 資料・タスク・ボード列の順に物理削除し、ファイルはトランザクション確定後に消す。 */
    public static function deleteWorkspace(Workspace $workspace): void
    {
        $deleted = [
            'documents' => [],
            'attachments' => ['paths' => [], 'directories' => []],
        ];

        DB::transaction(function () use ($workspace, &$deleted) {
            $locked = Workspace::withTrashed()->whereKey($workspace->id)->lockForUpdate()->first();
            if ($locked === null) {
                abort(404);
            }
            if ($locked->archived_at === null) {
                throw new ConflictException('このスペースは復元されたため、削除しませんでした。');
            }
            $deleted = self::deleteWorkspaceRows($locked);
        });

        self::purgeDeletedWorkspaceFiles($deleted);
    }

    /**
     * 組織と配下の行を一つのトランザクションで消す。
     * 途中で失敗したらスペース・タスク・資料・所属・通知・現在組織の付け替えもすべて戻す。
     * アイコンと添付などのファイルは、行削除が確定してから消す。
     */
    public static function deleteOrganization(Organization $organization): void
    {
        $organizationId = (int) $organization->id;
        $iconPath = $organization->icon_path;
        $documentFileTargets = [];
        $attachmentFiles = ['paths' => [], 'directories' => []];

        DB::transaction(function () use ($organization, $organizationId, &$documentFileTargets, &$attachmentFiles) {
            MutationLock::organization($organizationId);

            $workspaces = Workspace::withTrashed()
                ->where('organization_id', $organizationId)
                ->get();
            foreach ($workspaces as $workspace) {
                $deleted = self::deleteWorkspaceRows($workspace);
                array_push($documentFileTargets, ...$deleted['documents']);
                $attachmentFiles = self::mergeAttachmentFiles($attachmentFiles, $deleted['attachments']);
            }

            $documents = Document::withTrashed()
                ->where('organization_id', $organizationId)
                ->get();
            foreach ($documents as $document) {
                self::deleteDocumentRows($document);
                $documentFileTargets[] = $document;
            }

            $tasks = Task::withTrashed()
                ->where('organization_id', $organizationId)
                ->get();
            foreach ($tasks as $task) {
                if (! Task::withTrashed()->whereKey($task->id)->exists()) {
                    continue;
                }
                $attachmentFiles = self::mergeAttachmentFiles(
                    $attachmentFiles,
                    self::deleteTaskRows($task),
                );
            }

            self::repointLastOrganization($organizationId);
            self::purgeOrganizationChecklists($organizationId);

            AppNotification::query()
                ->where('data->organization_slug', $organization->slug)
                ->delete();

            $organization->delete();
        });

        self::purgeAttachmentFiles($attachmentFiles);
        foreach ($documentFileTargets as $document) {
            self::purgeDocumentFiles($document);
        }
        MediaStorage::deletePublic(is_string($iconPath) ? $iconPath : null);
    }

    /**
     * タスク行と関連行だけを消す。呼び出し側のトランザクションに参加する。
     *
     * @return array{paths: list<string>, directories: list<string>}
     */
    private static function deleteTaskRows(Task $task): array
    {
        $taskIds = self::taskTreeIds((int) $task->id);
        $attachmentFiles = self::attachmentFileTargets($taskIds);
        self::purgeTaskRelations($taskIds);
        Task::withTrashed()->whereIn('id', array_reverse($taskIds))->forceDelete();

        return $attachmentFiles;
    }

    /** 資料行だけを消す。呼び出し側のトランザクションに参加する。 */
    private static function deleteDocumentRows(Document $document): void
    {
        $document->forceDelete();
    }

    /**
     * スペースと配下の行だけを消す。呼び出し側のトランザクションに参加する。
     *
     * @return array{documents: list<Document>, attachments: array{paths: list<string>, directories: list<string>}}
     */
    private static function deleteWorkspaceRows(Workspace $workspace): array
    {
        $workspaceId = (int) $workspace->id;
        $documents = Document::withTrashed()
            ->where('workspace_id', $workspaceId)
            ->get()
            ->all();
        foreach ($documents as $document) {
            self::deleteDocumentRows($document);
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

        return [
            'documents' => $documents,
            'attachments' => $attachmentFiles,
        ];
    }

    /**
     * @param  array{documents: list<Document>, attachments: array{paths: list<string>, directories: list<string>}}  $deleted
     */
    private static function purgeDeletedWorkspaceFiles(array $deleted): void
    {
        self::purgeAttachmentFiles($deleted['attachments']);
        foreach ($deleted['documents'] as $document) {
            self::purgeDocumentFiles($document);
        }
    }

    /**
     * @param  array{paths: list<string>, directories: list<string>}  $left
     * @param  array{paths: list<string>, directories: list<string>}  $right
     * @return array{paths: list<string>, directories: list<string>}
     */
    private static function mergeAttachmentFiles(array $left, array $right): array
    {
        return [
            'paths' => [...$left['paths'], ...$right['paths']],
            'directories' => array_values(array_unique([...$left['directories'], ...$right['directories']])),
        ];
    }

    /** 削除する組織を現在組織にしているユーザーを、残りの所属か未設定へ移す。 */
    private static function repointLastOrganization(int $organizationId): void
    {
        $userIds = DB::table('users')
            ->where('last_organization_id', $organizationId)
            ->orderBy('id')
            ->lockForUpdate()
            ->pluck('id');

        foreach ($userIds as $userId) {
            $nextId = DB::table('memberships')
                ->where('user_id', $userId)
                ->where('organization_id', '!=', $organizationId)
                ->orderBy('organization_id')
                ->value('organization_id');

            DB::table('users')
                ->where('id', $userId)
                ->where('last_organization_id', $organizationId)
                ->update([
                    'last_organization_id' => $nextId,
                    'updated_at' => now(),
                ]);
        }
    }

    /** タスク削除後に残ったチェックリストがあれば、組織削除の RESTRICT を避ける。 */
    private static function purgeOrganizationChecklists(int $organizationId): void
    {
        $checklistIds = DB::table('task_checklists')
            ->where('organization_id', $organizationId)
            ->pluck('id');
        if ($checklistIds->isEmpty()) {
            return;
        }

        DB::table('task_checklist_items')->whereIn('task_checklist_id', $checklistIds)->delete();
        DB::table('task_checklists')->where('organization_id', $organizationId)->delete();
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
