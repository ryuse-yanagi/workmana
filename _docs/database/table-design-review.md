# テーブル設計レビュー（冗長性）

ソース: Laravel マイグレーション＋モデル／API の実使用  
日付: 2026-08-20  
実装反映: 2026-08-23（`2026_08_23_000001_drop_redundant_auth_and_task_columns`）

修正作業のチェックリストとして使う。プロダクト判断が必要な項目は実装前に確認する。

## 結論

ドメインの骨格（組織 → スペース → リスト → タスク、ドキュメント、ラベル）は妥当。

ただし移行の名残で、未使用テーブルと二重書き込みカラムが残っている。壊れているわけではないが、不整合の温床になる。

問題の中心は「テーブルが増えすぎ」ではなく、「同じ事実を2箇所に書いている」こと。ラベル3系統や `related_*` の双方向行はプロダクト判断として筋が通っている。

| 区分 | 件数 | 状態 |
|------|------|------|
| 未使用テーブル | 1 | **対応済み**（`invites` DROP） |
| 二重書き込み | 3 | **対応済み**（effort / assignee / status↔list） |
| 認証の名残 | 2（削除候補カラム／テーブル） | **対応済み** |
| ラベル3系統 | 削らなくてよい | — |

## 優先して直すもの

| 対象 | 問題 | 根拠 | 推奨 | 状態 |
|------|------|------|------|------|
| `invites` | 完全な死にテーブル | Model なし。招待は `organization_invites` のみ | DROP。`token_hash` / `invited_by` / `revoked_at` は新テーブルへ移さない | **DONE** |
| `tasks.assignee_id` と `task_assignees` | 同じ担当者を二重保持 | API は常に `assignee_ids[0]` を `assignee_id` にコピー。履歴も `assignee_id` のみ | `task_assignees` を正とする。`assignee_id` と index を削除 | **DONE**（履歴は `assignee_ids` のみ） |
| `effort_hours` / `effort_value` / `effort_unit` | 3カラムが常に同じ意味 | 保存時に unit=`hour` 固定。value と hours を相互コピー | `effort_hours` 1本に畳む（または value+unit だけ残す） | **DONE**（`effort_hours` のみ） |
| `tasks.status` と `list_id` | 進捗の二系統 | ボードは `lists`。`status` は default `todo` と CHECK、履歴にも残る。UI はほぼ中継のみ | カンバン列を正にするなら `status` を廃止。残すなら list と同期ルールを明示 | **DONE**（`status` が正、`lists.mapped_status` で同期） |

## 認証まわりの名残

ログインは Cognito（`cognito_sub`）。一方 `users` には Laravel 標準のローカル認証カラムが残っている。`sessions` / `jobs` / `cache` は `.env` が database ドライバなのでインフラとして必要。

| 対象 | 判定 | メモ | 状態 |
|------|------|------|------|
| `users.password` | ほぼ未使用 | nullable。Cognito 専用なら削除可 | **DONE** |
| `users.remember_token` | 未使用 | Hidden 指定のみ | **DONE** |
| `password_reset_tokens` | 未使用テーブル | ローカルパスワードリセットをしないなら DROP | **DONE** |
| `users.email_verified_at` | 使用中 | Cognito JWT / 招待受け入れで更新 | 維持 |
| `sessions`, `jobs`, `cache`, `failed_jobs` | 使用中 | SESSION/QUEUE/CACHE が database | 維持 |

## 意図的な重複（削らなくてよい）

| 対象 | なぜ残すか |
|------|------------|
| workspace / task / document のラベル3系統（9テーブル） | 語彙を独立させている。ポリモーフィック1本にすると制約とUI設定が混ざる。現状は重複ではなく分離 |
| `is_parent_task` | `parent_task_id` の導出ではない。子がまだない親タスクを表現する型フラグ |
| `workspace_assignees` | アクセス制御ではない（`memberships` は組織単位）。スペースの担当者リスト |
| organization JSON デフォルト3本 | 新規作成時のテンプレ。lists / status / category 実体とは別ライフサイクル |
| `last_organization_id` | 最後に開いた組織。セッションに置くより永続化が正しい |
| `related_*` の双方向2行 | クエリを片側 FK で済ますための意図的な2倍行。ストレージより実装コスト優先 |
| `tasks.organization_id` | workspace 経由の JOIN を避けるテナント境界。コメント等へのコピーも同じ理由 |

### 薄い重複（優先度低）

| 対象 | 内容 |
|------|------|
| 中間テーブルの `id` + timestamps | Laravel 慣例。複合PKだけでも足りるが害は小さい |
| comments / checklists / histories の `org_id` + `workspace_id` | task から導出可能。テナント横断クエリと整合チェック用。削除は任意 |
| `workspaces.status` / `shared_documents.category` が文字列 | マスタFKではない。デフォルト名の改名が既存行に波及しない |

## すでに掃除済み

- `workspace_memberships` DROP
- `workspaces.visibility` DROP
- `document_viewers` DROP
- `invites` DROP
- `password_reset_tokens` DROP
- `users.password` / `users.remember_token` DROP
- `tasks.assignee_id` DROP（`task_assignees` 一本化）
- `tasks.effort_value` / `tasks.effort_unit` DROP（`effort_hours` のみ）
- `memberships.invited_by` 削除（create マイグレーションから除去。招待経路では常に null だった）

スペース ACL とドキュメント閲覧者は撤回済み。現行は組織メンバーシップが権限の正。

## 推奨する片付け順

| 順 | 作業 | リスク | 状態 |
|----|------|--------|------|
| 1 | `invites` を DROP（アプリ非参照） | 低 | **DONE** |
| 2 | effort を1カラムに畳む | 中（API・フロントの互換） | **DONE** |
| 3 | `assignee_id` を廃止し `task_assignees` に一本化。履歴は `assignee_ids` | 中 | **DONE** |
| 4 | Cognito 専用なら `password` / `remember_token` / `password_reset_tokens` を削除 | 低（テスト工場の修正） | **DONE** |
| 5 | `tasks.status` の要否をプロダクト判断。残すなら list との関係を文書化 | 高（意味の変更） | **DONE**（status 正 + `lists.mapped_status`） |

## status / list_id の現行ルール（2026-08-23）

- **Canonical 進捗**: `tasks.status`（`todo` / `in_progress` / `done`）
- **Kanban 配置**: `tasks.list_id`
- **橋渡し**: `lists.mapped_status`（List名から推測しない）
- 列移動時: `list_id` と `status` を同一処理で同期
- status 単独 PATCH: 対応 List が 1 なら移動、複数なら現在 List が既にその status なら維持、0 または曖昧なら 422
- 履歴: `status_changed` と `list_changed` を区別して記録
