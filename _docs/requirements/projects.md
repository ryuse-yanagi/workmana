# プロジェクト・リスト・プロジェクト所属

## 概要

本システムは、組織（organization）配下にプロジェクト（project）を置き、プロジェクト単位でタスクを管理する。  
プロジェクトにはリスト（list、テーブル名 `lists`）で作業を分類でき、ユーザーは **組織所属（memberships）** を前提として **プロジェクト所属（project_memberships）** により参加する。

## 本書の範囲

- プロジェクト・リスト・プロジェクトメンバーに関する**要件定義**（満たすべき挙動）を記載する。
- タスク・コメント・履歴・通知の細目は `docs/requirements/tasks.md` を参照する。
- 認証・組織招待・組織所属の細目は `docs/requirements/auth.md` を参照する。
- 画面遷移・UI コンポーネント・文言は `docs/ui` に記載する。
- ロールごとの操作可否の網羅は `docs/permissions` に記載する。
- エンドポイント・リクエスト形式・レスポンス形式は `docs/api` に記載する。
- テーブル定義・インデックス・マイグレーションは `docs/database` に記載する。
- organization に依存する API の**コンテキスト検証**は `docs/requirements/auth.md`（組織コンテキスト）および `docs/api` に従う。

## 用語定義

- Project: タスク・リストが所属する作業単位（organization の子）
- List: プロジェクト内でタスクを分類する単位（`docs/requirements/tasks.md` と同一。DB テーブル名は `lists`）
- Project membership: ユーザーとプロジェクトの関係（`project_memberships`）
- Project role: プロジェクト内の役割区分（`project_memberships.role`。列挙値の定義は `docs/database`）
- Archived project: 運用上ロックしたプロジェクト（`archived_at IS NOT NULL`）。**作成・削除・構造変更**（メンバー変更・リスト変更）を禁止する（詳細は「プロジェクトのアーカイブ・復帰・削除」）。

## 画面一覧

遷移・操作の詳細は `docs/ui` に記載する。

- プロジェクト一覧画面
- プロジェクト詳細（設定）画面
- プロジェクト作成画面
- プロジェクト編集画面
- リスト一覧・編集 UI（プロジェクト詳細に内包してもよい）
- プロジェクトメンバー管理画面

## 機能要件

一覧・詳細の**参照可否**および各操作の**実行可否**は、原則として **`project_memberships` と `project_memberships.role` を基準**とし、**organization ロール（`memberships.role`）による拡張**（例: 組織管理者が組織内の全プロジェクトを一覧できるか等）は **`docs/permissions` で定義**する（`docs/requirements/auth.md` のデータモデルと整合）。以下の各節における権限・認可の記述もこの方針に従う。

### プロジェクト参照（一覧・詳細）

- プロジェクト**一覧**は、**現在の organization コンテキスト**に属するプロジェクトのうち、上記方針に従い認可フィルタした結果を返す。
- プロジェクト**詳細**の参照可否は一覧と**同一の認可ルール**に従う。クエリ・応答形式は `docs/api`、画面は `docs/ui` を参照する。
- **アーカイブ済み**（`archived_at IS NOT NULL`）のプロジェクトは、**既定では一覧に含めない**。
- アーカイブ済みを一覧に含める場合は、クライアントが **`archived=true` を明示的に指定**したとき**のみ**とする（クエリパラメータ名・型・既定値は `docs/api` で定義し、画面導線は `docs/ui` で定義する）。
- 一覧の既定ソートは `created_at DESC` とする（別ソート指定があれば `docs/api` で定義する）。
- 一覧・詳細に表示する属性の最低限は、少なくとも `name`、`archived_at` の有無、メンバー数（集計）を含めてよい。詳細項目は `docs/ui` で定義する。

### プロジェクト作成

- プロジェクトは、**`docs/permissions` で定義するプロジェクト作成権限**を持つユーザーのみ作成可能とする。
- 必須項目は `name`、`organization_id` とする。`organization_id` は**現在の organization コンテキスト**と一致させる。
- `name` は前後空白を除去して保存し、空文字は不可とする。
- **同一 `organization_id` 内で `project.name` の一意性は保証しない**（同名プロジェクトが複数存在し得る）。UI での識別方法（`id` 表示、作成日時等）は `docs/ui` で定義する。
- 作成者を **プロジェクトメンバー**として自動登録するかどうか（および付与する `project_memberships.role`）は `docs/permissions` で定義する。要件として、作成直後に**誰もメンバーがいない**プロジェクトが残らないよう、**少なくとも作成者をメンバーとして登録する**ことを推奨する。
- プロジェクト作成時に**既定リスト**を自動作成するかは任意とする。作成する場合は `name` および `sort_order` の初期値は `docs/ui` / `docs/api` で定義する。

### プロジェクト更新

- プロジェクトの更新は、**`docs/permissions` で定義する更新権限**を持つユーザーのみ可能とする。
- **`archived_at IS NOT NULL` のプロジェクト**に対する**属性更新**（`name` / `description` 等）は**禁止**する（**復帰**（アーカイブ解除）操作は除く。復帰自体は「プロジェクトのアーカイブ・復帰・削除」を参照）。
- 更新可能項目の一覧（例: `name`、`description` 等）は `docs/api` で定義する。`organization_id` の変更は**許可しない**（別 organization への移動は行わない）。

