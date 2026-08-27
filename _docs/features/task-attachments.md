# タスク添付ファイル（Task Attachments）

## 概要

タスクへのファイル upload／list／download／delete。新規アップロードはディスク **`local`**（`storage/app/private`）、パス `tasks/{taskId}/…`。ダウンロードはレガシーの **`public`** ディスクに残存するファイルもフォールバック参照する。削除時は両ディスクを掃除し得る。

API レスポンスにストレージ `path` は出さない（直リンク不可）。ダウンロードは認証付き API 経由。

## 本書の範囲

- 添付の保存・認可・UI

対象外: アバター（public）→ [profile.md](./profile.md)、資料本文のファイル化（未実装）

---

## データモデル

`task_attachments`: `original_name`, `path`, `mime_type`, `size_bytes`, `uploaded_by`

スペース／タスクの完全削除時、`PermanentDeleter` が行とファイルを削除。

**添付の作成・削除は `task_histories` に記録しない。**

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

ボード遷移時に `useWorkspaceBoardPageData` がワークスペース一括 API で添付メタデータを preload し、`TaskDetailModal` に `initialAttachments` として渡す（コメントと同様）。モーダル内の添付ブロック（ファイル選択、一覧、ダウンロードリンク、削除）。ダウンロード URL は API download ルート。

プレビュー UI（インライン表示）はなし。ウイルススキャンなし。

---

## 主要ファイル

- `backend/app/Http/Controllers/Api/TaskAttachmentController.php`
- `backend/app/Models/TaskAttachment.php`
- `backend/config/filesystems.php`（`local` → `app/private`）
- `frontend/app/composables/useWorkspaceBoardPageData.ts`
- `frontend/app/components/modals/TaskDetailModal.vue`
- テスト: `ListWorkspaceTaskAttachmentsGroupedByTaskTest.php` / `UploadTaskAttachmentTest.php` / `DownloadAndDeleteTaskAttachmentTest.php`
