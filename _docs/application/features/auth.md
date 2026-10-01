# 認証・セッション（Auth）

## 概要

認証は **Amazon Cognito Hosted UI（Authorization Code + PKCE）** を Laravel バックエンドが仲介する。ブラウザは JWT を保持せず、**HttpOnly セッション Cookie** のみを使う。Cognito トークンはサーバ側セッション（`CognitoSession`）に格納する。

アカウント作成は `POST /api/auth/register`（Cognito ユーザー + ローカル `users`）。ログインは Hosted UI 経由でセッションを確立する。

## 本書の範囲

- ログイン／登録／コールバック／ログアウト／セッション／CSRF
- ローカル開発用バイパス

対象外:

- 組織作成・招待受諾後の遷移先決定の詳細 → [organization.md](./organization.md)
- プロフィール編集 → [profile.md](./profile.md)

関連: [`../../database/schema-auth.md`](../../database/schema-auth.md)

---

## 全体フロー

### ログイン

```
[ /login ] → GET /api/auth/login?next=
        → Cognito Hosted UI
        → GET /api/auth/callback（code 交換・JWT 検証・ユーザー同期・セッション再生成）
        → フロント next（既定 /post-login）
        → 組織解決 → スペース一覧等
```

### 登録

```
[ /register ] → POST /api/auth/register
        → Cognito AdminCreateUser + users 行作成
        → ユーザーは別途 Cognito ログインが必要（この API ではセッションを張らない）
```

---

## データモデル

| 対象 | 要点 |
| --- | --- |
| `users` | `name`, `email`（正規化・unique）, `cognito_sub`, `email_verified_at`, `avatar_path`, `last_organization_id` |
| `sessions` | Laravel セッション |

パスワードは Cognito のみ。ローカル `password` / `remember_token` / `password_reset_tokens` は削除済み。

スキーマ詳細は [`../../database/schema-auth.md`](../../database/schema-auth.md)（実装差分: `avatar_path` / `last_organization_id` / `cognito_sub` 等）。

---

## API 要約

プレフィックス `/api`。認証不要（公開）。

| Method | Path | 説明 |
| --- | --- | --- |
| `GET` | `/auth/csrf-cookie` | XSRF-TOKEN 発行 |
| `GET` | `/auth/session` | 認証状態＋ユーザー（未ログインでも 200） |
| `GET` | `/auth/login?next=` | Hosted UI 開始（state / PKCE をセッションへ） |
| `GET` | `/auth/callback` | code 交換・ユーザー同期・フロントへリダイレクト |
| `POST` | `/auth/logout` | セッション破棄。レスポンスに Cognito `logout_url` |
| `POST` | `/auth/register` | Cognito + ローカルユーザー作成。セッションは張らない。レート制限は掛かっていない |

保護 API は `cognito` ミドルウェア。未認証は 401。

### 開発用バイパス

`COGNITO_BYPASS` 有効時、`CognitoSessionAuthenticator` が Cognito なしでユーザーを解決できる。

---

## フロント

| パス / 部品 | 役割 |
| --- | --- |
| `/login` | Cognito ログイン開始。`?next=` / `sessionStorage tm:pending_invite` |
| `/register` | 氏名・メール・パスワード登録 |
| `/post-login` | ログイン後の組織解決・遷移 |
| `useAuth.ts` | セッション取得・ログアウト等 |
| `auth.global.ts` | `/org/*`, `/post-login`, `/organizations/*` で要ログイン |

---

## 振る舞い・ルール

- コールバック時、Cognito の `email_verified` が偽なら拒否（`CognitoJwtService`）
- アプリ側で `users.email_verified_at === null` による組織 API 制限は**していない**
- パスワード再設定・失敗ロックアウト・認証監査ログはアプリ未実装（Cognito 側に委ねる部分あり）

---

## 主要ファイル

| 役割 | パス |
| --- | --- |
| ルート | `backend/routes/api.php` |
| コントローラ | `backend/app/Http/Controllers/Api/Auth/AuthController.php` |
| ミドルウェア | `backend/app/Http/Middleware/AuthenticateCognito.php` |
| サービス | `CognitoOAuthService`, `CognitoJwtService`, `CognitoSessionAuthenticator`, `CognitoUserRegistrationService`, `UserRegistrationService` |
| 設定 | `backend/config/cognito.php` |
| フロント | `frontend/app/pages/login.vue`, `register.vue`, `post-login.vue` |
