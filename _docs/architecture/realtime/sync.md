# リアルタイム同期

WorkMana は複数メンバーが同一スペースのボード／WBS を同時に操作することを想定しているため、サーバー側の変更を即時に各クライアントへ伝搬する仕組みを採用する。

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

### ② 配信フロー（他メンバーの画面に変更を即時反映）

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

| チャンネル名 | 種類 | 認可 | 用途 |
| --- | --- | --- | --- |
| `workspaces.{workspaceId}` | private | そのスペースを閲覧できるユーザー（`User::canAccessWorkspace`） | ボード／WBS のリスト・タスク変更 |

- 認可定義: `backend/routes/channels.php`
- 認可 HTTP: `POST /api/broadcasting/auth`（`cognito` + Cookie セッション。Echo の `channelAuthorization.customHandler`）

未実装（将来候補）: `orgs.*`（組織横断マスタ）、`users.*`（個人宛て通知の push）。アプリ内通知は現状ポーリング（[../../application/features/notification.md](../../application/features/notification.md)）。

## 配信イベント（現行）

いずれも `private-workspaces.{workspaceId}` 相当。`broadcastAs` はクラス名（Echo 側は `.TaskUpdated` のように listen）。

| イベント | 主な発火元 |
| --- | --- |
| `ListCreated` / `ListUpdated` / `ListDeleted` / `ListsReordered` | `ListController` |
| `TasksReordered` | `ListController`（列内タスク並べ替え） |
| `TaskCreated` / `TaskUpdated` / `TaskArchived` / `TaskRestored` / `TaskDeleted` | `TaskController` |
| `WbsTasksReordered` | `TaskController`（WBS 並べ替え） |

補足:

- タスクの列移動は専用 `TaskMoved` ではなく **`TaskUpdated` + `TasksReordered`**。
- ラベル更新・資料・組織設定・スペースメタの CRUD は **ブロードキャスト対象外**。
- 呼び出しはコントローラから `SafeBroadcast::toOthers(new …)`。

## フロント購読

| 部品 | 役割 |
| --- | --- |
| `frontend/app/plugins/echo.client.ts` | Echo 初期化（`broadcaster: 'reverb'`）、認可ハンドラ |
| `frontend/app/composables/useApi.ts` | リクエストに `X-Socket-ID` を付与 |
| `frontend/app/composables/useWorkspaceRealtimeChannel.ts` | `Echo.private('workspaces.{id}')` 購読・イベント listen |
| `WorkspaceBoard.vue` / `WorkspaceWbsView.vue` | ハンドラでボード／WBS 状態を更新 |

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
