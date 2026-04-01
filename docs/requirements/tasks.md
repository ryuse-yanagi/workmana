# タスク

## 概要

本システムは、組織・プロジェクト単位でタスクを管理する。  
タスクは作成・更新・削除・検索・状態遷移・担当者変更を行い、役割（role）に応じて操作可否を制御する。

## 本書の範囲

- タスク管理に関する**要件定義**（満たすべき挙動）を記載する。
- 画面遷移・UI コンポーネント・文言は `docs/ui` に記載する。
- ロールごとの操作可否の詳細は `docs/permissions` に記載する。
- エンドポイント・リクエスト形式・レスポンス形式は `docs/api` に記載する。
- テーブル定義・インデックス・マイグレーションは `docs/database` に記載する。
- 検索の実装方式（全文検索エンジンの利用の有無、インデックス戦略等）の詳細は `docs/architecture` に記載する。
- organization に依存する API の**コンテキスト検証**は `docs/requirements/auth.md`（組織コンテキスト）および `docs/api` に従う。

## 用語定義

- Task: 作業単位
- Project: タスクが所属するプロジェクト
- Organization: プロジェクトが所属する組織
- Assignee: タスク担当者
- Reporter: タスク起票者
- Section: プロジェクト内でタスクを分類する単位
- Status: タスク状態（`todo` / `in_progress` / `done`）
- Priority: 優先度（`low` / `medium` / `high`）
- Mention: コメント本文で特定ユーザーを指定し通知するための記法

## 画面一覧

遷移・操作の詳細は `docs/ui` に記載する。

- タスク一覧画面
- タスク詳細画面
- タスク作成画面
- タスク編集画面

## 機能要件

### タスク作成

- タスクは、操作対象プロジェクトに対して作成権限を持つユーザーのみ作成可能とする。
- 必須項目は `title`、`project_id`、`organization_id`、`status`、`reporter_id` とする。
- 任意項目は `description`、`priority`、`due_date`、`assignee_id` とする。
- `organization_id` は、`project_id` が参照するプロジェクトの属する organization と一致させる（**`task.organization_id` と当該 project の organization は常に同一**）。
- `reporter_id` は、当該 `project_id` のプロジェクトに所属するユーザー（**`project_memberships` に存在するユーザー**）とする。通常は作成者本人を指す。
- `status` 未指定時の初期値は `todo` とする。
- `priority` 未指定時の初期値は `medium` とする。
- `title` は前後空白を除去して保存し、空文字は不可とする。
- `description` は空を許容する。
- `due_date` は日時として妥当な値のみ受け付ける。
- `assignee_id` を指定する場合、**当該タスクの `project_id` に紐づくプロジェクトに所属するユーザー**（`project_memberships` に行が存在するユーザー）のみ受け付ける。
- assignee は1タスクにつき1ユーザーのみとする。

### タスク参照（一覧・詳細）

- タスク一覧は、ユーザーが参照権限を持つプロジェクト配下のタスクのみ表示する。
- タスク詳細は、ユーザーが参照権限を持つタスクのみ表示する。
- **論理削除済み**（`deleted_at IS NOT NULL`）のタスクは、一覧・検索・通常の一覧導線からは**除外**する。タスク ID を直接指定した**詳細取得**については、**参照権限を持つユーザーに限り閲覧専用で表示してよい**（更新・コメント投稿は不可）。権限のない場合の応答（404 等）と UI 上の導線は `docs/api` および `docs/ui` で定義する。
- 一覧の既定ソートは `created_at DESC` とする。
- 一覧はページングを提供する（ページサイズ・上限は `docs/api` で定義する）。
- 一覧には少なくとも `title`、`status`、`priority`、`due_date`、`assignee`、`updated_at` を表示する。
- タスクは任意で section に所属可能とし、section 未所属タスクも表示可能とする。
- タスク一覧は section ごとにグルーピング表示可能とする。

### タスク更新

- タスクの更新は、更新権限を持つユーザーのみ可能とする。
- **論理削除済み**（`deleted_at IS NOT NULL`）のタスクは**更新不可**とする。
- 更新可能項目は `title`、`description`、`status`、`priority`、`due_date`、`assignee_id` とする（**`reporter_id` は作成後に変更不可**）。
- `status` は定義済み列挙値（`todo` / `in_progress` / `done`）のみ受け付ける。
- `status=done` のタスクを `todo` または `in_progress` に戻す可否は、ロールポリシーに従う（詳細は `docs/permissions`）。
- **`assignee_id` の変更可否**は**ロール**に依存する（詳細は `docs/permissions`）。
- 更新時のバリデーションは作成時と同等とする。

### status の遷移ルール

- 許可する遷移は以下とする。  
  1. `todo -> in_progress`  
  2. `in_progress -> done`  
  3. `todo -> done`（作業不要・一括完了等を許可する場合）
