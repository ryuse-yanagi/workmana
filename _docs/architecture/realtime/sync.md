# リアルタイム同期

WorkMana は複数ユーザーが同じ組織とスペースを同時に操作することを想定しているため、サーバー側の変更を即時に各クライアントへ伝搬する仕組みを採用する。

用語: UI「スペース」＝コードの `workspace`。

## 採用技術

| レイヤー | 採用技術 | 役割 |
| --- | --- | --- |
| WebSocket サーバー | **Laravel Reverb** | 購読クライアントへイベントを push する。 |
| ブロードキャスト接続 | **`BROADCAST_CONNECTION=reverb`** | Laravel アプリから Reverb へイベントを渡すドライバ（HTTP / Pusher 互換 API）。単一ノードでは Redis を必須としない。 |
| クライアント | **Laravel Echo** + **pusher-js** | Nuxt / Vue で Reverb を購読。プライベートチャンネル認可も担当。 |

Redis は **Reverb 水平スケール**（`REVERB_SCALING_ENABLED`、既定 `false`）時のオプション。ローカル例のキュー／キャッシュは `database`（`QUEUE_CONNECTION` / `CACHE_STORE`）であり、ブロードキャスト経路とは独立。

本番のプロセス配置（同一タスクで API と Reverb を動かすか、分けて Redis で水平スケールするか）は [../cloud/](../cloud/) に書く。ここでは配信の論理だけを扱う。

意思決定の経緯は [`../../decisions/realtime-sync.md`](../../decisions/realtime-sync.md)。

## 全体フロー

「保存」と「配信」は別経路で並列に走る **2系統**。Echo / Reverb は **配信のための片道路** であり、ユーザーの書き込み操作自体はこれらを経由しない。

### ① 書き込みフロー（自分が操作したとき）

通常の REST API。Echo / Reverb は登場しない（レスポンスで自画面を更新する）。

```
[ Nuxt / Vue ]
      │ HTTP (REST API)  ※ X-Socket-ID 付き
      ▼
[ Laravel ]
      │ SQL
      ▼
[ PostgreSQL ]
```

### ② 配信フロー（他ユーザーの画面に変更を即時反映）

DB 更新後、コントローラが `SafeBroadcast::toOthers($event)` を呼び、Reverb 経由で他クライアントへ push する。

```
[ Laravel ]
      │ SafeBroadcast::toOthers ( ShouldBroadcastNow )
      │ → broadcast($event)->toOthers()
      ▼
[ Reverb (WebSocket サーバー) ]   ── BROADCAST_CONNECTION=reverb
      │ 該当チャンネル購読者へ push（送信元 socket は除外）
      ▼
[ Echo (購読中の "他" クライアント) ]
      │ コールバックで ref / 画面状態を更新
      ▼
[ Nuxt / Vue ]
```

### 合流イメージ

```
        ┌─ ユーザーA の操作 ───────────────────────────────┐
        │                                                 │
        │  Nuxt / Vue (A)                                 │
        │     │ HTTP (+ X-Socket-ID)                      │
        │     ▼                                           │
        │  Laravel ── SQL ──▶ PostgreSQL                  │
        │     │                                           │
        │     │ SafeBroadcast::toOthers(event)            │
        │     ▼                                           │
        │  Reverb (WebSocket)                             │
        │     │ push（A の socket は除外）                 │
        │     ▼                                           │
        │  Echo (購読クライアント = B, C, ... )           │
        │     │                                           │
        │     ▼                                           │
        │  Nuxt / Vue (B, C) ── 画面に即時反映            │
        │                                                 │
        └─────────────────────────────────────────────────┘
```

### 押さえておきたいポイント

- **書き込みは HTTP、配信は WebSocket** の二系統。Echo / Reverb は「保存」には介在しない。
- **Echo は基本的に受信専用**。サーバーからの push を受けて Vue の状態を更新する。
- **自分の操作の二重反映を避ける**ため、フロントは `X-Socket-ID` を API に付与し、サーバは `toOthers()` で配信する。
- イベントは **`ShouldBroadcastNow`**（同期ブロードキャスト。キュー経由の `ShouldBroadcast` ではない）。
- 配信失敗時: `SafeBroadcast` が `BroadcastException` を捕捉。`BROADCAST_FAIL_SILENTLY` が true（local 既定）ならログのみで HTTP は成功させる。
- DB は **PostgreSQL**（`DB_CONNECTION=pgsql`）。

