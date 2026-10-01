# アーキテクチャ

WorkMana の構成メモの入口。機能の操作手順は [`../../application/features/`](../../application/features/) 、テーブル定義は [`../../database/`](../../database/) 、採用理由は [`../../decisions/`](../../decisions/) に置く。ここは「何がどこにあり、境界をどう切っているか」だけを書く。

クラウド上の配置（ネットワーク、実行環境、マネージドサービスのつなぎ方）は [../cloud/](../cloud/) に置く。リポジトリだけでは判断しきれないため、本書では書かない。

## 論理構成

ブラウザは Nuxt を表示し、業務データの読み書きは Laravel の JSON API へ送る。永続化は PostgreSQL。ボード／WBS の他クライアント反映だけ Laravel Reverb を使う。ログインの本人確認は Amazon Cognito に委譲し、ブラウザへ渡す資格情報は HttpOnly のセッション Cookie のみ。

```
[ Browser ]
    │  HTTP (REST + Cookie)           WebSocket
    ▼                                 ▼
[ Nuxt ] ── /api ──────────────────▶ [ Laravel ] ──SQL──▶ [ PostgreSQL ]
                                    │
                                    │ 認可コード (PKCE)
                                    ▼
                               [ Cognito ]
                                    │
                                    │ broadcast
                                    ▼
                               [ Reverb ] ──push──▶ [ Echo (他クライアント) ]
```

- 書き込みは REST。Echo / Reverb は保存経路に入らない。
- ローカル開発では Vite が `/api` と `/storage` を Laravel へプロキシする。
- 用語: UI「スペース」＝コードの `workspace`。旧設計書の `project` も同じものを指す。

## 技術スタック

| 分類 | 採用 |
| --- | --- |
| Frontend | Nuxt 4 / Vue 3 / TypeScript / SCSS |
| Backend | Laravel 13 / PHP 8.3 |
| Database | PostgreSQL |
| 認証 | Cognito Hosted UI（認可コード + PKCE）＋サーバー側セッション |
| Realtime | Laravel Reverb / Laravel Echo |
| 共有契約 | リポジトリ直下 `shared/*.json` |

## リポジトリ

```
work-manager/
├── frontend/     Nuxt
├── backend/      Laravel API
├── shared/       FE/BE で揃える定数
└── _docs/
```

## 文書

| 文書 | 内容 |
| --- | --- |
| [system/boundaries.md](../system/boundaries.md) | プロセス境界とデータの通り道 |
| [backend/layers.md](../backend/layers.md) | Laravel の層とリクエストの通り方 |
| [frontend/structure.md](../frontend/structure.md) | Nuxt のディレクトリ責務 |
| [frontend/server-state.md](../frontend/server-state.md) | サーバー状態キャッシュ |
| [frontend/overlays.md](../frontend/overlays.md) | オーバーレイ UI |
| [auth/session.md](../auth/session.md) | セッション認証の信頼境界 |
| [auth/authorization.md](../auth/authorization.md) | 組織境界と閲覧・編集の判定 |
| [files/media.md](../files/media.md) | 公開メディアと非公開添付 |
| [realtime/sync.md](../realtime/sync.md) | リアルタイム同期 |
| [contracts/shared.md](../contracts/shared.md) | FE / BE 共有契約 |

実装とテストが仕様より新しいときは、コードを正とする。