- `done -> in_progress` および `done -> todo` は、原則として `admin` と `project_leader` のみ可能とする。
- 同一 status への更新（例: `todo -> todo`）は冪等に成功として扱う。
- 許可されていない遷移要求はバリデーションエラーとして拒否する。

### タスク削除

- タスク削除は、削除権限を持つユーザーのみ可能とする。
- 削除方式は**論理削除**（`deleted_at` を設定）を原則とする。
- 論理削除済みタスクは一覧・検索・通常参照から除外する。
- タスクを論理削除しても、**タスク履歴**（および必要に応じてコメント等の関連データ）は**削除せず保持する**。
- 既に削除済みタスクへの削除要求は冪等に成功として扱う。

### 検索・フィルタ・並び替え

- キーワード検索は `title` と `description` を対象とする。
- 本節は**要件レベルの挙動**を定義する。全文検索エンジンの採用の有無、DB 単体での `LIKE` 実装等の**実装詳細**は `docs/architecture` で定義する。
- 検索方式は**部分一致**（contains）を基本とし、前方一致は既定では提供しない。
- 文字種の扱いは**大文字小文字を区別しない**（case-insensitive）ことを原則とする。
- 日本語検索は Unicode 文字列として扱い、ひらがな・カタカナ・漢字を含む語句の部分一致検索を可能とする。
- 検索時は `title` / `description` の前後空白を除去して比較する。
- フィルタは `status`、`priority`、`assignee_id`、`project_id`、`due_date`（範囲）を提供する。
- 並び替えは `created_at`、`updated_at`、`due_date`、`priority` を提供する。
- `priority` ソート時の順序は `high > medium > low`（降順時）とし、昇順時は逆順（`low > medium > high`）とする。
- 複合条件（検索 + フィルタ + 並び替え）は同時指定可能とする。

### タスクコメント

- タスクにはコメントを複数件紐付け可能とする。
- コメントは、当該タスクを参照可能なユーザーのみ閲覧できる。
- コメント投稿は、当該タスクを更新可能なユーザーのみ可能とする。
- **論理削除済みタスク**への**コメント新規投稿**は不可とする（タスク本体の更新不可は「タスク更新」を参照）。
- コメントは `body` を必須とし、前後空白除去後の空文字は不可とする。
- コメント編集・削除は、投稿者本人または権限を持つロール（`admin` / `project_leader`）のみ可能とする。
- コメントの **`author_id`** は投稿者とし、**当該 `project_id` の `project_memberships` に存在するユーザー**のみが投稿できる（認可と整合させる）。
- **メンション**: コメント本文に **メンション記法**（例: `@user_id` や `@handle` 等）を含めてよい。具体構文・パース規則は `docs/api` で定義する。メンション**対象に指定できるユーザー**は、**当該プロジェクトの `project_memberships` に存在するユーザー**に限定する。対象外・存在しないユーザーを指定した場合は**無視する**か**バリデーションエラーとする**かは `docs/api` で定義する。

### タスク履歴

- タスクの主要変更イベントを履歴として保持する。
- `event_type` は**列挙値**として定義し、許可する値と意味は `docs/database` および `docs/api` で揃えて記載する。
- 履歴記録対象は、作成、更新、削除、status 変更、priority 変更、担当者変更、期限変更、コメント追加/編集/削除とする。
- 履歴には実行者、変更対象フィールド、変更前後値、実行日時を保存する。
- **タスクが論理削除された後も**、既存の履歴レコードは**保持**する（タスク本体の `deleted_at` の有無で履歴を消さない）。
- 履歴は当該タスクを参照可能なユーザーのみ閲覧できる。
- 履歴レコードはアプリケーションから改ざん・削除不可（運用上の保守作業を除く）とする。

### 通知

- 次のイベントで通知を発行する: タスク作成、担当者変更、期限超過、`status=done` への変更、**コメント追加**、**メンション**。
- 通知先は、担当者および起票者を基本とする。メンションがある場合は、**メンションされたユーザー**にも通知する。
- 通知手段（アプリ内通知・メール通知）の詳細は `docs/notifications` に記載する。
- 同一イベントの重複通知は抑止する（同一タスク・同一イベント・同一受信者での短時間重複送信を防止する）。

### エラー・例外時の扱い

- 存在しないタスク ID 指定時は要求を拒否する。
- **論理削除済みタスク**に対する**更新**および**コメント新規投稿**の要求は拒否する。
- 権限不足時は要求を拒否する。
- 不正入力（列挙値外、型不一致、必須欠落）は要求を拒否する。
- 競合更新の取り扱い（楽観ロックの有無・条件）は `docs/api` で定義する。

## 役割・権限・認可

役割によって権限を付与し、操作を制御する。細目は `docs/permissions` を参照する。

- 権限は organization / project コンテキストで判定する。タスクの操作可否（作成・更新・削除・状態遷移・コメント等）は **`memberships.role`** および対象プロジェクトの **`project_memberships`** に基づく。他 organization のタスクは参照・操作不可とする。

### 管理者（admin）

- organization 内の全プロジェクトタスクを作成・参照・更新・削除可能

