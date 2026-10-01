# タスク（Tasks）

## 概要

スペース内の作業単位。リスト必須所属、状態・優先度・複数担当・日付・見積・親子・チェックリスト（複数）・タスクラベル・アーカイブを持つ。ボードと WBS から共通の作成／詳細モーダルで編集する。

添付は別ドキュメント。通知の作成条件は [notification.md](./notification.md)。

## 本書の範囲

- タスク CRUD、フィールド意味、チェックリスト同期、親子、アーカイブ、一覧検索の現状

対象外: ボード DnD 詳細 → [board.md](./board.md)、WBS 並べ替え → [wbs.md](./wbs.md)、添付 → [task-attachments.md](./task-attachments.md)

関連: [`../../database/schema-tasks.md`](../../database/schema-tasks.md)

---

## データモデル（要約）

| 対象 | 要点 |
| --- | --- |
| `tasks` | `organization_id`, `workspace_id`, `list_id`（必須）, `sort_order`, `is_parent_task`, `parent_task_id`, `title`, `description`, `priority`（low/medium/high）, `start_date`, `due_date`, `gantt_bar_color`, `effort_hours`, `progress_rate`, `reporter_id`, `archived_at`, `deleted_at`。`status` 列はない |
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
| `POST` | `…/archive` \| `…/unarchive` | アーカイブ／復元（いずれも **admin**） |
| `DELETE` | `…` | 完全削除（アーカイブ後・**admin**） |
| `GET/PATCH` | `/tasks/wbs`, `/tasks/wbs/reorder` | → [wbs.md](./wbs.md) |

組織レベル: `/task-labels`, `/task-label-categories` → [organization-settings.md](./organization-settings.md)

新規担当追加時に `task.assigned` 通知（[notification.md](./notification.md)）。操作者自身への通知は送らない。

---

## 振る舞い・ルール

| 項目 | 内容 |
| --- | --- |
| 認可 | 組織メンバーならそのスペースを編集できる。アーカイブ・復元・完全削除は組織 **admin** |
| 担当 | `assignee_ids` → `task_assignees`。組織メンバーであること |
| 進捗 | `progress_rate`。ボード上の位置は `list_id`（`tasks.status` も `lists.mapped_status` もない） |
| チェックリスト | `PATCH` の `checklists[]` で同期 |
| アーカイブ | `archived_at`。ボード／WBS から除外。完全削除はアーカイブ後 |
| 検索 | タイトル `q` 等の部分対応 |

ブロードキャスト: `TaskCreated`, `TaskUpdated`, `TaskArchived`, `TaskRestored`, `TaskDeleted`, `TasksReordered`, `WbsTasksReordered`

---

## フロント

- `TaskFormPane`, `TaskDetailModal`, `TaskAddModal`, `TaskEditPopoverLayer`
- `TaskDetailChecklistBlock`, `TaskDetailHierarchyBlock`, `ParentTaskPickerPanel`
- ボードカード: `TaskBoardCard.vue`／WBS 行からも同一 API

---

## 主要ファイル

- `backend/app/Http/Controllers/Api/Task/TaskController.php`
- `backend/app/Models/Task/Task.php`, `TaskChecklist.php`, `TaskChecklistItem.php`
- `backend/app/Enums/TaskPriority.php`
- `frontend/app/components/modals/task/TaskDetailModal.vue`, `TaskAddModal.vue`
- `frontend/app/components/task/TaskFormPane.vue`
