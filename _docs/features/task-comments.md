# タスクコメント・リアクション・メンション（Task Comments）

## 概要

タスク単位のコメント（ソフトデリート）、絵文字リアクション、メンション記法。タスク詳細のチャットペインから操作する。コメント投稿時にアプリ内通知を発行する（詳細は [notification.md](./notification.md)）。コメント CRUD は `task_histories` にも書き込む（[task-history.md](./task-history.md)）。

## 本書の範囲

- コメント CRUD、リアクション、メンション構文・UI、ワークスペース一括コメント取得

対象外: 通知配信・ドロワー → notification.md、履歴参照 UI（未実装）

---

## データモデル

| テーブル | 要点 |
| --- | --- |
| `task_comments` | `body`, `edited_at`, soft deletes。org/workspace 非正規化列あり |
| `task_comment_reactions` | UNIQUE `(task_comment_id, user_id, emoji)` |

本文上限: `FieldLengthLimits::COMMENT_BODY`（**100** 文字）。

---

## メンション

記法（バックエンド・フロント共通）:

```text
@[表示名](user:123)
```

- ルーティングは **user ID** が正。表示名は無視
- ワークスペース（組織）アクセス可能な被メンション者のみ `task.mentioned`
- 投稿者は除外
- 担当者には別途 `task.commented`（メンションと重複し得る）
- **編集時の再通知なし**。`@` 入力のオートコンプリートはなく、ピッカーボタンで挿入

表示時は HTML エスケープ後、メンションを `<strong>` に置換（コメント本文は Markdown ではない）。

---

## API 要約

| Method | Path | 説明 |
| --- | --- | --- |
| `GET` | `…/workspaces/{ws}/tasks/comments` | タスク ID ごとのコメント一括（ボード preload） |
| `GET/POST` | `…/tasks/{task}/comments` | 一覧／作成 |
| `PATCH/DELETE` | `…/comments/{comment}` | 更新／削除（**作者のみ**） |
| `POST` | `…/comments/{comment}/reactions` | `{ emoji }` トグル |

認可: 読取＝ワークスペースアクセス、作成／リアクション＝編集可（現状は組織メンバーと同義）。スペース／タスクがアーカイブまたはソフトデリート済みだと作成・リアクション不可。

サーバ側の絵文字許可リストは厳密ではない（長さ上限程度）。

---

## フロント

- `TaskDetailChatPane.vue` … チャット、メンションピッカー、リアクション、編集削除
- `TaskDetailModal.vue` から利用
- 型: `taskCommentTypes.ts`
- ボードデータ: `useWorkspaceBoardPageData.ts` でコメント一括取得あり

コメント専用の Reverb イベントは本機能の中心ではない（ボード同期とは別系統）。

---

## 主要ファイル

- `backend/app/Http/Controllers/Api/TaskCommentController.php`
- `backend/app/Models/TaskComment.php`, `TaskCommentReaction.php`
- `frontend/app/components/task/TaskDetailChatPane.vue`
- [notification.md](./notification.md)
