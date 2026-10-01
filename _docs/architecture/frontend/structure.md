# フロントエンドの構成

Nuxt 4（`frontend/app/`）。ファイルベースのルーティング。コンポーネントはパス接頭辞なしで自動 import する。composable と utils はサブディレクトリまで自動 import する。

## ディレクトリ

| 場所 | 役割 |
| --- | --- |
| `pages/` | URL とページの組み立て |
| `middleware/auth.global.ts` | `/org/`・`/post-login`・`/organizations/` を未ログインなら `/login` へ |
| `components/` | 画面部品。`app` / `workspace` / `task` / `modals` / `settings` など |
| `composables/` | API 呼び出し、ページデータ、UI 状態。ドメイン別 |
| `utils/` | 描画・正規化・Markdown など、Vue インスタンスに依存しない処理 |
| `plugins/` | Echo、QueryClient、セッション先読み、ポップオーバーの片面処理 |
| `lib/` | Query のキーとクライアント |
| `constants/` | `shared/*.json` の再 export |
| `assets/styles/` | SCSS。mixin は各ファイルへ自動注入 |

## 画面の単位

保護ページは組織 slug を URL に持つ（`/org/[slug]/...`）。主なページは次のとおり。

| パス | 中身 |
| --- | --- |
| `/login` `/register` | 認証の入口。Cognito の秘密は持たない |
| `/post-login` | 所属組織の決定 |
| `/organizations/new` | 組織作成 |
| `/invite/[token]` | 招待の確認と受諾 |
| `/org/[slug]/workspaces` | スペース一覧 |
| `/org/[slug]/workspaces/[id]` | ボード（既定）と WBS |
| `/org/[slug]/workspaces/[id]/documents/[documentId]` | 資料 |
| `/org/[slug]/settings` | 組織設定 |

認証ミドルウェアは SSR では判定しない。セッション Cookie はブラウザにあり、クライアントで `ensureCurrentUser` してから通す。初回ペイント前に `auth-session` プラグインがセッションを取り、`session-ready` まで `html` を隠す。

## データ取得

ページはドメインの page-data composable を呼ぶ。公開 API は `fetchSnapshot` / `getCached` / patch などで、内部の正本は TanStack Query（[server-state.md](./server-state.md)）。

HTTP は `useApi` に集約する。

- ベース URL は `NUXT_PUBLIC_API_BASE_URL`。未設定時は相対 `/api`
- 書き込み前に `XSRF-TOKEN` を確保し、`X-XSRF-TOKEN` を付ける
- クライアントでは Echo の socket id を `X-Socket-ID` に付ける
- `avatar_url` / `icon_url` と色 index をレスポンス横断で正規化する

ボード／WBS の他者更新は `useWorkspaceRealtimeChannel`（[../realtime/sync.md](../realtime/sync.md)）。Query キャッシュはその配信そのものではない。

## 表示の注意

資料とタスク説明の Markdown は `marked` のあと、許可したタグと属性だけ残す（`utils/document/renderMarkdown.ts`）。モーダルとポップオーバーの配置・フォーカスは [overlays.md](./overlays.md)。
