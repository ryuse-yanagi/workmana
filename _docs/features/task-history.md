# タスク履歴（Task History）

## 概要

タスク変更の **書き込み専用** 監査ログ。`Task::observe(TaskObserver)` およびコメント／複数担当同期から `task_histories` へ挿入する。

**一覧・詳細の API も UI もない。** 製品機能として公開されるまでの仕様メモ。

## 本書の範囲

- 永続化トリガーとイベント種別、現状のギャップ

対象外: タイムライン UI（未実装）、添付変更の監査（未記録）

関連: [`../database/enums.md`](../database/enums.md)（`task_history.event_type`。コードの `start_date_changed` がドキュメント漏れの場合あり）、[tasks.md](./tasks.md)

---

## データモデル

`task_histories`: `event_type`, `field_name`, `before_value`, `after_value`, `actor_id`, `created_at`（`updated_at` なし）

Enum: `App\Enums\TaskHistoryEventType`  
登録: `AppServiceProvider` で `Task::observe(TaskObserver)`

タスク／スペース完全削除時に履歴も削除。

---

## 書き込みトリガー

| ソース | イベント例 |
| --- | --- |
| `TaskObserver::created` | `task_created` |
| `TaskObserver::updated` | `status_changed`, `priority_changed`, `list_changed`（`list_id`）, `start_date_changed`, `due_date_changed`, `task_updated`（title/description）, `task_deleted`（`deleted_at` 設定時） |
| `TaskCommentController` | `comment_added` / `comment_edited` / `comment_deleted` |
| `TaskController::syncAssigneesWithHistory` | `assignee_changed`（`field_name=assignee_ids`, JSON） |

`actor_id` は可能なとき `auth()->id()`。HTTP 外コンテキストでは null になり得る。

---

## 記録されない主な操作

- ラベル変更、チェックリスト、親子、リスト移動、見積、アーカイブ／アンアーカイブ（ソフトデリート以外）、添付、リアクション

---

## API / フロント

なし。

---

## 今後

公開時は本ファイルを E2E 仕様に拡張し、読取 API・タイムライン UI・未記録イベントの方針を追記する。

---

## 主要ファイル

- `backend/app/Observers/TaskObserver.php`
- `backend/app/Models/TaskHistory.php`
- `backend/app/Enums/TaskHistoryEventType.php`
- `backend/database/migrations/2026_04_13_000010_create_task_histories_table.php`
