# 認可

組織をテナント境界にする。誰であるかは [session.md](./session.md)。判定の正本は `OrganizationAccess` と `tests/Feature/Organizations/AccessControlApiTest.php`。

## 二段のゲート

1. **組織に所属しているか** — `EnsureOrganizationMember`。`/orgs/{organization}` の入口で、非組織ユーザーは 403。通過時に `organization_membership`（pivot）をリクエスト属性へ載せる。
2. **そのリソースを見てよいか** — コントローラと `User::canAccessWorkspace`。組織ユーザーは組織内の全スペースと全資料を開ける。

WebSocket の `workspaces.{id}` も同じ `canAccessWorkspace` で拒否する。

## 組織ロール

`memberships.role` は `admin` と `member`（`MembershipRole`）。設計メモに残る `project_leader` は現行の組織ロールではない。

| 操作 | admin | member |
| --- | --- | --- |
| 担当スペースの閲覧・通常編集 | 可 | 可 |
| 担当していないスペース | 可（組織内のすべて） | 可（組織内のすべて） |
| 組織内の資料 | 可（組織内のすべて） | 可（組織内のすべて） |
| ユーザーのロール変更・招待・組織設定の更新 | 可 | 不可 |
| スペース／タスク／資料のアーカイブ・復元・完全削除 | 可 | 不可 |

最後の管理者はロール変更と削除ができない。自分自身のユーザー削除は API が拒否する。

## スペースと資料

| 対象 | ユーザーから見える条件 | 編集 |
| --- | --- | --- |
| スペース | 組織ユーザーなら担当の有無にかかわらず可 | 閲覧できれば編集可 |
| 資料 | 組織ユーザーなら可 | 閲覧できるユーザーは通常編集可。アーカイブ操作は管理者のみ |

担当者の更新は `OrganizationAccess::syncWorkspaceAssignees` が `workspace_assignees` を書く。タスク担当者の候補は組織ユーザー（`memberships`）から選ぶ。

スペースが別組織の ID で指定された場合は、所属チェックのあと `ensureWorkspaceBelongsToOrganization` が 404 にする。
