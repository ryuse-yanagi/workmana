# 業務管理アプリ（work-manager）

組織単位でワークスペース・タスク・共有ドキュメントを管理する Web アプリケーションです。  
フロントエンド（Nuxt / Vue）とバックエンド（Laravel API）を分離し、Amazon Cognito による認証と、Laravel Reverb によるリアルタイム同期に対応しています。

## 目次

- [概要](#概要)
- [主な機能](#主な機能)
- [技術スタック](#技術スタック)
- [リポジトリ構成](#リポジトリ構成)
- [システム構成](#システム構成)
- [前提環境](#前提環境)
- [セットアップ（ローカル）](#セットアップローカル)
- [環境変数](#環境変数)
- [開発サーバーの起動](#開発サーバーの起動)
- [認証](#認証)
- [リアルタイム同期](#リアルタイム同期)
- [ドメインモデルとロール](#ドメインモデルとロール)
- [主な画面・API](#主な画面api)
- [シードデータ](#シードデータ)
- [テスト](#テスト)
- [ドキュメント](#ドキュメント)
- [UI メモ](#ui-メモ)

---

## 概要

| 項目 | 内容 |
|------|------|
| フロントエンド | Nuxt 4 + Vue 3（TypeScript） |
| バックエンド | Laravel 13（PHP 8.3+）REST API |
| DB | PostgreSQL |
| 認証 | Amazon Cognito JWT（ローカルはバイパス可） |
| リアルタイム | Laravel Reverb + Redis + Laravel Echo |
| アイコン | [Lucide Icons](https://lucide.dev/)（`lucide-vue-next`） |

マルチテナント（組織）前提で、組織配下にワークスペースを置き、カンバン／テーブル形式でタスクを運用します。共有ドキュメントやラベル体系も組織単位で管理できます。

---

## 主な機能

### 組織・メンバー

- 組織の作成・所属
- 組織メンバー一覧
- 組織設定（ラベルカテゴリ等の組織横断設定を含む）

### スペース

- スペースの作成・更新・アーカイブ・削除
- スペース間の関連付け
- スペースと共有ドキュメントの関連付け
- スペース用ラベル／ラベルカテゴリ

### タスク・リスト

- リスト（ボード列）の CRUD・並び替え
- タスクの CRUD・アーカイブ／復元
- カンバン相当の並び替え、テーブルビュー・並べ替え
- 親子タスク
- ステータス（`todo` / `in_progress` / `done`）・優先度（`low` / `medium` / `high`）
- 担当者・期限・工数（時間単位）
- チェックリスト
- タスクラベル
- コメント・リアクション・変更履歴

### 共有ドキュメント

- 組織内ドキュメントの作成・編集・削除
- TipTap ベースのリッチテキスト／Markdown 連携
- ドキュメントラベル・カテゴリ
- 関連ワークスペース／関連ドキュメントの紐付け

### その他

- プロフィール・アバター
- ボード上の他メンバー操作のリアルタイム反映（Reverb）

---

## 技術スタック

### フロントエンド（`frontend/`）

| 種別 | 技術 |
|------|------|
| フレームワーク | Nuxt `^4` / Vue `^3` |
| 言語 | TypeScript |
| スタイル | SCSS（共通 mixin あり） |
| エディタ | TipTap |
| DnD | vuedraggable |
| リアルタイム | laravel-echo + pusher-js |
| アイコン | lucide-vue-next |
| Node | `>= 22.12.0`（`.nvmrc` 参照） |

開発時は Vite のプロキシで `/api` → `http://127.0.0.1:8000` に転送します（CORS / WSL のループバック差を回避）。

### バックエンド（`backend/`）

| 種別 | 技術 |
|------|------|
| フレームワーク | Laravel `^13` |
| 言語 | PHP `^8.3` |
| DB | PostgreSQL（`DB_CONNECTION=pgsql`） |
| 認証 | Cognito JWT（`firebase/php-jwt`） |
| WebSocket | Laravel Reverb |
| Redis | predis（ブロードキャスト Pub/Sub 等） |
| キュー（ローカル既定） | `database`（本番では SQS 切替を想定） |

---

## リポジトリ構成

```
work-manager/
├── README.md                 # 本ファイル
├── _docs/                    # 設計・要件・意思決定ログ
│   ├── architecture/         # アーキテクチャ（リアルタイム同期など）
│   ├── database/             # スキーマ・列挙値
│   ├── decisions/            # ADR
│   └── requirements/         # 要件定義（認証・プロジェクト／タスク等）
├── backend/                  # Laravel API
│   ├── app/
│   ├── config/
│   ├── database/migrations/
│   ├── database/seeders/
│   ├── routes/api.php
│   └── ...
└── frontend/                 # Nuxt アプリ
    ├── app/
    │   ├── components/
    │   ├── composables/
    │   ├── pages/
    │   └── ...
    ├── nuxt.config.ts
    └── ...
```

設計ドキュメント上の用語で **project** と書かれている箇所は、実装では **workspace** に相当します。

---

## システム構成

```
[ Browser ]
    │  HTTP (REST)                    WebSocket
    ▼                                 ▼
[ Nuxt :3000 ] ──proxy /api──▶ [ Laravel :8000 ] ──SQL──▶ [ PostgreSQL ]
                                    │
                                    │ broadcast (ShouldBroadcast)
                                    ▼
                               [ Redis Pub/Sub ]
                                    │
                                    ▼
                               [ Reverb :8080 ] ──push──▶ [ Echo (他クライアント) ]
```

- **書き込み**: ブラウザ → REST API → PostgreSQL（Echo / Reverb は介在しない）
- **配信**: DB 更新後にイベント発火 → Redis → Reverb → 購読中クライアントへ push

詳細は [`_docs/architecture/realtime-sync.md`](_docs/architecture/realtime-sync.md) を参照してください。

---

## 前提環境

| ツール | 目安 |
|--------|------|
| PHP | 8.3 以上（開発環境では 8.4 でも可） |
| Composer | 2.x |
| Node.js | 22.12 以上（`frontend/.nvmrc`） |
| npm | package-lock 利用想定 |
| PostgreSQL | 16 系など |
| Redis | Reverb ブロードキャスト用（ローカル必須） |

任意:

- Amazon Cognito ユーザープール（本番・ステージング）
- AWS SQS（本番キュー切替時）

---

## セットアップ（ローカル）

### 1. リポジトリ取得

```bash
git clone <repository-url> work-manager
cd work-manager
```

### 2. バックエンド

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
```

`.env` で少なくとも次を設定します。

- `DB_*`（PostgreSQL）
- `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS`（例: `http://localhost:3000`）
- ローカル認証用: `COGNITO_BYPASS=true` と `COGNITO_BYPASS_USER_ID`（後述）
- Reverb: `REVERB_*`（フロントの `NUXT_PUBLIC_REVERB_*` と一致させる）

DB 作成例:

```bash
createdb task_manager   # .env の DB_DATABASE に合わせる
php artisan migrate
# 必要なら
php artisan db:seed
```

### 3. フロントエンド

```bash
cd frontend
cp .env.example .env
npm install
```

ローカルでは `NUXT_PUBLIC_API_BASE_URL` は未設定で構いません（相対 `/api` → Vite プロキシ）。  
Reverb を使う場合は `NUXT_PUBLIC_REVERB_*` を backend の値に合わせてください。

### 4. Redis

Reverb のブロードキャストに Redis が必要です。起動例:

```bash
redis-server
# または Docker 等
```

---

## 環境変数

### バックエンド（`backend/.env`）

| 変数 | 説明 |
|------|------|
| `APP_KEY` | `php artisan key:generate` で生成 |
| `DB_*` | PostgreSQL 接続 |
| `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS` | フロントオリジン（カンマ区切り可） |
| `BROADCAST_CONNECTION` | 既定 `reverb` |
| `REVERB_APP_ID` / `KEY` / `SECRET` / `HOST` / `PORT` / `SCHEME` | WebSocket サーバー設定 |
| `REDIS_*` | Pub/Sub 等 |
| `QUEUE_CONNECTION` | ローカル既定 `database` |
| `COGNITO_JWKS_URL` / `ISSUER` / `AUDIENCE` | 本番 JWT 検証 |
| `COGNITO_BYPASS` | ローカルのみ `true` 可 |
| `COGNITO_BYPASS_USER_ID` | バイパス時の既定ユーザー ID |

詳細コメントは [`backend/.env.example`](backend/.env.example) を参照してください。

### フロントエンド（`frontend/.env`）

| 変数 | 説明 |
|------|------|
| `NUXT_PUBLIC_API_BASE_URL` | 本番では絶対 URL（例: `https://api.example.com/api`）。ローカルは省略可 |
| `NUXT_PUBLIC_REVERB_KEY` / `HOST` / `PORT` / `SCHEME` | Echo 接続先（backend と一致） |
| `NUXT_PUBLIC_COGNITO_*` | Cognito Hosted UI 等（本番） |

詳細は [`frontend/.env.example`](frontend/.env.example) および [`frontend/nuxt.config.ts`](frontend/nuxt.config.ts) を参照してください。

---

## 開発サーバーの起動

ターミナルを分けて起動する想定です。

```bash
# 1) API
cd backend
php artisan serve
# → http://127.0.0.1:8000

# 2) キュー（ジョブを使う場合）
cd backend
php artisan queue:listen --tries=1

# 3) Reverb（リアルタイム）
cd backend
php artisan reverb:start
# → 既定 :8080

# 4) フロント
cd frontend
npm run dev
# → http://localhost:3000
```

`composer.json` の `composer run dev` は Laravel 標準の concurrently 構成（serve / queue / pail / vite）です。本アプリのフロントは `frontend/` 側の Nuxt なので、通常は上記のとおり **API と Nuxt を別プロセス**で起動してください。

| サービス | URL（ローカル既定） |
|----------|---------------------|
| フロント | http://localhost:3000 |
| API | http://127.0.0.1:8000 |
| Reverb | ws://127.0.0.1:8080 |

---

## 認証

API ルートは `cognito` ミドルウェア配下です（[`backend/routes/api.php`](backend/routes/api.php)）。

### 本番・ステージング

1. フロントで Cognito にログインし ID トークン（JWT）を取得
2. `Authorization: Bearer <token>` で API を呼ぶ
3. バックエンドが JWKS で検証し、`cognito_sub` でユーザーを同期

### ローカル（バイパス）

`.env`:

```env
COGNITO_BYPASS=true
COGNITO_BYPASS_USER_ID=1
```

- Bearer に **数値のユーザー ID** を載せる、または設定した `COGNITO_BYPASS_USER_ID` でそのユーザーとして扱う
- Cognito 実体がなくても API を検証できます

組織コンテキスト付き API は `orgs/{organization}` 配下で、`org.member` ミドルウェアにより所属チェックされます。

---

## リアルタイム同期

| レイヤー | 技術 | 役割 |
|----------|------|------|
| WebSocket サーバー | Laravel Reverb | 購読クライアントへ push |
| Pub/Sub | Redis | アプリ → Reverb のバス |
| クライアント | Laravel Echo | チャンネル購読 |

方針・代替案の経緯は [`_docs/decisions/realtime-sync.md`](_docs/decisions/realtime-sync.md) を参照してください。

---

## ドメインモデルとロール

### 主要な概念

```
Organization
  ├── Membership（ユーザー × 組織ロール）
  ├── Workspace（実装上の作業単位。設計書では project と呼ぶ場合あり）
  │     ├── List（ボード列）
  │     ├── Task（コメント・履歴・チェックリスト・ラベル）
  │     └── WorkspaceMembership / Assignees 等
  ├── SharedDocument（関連ワークスペース・関連ドキュメント）
  └── Labels（workspace / task / document 用のカテゴリ＋ラベル）
```

### 組織ロール（設計上の列挙）

| 値 | 意味 |
|----|------|
| `admin` | 組織管理者 |
| `project_leader` | プロジェクトリーダー |
| `member` | メンバー |

列挙値の正は [`_docs/database/enums.md`](_docs/database/enums.md) です。ロールの DB 制約は `backend/database/migrations` の create 定義を確認してください。

### タスクの状態・優先度

- **status**: `todo` → `in_progress` → `done`（一部ロールで done からの戻しも可）
- **priority**: `low` / `medium`（既定）/ `high`

---

## 主な画面・API

### フロント画面（例）

| パス | 内容 |
|------|------|
| `/login` | ログイン |
| `/auth/callback` | Cognito コールバック |
| `/org/[slug]` | 組織ホーム |
| `/org/[slug]/workspaces` | ワークスペース一覧 |
| `/org/[slug]/workspaces/[id]` | ワークスペース詳細（ボード／テーブル） |
| `/org/[slug]/documents` | ドキュメント一覧 |
| `/org/[slug]/documents/[id]` | ドキュメント詳細 |
| `/org/[slug]/settings` | 組織設定 |

### API（抜粋）

認証必須。プレフィックスは `/api`。

- `GET/PATCH /me` … プロフィール
- `GET/POST /organizations`
- `GET /orgs/{organization}/members` / `settings`
- `CRUD /orgs/{organization}/workspaces`
- `CRUD /orgs/{organization}/documents`
- ラベル類: `workspace-labels` / `task-labels` / `document-labels`（＋ categories）
- ワークスペース配下: `lists` / `tasks` / `comments` / `reactions` など

完全なルート一覧は [`backend/routes/api.php`](backend/routes/api.php) を参照してください。

---

## シードデータ

`backend/database/seeders/` に以下があります。

- `UserSeeder` / `OrganizationSeeder` / `WorkspaceSeeder`
- `TaskSeeder` / `LabelSeeder` / `DocumentSeeder`
- `DummySeederData` / `DatabaseSeeder`

```bash
cd backend
php artisan db:seed
# または個別
php artisan db:seed --class=UserSeeder
```

ローカルバイパス用ユーザー ID はシード後の実 ID に合わせて `COGNITO_BYPASS_USER_ID` を設定してください。

---

## テスト

```bash
cd backend
php artisan test
# または
composer test
```

---

## ドキュメント

設計・仕様の入口: [`_docs/README.md`](_docs/README.md)

| 領域 | パス |
|------|------|
| 要件（認証・招待） | [`_docs/requirements/auth.md`](_docs/requirements/auth.md) |
| 要件（プロジェクト／リスト） | [`_docs/requirements/projects.md`](_docs/requirements/projects.md) |
| 要件（タスク） | [`_docs/requirements/tasks.md`](_docs/requirements/tasks.md) |
| DB 索引 | [`_docs/database/README.md`](_docs/database/README.md) |
| 列挙値 | [`_docs/database/enums.md`](_docs/database/enums.md) |
| リアルタイム構成 | [`_docs/architecture/realtime-sync.md`](_docs/architecture/realtime-sync.md) |
| ADR（Reverb 採用） | [`_docs/decisions/realtime-sync.md`](_docs/decisions/realtime-sync.md) |

一部ディレクトリ（`api` / `permissions` / `ui` 等）は索引のみで中身が未整備の場合があります。実装の正はコードとマイグレーションを優先してください。

---

## UI メモ

- アイコンは **Lucide Icons**（`lucide-vue-next`）を使用しています。
- フォントは Inter / Noto Sans JP / Source Sans 3（`@fontsource/*`）を利用しています。

---

## ライセンス

バックエンドの Laravel スケルトン由来の表記は MIT です。リポジトリ全体のライセンス方針が別途ある場合はそちらに従ってください。