### プロジェクトのアーカイブ・復帰・削除

- **アーカイブ**は、**アーカイブ権限**を持つユーザーのみ実行可能とする。実行時に `archived_at` に日時を設定する（再実行は冪等に成功として扱う）。
- **復帰**（アーカイブ解除）は、**復帰権限**を持つユーザーのみ実行可能とする。`archived_at` をクリアする（再実行は冪等に成功として扱う）。
- **アーカイブ済みプロジェクト**（`archived_at IS NOT NULL` かつ `deleted_at IS NULL`）では、次を**すべて禁止**し、要求は拒否する。  
  - **作成**: 当該プロジェクト配下の**タスク新規作成**、**リスト新規作成**を含む（その他の新規リソース作成の有無は `docs/api` で補足してよい）。  
  - **削除**: **当該プロジェクトの論理削除**（`deleted_at` の設定）、**リスト削除**、**当該プロジェクト配下タスクの削除**（論理削除を含む）を含む。  
  - **構造変更**: **メンバー変更**（`project_memberships` の追加・削除・`role` 変更）、**リスト変更**（リストの作成・更新・削除・並び替え）。  
- **復帰**（アーカイブ解除）および**参照**（一覧・詳細・配下リソースの閲覧）は上記の禁止と両立させる。既存タスクに対する**更新・コメント投稿**等の可否は **`docs/requirements/tasks.md` および `docs/permissions` で定義**し、本節の禁止と**矛盾しないこと**。
- **削除**は原則として**論理削除**（`deleted_at` を設定）とし、**アーカイブより強い終了操作**として位置づける。削除済みプロジェクトは一覧の通常導線から**除外**する。削除の実行権限・復旧方針は `docs/permissions` で定義する。
- **`deleted_at IS NOT NULL` のプロジェクトは、すべての操作の対象外とする**。**参照の可否**（一覧への掲載、詳細・読み取り API の応答、配下リソースの扱いなど）は **`docs/api` / `docs/ui` / `docs/permissions` で別途定義**する。
- **物理削除**は行わない（運用保守を除く）。タスク・コメント・履歴との整合は `docs/requirements/tasks.md` に従う。

### プロジェクトメンバー（追加・更新・削除）

- **追加**、**`project_memberships.role` の変更**、**削除**（プロジェクトから外す）の実行可否は **`docs/permissions` で定義**する。以下はデータ上の拘束・挙動である。
- **追加**できるユーザーは、**同一 `organization_id` の `memberships` に存在するユーザー**に限る（「組織・プロジェクトコンテキスト」および `docs/requirements/auth.md` を参照）。
- **既に同一プロジェクトの `project_memberships` に存在するユーザー**への重複追加は、冪等に成功として扱う（ロール変更を意図しない限り、既存行を維持する）。
- **`project_memberships.role`** は列挙値のみ受け付ける。値の意味は `docs/database` および `docs/permissions` で定義する。
- **削除**後は当該 `(user_id, project_id)` の行を削除する（再実行は冪等に成功として扱う）。
- プロジェクトから外されたユーザーは、当該プロジェクトのタスクに対する**新規投稿・更新**ができないこと。既存タスクの `assignee_id` が外されたユーザーを指す場合の扱い（自動クリア、履歴のみ残す等）は **`docs/permissions` と `docs/requirements/tasks.md` で衝突なく定義する**。
- **最後の1人のメンバー**を削除し、プロジェクトに**誰も `project_memberships` が残らない状態**にすることは**禁止する**（要求は拒否する）。

### リスト（作成・更新・削除・並び順）

- リストは**プロジェクトに紐づく**（`lists` テーブル）。リストの CRUD の権限は **`docs/permissions`（リスト管理権限）で定義**する。
- 必須項目は `project_id`、`name`、`sort_order` とする。`project_id` は**現在の organization コンテキスト**および**操作権限のあるプロジェクト**に限定する。
- `name` は前後空白を除去して保存し、空文字は不可とする。
- 同一 `project_id` 内で `name` の一意性は**推奨**（重複を許す場合は UI 上の識別方法を `docs/ui` で定義する）。
- `sort_order` は 0 以上の整数とする。並び替え API の仕様（一括更新・楽観ロック等）は `docs/api` で定義する。
- リスト削除時、**当該リストに所属するタスク**については **`task.list_id` を `null` に設定**する（タスク自体は削除しない）。
- **アーカイブ済みプロジェクト**に対するリスト操作は、「プロジェクトのアーカイブ・復帰・削除」の**構造変更禁止**に従い**禁止**する。

### エラー・例外時の扱い

