# Docs 構成

docsディレクトリでは、WorkMana の設計・仕様書を管理しています。

## api ディレクトリ

**API仕様**

- エンドポイント一覧
- リクエスト/レスポンス
- 認証方式

## architecture ディレクトリ

**全体設計**

- システム構成
- 技術スタック
- レイヤー構造（MVCなど）
- [リアルタイム同期（Laravel Reverb / Redis / Laravel Echo）](./architecture/realtime-sync.md)
- [フロントエンドのサーバー状態キャッシュ（TanStack Query）](./architecture/frontend-server-state.md)
- [フロントエンドのオーバーレイ UI（Floating UI / focus-trap / VueUse）](./architecture/frontend-overlays.md)
- [FE / BE 共有契約（色・文字数・Zod / FormRequest）](./architecture/shared-contracts.md)

## business-rules ディレクトリ

## database ディレクトリ

**DB設計**

- [列挙値](./database/enums.md)
- [スキーマ: 認証・組織・招待](./database/schema-auth.md)
- [スキーマ: プロジェクト](./database/schema-projects.md)
- [スキーマ: タスク](./database/schema-tasks.md)
- ER図（必要に応じて `database/er.md` 等で追加）

## decisions ディレクトリ

**意思決定ログ**

- PostgreSQL を選んだ理由
- Amazon SQS を選んだ理由
- 設計のトレードオフ
- [リアルタイム同期に Laravel Reverb / Redis / Laravel Echo を採用](./decisions/realtime-sync.md)
- [フロント基盤ライブラリと FE/BE 共有契約](./decisions/frontend-foundations.md)

## deploy ディレクトリ

**デプロイ**

- 本番環境への手順
- CI/CD
- サーバー設定

## features ディレクトリ

**機能設計・仕様**（E2E。現行実装ベース）

- [認証・セッション](./features/auth.md)
- [組織・メンバー・招待](./features/organization.md)
- [組織設定・マスタ](./features/organization-settings.md)
- [プロフィール・アバター](./features/profile.md)
- [スペース](./features/workspaces.md)
- [ボード](./features/board.md)
- [タスク](./features/tasks.md)
- [WBS／ガント](./features/wbs.md)
- [資料](./features/documents.md)
- [タスク添付](./features/task-attachments.md)
- [タスク履歴](./features/task-history.md)
- [アプリ内通知](./features/notification.md)

## notifications ディレクトリ

通知の現行設計・仕様は [features/notification.md](./features/notification.md) を参照。

## permissions ディレクトリ

**権限管理**

- 管理者：admin
- プロジェクトリーダー：project_leader
- 一般ユーザー：member

## requirements ディレクトリ

**要件定義**

- 機能一覧
- 非機能要件（性能・セキュリティなど）
- ユーザーストーリー

## setup ディレクトリ

**環境構築**
- ローカル環境の立ち上げ
- 必要なツール
- `.env` の設定

## ui ディレクトリ

**画面設計**

- ワイヤーフレーム
- 画面遷移図
- UI仕様

## workflows ディレクトリ

**業務フロー**
- ユースケース
- シーケンス図
- タスクの流れ（作成->承認->完了）
