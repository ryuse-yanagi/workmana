# スキーマ: 資料

資料は必ず 1 つのスペースに所属する（`shared_documents.workspace_id`）。スペースを消すと、その資料も消える。

## shared_documents

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| id | bigint PK | NO | |
| organization_id | bigint FK → organizations.id | NO | `ON DELETE CASCADE` |
| workspace_id | bigint FK → workspaces.id | NO | 所属スペース。`ON DELETE CASCADE` |
| created_by | bigint FK → users.id | NO | `ON DELETE RESTRICT` |
| category | varchar(255) | YES | 組織の資料カテゴリ名。未設定可 |
| name | varchar(100) | NO | |
| description | text | YES | |
| body | longText | YES | Markdown |
| archived_at | timestamp | YES | |
| deleted_at | timestamp | YES | 論理削除（`softDeletes`） |
| created_at / updated_at | timestamp | YES | |

インデックス: `(organization_id, created_at)`、`(organization_id, deleted_at, archived_at)`、`(workspace_id, deleted_at, archived_at)`。
