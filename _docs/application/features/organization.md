# 組織・ユーザー・招待（Organization）

## 概要

マルチテナントの単位が **Organization（組織）**。URL は `/org/{slug}/…`。認証済みユーザーは組織を作成でき、作成者は **admin** になる。組織配下 API は `/api/orgs/{organization}`（`organization` は slug）＋ `org.member` ミドルウェア。

ユーザーロールは **`admin` / `member` のみ**。招待はメール＋ロールで発行し、`/invite/{plainToken}` で受諾する。

用語: 画面の「スペース」＝ `workspace`。組織への所属は入口で、スペースと資料の見え方は別判定（[`../../architecture/auth/authorization.md`](../../architecture/auth/authorization.md)）。

## 本書の範囲

- 組織作成、ユーザー管理、招待、現在組織の切替

対象外:

- 認証セッション自体 → [auth.md](./auth.md)
- 組織の既定マスタ・ラベル設定 → [organization-settings.md](./organization-settings.md)
- プロフィール → [profile.md](./profile.md)

関連: [`../../database/schema-auth.md`](../../database/schema-auth.md)

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
  I --> J{ログイン済み?}
  J -->|いいえ| K[Cognito Hosted UI でログインまたは登録]
  K --> L[招待ページへ戻る]
  J -->|はい| L
  L --> M{メール一致?}
  M -->|はい| N[参加する]
  M -->|いいえ| O[招待先で再ログイン]
  N --> P[membership 追加]
