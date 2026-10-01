# Docs 構成

WorkMana の設計・仕様書。

## application ディレクトリ

**何をするか**（機能、画面操作）

- [入口](./application/README.md)
- [機能仕様](./application/features/)
- [画面操作](./application/design/shortcuts.md)

## architecture ディレクトリ

**どう組んでいるか**（クラウド配置は `cloud/` に後で追加）

- [構成の入口](./architecture/overview/README.md)
- [システム境界](./architecture/system/boundaries.md)
- [バックエンド](./architecture/backend/layers.md)
- [フロントエンド](./architecture/frontend/structure.md)
- [認証・認可](./architecture/auth/session.md)
- [ファイル保存](./architecture/files/media.md)
- [リアルタイム同期](./architecture/realtime/sync.md)
- [FE / BE 共有契約](./architecture/contracts/shared.md)

API のルート一覧は `backend/routes/api.php`。

## database ディレクトリ

**テーブル**

- [列挙値](./database/enums.md)
- [スキーマ: ユーザー・組織・招待](./database/schema-auth.md)
- [スキーマ: スペース・ボード列・ラベル](./database/schema-workspaces.md)
- [スキーマ: タスク](./database/schema-tasks.md)
- [スキーマ: 資料](./database/schema-documents.md)
- [スキーマ: アプリ内通知](./database/schema-notifications.md)

## decisions ディレクトリ

**なぜそうしたか**

- [リアルタイム同期に Laravel Reverb / Laravel Echo を採用](./decisions/realtime-sync.md)
- [フロント基盤ライブラリと FE/BE 共有契約](./decisions/frontend-foundations.md)

## deploy ディレクトリ

**本番の環境変数**

- [本番環境変数](./deploy/production-env.md)