## チャンネル設計（現行）

| チャンネル名 | 種類 | 認可 | 購読する画面 | 用途 |
| --- | --- | --- | --- | --- |
| `workspaces.{workspaceId}` | private | そのスペースを閲覧できるユーザー（`User::canAccessWorkspace`） | ボード／WBS | そのスペースのリスト・タスク・添付・担当者 |
| `organizations.{organizationId}` | private | その組織のユーザー（`User::isMemberOfOrganization`） | `/org/{slug}/…` を開いているあいだ | スペース、資料、組織設定、ユーザー、招待、ラベル、プロフィール |

- 認可定義: `backend/routes/channels.php`
- 認可 HTTP: `POST /api/broadcasting/auth`（`cognito` + Cookie セッション。Echo の `channelAuthorization.customHandler`）

個人宛てチャンネル（`users.*`）は未実装。アプリ内通知はポーリング（[../../application/features/notification.md](../../application/features/notification.md)）。

## 配信イベント（現行）

呼び出しは `SafeBroadcast::toOthers`。組織向けは `OrganizationBroadcast::send` が `OrganizationChanged` を送る。`broadcastAs` はクラス名（Echo 側は `.TaskUpdated` のように listen）。

### `workspaces.{workspaceId}`

| イベント | 主な発火元 |
| --- | --- |
| `ListCreated` / `ListUpdated` / `ListDeleted` / `ListsReordered` | `ListController` |
| `TasksReordered` | `ListController`（列内タスク並べ替え） |
| `TaskCreated` / `TaskUpdated` / `TaskArchived` / `TaskRestored` / `TaskDeleted` | `TaskController` |
| `WbsTasksReordered` | `TaskController`（WBS 並べ替え） |
| `TaskAttachmentAdded` / `TaskAttachmentRemoved` | `TaskAttachmentController` |
| `WorkspaceMembersUpdated` | `WorkspaceController`（スペース担当者の変更） |

補足:

- タスクの列移動は専用 `TaskMoved` ではなく **`TaskUpdated` + `TasksReordered`**。
- `WorkspaceMembersUpdated` はスペース担当者の集合。組織ユーザーの追加・削除は組織チャンネルの `member.*`。

### `organizations.{organizationId}`

イベントは `OrganizationChanged` 一つ。ペイロードの `type` で区別する。

| `type` | 主な発火元 | 内容 |
| --- | --- | --- |
| `workspace.created` / `workspace.updated` / `workspace.archived` / `workspace.unarchived` / `workspace.deleted` | `WorkspaceController` | スペースのメタとライフサイクル |
| `workspace.pinned` | `WorkspaceController` | ピン留め。クライアントは自分の `user_id` のときだけ反映する |
| `document.created` / `document.updated` / `document.archived` / `document.restored` / `document.deleted` | `DocumentController` | 資料。削除以外は本文（`body`）を含む |
| `settings.updated` | `OrganizationController` | 組織名と既定マスタ |
| `icon.updated` | `OrganizationController` | 組織アイコン |
| `member.upserted` / `member.removed` | `OrganizationController`、招待受諾 | 組織ユーザー |
| `invite.upserted` / `invite.removed` | `OrganizationInviteController`、招待受諾 | 招待 |
| `task_labels.updated` / `workspace_labels.updated` | `LabelCatalogBroadcast` | タスク／スペースのラベルカタログ一式 |
| `user.profile_updated` | `MeController`（`OrganizationBroadcast::userProfile`） | ユーザー名とアバター。所属する各組織へ送る |
| `organization.deleted` | `OrganizationController`（削除確定後） | 組織の削除。配下の個別イベントは出さない |