### プロジェクトリーダー（project_leader）

- 担当プロジェクト内のタスクを作成・参照・更新・削除可能

### メンバー（member）

- 担当プロジェクト内のタスクを作成・参照可能
- 更新・削除可能範囲はポリシーで制御する（例: 自分が起票したタスクのみ）

### 閲覧者（viewer）

- 参照のみ可能

## 組織・プロジェクトコンテキスト

- タスクは必ず1つの project に所属する。
- project は必ず1つの organization に所属する。
- **`task.project_id`** が参照する project は、**`task.organization_id` と同一の organization** に属していること（冗長な `organization_id` は整合性検証に用いる）。
- **`project_memberships`** に登録されるユーザーは、必ず**同一 organization の `memberships`** を持つこと（プロジェクト参加は組織所属を前提とする）。
- ユーザーが複数 organization / project に所属する場合、現在コンテキストで操作対象を決定する。
- **project** エンティティは `organization_id` を持ち、タスク・セクション等の上位として `docs/database` で定義する（本書では `project_id` / `organization_id` の整合のみ要件化する）。

### organization からのメンバー削除と業務データ

- `memberships` 削除後のタスク・コメント・履歴等の扱いは **本書および `docs/permissions`** で定義する（`docs/requirements/auth.md` のメンバー除外と整合させる）。

## データ構造（要件レベルの項目）

物理設計・インデックスは `docs/database` に記載する。

projects（概要）
- id
- organization_id
- name
- created_at
- updated_at

制約（projects）:
- `organization_id` は必須（`tasks.project_id` が参照する先の organization と一致すること）

tasks
- id
- organization_id
- project_id
- section_id（nullable）
- title
- description
- status
- priority
- due_date
- assignee_id（nullable）
- reporter_id
- created_at
- updated_at
- deleted_at（論理削除用、nullable）

制約（tasks）:
- `organization_id` は必須であり、当該 `project_id` が参照する project の organization と一致すること
- `reporter_id` は作成後に変更しない（アプリケーション・API で更新リクエストに含めない）
- `project_id` は必須
- `title` は必須（前後トリム後に空文字不可）
- `status` は定義済み列挙値のみ
- `priority` は定義済み列挙値のみ
- `reporter_id` は必須であり、当該 `project_id` の **project_memberships** に存在するユーザーであること
- `assignee_id` を指定する場合、当該 `project_id` の **project_memberships** に存在するユーザーのみ
- assignee は1タスクにつき1ユーザーのみとする
- `section_id` は nullable とし、指定時は同一 `project_id` の section のみ参照可能とする

sections
- id
- project_id
- name
- sort_order
- created_at
- updated_at

制約（sections）:
- `project_id` は必須
- `name` は必須（前後トリム後に空文字不可）
- 同一 project 内で `name` は一意を推奨
- `sort_order` は 0 以上の整数とする

task_comments
- id
- task_id
- organization_id
- project_id
- author_id
- body
- created_at
- updated_at
- deleted_at（論理削除用、nullable）

制約（task_comments）:
- `task_id` は必須
- `author_id` は必須であり、当該 `project_id` の **project_memberships** に存在するユーザーであること
- `body` は必須（前後トリム後に空文字不可）
- 論理削除済み task への新規作成は不可

task_histories
- id
- task_id
- organization_id
- project_id
- actor_id（実行者、system の場合は nullable 可）
- event_type（列挙値。定義は `docs/database` / `docs/api`）
- field_name（差分対象フィールド、event_type により nullable 可）
- before_value（nullable）
- after_value（nullable）
- created_at

制約（task_histories）:
- `task_id` は必須
- `event_type` は `docs/database` および `docs/api` で定義した列挙値のみ
- `created_at` は必須

## 非機能要件

### セキュリティ

- 通信は HTTPS を前提とする。
- organization / project 境界を越える参照・更新・削除を禁止する。
- 入力値はサーバー側で必ず検証する（型、文字数、列挙値、存在確認）。
- 一覧・検索 API には認可フィルタを常時適用し、過剰取得を防止する。

### 可用性・運用性

- 一覧 API の応答時間目標は通常運用時 p95 で 300ms 以内を目安とする。
- 大量データ時でもページングにより応答性を維持する。
- 削除操作は論理削除とし、誤削除時の復旧可能性を確保する。
- 再試行時の二重実行に配慮し、削除・完了更新は可能な範囲で冪等に扱う。

### 監査可能性

- 記録対象: タスク作成、更新、削除、担当者変更、状態変更
- 記録項目: 実行者 user_id、task_id、project_id、organization_id、変更前後差分、結果、実行日時
- 監査ログには機微情報（秘密トークン等）を保存しない。

## 備考（運用ルール）

- 状態・優先度の列挙値追加時は、API・UI・権限制御・集計ロジックを同時更新する。
- `due_date` の判定はサーバー時刻（UTC）で統一し、表示時のみローカルタイムゾーンへ変換する。