```

---

## データモデル

| テーブル | 要点 |
| --- | --- |
| `organizations` | `name`, `slug`（unique）, `default_*_names` JSON, `created_by` |
| `memberships` | PK `(user_id, organization_id)`, `role`（admin\|member） |
| `organization_invites` | `email`, `role`, `token`（平文の SHA-256）, `expires_at`, `used_at`。取消は行削除 |

招待 TTL 既定 **7 日**（`config/invites.php`）。招待のテーブルは `organization_invites` だけ。

### 招待メール送信

- アプリは Laravel Mail（`OrganizationInviteMail`）経由で送信する。
- **本番は Amazon SES 前提**（`MAIL_MAILER=ses` または `ses-v2`）。起動時に `AppServiceProvider` が `ProductionConfigValidator` で検証する。
- 起動を止めるもの: `MAIL_MAILER` が `ses` / `ses-v2` 以外、`MAIL_FROM_ADDRESS` が空または `hello@example.com`。認証は IAM タスクロール推奨（キー方式なら `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`）。
- `AWS_DEFAULT_REGION` が未設定でも起動は止まらない。SES の region は `config/services.php` が `ap-northeast-1` を入れる。S3 ディスクの region にはその既定がない。
- ローカルは `MAIL_MAILER=log` で実送信せずログ出力のみ。

---

## API 要約

| Method | Path | 権限 | 説明 |
| --- | --- | --- | --- |
| `POST` | `/organizations` | 認証済 | 組織作成。作成者を admin、`last_organization_id` 更新 |
| `GET` | `/orgs/{org}/members` | ユーザー | ユーザー一覧 |
| `PATCH` | `/orgs/{org}/members/{member}` | admin | ロール変更 |
| `DELETE` | `/orgs/{org}/members/{member}` | admin | ユーザー削除（担当者クリーンアップ含む） |
| `GET/POST` | `/orgs/{org}/invites` | admin | 招待一覧／発行（再送時はトークン再発行・期限更新） |
| `DELETE` | `/orgs/{org}/invites/{invite}` | admin | 招待取消（削除） |
| `GET` | `/invites/{token}` | 公開 | 招待プレビュー |
| `POST` | `/invites/{token}/accept` | 要セッション | ログイン中メールが招待先と一致するときだけ membership を追加。未ログインは 401。パスワードでは参加できない |
| `GET/PUT` | `/me/current-organization` | 認証済 | 現在組織の解決／切替 |
| `DELETE` | `/orgs/{org}` | admin | 組織を削除。配下のスペース・タスク・資料・ラベル・招待・メンバーシップも消える。その組織宛の通知も消す。`last_organization_id` が削除対象なら、残りの所属のうち id が小さい組織へ移し、所属が無ければ null |

---

## 振る舞い・ルール

- 組織コード（`slug`）は作成時にサーバーが発行する 16 文字のランダムコード。名前からは作らず、リクエストで指定しても使わない。`organizations.slug` の UNIQUE と衝突時の再試行で一意。作成後は変更しない。既存行のコードはそのまま。ローカルシーダーのデモ組織も同じ形式で、再シード時に固定コード（`abcde` など）ならランダムへ置き換える
- 最終 admin の降格・削除は不可。組織そのものの削除は、残ユーザーがいても admin ならできる
- ユーザーの自己削除不可
- 組織削除の行変更（スペース・タスク・資料・所属・通知・現在組織の付け替えを含む）は一つのトランザクションで確定する。途中で失敗した場合はすべて元に戻る。アーカイブ済み・論理削除済みのスペースも対象。アイコンと添付などのファイルは行削除の確定後に消す
- アカウント作成とパスワードは Cognito Hosted UI だけ。招待ページは名前もパスワードも受け取らない。未ログインは `GET /api/auth/login?next=/invite/{token}&login_hint={email}` へ進み、コールバックで `users` を同期して同じ招待 URL へ戻る
- 招待メールと受諾ユーザーのメールは一致必須。違うメールでログイン中なら 422。既ユーザーなら受諾は冪等成功
- 組織コンテキスト: ルーティングは URL slug が正。API は path の org への membership を見る（`last_organization_id` と path の一致は必須ではない）
- 組織ユーザーは組織内の全スペースと全資料を開ける。編集もできる。アーカイブ操作は管理者のみ（[workspaces.md](./workspaces.md)、[documents.md](./documents.md)）
- ユーザーと招待の変更は組織チャンネルの `member.*` / `invite.*`。組織の削除は `organization.deleted`。削除した画面以外でその組織を開いているクライアントは、残りの所属のスペース一覧へ、所属が無ければ組織作成画面へ移る（[`../../architecture/realtime/sync.md`](../../architecture/realtime/sync.md)）

---

## フロント

| 画面 / 部品 | 役割 |
| --- | --- |
| `/organizations/new` | 組織作成。所属があるときはキャンセルで元の組織（`last_organization_id`、無ければ先頭）へ戻る |
| `/invite/[token]` | 招待確認。未ログインは Cognito でログインまたは登録し、戻ったあとメールが一致すれば参加してスペース一覧へ進む。ローカルバイパスで Cognito 未設定のときは `/login` を経由する |
| `/org/[slug]/settings?tab=organization` | 組織設定。admin のみ末尾に「組織を削除」。確認後に削除し、残りの所属があればそのスペース一覧、無ければ組織作成へ進む |
| `/org/[slug]/settings?tab=members` | ユーザー・招待（`SettingsMembersPanel`, `UserInviteModal`）。表示中は招待一覧とユーザー一覧を取り直すので、受諾後は「招待中」から管理者または一般ユーザーへ移る |
| `AppGlobalHeader` | 組織切替 → `PUT /me/current-organization` → `/org/{slug}/workspaces`。切替リスト末尾の「組織の作成」→ `/organizations/new` |
| `/post-login` | 0 組織なら作成画面、そうでなければスペース一覧 |

---

## 主要ファイル

| 役割 | パス |
| --- | --- |
| コントローラ | `OrganizationController`, `OrganizationInviteController`, `InviteAcceptController`, `MeController`（切替） |
| サービス | `OrganizationInviteService`, `OrganizationMemberService`, `OrganizationContextService` |
| ミドルウェア | `EnsureOrganizationMember` |
| メール | `OrganizationInviteMail` |
| フロント | `organizations/new.vue`, `invite/[token].vue`, `SettingsMembersPanel.vue`, `AppGlobalHeader.vue` |
