# スキーマ: スペース・ボード列・ラベル

UI のスペースはテーブル名 `workspaces`。旧草案の `projects` は現行マイグレーションにない。

## workspaces

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| id | bigint PK | NO | |
| organization_id | bigint FK → organizations.id | NO | `ON DELETE RESTRICT` |
| created_by | bigint FK → users.id | NO | `ON DELETE RESTRICT` |
| name | varchar | NO | 組織内の一意制約はない |
| description | text | YES | |
| status | varchar(255) | YES | 組織の既定ステータス名。未設定可 |
| archived_at | timestamp | YES | |
| deleted_at | timestamp | YES | 完全削除前の印。物理削除は別処理 |
| created_at / updated_at | timestamp | YES | |

インデックス: `(organization_id, deleted_at, archived_at)`、`(organization_id, deleted_at, created_at)`。

## lists

ボード列。スペース内で名前は一意。

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| id | bigint PK | NO | |
| workspace_id | bigint FK → workspaces.id | NO | `ON DELETE CASCADE` |
| name | varchar | NO | UNIQUE `(workspace_id, name)` |
| color_index | unsigned tinyint | NO | 既定は共有パレットの標準色 |
| sort_order | unsigned int | NO | 既定 0 |
| created_at / updated_at | timestamp | YES | |

インデックス: `(workspace_id, sort_order)`。

## workspace_assignees

スペース担当者。可視性の判定には使わない。

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| id | bigint PK | NO | |
| workspace_id | bigint FK → workspaces.id | NO | `ON DELETE CASCADE` |
| user_id | bigint FK → users.id | NO | `ON DELETE CASCADE` |
| created_at / updated_at | timestamp | YES | |

UNIQUE `(workspace_id, user_id)`。

## workspace_pins

ユーザーごとのピン。

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| id | bigint PK | NO | |
| workspace_id | bigint FK → workspaces.id | NO | `ON DELETE CASCADE` |
| user_id | bigint FK → users.id | NO | `ON DELETE CASCADE` |
| pinned_at | timestamp | NO | 既定は現在時刻 |
| created_at / updated_at | timestamp | YES | |

UNIQUE `(workspace_id, user_id)`。

## スペース用ラベル

組織マスタ。カテゴリとラベルの名前は、それぞれの親の中で一意。色は `color_index`。

| テーブル | 主な列 | 削除 |
| --- | --- | --- |
| workspace_label_categories | organization_id, created_by, name(40), sort_order | 組織 CASCADE、作成者 RESTRICT |
| workspace_labels | organization_id, category_id, created_by, name(40), color_index, sort_order | カテゴリ CASCADE |
| workspace_workspace_label | workspace_id, workspace_label_id | 双方 CASCADE。UNIQUE 組 |

UNIQUE: カテゴリは `(organization_id, name)`、ラベルは `(category_id, name)`、中間は `(workspace_id, workspace_label_id)`。

資料の所属は `shared_documents.workspace_id`（1 資料につき 1 スペース）。資料本体は [schema-documents.md](./schema-documents.md)。
