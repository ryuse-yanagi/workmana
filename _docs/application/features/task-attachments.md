# タスク添付ファイル（Task Attachments）

## 概要

タスクへのファイル upload／list／download／delete。新規アップロードは **`private_media` ディスク**（本番は S3 `s3-private`、ローカル既定は `local`＝`storage/app/private`）、パス `tasks/{taskId}/…`。ダウンロードはレガシーの **`public` / `local`** に残存するファイルもフォールバック参照する。削除時は現行ディスクとレガシーディスクを掃除し得る。

API レスポンスにストレージ `path` は出さない（直リンク不可）。ダウンロードは認証付き API 経由。

## 本書の範囲

- 添付の保存・認可・UI

対象外: アバター（public）→ [profile.md](./profile.md)、資料本文のファイル化（未実装）

---

## データモデル

`task_attachments`: `original_name`, `path`, `mime_type`, `size_bytes`, `uploaded_by`

スペース／タスクの完全削除時、`PermanentDeleter` が行とファイルを削除。

---

## API 要約

| Method | Path | 権限 |
| --- | --- | --- |
| `GET` | `…/workspaces/{ws}/tasks/attachments` | メンバー（タスク ID ごとの一括・ボード preload） |
| `GET` | `…/tasks/{task}/attachments` | メンバー（アクセス可） |
| `POST` | `…/tasks/{task}/attachments` | 編集可＋スペース未アーカイブ。ソフトデリート済みタスク不可 |
| `GET` | `…/attachments/{attachment}/download` | アクセス可 |
| `DELETE` | `…/attachments/{attachment}` | 編集可 |

制約例: 最大 **10240 KB**。拡張子 pdf / txt / csv / md / 画像 / Office / zip 等。

---

## フロント

ボードを開くとき `useWorkspaceBoardPageData` がスペース単位の一覧 API で添付メタデータを先読みし、`TaskDetailModal` に `initialAttachments` として渡す。モーダル内で選択、一覧、ダウンロード、削除を行う。ダウンロード URL は API の download ルート。

プレビュー UI（インライン表示）はなし。ウイルススキャンなし。

---

## 主要ファイル

- `backend/app/Http/Controllers/Api/Task/TaskAttachmentController.php`
- `backend/app/Models/Task/TaskAttachment.php`
- `backend/config/filesystems.php`（`private_media` → 本番 `s3-private` / ローカル `local`）
- `frontend/app/composables/workspace/useWorkspaceBoardPageData.ts`
- `frontend/app/components/modals/task/TaskDetailModal.vue`
- テスト: `ListWorkspaceTaskAttachmentsGroupedByTaskTest.php` / `UploadTaskAttachmentTest.php` / `DownloadAndDeleteTaskAttachmentTest.php`
