# ADR: リアルタイム同期に Laravel Reverb / Laravel Echo を採用

- ステータス: Accepted
- 日付: 2026-05-13

## 背景

WorkMana のボード／WBS 画面は、複数メンバーが同時に編集することを想定している。リアルタイム配信がないと、クライアントがリロードや自分の操作をトリガーにしない限り他メンバーの変更が反映されず、ボード状態の食い違いや「気付かないうちに上書き」が発生し得る。

## 決定

リアルタイム同期は以下の組み合わせで実装する。

- **Laravel Reverb**: WebSocket サーバー
- **ブロードキャスト接続**: Laravel の `BROADCAST_CONNECTION=reverb`（アプリから Reverb への配信。単一ノードでは Redis を必須としない）
- **Laravel Echo**（+ `pusher-js`）: フロントエンド（Nuxt / Vue）の購読クライアント

詳細な現行構成は [`../architecture/realtime/sync.md`](../architecture/realtime/sync.md) を参照。

## 検討した代替案

| 候補 | 採用しなかった理由 |
| --- | --- |
| **Pusher (SaaS)** | 月額課金が発生する。コネクション数 / メッセージ数で料金が増える。学習・本番ともにコストが読みづらい。 |
| **Ably / Soketi など他 SaaS / OSS** | 別途運用ノウハウが必要。Reverb は Laravel 公式のため統合が最短。 |
| **Socket.IO（Node.js 別サーバー）** | 既存スタックが Laravel/PHP 中心であり、別言語のサーバーを増やすと運用負荷・認証統合コストが高い。 |
| **ポーリング（数秒ごとの GET）** | 実装は最も簡単だが、ユーザー数 × 頻度で API 負荷が線形に増え、即時性も劣る。長期的に不利。 |
| **Server-Sent Events (SSE)** | 単方向で済むユースケースには有効だが、将来的に「タイピング中」「プレゼンス（誰が見ているか）」など双方向通信を導入する余地を残したいため不採用。 |

## 採用理由

1. **Laravel 公式 / 標準統合**: `Broadcast` ファサード、ブロードキャスト可能な Event、`routes/channels.php` の認可など、既存の Laravel エコシステムにそのまま乗る。
2. **Pusher 互換プロトコル**: フロント側は Laravel Echo + `pusher-js` をそのまま使え、将来 Pusher / Ably などへ移行する場合も差し替えやすい。
3. **セルフホストでコスト固定**: 同時接続数や月間メッセージ数に応じた SaaS 課金が発生しない。
4. **学習資産が再利用できる**: 認可、イベントといった Laravel の既知の概念だけで構築でき、新たな技術スタック（Node.js, Go 等）を持ち込まない。
5. **単一ノードでは Redis 必須ではない**: 配信は `reverb` ドライバ経由。Redis は Reverb の水平スケール（`REVERB_SCALING_ENABLED`）時のオプションとして使える。

## 影響

- Reverb プロセスを API とは別に常駐させる。止めると、他クライアントへの即時反映が止まる。
- 書き込みの成功と配信の成功は分ける。配信に失敗しても、保存済みの変更は失敗にしない。

## 未決定事項 / フォロー

- スケールアウト時の Reverb 複数ノード構成（`REVERB_SCALING_ENABLED` + Redis。sticky session 要否を含む）。
- プレゼンス機能（誰がボードを見ているか）の導入タイミング。
- WebSocket 再接続時に、ボード／WBS をどこまで再取得するか。
