# スキーマ: プロジェクト・セクション・プロジェクト所属

関連要件: `docs/requirements/projects.md`・`docs/requirements/auth.md`（`project_memberships` 整合）

## project_memberships.role

`project_memberships.role` は `memberships.role` と同一の定義を使用する。列挙値および説明は [enums.md](./enums.md) の `membership.role` を参照。DB 型は [schema-auth.md](./schema-auth.md) に準拠する。  
**当該プロジェクト内の操作権限**の判定にのみ用いる（組織の `memberships.role` とは別列。組み合わせは `docs/permissions`）。

## projects

| カラム | 型（目安） | NULL | 説明 |
|--------|------------|------|------|
| id | bigint PK | NO | |
| organization_id | bigint FK → organizations.id | NO | 下記 `ON DELETE` を参照 |
| created_by | bigint FK → users.id | NO | プロジェクト作成ユーザー |
| name | varchar(255) | NO | 前後トリム後空不可。**同一 organization 内で名前の一意性は保証しない** |
| description | text | YES | |
| archived_at | timestamp | YES | アーカイブ日時。**表示・フィルタ**等の UI/API 制御に用いる（例: アーカイブ一覧の切替） |
| deleted_at | timestamp | YES | 論理削除。`NOT NULL` なら終了状態（`archived_at` より強い／削除優先で解釈） |
| created_at | timestamp | NO | |
| updated_at | timestamp | NO | |

一覧・通常導線:

- **通常のプロジェクト一覧**は **`deleted_at IS NULL` の行のみ**。
- **`archived_at`** は、上記を前提にした**表示状態・フィルタ**（例: アーカイブ一覧の切替）。

制約・インデックス:

- **付けない**: `(organization_id, name)` の UNIQUE（同名プロジェクト可）
- `INDEX (organization_id, deleted_at, archived_at)`
- `INDEX (organization_id, created_at DESC)`（既定ソート）
- `INDEX (created_by)`（任意）

外部キー・削除時:

- `projects.created_by` → `users.id` **`ON DELETE RESTRICT`**
- `projects.organization_id` → `organizations.id` **`ON DELETE RESTRICT`**（子プロジェクトが残る organization は物理削除不可）。**`ON DELETE CASCADE`** は組織物理削除で配下を一掃する仕様に限り採用（影響大。明示的に決定）。

作成時:

- **`projects.created_by` を `user_id` とし、`project_memberships` に `role = admin` の行を同時に追加する**（詳細は `docs/permissions`）。

## lists

| カラム | 型（目安） | NULL | 説明 |
|--------|------------|------|------|
| id | bigint PK | NO | |
| project_id | bigint FK → projects.id | NO | 下記 `ON DELETE` を参照 |
| name | varchar(255) | NO | 前後トリム後空不可。**同一 `project_id` 内で一意**（`UNIQUE (project_id, name)`） |
| sort_order | unsigned int | NO | 0 以上。**表示は `sort_order` 昇順**。**重複可**・**連番不要** |
| created_at | timestamp | NO | |
| updated_at | timestamp | NO | |

制約・インデックス:

- `UNIQUE (project_id, name)`
- `INDEX (project_id, sort_order)`

外部キー・削除時:

- `lists.project_id` → `projects.id` **`ON DELETE CASCADE`**

## project_memberships

| カラム | 型（目安） | NULL | 説明 |
|--------|------------|------|------|
| user_id | bigint FK → users.id | NO | 下記の memberships 前提を満たすユーザーのみ |
| project_id | bigint FK → projects.id | NO | 下記 `ON DELETE` を参照 |
| role | `memberships.role` に準拠 | NO | 冒頭節・[enums.md](./enums.md)・[schema-auth.md](./schema-auth.md) |
| added_by | bigint FK → users.id | YES | 非 NULL 時は下記の memberships 前提を満たすユーザー。追記者 |
| created_at | timestamp | NO | |
| updated_at | timestamp | NO | |

memberships 前提（アプリまたは DB トリガー等で担保）:

- 対象行の `project_id` から `projects.organization_id` を `org` とする。
- **`user_id`**: `(user_id, org)` が `memberships` に存在すること（組織メンバーのみプロジェクトメンバーにできる）。
- **`added_by`（非 NULL 時）**: `(added_by, org)` が `memberships` に存在すること（同一 organization のメンバーのみ）。

制約・インデックス:

- `PRIMARY KEY (user_id, project_id)` または `UNIQUE (user_id, project_id)`
- `INDEX (project_id)`（一覧・件数）
- `INDEX (project_id, role)`（ロール別・`admin` 存在確認等）
- `INDEX (user_id)`

外部キー・削除時:

- `project_memberships.added_by` → `users.id` **`ON DELETE SET NULL`**
- `project_memberships.project_id` → `projects.id` **`ON DELETE CASCADE`**

ビジネスルール:

- **`admin` が常に1名以上**: 当該 `project_id` で `role = admin`（[enums.md](./enums.md) の `membership.role`）が少なくとも1件。違反する削除・ロール変更は禁止。作成時の初期行は上記 **projects の「作成時」** に従う。
- ユーザーが organization から外れたら、当該 org 配下の `project_memberships` を削除（要件）。

外部キー・`ON DELETE` の一覧は各テーブル節を参照。タスク側は [schema-tasks.md](./schema-tasks.md)。
