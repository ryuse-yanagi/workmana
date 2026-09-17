# タスク（Tasks）

## 概要

スペース内の作業単位。リスト必須所属、状態・優先度・複数担当・日付・見積・親子・チェックリスト（複数）・タスクラベル・アーカイブを持つ。ボードと WBS から共通の作成／詳細モーダルで編集する。

履歴は `TaskObserver` 等が `task_histories` へ書き込むが、**参照 API／UI は未提供** → [task-history.md](./task-history.md)。  
コメント・添付は別ドキュメント。通知の作成条件は [notification.md](./notification.md)。

## 本書の範囲

- タスク CRUD、フィールド意味、チェックリスト同期、親子、アーカイブ、一覧検索の現状

対象外: ボード DnD 詳細 → [board.md](./board.md)、WBS 並べ替え → [wbs.md](./wbs.md)、コメント → [task-comments.md](./task-comments.md)、添付 → [task-attachments.md](./task-attachments.md)

関連: [`../requirements/tasks.md`](../requirements/tasks.md)、[`../database/schema-tasks.md`](../database/schema-tasks.md)

---

## データモデル（要約）

| 対象 | 要点 |
| --- | --- |
| `tasks` | `organization_id`, `workspace_id`, `list_id`（必須）, `sort_order`, `is_parent_task`, `parent_task_id`, `title`, `description`, `status`（todo/in_progress/done）, `priority`（low/medium/high）, `start_date`, `due_date`, `gantt_bar_color`, `effort_hours`, `reporter_id`, `archived_at`, `deleted_at` |
| `task_assignees` | 複数担当（正本） |
| `task_task_label` | タスクラベル |
| `task_checklists` / `task_checklist_items` | 複数チェックリスト。item は UUID PK |

親子は **1 階層**（親は親を持てない）。

---

## API 要約

`/api/orgs/{organization}/workspaces/{workspace}/…`

| Method | Path | 説明 |
| --- | --- | --- |
| `GET/POST` | `/tasks` | 一覧（`q` タイトル検索等）／作成 |
| `GET` | `/tasks/parents` | 親候補 |
| `GET` | `/tasks/archived` | アーカイブ一覧 |
| `GET/PATCH` | `/tasks/{task}` | 詳細／更新（`checklists[]`, `assignee_ids`, `label_ids` 等） |
| `POST` | `…/archive` \| `…/unarchive` | アーカイブ／復元（復元は **admin**） |
| `DELETE` | `…` | 完全削除（アーカイブ後・**admin**） |
| `GET/PATCH` | `/tasks/wbs`, `/tasks/wbs/reorder` | → [wbs.md](./wbs.md) |

組織レベル: `/task-labels`, `/task-label-categories` → [organization-settings.md](./organization-settings.md)

新規担当追加時に `task.assigned` 通知（[notification.md](./notification.md)）。操作者自身への通知は送らない。

---

## 振る舞い・ルール

| 項目 | 内容 |
| --- | --- |
| 認可 | 組織メンバーなら編集可。ステータス遷移のロール制限（done→todo 等）は**未実装** |
| 担当 | `assignee_ids` → `task_assignees`。組織メンバーであること |
| 進捗 | **`status` が正**（todo / in_progress / done）。`list_id` は Kanban 配置。各 List の `mapped_status` で同期（List名から推測しない） |
| ステータス | 列挙値のいずれかに直接設定可能。列移動時は list の `mapped_status` に自動同期 |
| チェックリスト | `PATCH` の `checklists[]` で同期 |
| アーカイブ | `archived_at`。ボード／WBS から除外。完全削除はアーカイブ後 |
| 検索 | タイトル `q` 等の部分対応。要件の横断フィルタ行列は未実装 |

ブロードキャスト: `TaskCreated`, `TaskUpdated`, `TaskArchived`, `TaskRestored`, `TaskDeleted`, `TasksReordered`, `WbsTasksReordered`

---

## フロント

- `TaskFormPane`, `TaskDetailModal`, `TaskCreateModal`, `TaskEditPopoverLayer`
- `TaskDetailChecklistBlock`, `TaskDetailHierarchyBlock`, `ParentTaskPickerPanel`
- ボードカード: `TaskBoardCard.vue`／WBS 行からも同一 API

---

## 要件との差分

| 要件 | 実装 |
| --- | --- |
| 単一 assignee / project membership | 組織内 multi-assignee（`task_assignees`） |
| status 遷移ルール | なし |
| 履歴閲覧 | write-only |
| 充実した検索・フィルタ | 部分的 |
| 削除＝論理削除のみ | アーカイブ＋完全削除 |
| 通知（作成・期限・完了） | 担当追加／コメント／メンションのみ |

---

## 主要ファイル

- `backend/app/Http/Controllers/Api/TaskController.php`
- `backend/app/Models/Task.php`, `TaskChecklist*.php`
- `backend/app/Observers/TaskObserver.php`
- `backend/app/Enums/TaskStatus.php`, `TaskPriority.php`
- `frontend/app/components/modals/TaskDetailModal.vue`, `TaskCreateModal.vue`
- `frontend/app/components/task/TaskFormPane.vue`
