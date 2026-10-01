# 組織設定・マスタ（Organization Settings）

## 概要

組織の **名前とアイコン**、**既定値 JSON**（ボードリスト名、スペースステータス名、資料カテゴリ名）、二種の **ラベル体系**（スペース／タスク：各カテゴリ＋ラベル＋並べ替え）を管理する。設定画面 `/org/{slug}/settings` の各タブから操作する。メンバー招待タブの詳細は [organization.md](./organization.md)。

既定ボードリストはスペース作成時のリストシードに、スペースステータスはスペースの `status` 検証に、資料カテゴリは資料の `category` 検証に使われる。

## 本書の範囲

- 組織名、組織アイコン、`GET/PATCH …/settings`、ラベル／カテゴリ CRUD・reorder、設定 UI

対象外: slug の変更（API にない）、メンバー管理の詳細

---

## データモデル

| 対象 | 要点 |
| --- | --- |
| `organizations.name` / `slug` / `icon_path` | 名前は変更可。slug は作成時に発行したランダムコードのまま。アイコンは公開ディスク `org-icons/` |
| `organizations.default_board_list_names` | JSON。`{name, color_index}` 配列。件数の上限はない |
| `default_workspace_status_names` | 同上 |
| `default_document_category_names` | 同上。未設定時は共有 JSON の `その他` |
| `workspace_label_categories` / `workspace_labels` | スペースラベル |
| `task_label_*` | タスクラベル |

正規化: `DefaultBoardLists`, `DefaultWorkspaceStatuses`, `DefaultDocumentCategories`, `DefaultNamedColorItems`。

---

## API 要約

| Method | Path | 権限 | 説明 |
| --- | --- | --- | --- |
| `GET` | `/orgs/{org}/settings` | メンバー | 名前・slug・`icon_url`・既定値・`role` |
| `PATCH` | `/orgs/{org}/settings` | **admin** | `name` と三つの既定配列のいずれか／複数 |
| `POST` | `/orgs/{org}/icon` | **admin** | multipart `icon`（画像、最大 2MB）。旧ファイルを置換 |
| `DELETE` | `/orgs/{org}/icon` | **admin** | アイコンを外す |
| CRUD + reorder | `/workspace-label-categories`, `/workspace-labels` | 読取:メンバー／書込:**admin** | |
| 同上 | `/task-label-*` | 同上 | |

空のボードリスト設定だと、新規スペースはリストなしで作成される。

---

## フロント

| 部品 | タブ |
| --- | --- |
| `SettingsOrganizationPanel` → `OrganizationSettingsModal` | 組織設定（名前・アイコン） |
| `SettingsDefaultBoardListsPanel` | リスト設定 |
| `SettingsDefaultWorkspaceStatusesPanel` | ステータス設定 |
| `SettingsDefaultDocumentCategoriesPanel` | 資料カテゴリ |
| `SettingsLabelsPanel` → `SettingsLabelCategoryPanel` | ラベル（workspace/task） |
| `SettingsMembersPanel` | ユーザー（organization.md） |
| `SettingsSidebar`, `useOrgSettingsPageData` | シェル・データ |
| `LabelAddModal`, `LabelFormModal`, `LabelEditModal`, `LabelCategoryNameModal` | ラベルの追加・編集・カテゴリ名 |

`canManageSettings = role === 'admin'`。メンバーは参照のみ。

タブキー: `organization` / `members` / `workspace_labels` / `workspace_statuses` / `default_board_lists` / `task_labels` / `document_categories`。旧クエリ `labels` と `project_labels` はスペースラベル、`invites` はユーザー設定に寄せる。

---

## ギャップ

- slug は変更できない
- 色はプリセット（`LabelColorPresets` 等）に依存

---

## 主要ファイル

- `OrganizationController`（`settings` / `updateSettings`）
- `backend/app/Http/Controllers/Api/Workspace/WorkspaceLabelController.php`, `WorkspaceLabelCategoryController.php`
- `backend/app/Http/Controllers/Api/Task/TaskLabelController.php`, `TaskLabelCategoryController.php`
- `backend/app/Support/Workspace/DefaultBoardLists.php`, `DefaultWorkspaceStatuses.php`
- `backend/app/Support/Document/DefaultDocumentCategories.php`
- `frontend/app/pages/org/[slug]/settings.vue`
- `frontend/app/components/settings/*`
