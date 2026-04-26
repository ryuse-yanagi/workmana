# スキーマ: タスク・コメント・履歴

関連要件: `docs/requirements/tasks.md`・`docs/requirements/projects.md`（セクション削除時の `section_id`）

プロジェクト・セクション・`project_memberships` は [schema-projects.md](./schema-projects.md)。

## task.status / task.priority

列挙値および説明は [enums.md](./enums.md) の `task.status`・`task.priority` を参照する。

- **MySQL / MariaDB**: `tasks.status` は `ENUM('todo','in_progress','done')`、`tasks.priority` は `ENUM('low','medium','high')` とする（リテラル集合は enums と一致させる）。
- **PostgreSQL**: [schema-auth.md](./schema-auth.md) の組織ロールと同様、`varchar` + `CHECK`、または `CREATE TYPE ... AS ENUM` を採用する。

`priority` のソート順（`high > medium > low` 等）は SQL の `ENUM` 並びと一致しないため、`ORDER BY` は **`CASE` 式またはアプリ層**で enums の順序に従って実装する。

## task_history.event_type

許容値は [enums.md](./enums.md) の `task_history.event_type` のみ。DB 列は **`varchar(64)`** とする（イベント種別の追加・変更が比較的頻繁になり得るため、`tasks.status` ほど DB の `ENUM` にはしない）。

## tasks

| カラム | 型（目安） | NULL | 説明 |
|--------|------------|------|------|
| id | bigint PK | NO | |
| organization_id | bigint FK → organizations.id | NO | 下記 `ON DELETE` を参照。親 `projects.organization_id` と**常に一致**（冗長。検証・一覧用） |
| project_id | bigint FK → projects.id | NO | 下記 `ON DELETE` を参照 |
| section_id | bigint FK → sections.id | YES | 非 NULL 時は当該 section の `project_id` = `tasks.project_id`。下記 `ON DELETE` を参照 |
| title | varchar(500) | NO | 前後トリム後空不可。文字数上限の API 上の定義は `docs/api` と一致させる |
| description | text | YES | 空文字可 |
| status | 上記「task.status / task.priority」 | NO | 既定値 `todo` |
| priority | 上記「task.status / task.priority」 | NO | 既定値 `medium` |
| due_date | timestamp | YES | **UTC** で保存。日付のみの解釈・境界は `docs/api` |
| assignee_id | bigint FK → users.id | YES | 非 NULL 時は下記の project_memberships 前提を満たすユーザー |
| reporter_id | bigint FK → users.id | NO | 作成後変更不可。下記の project_memberships 前提を満たすユーザー |
| created_at | timestamp | NO | |
| updated_at | timestamp | NO | |
| deleted_at | timestamp | YES | 論理削除 |

一覧・参照:

- **通常のタスク一覧・検索結果**は **`deleted_at IS NULL` の行のみ**とする。
- **`deleted_at IS NOT NULL` のタスク**は、**ID 指定の詳細取得**に限り参照権限のあるユーザーへ**閲覧専用**で返してよい（更新・コメント新規は不可。応答コードは `docs/api`）。

制約・インデックス:

- `INDEX (project_id, deleted_at, created_at DESC)`（プロジェクト配下一覧・既定ソート `created_at DESC`）
- `INDEX (organization_id, deleted_at)`
- `INDEX (assignee_id, deleted_at)`
- `INDEX (project_id, status, deleted_at)`（ステータスフィルタ）
- `INDEX (project_id, due_date, deleted_at)`（期限フィルタ・ソート）
- **キーワード検索（`title`・`description`、部分一致・大文字小文字無視・日本語を含む）**は、**MySQL / MariaDB では `FULLTEXT INDEX`** を `title`・`description` に付与し、**`ngram` パーサー**を用いる（トークン長・ストップワードはマイグレーションで明示）。**PostgreSQL** では `tsvector` 生成列 + **`GIN`** インデックスで同等の検索を実装する。

外部キー・削除時:

- `tasks.organization_id` → `organizations.id` **`ON DELETE RESTRICT`**
- `tasks.project_id` → `projects.id` **`ON DELETE CASCADE`**（プロジェクト行を物理削除したとき当該タスクも削除。運用は論理削除が主でも、行削除時の整合用）
- `tasks.section_id` → `sections.id` **`ON DELETE SET NULL`**（セクション削除時に未分類へ）
- `tasks.assignee_id` → `users.id` **`ON DELETE SET NULL`**
- `tasks.reporter_id` → `users.id` **`ON DELETE RESTRICT`**（参照が残る間は当該ユーザーを物理削除しない）