`organization.deleted` は削除操作のソケットには送らない（`toOthers`）。その画面は API 成功後に自分で遷移する。同じ組織を開いている他の画面は、サーバーが付け替えた現在組織のスペース一覧へ進む。所属が残っていなければ組織作成画面へ進む。

## 配信しないもの

- **アプリ内通知**の作成・既読。未読の有無はヘッダーのポーリング。
- **入力中・プレゼンス**。資料の同時編集（カーソル共有）もしない。資料は保存のたびに `document.*` を配信する。

## フロント購読

| 部品 | 役割 |
| --- | --- |
| `frontend/app/plugins/echo.client.ts` | Echo 初期化（`broadcaster: 'reverb'`）、認可ハンドラ |
| `frontend/app/composables/useApi.ts` | リクエストに `X-Socket-ID` を付与 |
| `frontend/app/composables/workspace/useWorkspaceRealtimeChannel.ts` | `Echo.private('workspaces.{id}')` 購読・イベント listen |
| `WorkspaceBoard.vue` / `WorkspaceWbsView.vue` | ハンドラでボード／WBS 状態を更新 |
| `frontend/app/app.vue` | `/org/{slug}/…` のあいだ組織チャンネルを購読 |
| `frontend/app/composables/org/useOrganizationRealtimeChannel.ts` | `Echo.private('organizations.{id}')` で `.OrganizationChanged` を listen |
| `frontend/app/composables/org/applyOrganizationRealtime.ts` | `type` に応じて一覧・設定・資料キャッシュを更新 |

再接続時は接続成功後にリスナーをバインドする。**ボード全体の自動フル再取得ポリシーは未整備**（一部ハンドラ内で部分 refresh あり）。

## 設定ポイント

### バックエンド（`backend/.env`）

- `BROADCAST_CONNECTION=reverb`
- `BROADCAST_FAIL_SILENTLY`（任意。local は既定 true）
- `REVERB_APP_ID` / `REVERB_APP_KEY` / `REVERB_APP_SECRET`
- `REVERB_HOST` / `REVERB_PORT` / `REVERB_SCHEME`（ブラウザから見た接続先。本番は公開ホスト + 443 + https）
- `REVERB_BROADCAST_HOST` / `PORT` / `SCHEME`（Laravel → Reverb の内部送信。同一コンテナなら 127.0.0.1:8080/http）
- `REVERB_SERVER_HOST` / `REVERB_SERVER_PORT`（Reverb 待受。コンテナ内は `0.0.0.0:8080`）
- `APP_RUNTIME`（`web` / `http` / `reverb`）
- `LOG_CHANNEL=stderr`（本番。ECS awslogs → CloudWatch）
- 起動: ローカルは `php artisan reverb:start`。ECS イメージは entrypoint が役割に応じて起動

### フロントエンド（`frontend/.env`）

- `NUXT_PUBLIC_REVERB_KEY` / `HOST` / `PORT` / `SCHEME`（backend の Reverb 設定と一致）

依存: `laravel-echo`, `pusher-js`

## 信頼性 / 補完設計

- WebSocket は **best-effort**。取りこぼしや長期切断への完全な整合保証は、現状の再接続フル再取得ではカバーしていない。
- 書き込み成功と配信成功は分離。`fail_silently` 時は配信失敗でも REST は成功し得る（ローカルで Reverb 未起動でも開発可能）。
- 楽観的 UI と併用する場合も、`X-Socket-ID` + `toOthers()` により自分宛ての同一イベントは届かない。

## 関連ドキュメント

- 本番環境変数: [`../../deploy/production-env.md`](../../deploy/production-env.md)
- 意思決定ログ: [`../../decisions/realtime-sync.md`](../../decisions/realtime-sync.md)
- ボード機能: [`../../application/features/board.md`](../../application/features/board.md)
- WBS 機能: [`../../application/features/wbs.md`](../../application/features/wbs.md)
- スペース: [`../../application/features/workspaces.md`](../../application/features/workspaces.md)
- 資料: [`../../application/features/documents.md`](../../application/features/documents.md)
- 組織・通知: [`../../application/features/organization.md`](../../application/features/organization.md)、[`../../application/features/notification.md`](../../application/features/notification.md)
