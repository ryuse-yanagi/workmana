# スキーマ: タスク

スペースは [schema-workspaces.md](./schema-workspaces.md) の `workspaces` / `lists`。優先度は [enums.md](./enums.md)。変更履歴のテーブルはない。

`tasks.status` 列と `tasks.assignee_id` 列はない。担当は `task_assignees`、列は `list_id`。

## tasks

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| id | bigint PK | NO | |
| organization_id | bigint FK → organizations.id | NO | `ON DELETE RESTRICT` |
| workspace_id | bigint FK → workspaces.id | NO | `ON DELETE CASCADE` |
| list_id | bigint FK → lists.id | NO | `ON DELETE RESTRICT`。列を消す前にタスクを移す |
| sort_order | unsigned int | NO | 列内および並べ替えの順。既定 0 |
| is_parent_task | boolean | NO | 既定 false |
| parent_task_id | bigint FK → tasks.id | YES | `ON DELETE SET NULL` |
| title | varchar(500) | NO | |
| description | text | YES | |
| priority | varchar(32) | NO | 既定 `medium` |
| start_date | timestamp | YES | |
| due_date | timestamp | YES | |
| gantt_bar_color | varchar(7) | YES | ガントの色 |
| effort_hours | decimal(12,6) | YES | 工数（時間） |
| progress_rate | unsigned tinyint | YES | 進捗 |
| reporter_id | bigint FK → users.id | NO | `ON DELETE RESTRICT` |
| archived_at | timestamp | YES | |
| deleted_at | timestamp | YES | |
| created_at / updated_at | timestamp | YES | |

主なインデックス: `(workspace_id, deleted_at, created_at)`、`(organization_id, deleted_at)`、期限・開始日、`(list_id, sort_order)`、`(parent_task_id)`、`(workspace_id, is_parent_task)`、`(workspace_id, archived_at)`。

## task_assignees

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| id | bigint PK | NO | |
| task_id | bigint FK → tasks.id | NO | `ON DELETE CASCADE` |
| user_id | bigint FK → users.id | NO | `ON DELETE CASCADE` |
| created_at / updated_at | timestamp | YES | |

UNIQUE `(task_id, user_id)`。

## タスク用ラベル

形はスペース用ラベルと同じ。テーブルは `task_label_categories`、`task_labels`、中間 `task_task_label`（`task_id`, `task_label_id`）。削除の向きも同じ。

## task_checklists / task_checklist_items

チェックリストはタスクに CASCADE。項目の主キーは UUID。

| テーブル | 主な列 |
| --- | --- |
| task_checklists | task_id, organization_id, workspace_id, title(255), sort_order |
| task_checklist_items | id (uuid PK), task_checklist_id, text, checked, sort_order |

組織・スペースへの外部キーは `ON DELETE RESTRICT`。項目はチェックリスト削除で CASCADE。

## task_attachments

ファイル実体は非公開ディスク。行はパスだけ持つ。

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| id | bigint PK | NO | |
| task_id | bigint FK → tasks.id | NO | `ON DELETE CASCADE` |
| uploaded_by | bigint FK → users.id | NO | `ON DELETE RESTRICT` |
| original_name | varchar | NO | |
| path | varchar | NO | |
| mime_type | varchar(255) | YES | |
| size_bytes | bigint unsigned | NO | 既定 0 |
| created_at / updated_at | timestamp | YES | |

インデックス: `(task_id, created_at)`。
