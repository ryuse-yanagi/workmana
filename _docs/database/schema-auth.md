# スキーマ: 認証・組織・招待

関連要件: `docs/requirements/auth.md`

組織ロール（`memberships.role`・`invites.role`）の取りうる値は DB 上は次のとおりとする（意味は [enums.md](./enums.md) の `membership.role`）。

`ENUM('admin','project_leader','member','viewer')`

- **MySQL / MariaDB**: 上記 `ENUM` をそのまま使用できる。
- **PostgreSQL**: ネイティブの `ENUM` 型はリテラル一覧の ALTER が重いため、要件次第で `varchar` + CHECK、または `CREATE TYPE ... AS ENUM ('admin','project_leader','member','viewer')` を採用する。

## users

| カラム | 型 | NULL | 説明 |
|--------|---|------|------|
| id | bigint PK | NO | |
| email | varchar(255) | NO | 一意。保存時は小文字化・前後トリム |
| password | varchar(255) | NO | ハッシュ保存（bcrypt 等） |
| email_verified_at | timestamp | YES | メール検証済み日時 |
| created_at | timestamp | NO | |
| updated_at | timestamp | NO | |

制約・インデックス:

- `UNIQUE (email)`（正規化後の値で一意）

備考:

- 表示名がプロダクト上必要なら `name` 等を追加してよい（要件外。Laravel 既定マイグレーションとの整合用）。

## organizations

| カラム | 型 | NULL | 説明 |
|--------|---|------|------|
| id | bigint PK | NO | |
| name | varchar(255) | NO | |
| created_by | bigint FK → users.id | NO | 作成ユーザー |
| created_at | timestamp | NO | |
| updated_at | timestamp | NO | |

## memberships

ユーザーと組織の所属。組織ロールを保持する。

| カラム | 型 | NULL | 説明 |
|--------|---|------|------|
| user_id | bigint FK → users.id | NO | |
| organization_id | bigint FK → organizations.id | NO | |
| role | ENUM('admin','project_leader','member','viewer') | NO | [enums.md](./enums.md) の `membership.role` と同一集合 |
| invited_by | bigint FK → users.id | YES | 招待者 |
| created_at | timestamp | NO | |
| updated_at | timestamp | NO | |

制約・インデックス:

- `PRIMARY KEY (user_id, organization_id)`
- `INDEX (organization_id)`（メンバー一覧）
- `INDEX (user_id)`（ユーザー所属一覧）

## invites

組織への招待。メールは `users` と同じ正規化ルールで保存・照合。

| カラム | 型 | NULL | 説明 |
|--------|---|------|------|
| id | bigint PK | NO | |
| email | varchar(255) | NO | 正規化済み |
| organization_id | bigint FK → organizations.id | NO | |
| role | ENUM('admin','project_leader','member','viewer') | NO | 受諾時に付与する `memberships.role` と同型・同集合 |
| token_hash | varchar(255) | NO | 平文トークンは保存しない（要件: ハッシュのみ） |
| expires_at | timestamp | NO | |
| invited_by | bigint FK → users.id | NO | |
| used_at | timestamp | YES | 使用済み日時 |
| revoked_at | timestamp | YES | 取り消し日時 |
| created_at | timestamp | NO | |
| updated_at | timestamp | NO | |

制約・インデックス（意図）:

- **ビジネス制約**: `revoked_at IS NULL` かつ `used_at IS NULL` かつ期限内の行は、同一 `(organization_id, email)` で高々 1 件。
- **PostgreSQL 例**:  
  `CREATE UNIQUE INDEX invites_one_active_per_org_email ON invites (organization_id, email) WHERE revoked_at IS NULL AND used_at IS NULL;`
- **MySQL**: 部分一意がないため、例として次のいずれかで代替する。  
  - アクティブ行のみ値を持つ生成列（例: アクティブ時に正規化 email、非アクティブ時は NULL）＋ `UNIQUE (organization_id, active_email)`（NULL の重複許容に注意して設計）  
  - トランザクション＋ `SELECT ... FOR UPDATE` での排他と、検索用 `(organization_id, email, revoked_at, used_at)` インデックス  
  採用した方式をマイグレーションコメントに残す。

その他制約・インデックス:

- `UNIQUE (token_hash)`（受諾時のルックアップ。ハッシュ値は行ごとに一意とする）

## password_reset_tokens

| カラム | 型 | NULL | 説明 |
|--------|---|------|------|
| user_id | bigint FK → users.id | NO | |
| token_hash | varchar(255) | NO | 平文は保存しない |
| expires_at | timestamp | NO | |
| used_at | timestamp | YES | 設定済みなら無効 |
| created_at | timestamp | NO | |

制約・インデックス:

- `PRIMARY KEY (user_id)` または `UNIQUE (user_id)`（ユーザーあたり最新1件運用なら PK でよい。再発行で行を差し替えるか行追加するかは実装方針）
- `UNIQUE (token_hash)`

## email_verification_tokens

| カラム | 型 | NULL | 説明 |
|--------|---|------|------|
| user_id | bigint FK → users.id | NO | |
| token_hash | varchar(255) | NO | |
| expires_at | timestamp | NO | |
| used_at | timestamp | YES | |
| created_at | timestamp | NO | |

制約・インデックス:

- `password_reset_tokens` と同様に、ユーザー単位の最新1件運用か複数行保持かを決めて PK/UNIQUE を定義
- `UNIQUE (token_hash)`

## リレーション概要

- `organizations.created_by` → `users`
- `memberships` → `users`, `organizations`
- `invites` → `organizations`, `users`（invited_by）

`project_memberships` は [schema-projects.md](./schema-projects.md) に記載。