- 存在しないプロジェクト ID・リスト ID 指定時は要求を拒否する。
- **`deleted_at IS NOT NULL` のプロジェクト**の扱いは、「プロジェクトのアーカイブ・復帰・削除」に従う（参照可否の細目は同節および `docs/api` / `docs/ui` / `docs/permissions` を参照）。
- **アーカイブ済み**プロジェクトに対する禁止操作は拒否する。
- 権限不足時は要求を拒否する。
- 不正入力（列挙値外、型不一致、必須欠落、`organization_id` 不一致）は要求を拒否する。
- 競合更新の取り扱い（楽観ロックの有無・条件）は `docs/api` で定義する。

## 役割・権限・認可

admin / project_leader / member / viewer 等の**ロールごとの操作可否の網羅**は **`docs/permissions`** に記載する（「機能要件」冒頭の認可方針および `docs/requirements/auth.md` のデータモデルと整合）。他 organization のプロジェクトは参照・操作不可とする。

## 組織・プロジェクトコンテキスト

- すべてのプロジェクト操作は、**現在の organization コンテキスト**と整合していること（`docs/requirements/auth.md` の組織コンテキストと同一方針）。
- **`project.organization_id`** は、リクエストの organization コンテキストと一致すること。
- **`project_memberships.user_id`** は、**同一 organization の `memberships`** を持つユーザーであること（`docs/requirements/tasks.md` の組織・プロジェクトコンテキストと整合させる）。

### organization からのメンバー削除との整合

- ユーザーが organization から除外された場合、当該 organization 配下の **`project_memberships` は削除する**（残留させない）。タスク等の業務データの扱いは `docs/requirements/tasks.md` および `docs/requirements/auth.md` に従う。

## データ構造（要件レベルの項目）

物理設計・インデックスは `docs/database` に記載する。`tasks` / `task_comments` / `task_histories` / `lists` の列定義は `docs/requirements/tasks.md` と重複するため、**以降はプロジェクト周辺の核のみ**示す。

projects
- id
- organization_id
- name
- description（nullable。任意）
- archived_at（nullable）
- deleted_at（論理削除用、nullable）
- created_at
- updated_at

制約（projects）:
- `organization_id` は必須
- `name` は必須（前後トリム後に空文字不可）
- **同一 `organization_id` 内での `name` 一意性は保証しない**（DB に `(organization_id, name)` の一意制約を**設けない**方針とする。`docs/database` で整合させる）
- `archived_at` と `deleted_at` を同時に意味のある状態にしない（通常は **削除優先**：`deleted_at IS NOT NULL` の行はアーカイブ概念より**終了**として扱う）

lists
- id
- project_id
- name
- sort_order
- created_at
- updated_at

制約（lists）:
- `project_id` は必須
- `name` は必須（前後トリム後に空文字不可）
- 同一 project 内で `name` は一意を推奨
- `sort_order` は 0 以上の整数とする

project_memberships
- user_id
- project_id
- role
- added_by（nullable 可）
- created_at
- updated_at

制約（project_memberships）:
- `(user_id, project_id)` は一意とする
- `user_id` は、当該 `project_id` が属する organization に対する **`memberships` に必ず存在する**こと

## 非機能要件

### セキュリティ

- 通信は HTTPS を前提とする。
- organization / project 境界を越える参照・更新・削除を禁止する。
- 入力値はサーバー側で必ず検証する（型、文字数、列挙値、存在確認、organization コンテキスト一致）。
- 一覧 API には認可フィルタを常時適用し、過剰取得を防止する。

### 可用性・運用性

- プロジェクト一覧 API の応答時間目標は、通常運用時 p95 で 300ms 以内を目安とする（キャッシュ方針は `docs/architecture` で定義してもよい）。
- メンバー追加・削除、リスト並び替えは、可能な範囲で冪等に扱う。
- `due_date` や表示時刻と同様、**アーカイブ・削除の時刻判定**はサーバー時刻（UTC）で統一し、表示時のみローカルタイムゾーンへ変換する。

### 監査可能性

- 記録対象: プロジェクト作成、更新、アーカイブ、復帰、論理削除、メンバー追加・削除、リスト作成・更新・削除・並び替え
- 記録項目: 実行者 `user_id`、対象 `project_id` / `list_id`、組織 `organization_id`、変更要点、**結果**（`success` / `failure` を含む）、実行日時。**`failure` の場合**は、**理由を表すコード**（例: 権限不足・バリデーションエラー種別）を**含めてもよい**（コード体系は `docs/api` または運用方針で定義する）。
- **権限不足・バリデーションエラーなどにより拒否された操作**を監査ログに含めるかどうかは **`docs/permissions` または運用方針で別途定義**する。
- 監査ログに機微情報（秘密トークン等）を保存しない。

## 備考（運用ルール）

- プロジェクト名・リスト名の文字数上限・禁止文字は `docs/api` で定義する。
- 組織作成直後の**初期プロジェクト**の自動生成有無はプロダクト方針として任意とし、採用する場合は `docs/ui` / オンボーディング設計に明記する。
- `docs/requirements/tasks.md` のタスク・コメント・履歴の制約（`project_id` / `list_id` 整合、`project_memberships` 前提）は、本書の方針と**矛盾しないこと**。
- **メンバー数**は、**リアルタイム集計**または**キャッシュ**により取得する（実装方針は `docs/architecture` で定義する）。