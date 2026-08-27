# 資料（Documents）

## 概要

組織スコープの **共有 Markdown 資料**（モデル `SharedDocument`）。一覧・作成・詳細編集／プレビュー・カテゴリ・資料ラベル・アーカイブ・関連スペース／関連資料を持つ。

本文は DB の longText に生 Markdown を保存。**サニタイズ付き HTML 化はフロントのみ**（`renderMarkdownToSafeHtml`）。サーバ側サニタイズ・版管理・資料添付・リアルタイム同期はなし。

カテゴリは FK テーブルではなく、組織の `default_document_category_names` にある **名前文字列**。

## 本書の範囲

- 資料 CRUD、アーカイブ、関連付け、Markdown UI

対象外: カテゴリ／ラベルマスタ編集 → [organization-settings.md](./organization-settings.md)

---

## 全体フロー

```
[/org/{slug}/documents] 一覧（検索・ソート・作成・アーカイブ）
        │
        ▼
[/org/{slug}/documents/{id}] サイドバー（メタ）＋ Markdown 編集／プレビュー
```

---

## データモデル

| テーブル | 要点 |
| --- | --- |
| `shared_documents` | `name`, `description`, `body`, `category`, `archived_at`, soft deletes |
| `document_labels` 系 | カテゴリ＋ラベル＋ pivot `document_document_label` |
| `document_related_document` | 関連資料（双方向同期） |
| `workspace_related_document` | 関連スペース |

`document_viewers` は実装後に削除済み（資料単位の閲覧者はなし）。

---

## API 要約

`/api/orgs/{organization}/…`、`org.member`

| Method | Path | 説明 |
| --- | --- | --- |
| `GET/POST` | `/documents` | 一覧／作成 |
| `GET` | `/documents/archived` | アーカイブ一覧 |
| `GET/PATCH/DELETE` | `/documents/{document}` | 詳細／更新／完全削除 |
| `POST` | `…/archive` \| `…/unarchive` | アーカイブ／復元（復元は **admin**） |
| `PUT/DELETE` | `…/related-workspaces[/{workspace}]` | 関連スペース |
| `PUT/DELETE` | `…/related-documents[/{related}]` | 関連資料 |

- アーカイブ中の更新は 403
- 完全削除はアーカイブ後・admin（`PermanentDeleter`）
- 関連スペース ID は操作者のアクセス可能なものに限定

---

## フロント

| 画面 / 部品 | 役割 |
| --- | --- |
| `pages/…/documents/index.vue` | 一覧 |
| `pages/…/documents/[id].vue` | 詳細編集 |
| `DocumentCreateModal`, `DocumentDeleteModal` | 作成・削除確認 |
| `DocumentCategorySelect`, `DocumentLabelSelect` | カテゴリ・ラベル |
| `useOrgDocumentsPageData.ts` | ページデータ |
| `utils/renderMarkdown.ts` | プレビュー用サニタイズ |

---

## ギャップ

- requirements / database に資料専用ドキュメントが薄い（本ファイルが E2E の正）
- サーバ側 Markdown サニタイズなし
- 版管理・添付・リアルタイムなし

---

## 主要ファイル

- `backend/app/Http/Controllers/Api/SharedDocumentController.php`
- `backend/app/Models/SharedDocument.php`
- `backend/app/Support/DefaultDocumentCategories.php`, `BidirectionalRelationSync.php`
- `frontend/app/pages/org/[slug]/documents/index.vue`, `[id].vue`
- `frontend/app/utils/renderMarkdown.ts`
