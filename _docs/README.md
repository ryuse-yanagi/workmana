# Docs 構成

docsディレクトリでは、タスク管理アプリの設計・仕様書を管理しています。

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

## business-rules ディレクトリ

## database ディレクトリ

**DB設計**

- [README（索引・方針）](./database/README.md)
- [列挙値](./database/enums.md)
- [スキーマ: 認証・組織・招待](./database/schema-auth.md)
- [スキーマ: プロジェクト](./database/schema-projects.md)
- [スキーマ: タスク](./database/schema-tasks.md)
- ER図（必要に応じて `database/er.md` 等で追加）

## decisions ディレクトリ

**意思決定ログ**

- MySQL を選んだ理由
- Amazon SQS を選んだ理由
- 設計のトレードオフ
- 

## deploy ディレクトリ

**デプロイ**

- 本番環境への手順
- CI/CD
- サーバー設定

## notifications ディレクトリ

## permissions ディレクトリ

**権限管理**

- 管理者：admin
- プロジェクトリーダー：project_leader
- 一般ユーザー：member
- 閲覧者：viewer

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
