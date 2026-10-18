# 資料（Documents）

## 概要

1 つのスペースに所属する **Markdown 資料**（モデル `Document`）。一覧・作成・詳細編集／プレビュー・カテゴリ・アーカイブを持つ。作成はスペースのサイドバーから行い、資料は必ずそのスペースにだけ属する。

本文は DB の longText に生 Markdown を保存。**サニタイズ付き HTML 化はフロントのみ**（`renderMarkdownToSafeHtml`）。`marked` の出力を信頼せず、見出し・リスト・表・強調・リンクなどの許可タグ以外は落とす。リンクは `http` / `https` / `mailto` / `#` / `/` 始まり（`//` と `/\` は不可）だけ残す。チェックボックスは `disabled` の checkbox に固定する。サーバ側サニタイズ・版管理・資料添付はなし。保存時の作成・更新・アーカイブ・復元・削除は組織チャンネルで配信する（[`../../architecture/realtime/sync.md`](../../architecture/realtime/sync.md)）。

カテゴリは FK テーブルではなく、組織の `default_document_category_names` にある **名前文字列**。

## 本書の範囲

- 資料 CRUD、アーカイブ、Markdown UI

対象外: カテゴリ／ラベルマスタ編集 → [organization-settings.md](./organization-settings.md)

---

## 全体フロー

```
スペース詳細のサイドバー（そのスペースに紐づく資料）
        │
        ▼
[/org/{slug}/workspaces/{id}/documents/{documentId}]
        メタ編集／ Markdown 編集・プレビュー
```

---

## データモデル

| テーブル | 要点 |
| --- | --- |
| `shared_documents` | `workspace_id`（必須）、`name`, `description`, `body`, `category`, `archived_at`, soft deletes |

---

## API 要約

`/api/orgs/{organization}/…`、`org.member`

| Method | Path | 説明 |
| --- | --- | --- |
| `GET/POST` | `/documents` | 一覧／作成。作成は `workspace_id` 必須 |
| `GET` | `/documents/archived` | アーカイブ一覧 |
| `GET/PATCH/DELETE` | `/documents/{document}` | 詳細／更新／完全削除 |
| `GET/POST` | `/workspaces/{workspace}/documents` | そのスペースに紐づく一覧／作成 |
| `GET` | `/workspaces/{workspace}/documents/archived` | スペース配下のアーカイブ一覧 |
| `POST` | `…/archive` \| `…/unarchive` | アーカイブ／復元（いずれも **admin**） |

- アーカイブ中の更新は、更新前の検査で 403。トランザクション内で先にアーカイブされていた場合は 422
- 完全削除はアーカイブ後・admin（`PermanentDeleter`）
- スペースを完全削除すると、その `workspace_id` の資料も消える

---

## フロント

| 画面 / 部品 | 役割 |
| --- | --- |
| `pages/org/[slug]/workspaces/[id]/documents/[documentId].vue` | 詳細編集。スペース詳細へ戻る |
| `WorkspaceDetailSidebar` | スペースに紐づく資料の一覧 |
| `DocumentFormModal` | 作成と、名前・説明・カテゴリの編集 |
| `DocumentCategorySelect` | カテゴリ |
| `useOrgDocumentsPageData.ts` | ページデータ |
| `utils/document/renderMarkdown.ts` | プレビュー用サニタイズ |

---

## ギャップ

- 組織直下の資料一覧ページはない。一覧はスペース詳細のサイドバー
- サーバ側 Markdown サニタイズなし
- 版管理・添付・同時編集（カーソル共有）なし。保存後の他クライアント反映は組織チャンネルの `document.*`

---

## 主要ファイル

- `backend/app/Http/Controllers/Api/Document/DocumentController.php`
- `backend/app/Models/Document/Document.php`
- `backend/app/Support/Document/DefaultDocumentCategories.php`
- `frontend/app/pages/org/[slug]/workspaces/[id]/documents/[documentId].vue`
- `frontend/app/utils/document/renderMarkdown.ts`
