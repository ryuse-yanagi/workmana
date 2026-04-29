# データベース設計（`docs/database`）

`docs/requirements/auth.md`・`projects.md`・`tasks.md` のデータ構造を、**マイグレーションと整合する粒度**でまとめたものです。  
**本ディレクトリをスキーマの正**とし、Laravel 等の初期マイグレーションと食い違う場合はこちらに寄せるか、移行方針を別途記載してください。

次は **`docs/api`**（文字数上限・型名・エラーコード・`task_histories.field_name` 等）・**`docs/permissions`**（ロールの効き方）と一緒に更新する想定です。

## 読み方（推奨順）

1. **[enums.md](./enums.md)** … 列挙値の**単一参照元**（アプリ定数・OpenAPI・DB の `ENUM` / `CHECK` と揃える）。
2. **[schema-auth.md](./schema-auth.md)** … ユーザー・組織・`memberships`・`invites`・リセット/検証トークン。
3. **[schema-projects.md](./schema-projects.md)** … `projects`・`lists`・`project_memberships`（`memberships.role` と同一の `ENUM` をプロジェクト側でも使用）。
4. **[schema-tasks.md](./schema-tasks.md)** … `tasks`・`task_comments`・`task_histories`（検索インデックス・`ON DELETE` 方針まで記載）。

ドメイン横断のルール（論理削除の一覧対象、`project_memberships` 前提など）は各 `schema-*.md` 内の見出しで完結するようにしてあります。

## ファイル一覧

| ファイル | 内容 |
|----------|------|
| [enums.md](./enums.md) | `task.status` / `priority`・`membership.role`（`invites.role` 含む）・`project_membership.role`（参照のみ）・`task_history.event_type` |
| [schema-auth.md](./schema-auth.md) | `users`・`organizations`・`memberships`・`invites`・`password_reset_tokens`・`email_verification_tokens` |
| [schema-projects.md](./schema-projects.md) | `projects`・`lists`・`project_memberships` |
| [schema-tasks.md](./schema-tasks.md) | `tasks`・`task_comments`・`task_histories` |

**ER 図**は未同梱です。必要になったら `er.md` 等に Mermaid や外部ツール出力を追加してください。

**通知**・**監査ログ専用テーブル**は `docs/notifications` および運用方針に従い、本ディレクトリのコアテーブル外で定義します。

## 命名・型・削除の共通方針

- **主キー**は原則 `id`（`bigint` 自動採番）。`project_memberships` 等、複合主キーを採る表は各スキーマに明記。
- **外部キー**列名は `*_id`。**`ON DELETE`（`RESTRICT` / `CASCADE` / `SET NULL`）**は表ごとに各 `schema-*.md` で固定（実装時に勝手に変えない）。
- **日時**は **UTC** で保存（`timestamp` または `datetime`）。境界・表示は `docs/api`。
- **論理削除**は `deleted_at`（nullable）。**プロジェクト**は `archived_at` と併用し、**削除（`deleted_at`）を優先**して解釈する（詳細は [schema-projects.md](./schema-projects.md)）。
- **ロール列**（組織・プロジェクト・招待）は値の集合を [enums.md](./enums.md) の **`membership.role`** に揃え、MySQL では [schema-auth.md](./schema-auth.md) の `ENUM` 定義に準拠する（PostgreSQL は `CHECK` / `CREATE TYPE` 等。各スキーマに注記あり）。

## RDBMS 差分（実装時に要判断）

### 招待（`invites`）の部分一意

「有効な未使用の招待は `(organization_id, 正規化 email)` で高々 1 件」は、**PostgreSQL** なら部分一意インデックスで表現しやすいです。**MySQL** では部分一意が使えないため、生成列＋ `UNIQUE`、またはトランザクション＋アプリ層での保証等で代替します。  
→ [schema-auth.md](./schema-auth.md) の `invites` 節。

### タスクのキーワード検索

**MySQL / MariaDB** では `FULLTEXT` + **ngram**。**PostgreSQL** では `tsvector` + **GIN**。  
→ [schema-tasks.md](./schema-tasks.md) の `tasks` 節。

## 実装メモ（Laravel 等）

- 既定の `users.name`・`password_reset_tokens`（`email` 主キー型）などは、本スキーマと一致しないことが多いです。寄せるかどうかを明示してください。
- **`UNIQUE (token_hash)`**（招待・各種トークン）は [schema-auth.md](./schema-auth.md) に従います。

## 関連ドキュメント

- 要件: `docs/requirements/auth.md`・`projects.md`・`tasks.md`
- 権限: `docs/permissions`
- API: `docs/api`
- 検索基盤の補足: `docs/architecture`（本スキーマと矛盾しない範囲で）
