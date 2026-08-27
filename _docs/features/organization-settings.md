# 組織設定・マスタ（Organization Settings）

## 概要

組織の **既定値 JSON**（ボードリスト名、スペースステータス名、資料カテゴリ名）と、三種の **ラベル体系**（スペース／タスク／資料：各カテゴリ＋ラベル＋並べ替え）を管理する。設定画面 `/org/{slug}/settings` の各タブから操作する。メンバー招待タブの詳細は [organization.md](./organization.md)。

既定ボードリストはスペース作成時のリストシードに、スペースステータスはスペースの `status` 検証に、資料カテゴリは資料の `category` 検証に使われる。

## 本書の範囲

- `GET/PATCH …/settings`、ラベル／カテゴリ CRUD・reorder、設定 UI

対象外: 組織名・slug の変更（settings PATCH の対象外）、メンバー管理の詳細

---

## データモデル

| 対象 | 要点 |
| --- | --- |
| `organizations.default_board_list_names` | JSON。`{name, color_index}` 配列（最大 20） |
| `default_workspace_status_names` | 同上 |
| `default_document_category_names` | 同上。未設定時のフォールバック例: `その他` |
| `workspace_label_categories` / `workspace_labels` | スペースラベル |
| `task_label_*` | タスクラベル |
| `document_label_*` | 資料ラベル |

正規化: `DefaultBoardLists`, `DefaultWorkspaceStatuses`, `DefaultDocumentCategories`, `DefaultNamedColorItems`。

---

## API 要約

| Method | Path | 権限 | 説明 |
| --- | --- | --- | --- |
| `GET` | `/orgs/{org}/settings` | メンバー | 既定値＋`role` |
| `PATCH` | `/orgs/{org}/settings` | **admin** | 三つの既定配列のいずれか／複数 |
| CRUD + reorder | `/workspace-label-categories`, `/workspace-labels` | 読取:メンバー／書込:**admin** | |
| 同上 | `/task-label-*`, `/document-label-*` | 同上 | |

空のボードリスト設定だと、新規スペースはリストなしで作成される。

---

## フロント

| 部品 | タブ |
| --- | --- |
| `SettingsDefaultBoardListsPanel` | リスト設定 |
| `SettingsDefaultWorkspaceStatusesPanel` | ステータス設定 |
| `SettingsDefaultDocumentCategoriesPanel` | 資料カテゴリ |
| `SettingsLabelsPanel` → `SettingsLabelCategoryPanel` | ラベル（workspace/task/document） |
| `SettingsMembersPanel` | ユーザー（organization.md） |
| `SettingsSidebar`, `useOrgSettingsPageData` | シェル・データ |
| `LabelCreateModal`, `LabelEditModal`, `LabelCategoryNameModal` | ラベル操作 |

`canManageSettings = role === 'admin'`。メンバーは参照のみ。

クエリ例: `?tab=default_board_lists` / `workspace_statuses` / `document_categories` / `labels` / `members`

---

## ギャップ

- 組織名／slug 編集はこの機能外
- 色はプリセット（`LabelColorPresets` 等）に依存

---

## 主要ファイル

- `OrganizationController`（`settings` / `updateSettings`）
- `backend/app/Http/Controllers/Api/*Label*.php`
- `backend/app/Support/DefaultBoardLists.php` 他
- `frontend/app/pages/org/[slug]/settings.vue`
- `frontend/app/components/settings/*`
