# スペース（Workspaces）

## 概要

組織配下の作業単位。UI では「スペース」、コード・API では **`workspace`**。旧設計書の `project` に相当する。

CRUD・アーカイブ／復元／完全削除・ステータス・複数担当者・スペースラベル・個人ごとのピン留めを持つ。資料はスペースに 1 対多で所属する。作成時、組織設定の既定ボードリスト名からリストをシードする。

組織メンバーは担当の有無にかかわらず、組織内の全スペースを開いて編集できる。アーカイブ・復元・完全削除は管理者のみ。判定の詳細は [`../../architecture/auth/authorization.md`](../../architecture/auth/authorization.md)。

## 本書の範囲

- スペース一覧・詳細シェル・メタデータの CRUD／アーカイブ

対象外:

- ボード列・カード操作 → [board.md](./board.md)
- タスク本体 → [tasks.md](./tasks.md)
- WBS → [wbs.md](./wbs.md)
- 既定ステータス／ラベルマスタ → [organization-settings.md](./organization-settings.md)

関連: [`../../database/schema-workspaces.md`](../../database/schema-workspaces.md)

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
| `workspaces` | `organization_id`, `created_by`, `name`, `description`, `status`（nullable 文字列）, `archived_at`, `deleted_at`。`updated_at` はスペース行の更新に加え、タスク／リスト等のスペース内変更でも更新する（一覧の「更新日時順」用） |
| `workspace_assignees` | 複数担当。スペースの可視性判定には使わない |
| `workspace_pins` | ユーザーごとのピン（`pinned_at`） |
| `workspace_workspace_label` | 組織の workspace labels との pivot |
| `shared_documents.workspace_id` | そのスペースの資料（1 資料につき 1 スペース） |

ステータス値は組織の `default_workspace_status_names` に含まれる名前で検証。

---

## API 要約

プレフィックス `/api/orgs/{organization}`、`org.member`。

| Method | Path | 説明 |
| --- | --- | --- |
| `GET/POST` | `/workspaces` | 一覧／作成 |
| `GET` | `/workspaces/archived` | アーカイブ一覧 |
| `GET/PATCH` | `/workspaces/{workspace}` | 詳細／更新 |
| `GET` | `/workspaces/{workspace}/members` | そのスペースの担当者一覧 |
| `POST` | `…/pin` \| `…/unpin` | 自分だけのピン留め／解除。閲覧できるスペースが対象。応答の `pinned` / `pinned_at` |
| `POST` | `…/archive` \| `…/unarchive` | アーカイブ／復元（**admin**） |
| `DELETE` | `…` | 完全削除（アーカイブ済みかつ **admin**） |

アーカイブ中は属性更新・ボード／タスク書き込みをブロック。

---

## フロント

| 画面 / 部品 | 役割 |
| --- | --- |
| `pages/org/[slug]/workspaces/index.vue` | 一覧、ラベル絞り込み、検索、作成、ピン留め、アーカイブモーダル |
| `pages/org/[slug]/workspaces/[id]/index.vue` | 詳細シェル（ボード／WBS） |
| `WorkspaceFormModal` | 作成とメタ編集 |
| `WorkspaceDetailSidebar` | 詳細のメタと、そのスペースの資料一覧 |
| `WorkspaceAssigneeSelect`, `WorkspaceStatusSelect` | 担当・ステータス |
| `ArchivedNamedItemsModal` | アーカイブ一覧 |

リアルタイム: スペース CRUD／アーカイブ自体のブロードキャストは**なし**。

---

## 主要ファイル

- `backend/app/Http/Controllers/Api/Workspace/WorkspaceController.php`
- `backend/app/Models/Workspace/Workspace.php`
- `backend/app/Support/Workspace/DefaultBoardLists.php`, `DefaultWorkspaceStatuses.php`
- `frontend/app/pages/org/[slug]/workspaces/index.vue`, `[id]/index.vue`
