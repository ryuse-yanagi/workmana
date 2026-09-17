# WorkMana

## 目次

- [概要](#概要)
- [特徴](#特徴)
- [スクリーンショット](#スクリーンショット)
- [機能](#機能)
- [技術](#技術)
- [技術詳細・設計](#技術詳細設計)
- [構成](#構成)
- [セットアップ](#セットアップ)
- [ドメインモデルとロール](#ドメインモデルとロール)
- [主な画面・API](#主な画面api)
- [シードデータ](#シードデータ)
- [テスト](#テスト)
- [ドキュメント](#ドキュメント)

---

## 概要

チームのタスク管理・資料共有を一元化する **WorkMana**（ワークマナ）です。ドメインは [workmanager.jp](https://workmanager.jp) です。

組織単位のマルチテナント構成を採用し、ユーザー・権限・スペースを管理できます。
スペース内では、カンバン、WBS（ガント付き）、タスク管理を利用でき、資料やラベル管理にも対応しています。

フロントエンドとバックエンドを分離した構成で、認証にはAmazon Cognito、リアルタイム同期にはLaravel Reverbを利用しています。

UI／本READMEでは **スペース** と呼びます。設計ドキュメントの **project**、コード／APIの **workspace** はいずれもスペースに相当します。

---

## 特徴

- **組織単位のマルチテナント** — 組織・メンバー・招待・設定を組織ごとに分離
- **カンバンと WBS** — ボード列の並び替えと、ガント付き WBS ビューを同一スペースで利用
- **資料** — スペース配下の Markdown 編集、カテゴリ
- **セッションベース認証** — Cognito 認可コード（PKCE）。JWT はブラウザに保存せず HttpOnly Cookie のみ
- **ボード／WBS のリアルタイム同期** — Laravel Reverb でリスト／タスク操作を他クライアントへ反映
- **添付の私有化** — タスク添付は `local` ディスク＋認証付き download（`/storage` 直リンク不可）

---

## スクリーンショット

（準備中）

---

## 機能

### 組織・メンバー

- アカウント作成（`/register`）と組織作成は分離。作成後は Cognito ログインが必要
- 所属組織が無いユーザーは `/organizations/new` から組織を作成でき、作成者が管理者になる（API の `POST /organizations` は追加の組織作成も可）
- ログイン後は `/post-login` で所属を解決。0 件なら組織作成、1 件以上なら `last_organization_id`（無ければ先頭）の組織トップへ遷移
- プロフィールメニューから所属組織を切替（`PUT /me/current-organization` で `last_organization_id` を更新）
- 組織メンバー一覧・ロール変更（`admin` / `member`）・メンバー削除
- ユーザー招待（メール・トークン URL・新規登録／既存ユーザーの参加確認・取消）
- 組織設定（既定ボードリスト／スペースステータス／資料カテゴリ、スペース／タスク／資料用ラベル）

### スペース

- スペースの作成・更新・アーカイブ／復元・削除
- アーカイブ済みスペース一覧
- スペースステータス（組織の既定値を設定可能）
- スペース間の関連付け
- スペース配下の資料（作成・一覧はスペース詳細サイドバー）
- スペース用ラベル／ラベルカテゴリ
- スペース担当者の設定

### タスク・リスト

- リスト（ボード列）の CRUD・並び替え
- タスクの CRUD・アーカイブ／復元
- カンバン相当の並び替え
- WBS ビュー（ガント・開始日・表示項目のカスタム・並べ替え）
- 親子タスク
- ステータス（`todo` / `in_progress` / `done`）・優先度（`low` / `medium` / `high`）
- 担当者・開始日・期限・工数（時間単位）
- チェックリスト
- タスクラベル
- コメント・リアクション・メンション通知（`@[表示名](user:ID)`）
- 添付ファイル（認証付きアップロード／ダウンロード／削除。詳細は[ファイル保存](#ファイル保存)）

### 資料

- スペース配下の資料の作成・編集・削除（スペース詳細サイドバーから作成）
- アーカイブ／復元・スペース内アーカイブ済み一覧
- Markdown の編集（textarea）と閲覧時の HTML レンダリング（`marked` ＋ HTML サニタイズ）
- 資料カテゴリ

### その他

- プロフィール・アバター
- アプリ内通知（ヘッダー一覧・既読／一括既読）
- ボード／WBS 上のリスト／タスク操作のリアルタイム反映（Reverb。コメント・資料等は対象外）

---

## 技術

| 分類 | 技術 |
|------|------|
| Frontend | Nuxt 4 / Vue 3 / TypeScript |
| Backend | Laravel 13 / PHP 8.3 |
| Database | PostgreSQL |
| Authentication | Amazon Cognito |
| Realtime | Laravel Reverb / Laravel Echo |

---

## 技術詳細・設計

主要な技術選定と実装方針です。補助ライブラリは各サブセクションと `_docs/architecture/` に記載します。

### フロントエンド（`frontend/`）

| 種別 | 技術 |
|------|------|
| フレームワーク | Nuxt `^4` / Vue `^3` |
| 言語 | TypeScript |
| スタイル | SCSS（共通 mixin あり） |
| サーバー状態 | `@tanstack/vue-query` |
| オーバーレイ | `@floating-ui/dom` / `focus-trap` / `@vueuse/core` |
| バリデーション | `zod` |
| DnD | vuedraggable |
| リアルタイム | laravel-echo + pusher-js |
| アイコン | lucide-vue-next |
| Node | `>= 22.12.0`（`.nvmrc` 参照） |

開発時は Vite のプロキシで `/api` → `http://127.0.0.1:8000` に転送します（CORS / WSL のループバック差を回避）。

設計メモ:

- [`_docs/architecture/frontend-server-state.md`](_docs/architecture/frontend-server-state.md)
- [`_docs/architecture/frontend-overlays.md`](_docs/architecture/frontend-overlays.md)
- [`_docs/architecture/shared-contracts.md`](_docs/architecture/shared-contracts.md)
- ADR: [`_docs/decisions/frontend-foundations.md`](_docs/decisions/frontend-foundations.md)

### バックエンド（`backend/`）

| 種別 | 技術 |
|------|------|
| フレームワーク | Laravel `^13` |
| 言語 | PHP `^8.3` |
| DB | PostgreSQL（`DB_CONNECTION=pgsql`） |
| 認証 | Cognito ID トークン検証（`firebase/php-jwt`） |
| WebSocket | Laravel Reverb |
| キュー（ローカル既定） | `database` |
| 入力検証 | FormRequest（代表エンドポイント）＋ `FieldLengthLimits` |

`predis` は依存関係に含まれます。既定の Reverb（`REVERB_SCALING_ENABLED=false`）では Redis は不要です。色・文字数の正本はリポジトリ直下の `shared/`（[`_docs/architecture/shared-contracts.md`](_docs/architecture/shared-contracts.md)）。

### 認証

API ルートは `cognito` ミドルウェア配下です（[`backend/routes/api.php`](backend/routes/api.php)）。

**JWT はブラウザに保存しません。** 認可コードフロー（PKCE）をバックエンドで完結させ、
トークンはサーバー側セッションにのみ保持し、ブラウザへ渡すのは HttpOnly のセッション Cookie だけです。

#### 本番・ステージング

1. フロントが `GET /api/auth/login?next=...` へ遷移し、バックエンドが `state` と PKCE verifier をセッションに保存して Cognito Hosted UI へリダイレクト
2. Cognito が `GET /api/auth/callback` へコールバック。バックエンドが `state` を検証し、認可コードをトークンへ交換
3. IDトークンの署名・`iss`・`aud`・`token_use=id`・有効期限をJWKSで検証してユーザーを同期し、セッションIDを再生成してCookieを発行
4. 以降の API はセッション Cookie で認証。更新系リクエストは `X-XSRF-TOKEN` ヘッダーによる CSRF 検証を通す
5. トークン更新時も新しいIDトークンを同様に再検証し、失敗時はセッションを破棄
6. ログアウト時はCognitoの`/oauth2/revoke`でRefresh Tokenを失効させてからローカルセッションを破棄
7. ユーザー情報は `GET /api/auth/session` / `GET /api/me` から取得（フロントで JWT をデコードしない）

ユーザー同期（`CognitoJwtService::syncUserFromClaims`）:

- ID トークンの `email_verified` が真でない場合は同期を拒否する
- メール一致で既存ユーザーを探すが、**別の `cognito_sub` が既に紐付いている場合は上書きしない**
- ログイン後の `next` / リダイレクト先は同一オリジンの相対パスのみ許可（`//evil` 等を拒否）

`COGNITO_REDIRECT_URI` は **ブラウザから見た URL**（フロントのオリジン配下の `/api/auth/callback`）を指定し、
同じ値を Cognito アプリクライアントの「許可されているコールバック URL」にも登録してください。

| エンドポイント | 用途 |
|----------------|------|
| `GET /api/auth/login` | Hosted UI へのリダイレクト開始 |
| `GET /api/auth/callback` | 認可コードの受け取りとセッション確立 |
| `POST /api/auth/logout` | セッション破棄と Hosted UI ログアウト URL の取得 |
| `GET /api/auth/session` | 認証状態とユーザー情報（未認証でも 200） |
| `GET /api/auth/csrf-cookie` | `XSRF-TOKEN` Cookie の発行 |
| `POST /api/auth/register` | 組織未所属のアカウント作成（作成後は Cognito ログインが必要） |
| `GET /api/me/current-organization` | ログイン後の利用組織を解決（`last_organization_id` 更新） |
| `PUT /api/me/current-organization` | 組織切替（所属メンバーのみ。`last_organization_id` 更新） |

ログイン後の既定リダイレクトは `/post-login`（`COGNITO_DEFAULT_REDIRECT_PATH`）。

本番環境（`APP_ENV=production`）では起動時に以下を検証し、違反があれば起動を停止します。

- `SESSION_ENCRYPT=true`、`SESSION_SECURE_COOKIE=true`、`SESSION_HTTP_ONLY=true`
- `APP_DEBUG=false`
- `SESSION_SAME_SITE=lax`または`none`（`strict`はCognitoからのコールバックでCookieが送られないため不可）
- `SESSION_DRIVER`がサーバー側ストレージ（`cookie` / `array`は不可）
- `COGNITO_BYPASS=false`
- Cognitoの必須設定がすべて存在し、`COGNITO_AUDIENCE=COGNITO_CLIENT_ID`
- `APP_URL`、CORS許可オリジン、Cognito・コールバック・フロントエンドのURLがすべてHTTPS
- 招待メールは Amazon SES（`MAIL_MAILER=ses` または `ses-v2`）。`MAIL_FROM_ADDRESS` はプレースホルダ以外の検証済みアドレス。`AWS_DEFAULT_REGION` 必須（認証は IAM ロールまたはアクセスキー）

#### ローカル（バイパス）

`.env`:

```env
COGNITO_BYPASS=true
COGNITO_BYPASS_USER_ID=1
```

- `COGNITO_BYPASS_USER_ID` は **必須**。ブラウザは Cookie 認証のみで `Authorization` ヘッダを送らないため、未設定だとログイン状態にならず `/login` から先へ進めません
- `curl` などから直接叩く場合に限り、Bearer に **数値のユーザー ID** を載せる方法も使えます
- Cognito 実体がなくても API を検証できます

組織コンテキスト付き API は `orgs/{organization}` 配下で、`org.member` ミドルウェアにより所属チェックされます。

#### ユーザー招待

1. 組織管理者が設定画面の「ユーザー招待」からメールアドレスとロールを指定して送信
2. サーバーが `organization_invites` を作成し、`/invite/{token}` へのリンク付きメールを送る（有効期限は既定 7 日）
3. **新規ユーザー**: 名前・パスワードを入力して登録。Cognito / `users` / `memberships` を作成し、招待組織を `last_organization_id` に設定。その後 Cognito ログイン
4. **既存ユーザー**: 自動ログインせず、ログイン後に参加確認を経てから `memberships` へ登録。招待メールとログイン中アカウントのメールが一致する場合のみ参加可能
5. 使用済みトークンへ再アクセスすると「この招待は使用済みです」を表示（ワンタイム）

| 環境変数 | 用途 |
|----------|------|
| `ORGANIZATION_INVITE_EXPIRES_DAYS` | 招待リンクの有効日数（既定 7） |
| `COGNITO_USER_POOL_ID` / `COGNITO_REGION` | AdminCreateUser による登録（AWS 認証情報も必要）。未設定時は Client SignUp API |
| `MAIL_*` | 招待メール送信。ローカル既定は `log`。**本番は Amazon SES**（`MAIL_MAILER=ses`） |

DB には平文トークンを保存せず、SHA-256 ハッシュを `organization_invites.token` に格納します。

組織の**最後の管理者**はロール変更・削除できません（並行操作でも `lockForUpdate` でガード）。自分自身のメンバー削除は API で拒否され、設定画面でも自分自身の編集・削除ボタンは出しません。

### リアルタイム同期

| レイヤー | 技術 | 役割 |
|----------|------|------|
| WebSocket サーバー | Laravel Reverb | 購読クライアントへ push |
| クライアント | Laravel Echo | チャンネル購読 |

ボード（`WorkspaceBoard`）と WBS（`WorkspaceWbsView`）向けに、リスト／タスクの作成・更新・並び替え・アーカイブ等を配信します。WBS の親子・並び替えは `WbsTasksReordered` でも同期します。コメント・リアクション・資料・通知などはリアルタイム対象外です。

ローカルで Reverb を起動しない場合、ボード／WBS のリアルタイム反映は動きませんが REST API 自体は利用できます（`APP_ENV=local` では `BROADCAST_FAIL_SILENTLY` 既定が有効）。

方針メモ: [`_docs/decisions/realtime-sync.md`](_docs/decisions/realtime-sync.md)

### ファイル保存

| 種別 | ディスク | 公開方法 | 制限 |
|------|----------|----------|------|
| タスク添付 | `local`（コントローラで固定） | 認証付き `GET …/attachments/{id}/download` のみ | 最大 10MB。拡張子: pdf / txt / csv / md / png / jpg / jpeg / gif / webp / doc(x) / xls(x) / ppt(x) / zip |
| アバター | `public` | `php artisan storage:link` 後の `/storage/avatars/…` | 画像のみ・最大 2MB |

- 新規のタスク添付は **`/storage/...` 直リンクでは取得できません**
- 移行前に `public` へ置かれた添付があっても、download API が `local` → `public` の順で解決します
- 資料／タスク説明の Markdown 閲覧表示は許可リスト型の HTML サニタイズを通します

---

## 構成

### システム構成

```
[ Browser ]
    │  HTTP (REST)                    WebSocket
    ▼                                 ▼
[ Nuxt :3000 ] ──proxy /api,/storage──▶ [ Laravel :8000 ] ──SQL──▶ [ PostgreSQL ]
                                    │
                                    │ broadcast (BROADCAST_CONNECTION=reverb)
                                    ▼
                               [ Reverb :8080 ] ──push──▶ [ Echo (他クライアント) ]
```

- **書き込み**: ブラウザ → REST API → PostgreSQL（Echo / Reverb は介在しない）
- **配信（ボード／WBS）**: DB 更新後にイベント発火 → Reverb → 購読中クライアントへ push

設計メモは [`_docs/architecture/realtime-sync.md`](_docs/architecture/realtime-sync.md) にもあります（構成図が古い場合は本 README とコードを優先）。

### リポジトリ構成

```
work-manager/
├── README.md                 # 本ファイル
├── shared/                   # FE/BE 共有契約（色・文字数・既定マスタ）
├── _docs/                    # 設計・要件・意思決定ログ
│   ├── architecture/
│   ├── database/
│   ├── decisions/
│   └── requirements/
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

---

## セットアップ

### 前提環境

| ツール | 目安 |
|--------|------|
| PHP | 8.3 以上 |
| Composer | 2.x |
| Node.js | 22.12 以上（`frontend/.nvmrc`） |
| npm | package-lock 利用想定 |
| PostgreSQL | `DB_CONNECTION=pgsql` で接続できること |

任意:

- Amazon Cognito ユーザープール（本番・ステージング）
- Redis（Reverb のスケーリング有効時など）

### ローカル環境の構築

#### 1. リポジトリ取得

```bash
git clone <repository-url> work-manager
cd work-manager
```

#### 2. バックエンド

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
- Reverb を使う場合: `REVERB_*`（フロントの `NUXT_PUBLIC_REVERB_*` と一致）

DB 作成例:

```bash
createdb task_manager   # .env の DB_DATABASE に合わせる
php artisan migrate
# アバター用の public ディスクを公開（初回のみ）
php artisan storage:link
# 必要なら
php artisan db:seed
```

タスク添付は `local` ディスクに保存するため、`storage:link` は**アバター表示用**です。添付は認証付き download API 経由でのみ取得します。

#### 3. フロントエンド

```bash
cd frontend
cp .env.example .env
npm install
```

ローカルでは `NUXT_PUBLIC_API_BASE_URL` は未設定で構いません（相対 `/api` → Vite プロキシ）。  
Reverb を使う場合は `NUXT_PUBLIC_REVERB_*` を backend の値に合わせてください。

### 環境変数

#### バックエンド（`backend/.env`）

| 変数 | 説明 |
|------|------|
| `APP_KEY` | `php artisan key:generate` で生成 |
| `DB_*` | PostgreSQL 接続 |
| `FRONTEND_URL` / `CORS_ALLOWED_ORIGINS` | フロントオリジン（カンマ区切り可） |
| `BROADCAST_CONNECTION` | 既定 `reverb` |
| `REVERB_APP_ID` / `KEY` / `SECRET` / `HOST` / `PORT` / `SCHEME` | WebSocket サーバー設定 |
| `QUEUE_CONNECTION` | ローカル既定 `database` |
| `FILESYSTEM_DISK` | 既定 `local` |
| `MAIL_*` | 招待メール。ローカル既定は `log`。本番は `MAIL_MAILER=ses` と SES 検証済みの `MAIL_FROM_ADDRESS` が必須 |
| `AWS_DEFAULT_REGION` | SES（および Cognito Admin / S3 等）のリージョン。本番 SES で必須 |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | SES をキー方式で使う場合。IAM タスクロールなら不要 |
| `COGNITO_JWKS_URL` / `ISSUER` / `AUDIENCE` | JWT検証。すべて必須で、`AUDIENCE`は`CLIENT_ID`と一致させる |
| `COGNITO_DOMAIN` / `CLIENT_ID` / `CLIENT_SECRET` | Hosted UI と認可コードフロー（シークレットは任意） |
| `COGNITO_REDIRECT_URI` / `LOGOUT_REDIRECT_URI` | ブラウザから見たコールバック URL・ログアウト後の戻り先 |
| `COGNITO_FRONTEND_URL` / `COGNITO_DEFAULT_REDIRECT_PATH` | ログイン後の戻り先（相対パスに限定。既定 `/post-login`） |
| `SESSION_ENCRYPT` | トークンを含むサーバー側セッションを暗号化。常に`true` |
| `SESSION_HTTP_ONLY` / `SESSION_SAME_SITE` / `SESSION_SECURE_COOKIE` | 認証Cookieの保護。本番は`true` / `lax` / `true`を推奨 |
| `COGNITO_BYPASS` | ローカルのみ `true` 可 |
| `COGNITO_BYPASS_USER_ID` | バイパス時の既定ユーザー ID |

詳細コメントは [`backend/.env.example`](backend/.env.example) を参照してください。

#### フロントエンド（`frontend/.env`）

| 変数 | 説明 |
|------|------|
| `NUXT_PUBLIC_API_BASE_URL` | 本番では絶対 URL（例: `https://api.example.com/api`）。ローカルは省略可 |
| `NUXT_PUBLIC_REVERB_KEY` / `HOST` / `PORT` / `SCHEME` | Echo 接続先（backend と一致） |

Cognito の設定（`client_id` / `redirect_uri` 等）はバックエンドのみが保持します。

詳細は [`frontend/.env.example`](frontend/.env.example) および [`frontend/nuxt.config.ts`](frontend/nuxt.config.ts) を参照してください。

### 開発サーバーの起動

ターミナルを分けて起動する想定です。

```bash
# 1) API
cd backend
php artisan serve
# → http://127.0.0.1:8000

# 2) キュー（ジョブを使う場合）
cd backend
php artisan queue:listen --tries=1

# 3) Reverb（ボード／WBS のリアルタイム反映）
cd backend
php artisan reverb:start
# → 既定 :8080

# 4) フロント
cd frontend
npm run dev
# → http://localhost:3000
```

`composer.json` の `composer run dev` は Laravel 標準の concurrently 構成です。本アプリのフロントは `frontend/` の Nuxt なので、通常は **API と Nuxt を別プロセス**で起動してください。

| サービス | URL（ローカル既定） |
|----------|---------------------|
| フロント | http://localhost:3000 |
| API | http://127.0.0.1:8000 |
| Reverb | ws://127.0.0.1:8080 |

---

## ドメインモデルとロール

### 主要な概念

```
Organization
  ├── Membership（ユーザー × 組織ロール: admin / member）
  ├── OrganizationInvite
  ├── Workspace（スペース。設計書では project、コードでは workspace）
  │     ├── List（ボード列）
  │     ├── Task（コメント・チェックリスト・ラベル・添付ファイル等）
  │     ├── SharedDocument（資料。スペース配下・アーカイブ）
  │     └── Assignees 等
  ├── Labels（スペース / タスク / 資料用のカテゴリ＋ラベル）
  └── AppNotification（ユーザー向けアプリ内通知）
```

### 組織ロール（実装）

| 値 | 意味 |
|----|------|
| `admin` | 組織管理者 |
| `member` | メンバー |

実装の正は [`MembershipRole`](backend/app/Enums/MembershipRole.php) です。設計書（[`_docs/database/enums.md`](_docs/database/enums.md)）の `project_leader` は現行の組織ロールでは未使用です。

組織メンバーであれば、その組織のスペースへアクセス・編集できます。

### タスクの状態・優先度

- **status**: `todo` / `in_progress` / `done`
- **priority**: `low` / `medium`（既定）/ `high`

## 主な画面・API

### フロント画面（例）

| パス | 内容 |
|------|------|
| `/login` | ログイン（Cognito コールバックはバックエンドの `/api/auth/callback` が処理） |
| `/register` | アカウント作成（組織とは分離） |
| `/organizations/new` | 組織作成（所属 0 件のとき。作成者が管理者） |
| `/post-login` | ログイン後の組織決定・遷移 |
| `/invite/[token]` | 招待確認・新規登録／既存ユーザーの参加確認 |
| `/org/[slug]` | 組織ホーム（スペース一覧へリダイレクト） |
| `/org/[slug]/workspaces` | スペース一覧 |
| `/org/[slug]/workspaces/[id]` | スペース詳細（ボード／WBS・ガント） |
| `/org/[slug]/workspaces/[id]/documents/[documentId]` | 資料詳細 |
| `/org/[slug]/documents` | スペース一覧へリダイレクト |
| `/org/[slug]/documents/[id]` | 旧資料 URL（正規パスへリダイレクト） |
| `/org/[slug]/settings` | 組織設定（`?tab=members` でユーザー招待） |

### API（抜粋）

認証必須（招待確認・受諾とアカウント作成を除く）。プレフィックスは `/api`。

- `GET/PATCH /me`・`POST/DELETE /me/avatar` … プロフィール／アバター
- `GET /me/current-organization` / `PUT /me/current-organization` … 利用組織の解決・切替
- `GET /notifications` / `PATCH …/read` / `POST …/read-all` … 通知
- `POST /auth/register` … アカウント作成（組織未所属）
- `POST /organizations` … 組織作成（作成者を admin として所属付け、`last_organization_id` 更新）
- `GET /orgs/{organization}/members` / `PATCH|DELETE …/members/{member}` / `settings`
- `GET/POST /orgs/{organization}/invites` / `DELETE …/invites/{invite}` … 招待（管理者）
- `GET /invites/{token}` / `POST /invites/{token}/accept` … 招待確認・受諾（既存 Cognito ユーザーはセッション必須）
- `CRUD /orgs/{organization}/workspaces`（`archived`・`archive`・`unarchive` 含む。メンバー一覧 GET は担当者候補用）
- `CRUD /orgs/{organization}/workspaces/{workspace}/documents`（一覧・作成・アーカイブ一覧）＋ `/documents/{id}`（詳細・更新・archive/unarchive・削除）
- ラベル類: `workspace-labels` / `task-labels`（＋ categories）
- スペース配下: `lists` / `tasks` / `comments` / `reactions` / `attachments`（download 含む） / `tasks/wbs` など

完全なルート一覧は [`backend/routes/api.php`](backend/routes/api.php) を参照してください。

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

シード後の主なダミーデータ（[`DummySeederData`](backend/database/seeders/DummySeederData.php)）:

| 項目 | 値 |
|------|-----|
| 組織 slug | `abcde` |
| ユーザー | `a@example.com` …（名前 A〜T）。パスワードはいずれも `password` |
| スペース例 | 「WorkMana」など |

ローカルバイパス用ユーザー ID はシード後の実 ID に合わせて `COGNITO_BYPASS_USER_ID` を設定してください（例: ユーザー A の ID）。
フロントの初期導線は `/org/abcde/workspaces` などシードの slug に合わせると便利です。

## テスト

```bash
cd backend
php artisan test
# または
composer test
```

## ドキュメント

設計・仕様の入口: [`_docs/README.md`](_docs/README.md)

| 領域 | パス |
|------|------|
| 要件（認証・招待） | [`_docs/requirements/auth.md`](_docs/requirements/auth.md) |
| 要件（プロジェクト／リスト） | [`_docs/requirements/projects.md`](_docs/requirements/projects.md) |
| 要件（タスク） | [`_docs/requirements/tasks.md`](_docs/requirements/tasks.md) |
| 列挙値 | [`_docs/database/enums.md`](_docs/database/enums.md) |
| スキーマ（認証・組織） | [`_docs/database/schema-auth.md`](_docs/database/schema-auth.md) |
| 機能仕様（通知など） | [`_docs/features/notification.md`](_docs/features/notification.md) |
| リアルタイム構成 | [`_docs/architecture/realtime-sync.md`](_docs/architecture/realtime-sync.md) |
| サーバー状態キャッシュ | [`_docs/architecture/frontend-server-state.md`](_docs/architecture/frontend-server-state.md) |
| オーバーレイ UI | [`_docs/architecture/frontend-overlays.md`](_docs/architecture/frontend-overlays.md) |
| FE/BE 共有契約 | [`_docs/architecture/shared-contracts.md`](_docs/architecture/shared-contracts.md) |
| ADR（Reverb 採用） | [`_docs/decisions/realtime-sync.md`](_docs/decisions/realtime-sync.md) |
| ADR（フロント基盤） | [`_docs/decisions/frontend-foundations.md`](_docs/decisions/frontend-foundations.md) |

一部ディレクトリ（`api` / `permissions` / `ui` 等）は索引のみで中身が未整備の場合があります。実装の正はコードとマイグレーションを優先してください。

## UI メモ

- アイコンは **Lucide Icons**（`lucide-vue-next`）を使用しています。
- フォントは Inter / Noto Sans JP / Source Sans 3（`@fontsource/*`、`frontend/app/assets/styles/fonts.css`）を利用しています。

## ライセンス

バックエンドの Laravel スケルトン由来の表記は MIT です。リポジトリ全体のライセンス方針が別途ある場合はそちらに従ってください。