project_memberships 前提（アプリまたは DB トリガー等で担保）:

- **`reporter_id`**・**`assignee_id`（非 NULL 時）**は、いずれも **`(users.id, tasks.project_id)` に対応する `project_memberships` 行が存在する**こと（当該プロジェクトのメンバーのみ）。

冗長列・整合:

- **`organization_id`** = 親 `projects.organization_id`（挿入・更新時に検証）
- **`section_id` が非 NULL** なら、当該 `sections.project_id` = `tasks.project_id`

## task_comments

| カラム | 型（目安） | NULL | 説明 |
|--------|------------|------|------|
| id | bigint PK | NO | |
| task_id | bigint FK → tasks.id | NO | 下記 `ON DELETE` を参照 |
| organization_id | bigint FK → organizations.id | NO | 親タスクと**常に一致**（認可短絡・集計用） |
| project_id | bigint FK → projects.id | NO | 親タスクと**常に一致** |
| author_id | bigint FK → users.id | NO | 投稿者。下記の project_memberships 前提を満たすユーザー |
| body | text | NO | 前後トリム後空不可 |
| created_at | timestamp | NO | |
| updated_at | timestamp | NO | |
| deleted_at | timestamp | YES | コメントの論理削除 |

制約・インデックス:

- `INDEX (task_id, deleted_at, created_at)`（スレッド表示）
- `INDEX (project_id, deleted_at)`

外部キー・削除時:

- `task_comments.task_id` → `tasks.id` **`ON DELETE CASCADE`**
- `task_comments.organization_id` → `organizations.id` **`ON DELETE RESTRICT`**
- `task_comments.project_id` → `projects.id` **`ON DELETE RESTRICT`**
- `task_comments.author_id` → `users.id` **`ON DELETE RESTRICT`**

project_memberships 前提:

- **`author_id`** は、当該 **`project_id`** の **`project_memberships`** に存在するユーザーであること。

冗長列:

- **`organization_id`・`project_id`** は、紐づく **`tasks`** の同名カラムと**常に一致**させる（挿入・更新時に検証）。

## task_histories

アプリケーションからの **UPDATE / DELETE は行わない**（運用保守を除く）。差分は `field_name`・`before_value`・`after_value` で表現する。

| カラム | 型（目安） | NULL | 説明 |
|--------|------------|------|------|
| id | bigint PK | NO | |
| task_id | bigint FK → tasks.id | NO | 下記 `ON DELETE` を参照 |
| organization_id | bigint FK → organizations.id | NO | 親タスクと**常に一致** |
| project_id | bigint FK → projects.id | NO | 親タスクと**常に一致** |
| actor_id | bigint FK → users.id | YES | 人間による操作の実行者。**system 由来のイベントは NULL** |
| event_type | varchar(64) | NO | 上記「task_history.event_type」 |
| field_name | varchar(64) | YES | 差分対象フィールド名。イベント種別によっては NULL |
| before_value | text | YES | 値の表現は `docs/api` と一致（JSON 文字列可） |
| after_value | text | YES | 同上 |
| created_at | timestamp | NO | |

制約・インデックス:

- `INDEX (task_id, created_at)`（時系列表示）

外部キー・削除時:

- `task_histories.task_id` → `tasks.id` **`ON DELETE CASCADE`**
- `task_histories.organization_id` → `organizations.id` **`ON DELETE RESTRICT`**
- `task_histories.project_id` → `projects.id` **`ON DELETE RESTRICT`**
- `task_histories.actor_id` → `users.id` **`ON DELETE SET NULL`**

冗長列:

- **`organization_id`・`project_id`** は、紐づく **`tasks`** と**常に一致**させる。

ビジネスルール:

- **親タスクが論理削除**（`tasks.deleted_at IS NOT NULL`）されても、既存の **`task_histories` 行は削除しない**（要件）。
- **`task_comments` も同様**、親タスク論理削除のみでは行を残す。親 **`tasks` 行を物理削除**した場合は **`ON DELETE CASCADE`** でコメント・履歴も削除される。

通知の永続化テーブルは `docs/notifications` で定義する。外部キー・`ON DELETE` の一覧は各テーブル節を参照。
