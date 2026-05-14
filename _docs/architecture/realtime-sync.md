# リアルタイム同期

タスク管理アプリは複数メンバーが同一ボードを同時に操作することを想定しているため、サーバー側の変更を即時に各クライアントへ伝搬する仕組みを採用する。

## 採用技術

| レイヤー | 採用技術 | 役割 |
| --- | --- | --- |
| WebSocket サーバー | **Laravel Reverb** | Laravel 公式の WebSocket サーバー。バックエンドからイベントを購読クライアントへブロードキャストする。 |
| バックエンドのブロードキャストドライバ / Pub-Sub | **Redis** | Laravel の `BROADCAST_DRIVER=redis` を介して、アプリケーションサーバー（Laravel）から Reverb へイベントを引き渡す Pub/Sub バス。キューやキャッシュとも共用する。 |
| クライアントライブラリ | **Laravel Echo** | フロントエンド（Nuxt / Vue）で Reverb のチャンネルを購読するための公式クライアント。プライベートチャンネルやプレゼンスチャンネルの認可も `Echo` が担当する。 |

## 全体フロー

「保存」と「配信」は別経路で並列に走る **2系統** の構成。Echo / Reverb / Redis は **配信のための片道路** であり、ユーザーの書き込み操作自体はこれらを経由しない。

### ① 書き込みフロー（自分が操作したとき）

通常の REST API。Echo / Reverb / Redis は登場しない。

```
[ Nuxt / Vue ]
      │ HTTP (REST API)
      ▼
[ Laravel ]
      │ SQL
      ▼
[ PostgreSQL ]
```

### ② 配信フロー（他メンバーの画面に変更を即時反映）

Laravel が DB 更新後にイベントを発火し、Redis を Pub/Sub バスとして使って Reverb に渡し、Reverb が WebSocket で購読クライアントへ push する。

```
[ Laravel ]
      │ ① Event::dispatch ( implements ShouldBroadcast )
      │    例: TaskUpdated, TaskMoved, ListReordered
      ▼
[ Redis (Pub/Sub) ]              ── BROADCAST_DRIVER=redis
      │
      ▼
[ Reverb (WebSocket サーバー) ]
      │ ② 該当チャンネル購読者へ push
      ▼
[ Echo (購読中の "他" クライアント) ]
      │ ③ コールバックでストア / ref を更新
      ▼
[ Nuxt / Vue ]                   ── 他メンバーの画面が即時更新
```

### 合流イメージ（① と ② を重ねた図）

```
        ┌─ ユーザーA の操作 ───────────────────────────────┐
        │                                                 │
        │  Nuxt / Vue (A)                                 │
        │     │ HTTP                                      │
        │     ▼                                           │
        │  Laravel ── SQL ──▶ PostgreSQL                  │
        │     │                                           │
        │     │ broadcast(event)->toOthers()              │
        │     ▼                                           │
        │  Redis (Pub/Sub)                                │
        │     │                                           │
        │     ▼                                           │
        │  Reverb (WebSocket)                             │
        │     │ push                                      │
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
- **Echo は基本的に受信専用** と捉えてよい。サーバーへ何かを送るためのものではなく、サーバーからの push を受け取って Vue の状態を更新する役割。
- **Redis は Laravel ↔ Reverb 間のメッセージバス**。`broadcast()` が Redis に publish → Reverb が subscribe して、対応する WebSocket 接続に転送する。
- **自分の操作の二重反映を避ける** ため、書き込み時に `socket_id` をヘッダで送り、Laravel 側は `broadcast(...)->toOthers()` で配信する（楽観的更新と併用する場合は必須）。
- DB は **PostgreSQL** を採用（`backend/.env` の `DB_CONNECTION=pgsql`）。

## チャンネル設計（方針）

| チャンネル名 | 種類 | 配信イベント例 |
| --- | --- | --- |
| `projects.{projectId}` | private | `TaskCreated`, `TaskUpdated`, `TaskArchived`, `TaskMoved`, `ListCreated`, `ListUpdated`, `ListReordered` |
| `orgs.{orgSlug}` | private | `LabelCreated`, `LabelUpdated`, `LabelDeleted`, `ProjectCreated`, `ProjectArchived` |
| `users.{userId}` | private | 自分宛ての通知（招待、メンション 等） |

認可は `routes/channels.php` で行い、`ensureProjectMember` 相当のロジックを再利用してプロジェクト所属者だけが購読できるようにする。

## 設定ポイント

- `.env`
  - `BROADCAST_DRIVER=redis`
  - `QUEUE_CONNECTION=redis`（任意。重いブロードキャストは queue 経由が安全）
  - `REVERB_APP_ID` / `REVERB_APP_KEY` / `REVERB_APP_SECRET`
  - `REVERB_HOST` / `REVERB_PORT` / `REVERB_SCHEME`
- バックエンド
  - `composer require laravel/reverb`
  - `php artisan reverb:install`
  - `php artisan reverb:start`（本番ではプロセスマネージャ管理）
- フロントエンド
  - `npm install laravel-echo pusher-js`（Reverb は Pusher 互換プロトコル）
  - Nuxt プラグインで `window.Echo` を初期化し、`useEcho()` のような composable を作る

## 信頼性 / 補完設計

- WebSocket は **best-effort**。切断・取りこぼし対策として、再接続時には対象リソース（プロジェクトのタスク一覧等）を `GET` で再取得する。
- 楽観的更新（クライアント先行で UI を更新）と組み合わせる場合、サーバーから返ってきたブロードキャストイベントで自分の操作分は無視できるように、`socket_id` をリクエストヘッダに含めて `broadcast(...)->toOthers()` で配信する。

## 関連ドキュメント

- 意思決定ログ: [`../decisions/realtime-sync.md`](../decisions/realtime-sync.md)
