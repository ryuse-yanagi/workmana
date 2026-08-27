# WBS／ガント（WBS）

## 概要

同一スペース詳細上のビュー。`?view=wbs`（レガシー `list`/`table`/`gantt` や `/wbs` パスはミドルウェアで寄せる）。階層テーブル＋任意のガント列（月カレンダー、バーの日付ドラッグ、バー色）を表示する。

専用テーブルはなく **`tasks` の階層・日付・色・並び**を使う。編集モードの DnD で親付け替え・並べ替えを行い、`PATCH …/tasks/wbs/reorder` に**全アクティブタスク**を送る。

## 本書の範囲

- WBS ビュー、ガント表示、WBS 並べ替え API、関連イベント

対象外: タスクフィールド全般 → [tasks.md](./tasks.md)、ボード → [board.md](./board.md)、同期基盤 → [`../architecture/realtime-sync.md`](../architecture/realtime-sync.md)

---

## 全体フロー

```
[/org/{slug}/workspaces/{id}?view=wbs]
  → GET …/tasks/wbs
  → 表示項目モーダル（localStorage 連携）
  → 編集モード DnD → PATCH …/tasks/wbs/reorder
  → セル／ポップオーバー編集 → PATCH …/tasks/{id}
  → ガントバー操作 → 日付 PATCH
```

ビュー切替: `WorkspaceViewSwitcher`（ボード URL ↔ `?view=wbs`）。

---

## データモデル

追加テーブルなし。利用する主な列:

- `parent_task_id`, `sort_order`, `is_parent_task`
- `start_date`, `due_date`, `gantt_bar_color`
- `effort_*`, 担当・ラベル等は通常タスクと同じ

アーカイブ済みタスクは WBS 一覧から除外。

---

## API 要約

| Method | Path | 説明 |
| --- | --- | --- |
| `GET` | `/workspaces/{workspace}/tasks/wbs` | WBS 用タスクツリー |
| `PATCH` | `/workspaces/{workspace}/tasks/wbs/reorder` | body `{ tasks: [{ id, sort_order, parent_task_id }] }`（全件必須） |

フィールド更新は通常の `PATCH …/tasks/{task}`。

イベント: `WbsTasksReordered`（同一チャンネル `private-workspaces.{id}`）。タスク更新系イベントも共有。

---

## フロント

| 部品 | 役割 |
| --- | --- |
| `WorkspaceWbsView.vue` | 本体 |
| `WorkspaceProjectView.vue` | WBS 時のクロム（表示項目・追加・編集） |
| `WbsDisplayItemsModal.vue` | 表示列 |
| `WorkspaceGanttColorPopover.vue` | バー色 |
| `useWorkspaceWbsPageData`, `useWbsTaskDragReorder`, `useWbsTaskGroups`, `useWbsColumnResize`, `useGanttCalendar`, `useGanttBarInteraction` | データ・操作 |
| `wbs-path.global.ts` | 旧パス寄せ |

表示キー例: `title`（必須）, `assignees`, `labels`, `list`, `startDate`, `dueDate`, `effort`, `notes`, `gantt`

---

## 認可

[tasks.md](./tasks.md) と同じ（組織メンバー編集可。アーカイブ済みスペースは書き込み不可）。

---

## ギャップ

- 独立した要件ドキュメントはなし（本ファイルが E2E の正）
- ガントは別ルートではなく **表示列トグル**
- 詳細な同期経路は [`../architecture/realtime-sync.md`](../architecture/realtime-sync.md) を参照

---

## 主要ファイル

- `TaskController`（`wbsIndex`, `wbsReorder`）
- `backend/app/Events/WbsTasksReordered.php`
- `frontend/app/components/workspace/WorkspaceWbsView.vue`
- `frontend/app/composables/useWorkspaceViewRoutes.ts`
- `frontend/app/middleware/wbs-path.global.ts`
