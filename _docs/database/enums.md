# 列挙値

正本はマイグレーションの `CHECK` と PHP の enum。ここに無い値を DB は強制しない。

## memberships.role / organization_invites.role

PostgreSQL では `CHECK (role IN ('admin','member'))`。`project_leader` は現行スキーマにない。

| 値 | 意味 |
| --- | --- |
| `admin` | 組織管理者 |
| `member` | メンバー |

PHP: `App\Enums\MembershipRole`。

## tasks.priority

PostgreSQL では `CHECK (priority IN ('low','medium','high'))`。既定 `medium`。

| 値 | 意味 |
| --- | --- |
| `low` | 低 |
| `medium` | 中 |
| `high` | 高 |

PHP: `App\Enums\TaskPriority`。タスクに `status` 列はない。ボード上の位置は `lists` への所属。
