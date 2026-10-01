# システム境界

プロセスとデータの所有者。実行環境への載せ方は [../cloud/](../cloud/) で後述する。

## プロセス

| プロセス | 所有者 | 役割 |
| --- | --- | --- |
| Nuxt | `frontend/` | 画面、ルーティング、API クライアント、Echo 購読 |
| Laravel | `backend/` | JSON API、セッション、認可、永続化、ブロードキャスト発火 |
| PostgreSQL | DB | 業務データの正本 |
| Reverb | Laravel と同じアプリ | WebSocket の push。購読認可は Laravel の `/api/broadcasting/auth` |
| Cognito | 外部 IdP | パスワードと Hosted UI。アプリ DB のユーザー行とは `cognito_sub` で対応づける |

ローカルでは API（`php artisan serve`）、Reverb（`php artisan reverb:start`）、Nuxt（`npm run dev`）を別プロセスで起動する。キューを使う処理があるときは `php artisan queue:listen` を足す。ローカル既定のキューとキャッシュは `database` ドライバで、ブロードキャスト経路とは独立。

## リクエストの種類

| 種類 | 経路 | 認証 |
| --- | --- | --- |
| 画面 | ブラウザ → Nuxt | 保護ルートはクライアント側ミドルウェアがセッションを確認 |
| 業務 API | ブラウザ → `/api/...` → Laravel | `cognito`（セッション Cookie）。組織配下は加えて `org.member` |
| 書き込み API | 同上 + `X-XSRF-TOKEN` | Cookie の CSRF トークン |
| 放送認可 | `POST /api/broadcasting/auth` | `cognito` + Cookie |
| 配信 | Laravel → Reverb → Echo | チャンネルコールバック |

開発時、ブラウザから見た API は同一オリジンの `/api` で、Vite が Laravel へ転送する。SSR 中の相対 `/api` は Vite を通らないため、Nuxt サーバーは `apiInternalBase` で Laravel へ直接向ける。

## データの正本

| データ | 正本 | 補足 |
| --- | --- | --- |
| ユーザー・組織・スペース・タスク・資料 | PostgreSQL | API レスポンスは都度組み立てる |
| 画面上の一覧キャッシュ | ブラウザ内の TanStack Query | サーバーの正本ではない。[../frontend/server-state.md](../frontend/server-state.md) |
| ボード／WBS の他者更新 | Reverb のイベント | best-effort。取りこぼしの完全補償は未整備 |
| ID / Refresh トークン | サーバー側セッション | ブラウザの JS からは読めない |
| 色・文字数・既定マスタ | `shared/*.json` | [../contracts/shared.md](../contracts/shared.md) |
| アバター・組織アイコン | 公開ディスク | URL を API が返す |
| タスク添付 | 非公開ディスク | download API のみ。[../files/media.md](../files/media.md) |

## 失敗の分離

書き込みの成功と、WebSocket 配信の成功は別である。ローカル既定では配信失敗をログに留めて HTTP は成功させる（`BROADCAST_FAIL_SILENTLY`）。認証トークンの検証に失敗したときはセッションを破棄する。
