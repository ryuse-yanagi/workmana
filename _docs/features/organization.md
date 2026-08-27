# 組織・メンバー・招待（Organization）

## 概要

マルチテナントの単位が **Organization（組織）**。URL は `/org/{slug}/…`。認証済みユーザーは組織を作成でき、作成者は **admin** になる。組織配下 API は `/api/orgs/{organization}`（id または slug）＋ `org.member` ミドルウェア。

メンバーロールは **`admin` / `member` のみ**（要件書の `project_leader` は未使用）。招待はメール＋ロールで発行し、`/invite/{plainToken}` で受諾する。

用語: 画面の「スペース」＝ `workspace`。組織メンバーであれば当該組織の全スペースにアクセスできる（スペース単位の membership は廃止済み）。

## 本書の範囲

- 組織作成、メンバー管理、招待、現在組織の切替

対象外:

- 認証セッション自体 → [auth.md](./auth.md)
- 組織の既定マスタ・ラベル設定 → [organization-settings.md](./organization-settings.md)
- プロフィール → [profile.md](./profile.md)

関連: [`../requirements/auth.md`](../requirements/auth.md)、[`../database/schema-auth.md`](../database/schema-auth.md)

---

## 全体フロー

```mermaid
flowchart TD
  A[ログイン済ユーザー] --> B{所属組織数}
  B -->|0| C[/organizations/new]
  C --> D[POST /organizations]
  D --> E[作成者を admin に所属]
  E --> F[/org/slug/workspaces]
  B -->|1+| G[last_organization_id または先頭]
  G --> F
  H[管理者が招待発行] --> I[メール /invite/token]
  I --> J{既存 Cognito ユーザー?}
  J -->|新規| K[accept: name+password]
  J -->|既存| L[ログイン後 accept]
  K --> M[membership 追加]
  L --> M
```

---

## データモデル

| テーブル | 要点 |
| --- | --- |
| `organizations` | `name`, `slug`（unique）, `default_*_names` JSON, `created_by` |
| `memberships` | PK `(user_id, organization_id)`, `role`（admin\|member） |
| `organization_invites` | `email`, `role`, `token`（平文の SHA-256）, `expires_at`, `used_at`。取消は行削除 |

招待 TTL 既定 **7 日**（`config/invites.php`）。レガシー `invites` マイグレーションは存在するが、実行時は `organization_invites` のみ。

### 招待メール送信

- アプリは Laravel Mail（`OrganizationInviteMail`）経由で送信する。
- **本番は Amazon SES 前提**（`MAIL_MAILER=ses`）。起動時に `AppServiceProvider` が検証する。
- 必要な環境変数: `MAIL_MAILER=ses`、`MAIL_FROM_ADDRESS`（SES 検証済み）、`AWS_DEFAULT_REGION`。認証は IAM タスクロール推奨（キー方式なら `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`）。
- ローカルは `MAIL_MAILER=log` で実送信せずログ出力のみ。

---

## API 要約

| Method | Path | 権限 | 説明 |
| --- | --- | --- | --- |
| `POST` | `/organizations` | 認証済 | 組織作成。作成者を admin、`last_organization_id` 更新 |
| `GET` | `/orgs/{org}/members` | メンバー | メンバー一覧 |
| `PATCH` | `/orgs/{org}/members/{member}` | admin | ロール変更 |
| `DELETE` | `/orgs/{org}/members/{member}` | admin | メンバー削除（担当者クリーンアップ含む） |
| `GET/POST` | `/orgs/{org}/invites` | admin | 招待一覧／発行（再送時はトークン再発行・期限更新） |
| `DELETE` | `/orgs/{org}/invites/{invite}` | admin | 招待取消（削除） |
| `GET` | `/invites/{token}` | 公開 | 招待プレビュー |
| `POST` | `/invites/{token}/accept` | 公開／要セッション | 新規は name+password、既存はログイン必須・メール一致 |
| `GET/PUT` | `/me/current-organization` | 認証済 | 現在組織の解決／切替 |

---

## 振る舞い・ルール

- 最終 admin の降格・削除は不可
- メンバーの自己削除不可
- 招待メールと受諾ユーザーのメールは一致必須。既メンバーなら受諾は冪等成功
- 組織コンテキスト: ルーティングは URL slug が正。API は path の org への membership を見る（`last_organization_id` と path の一致は必須ではない）
- スペース／タスク等の編集可否は「当該組織のメンバー」＝アクセス可（[workspaces.md](./workspaces.md)）

---

## フロント

| 画面 / 部品 | 役割 |
| --- | --- |
| `/organizations/new` | 組織作成 |
| `/invite/[token]` | 招待確認・新規登録／既存ユーザー確認 |
| `/org/[slug]/settings?tab=members` | メンバー・招待（`SettingsMembersPanel`, `UserInviteModal`） |
| `AppGlobalHeader` | 組織切替 → `PUT /me/current-organization` → `/org/{slug}/workspaces` |
| `/post-login` | 0 組織なら作成画面、否则 スペース一覧 |

---

## 要件との差分

| 要件 | 実装 |
| --- | --- |
| `project_leader` / `project_memberships` | なし。組織ロール admin/member のみ |
| 招待テーブル `invites` + `revoked_at` | `organization_invites`、取消は DELETE |
| 招待期限 24h | 既定 7 日（設定可） |
| 招待・メンバー変更の監査ログ | なし |

---

## 主要ファイル

| 役割 | パス |
| --- | --- |
| コントローラ | `OrganizationController`, `OrganizationInviteController`, `InviteAcceptController`, `MeController`（切替） |
| サービス | `OrganizationInviteService`, `OrganizationMemberService`, `OrganizationContextService` |
| ミドルウェア | `EnsureOrganizationMember` |
| メール | `OrganizationInviteMail` |
| フロント | `organizations/new.vue`, `invite/[token].vue`, `SettingsMembersPanel.vue`, `AppGlobalHeader.vue` |
