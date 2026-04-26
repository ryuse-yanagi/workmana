# 列挙値一覧

アプリケーション定数・OpenAPI の `enum`・DB の **`ENUM` / `CHECK` / PostgreSQL の `CREATE TYPE`** の**単一参照元**とする。  
値の追加・変更時は `docs/requirements/*`・`docs/api`・`docs/permissions`・該当する `schema-*.md` を同時に見直す。

## task.status

タスク状態。DB では [schema-tasks.md](./schema-tasks.md) のとおり MySQL なら `ENUM`、PostgreSQL なら `CHECK` 等で同一集合を強制する。

| 値 | 意味 |
|----|------|
| `todo` | 未着手 |
| `in_progress` | 進行中 |
| `done` | 完了 |

## task.priority

優先度。ソート順は要件どおり降順時 **`high` > `medium` > `low`**（昇順は逆）。DB 定義は [schema-tasks.md](./schema-tasks.md)。

| 値 | 意味 |
|----|------|
| `low` | 低 |
| `medium` | 中（既定） |
| `high` | 高 |

## membership.role（`memberships.role`・`invites.role`）

組織への所属ロールおよび、招待で付与するロール。`invites.role` は**同一の値集合**を用いる（表は重複しない）。`docs/permissions` の操作可否と一致させる。DB 定義は [schema-auth.md](./schema-auth.md)。

| 値 | 意味（概要） |
|----|----------------|
| `admin` | 組織管理者 |
| `project_leader` | プロジェクトリーダー |
| `member` | メンバー |
| `viewer` | 閲覧者 |

## project_membership.role（`project_memberships.role`）

**単一定義源は上の `membership.role`。** 取りうる値・意味・DB 型は `memberships.role` と同一（表は重複しない）。

- 列の意味: プロジェクト内ロール。組織の `memberships.role` とは**別列**だが、**当該プロジェクト内の操作権限**にのみ効く（組織ロールとの組み合わせは `docs/permissions`）。
- スキーマ: [schema-projects.md](./schema-projects.md) の「project_memberships.role」および [schema-auth.md](./schema-auth.md) の `memberships.role`。

## task_history.event_type

履歴イベント種別。API・監査表示と揃える。DB 列は `varchar(64)`（[schema-tasks.md](./schema-tasks.md)）。

| 値 | 意味 |
|----|------|
| `task_created` | タスク作成 |
| `task_updated` | タスク更新（汎用） |
| `task_deleted` | 論理削除 |
| `status_changed` | 状態変更 |
| `priority_changed` | 優先度変更 |
| `assignee_changed` | 担当者変更 |
| `due_date_changed` | 期限変更 |
| `comment_added` | コメント追加 |
| `comment_edited` | コメント編集 |
| `comment_deleted` | コメント論理削除 |

記録のルール（二重記録の禁止）:

- **`status`・`priority`・`assignee_id`・`due_date` の変更**は、**上表の専用 `event_type`（`status_changed` 等）を用いる**。
- **`title`・`description` の変更**専用の `event_type` は定義しない。**`task_updated`** とし、差分は **`field_name`・`before_value`・`after_value`** で表す（`field_name` の取りうる値は `docs/api` で列挙する）。

## 備考

- HTTP エラー理由コード等は `docs/api` に記載する。
