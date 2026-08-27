# スペース（Workspaces）

## 概要

組織配下の作業単位。UI では「スペース」、コード・API では **`workspace`**。旧設計書の `project` に相当する。

CRUD・アーカイブ／復元／完全削除・ステータス・複数担当者・スペースラベル・関連スペース／資料を持つ。作成時、組織設定の既定ボードリスト名からリストをシードする。

アクセス制御は **組織メンバーシップのみ**（`workspace_memberships` / visibility は廃止済み）。組織メンバーなら当該組織の全スペースを参照・編集できる。

## 本書の範囲

- スペース一覧・詳細シェル・メタデータの CRUD／アーカイブ

対象外:

- ボード列・カード操作 → [board.md](./board.md)
- タスク本体 → [tasks.md](./tasks.md)
- WBS → [wbs.md](./wbs.md)
- 既定ステータス／ラベルマスタ → [organization-settings.md](./organization-settings.md)

関連: [`../requirements/projects.md`](../requirements/projects.md)、[`../database/schema-projects.md`](../database/schema-projects.md)（命名は project のままの箇所あり）

---

## 全体フロー

```
[/org/{slug}/workspaces] 一覧
        │ 行クリック（prefetch）
        ▼
[/org/{slug}/workspaces/{id}] 詳細シェル
        ├── ボード（既定）
        └── ?view=wbs → WBS
```

アーカイブ済みスペースを ID 直叩きすると一覧へリダイレクト。

---

## データモデル

| テーブル | 要点 |
| --- | --- |
| `workspaces` | `organization_id`, `created_by`, `name`, `description`, `status`（nullable 文字列）, `archived_at`, `deleted_at`。`updated_at` はスペース行の更新に加え、タスク／リスト／コメント等のスペース内変更でも更新する（一覧の「更新日時順」用） |
| `workspace_assignees` | 複数担当 |
| `workspace_workspace_label` | 組織の workspace labels との pivot |
| `workspace_related_workspace` / `workspace_related_document` | 関連 |

ステータス値は組織の `default_workspace_status_names` に含まれる名前で検証。

---

## API 要約

プレフィックス `/api/orgs/{organization}`、`org.member`。

| Method | Path | 説明 |
| --- | --- | --- |
| `GET/POST` | `/workspaces` | 一覧／作成 |
| `GET` | `/workspaces/archived` | アーカイブ一覧 |
| `GET/PATCH` | `/workspaces/{workspace}` | 詳細／更新 |
| `GET` | `/workspaces/{workspace}/members` | **組織メンバー一覧**（担当候補。スペース固有メンバーではない） |
| `PUT/DELETE` | `…/related-workspaces[/{id}]` | 関連スペース |
| `PUT/DELETE` | `…/related-documents[/{id}]` | 関連資料 |
| `POST` | `…/archive` | アーカイブ（メンバー可） |
| `POST` | `…/unarchive` | 復元（**admin のみ**） |
| `DELETE` | `…` | 完全削除（アーカイブ済みかつ **admin**） |

アーカイブ中は属性更新・関連同期・ボード／タスク書き込みをブロック。

---

## フロント

| 画面 / 部品 | 役割 |
| --- | --- |
| `pages/org/[slug]/workspaces/index.vue` | 一覧、ラベル絞り込み、検索、作成、アーカイブモーダル |
| `pages/org/[slug]/workspaces/[id].vue` | 詳細シェル（ボード／WBS） |
| `WorkspaceCreateModal`, `WorkspaceDetailSidebar` | 作成・メタ編集 |
| `WorkspaceAssigneeSelect`, `WorkspaceStatusSelect` | 担当・ステータス |
| `ArchivedNamedItemsModal` | アーカイブ一覧 |

リアルタイム: スペース CRUD／アーカイブ自体のブロードキャストは**なし**。

---

## 要件との差分

| 要件 | 実装 |
| --- | --- |
| `project_memberships` / 可視性 | 廃止。組織メンバー＝アクセス可 |
| 論理削除が主 | アーカイブ → admin が完全削除 |
| テーブル名 `projects` | `workspaces` |

---

## 主要ファイル

- `backend/app/Http/Controllers/Api/WorkspaceController.php`
- `backend/app/Models/Workspace.php`
- `backend/app/Support/DefaultBoardLists.php`, `DefaultWorkspaceStatuses.php`
- `frontend/app/pages/org/[slug]/workspaces/index.vue`, `[id].vue`
- マイグレーション: `…_drop_workspace_visibility_and_memberships.php`
