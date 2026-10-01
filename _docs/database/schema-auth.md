# スキーマ: ユーザー・組織・招待

マイグレーションが正。パスワード列はない。本人確認は Cognito で、ローカルには `cognito_sub` を置く。

## users

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| id | bigint PK | NO | |
| name | varchar | YES | ユーザー名 |
| email | varchar | NO | UNIQUE |
| cognito_sub | varchar | YES | UNIQUE。Cognito の sub |
| avatar_path | varchar | YES | 公開ディスク上のパス |
| last_organization_id | bigint FK → organizations.id | YES | 直前に使った組織。組織削除で NULL |
| email_verified_at | timestamp | YES | |
| created_at / updated_at | timestamp | YES | |

`last_organization_id` は `organizations` 作成マイグレーションで追加する。`ON DELETE SET NULL`。

## organizations

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| id | bigint PK | NO | |
| name | varchar | NO | |
| slug | varchar | NO | UNIQUE。URL の組織キー。新規作成時は 16 文字のランダムコード |
| icon_path | varchar | YES | |
| default_board_list_names | json | YES | 新規スペースの既定ボード列 |
| default_workspace_status_names | json | YES | 既定スペースステータス |
| default_document_category_names | json | YES | 既定資料カテゴリ |
| created_by | bigint FK → users.id | NO | `ON DELETE RESTRICT` |
| created_at / updated_at | timestamp | YES | |

## memberships

組織所属。複合主キー `(user_id, organization_id)`。

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| user_id | bigint FK → users.id | NO | `ON DELETE CASCADE` |
| organization_id | bigint FK → organizations.id | NO | `ON DELETE CASCADE` |
| role | varchar(32) | NO | [enums.md](./enums.md)。`admin` / `member` |
| created_at / updated_at | timestamp | YES | |

## organization_invites

旧草案の `invites` テーブルはなく、こちらが招待の正。

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| id | bigint PK | NO | |
| organization_id | bigint FK → organizations.id | NO | `ON DELETE CASCADE` |
| email | varchar | NO | |
| role | varchar(32) | NO | `admin` / `member` |
| token | varchar | NO | UNIQUE。保存値は SHA-256 ハッシュ |
| expires_at | timestamp | NO | |
| used_at | timestamp | YES | 使用済み |
| created_at / updated_at | timestamp | YES | |

PostgreSQL / SQLite では、未使用行について `(organization_id, email)` の部分ユニークインデックス `organization_invites_one_active_per_org_email`（`WHERE used_at IS NULL`）。

## sessions

Laravel のセッション。認証 Cookie のサーバ側データ。`id` が主キー、`user_id` は nullable、`payload` にトークンを含む。

`cache` / `cache_locks` / `jobs` / `job_batches` / `failed_jobs` はフレームワーク用で、業務テーブルではない。
