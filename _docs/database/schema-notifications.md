# スキーマ: アプリ内通知

マイグレーション: `backend/database/migrations/2026_07_31_000004_create_notifications_table.php`  
モデル: `App\Models\Notification\AppNotification`（`backend/app/Models/Notification/AppNotification.php`）。`$table` は `app_notifications`。

種別・`data` の中身・作成条件は [アプリ内通知](../application/features/notification.md)。`type` は DB の enum ではなく varchar。

## app_notifications

ユーザー宛て。配信チャンネルではなく、ヘッダー一覧用の行。組織 ID の列は無く、複数組織の通知が同じユーザーに混在する。

| カラム | 型 | NULL | 説明 |
| --- | --- | --- | --- |
| id | bigint PK | NO | |
| user_id | bigint FK → users.id | NO | 受信者。`ON DELETE CASCADE` |
| type | varchar(64) | NO | 通知種別。`task.assigned` / `task.due_date_changed` / `task.archived` / `task.restored` / `task.deleted` / `workspace.member_added` / `organization.role_changed` / `organization.invited` |
| data | json | NO | 表示と遷移に使うペイロード |
| read_at | timestamp | YES | 未読は NULL |
| created_at / updated_at | timestamp | YES | 一覧 API は `updated_at` を返さない |

インデックス: `(user_id, read_at, created_at)`。

`User::appNotifications()` が HasMany。
