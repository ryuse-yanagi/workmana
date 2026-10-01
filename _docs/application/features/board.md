# ボード（Board / カンバン）

## 概要

スペース詳細の既定ビュー。列は `lists`（モデル `BoardList`）、カードは非アーカイブのタスク。`vuedraggable` で列の並べ替え、カードの同一列内並べ替え、**列またぎ移動**（`list_id` 更新＋各列 `tasks/reorder`）を行う。

作成・詳細はモーダル。リスト／タスク操作は Laravel イベント経由で同一スペースの他クライアントへ配信する（方式は [`../../architecture/realtime/sync.md`](../../architecture/realtime/sync.md)）。

## 本書の範囲

- リスト CRUD／並べ替え、ボード上のカード操作導線、ボード系リアルタイムイベント名

対象外:

- タスクフィールドの意味・チェックリスト等 → [tasks.md](./tasks.md)
- WBS／ガント → [wbs.md](./wbs.md)
- Reverb／Echo の基盤 → architecture

用語: スペース詳細 URL `/org/{slug}/workspaces/{id}`（`?view` なし or `board`）。

---

## 全体フロー

```
[スペース詳細 board]
  ├── GET lists + tasks（ページデータ）
  ├── DnD 列 → PATCH lists/reorder
  ├── DnD カード（同列）→ PATCH lists/{id}/tasks/reorder
  ├── DnD カード（列移動）→ PATCH task(list_id) + reorder
  ├── カードクリック → TaskDetailModal
  └── ＋ → TaskAddModal / ListFormModal
```

---

## データモデル

| テーブル | 要点 |
| --- | --- |
| `lists` | `workspace_id`, `name`, `color_index`, `sort_order`。UNIQUE `(workspace_id, name)` |
| `tasks.list_id` | **必須**（Kanban 配置）。`mapped_status` による status 同期はない |

スペース作成時、組織の `default_board_list_names` からリストをシード（空ならリストなし）。

---

## API 要約

`/api/orgs/{organization}/workspaces/{workspace}/…`、`org.member`。アーカイブ済みスペースでは書き込み不可。

| Method | Path | 説明 |
| --- | --- | --- |
| `GET/POST` | `/lists` | 一覧／作成 |
| `PATCH` | `/lists/reorder` | `list_ids` 全件 |
| `PATCH/DELETE` | `/lists/{boardList}` | 更新／削除 |
| `PATCH` | `/lists/{boardList}/tasks/reorder` | 当該列の非アーカイブタスク ID 全件 |

タスク CRUD／移動は [tasks.md](./tasks.md) のルート。

### リスト削除ルール

- **最後の 1 列は削除不可**
- 残タスクは別リストへ移す（`list_id = null` にはしない）

---

## リアルタイム（イベント名）

チャンネル: `private-workspaces.{workspaceId}`（詳細は [`../../architecture/realtime/sync.md`](../../architecture/realtime/sync.md)）。

| イベント |
| --- |
| `ListCreated`, `ListUpdated`, `ListDeleted`, `ListsReordered` |
| `TaskCreated`, `TaskUpdated`, `TaskArchived`, `TaskRestored`, `TaskDeleted`, `TasksReordered` |

専用の `TaskMoved` はない（移動は `TaskUpdated` + `TasksReordered`）。

---

## フロント

| 部品 | 役割 |
| --- | --- |
| `WorkspaceBoard.vue` | カンバン本体 |
| `WorkspaceDetailView.vue` | `mode=board` 時 |
| `WorkspaceViewSwitcher.vue` | ボード ↔ WBS |
| `TaskBoardCard.vue` | カード |
| `TaskAddModal`, `TaskDetailModal` | タスクの追加・詳細 |
| `ListFormModal` | リストの作成・名前変更 |
| `ConfirmModal` | リスト削除とアーカイブの確認。最後の 1 列は削除不可 |
| `ArchivedTasksModal` | アーカイブ済みタスク |
| `useWorkspaceRealtimeChannel.ts` | Echo 購読 |

---

## 認可

スペースを編集できる人だけが列とカードを変更できる（[`../../architecture/auth/authorization.md`](../../architecture/auth/authorization.md)）。タスクのアーカイブ・復元・完全削除は組織 admin。

---

## 主要ファイル

- `backend/app/Http/Controllers/Api/Workspace/ListController.php`
- `backend/app/Models/Workspace/BoardList.php`
- `backend/app/Events/List/`, `backend/app/Events/Task/TasksReordered.php`
- `frontend/app/components/workspace/WorkspaceBoard.vue`
- `frontend/app/composables/workspace/useWorkspaceViewRoutes.ts`
