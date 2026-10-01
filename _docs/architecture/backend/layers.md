# バックエンド

Laravel API（`backend/`）。画面は返さず、JSON とリダイレクト（Cognito）だけを担当する。

## 層

Repository 層は置かない。参照と更新は Eloquent をコントローラから直接使う。横断ルールだけ Service / Support に出す。

| 場所 | 役割 |
| --- | --- |
| `routes/api.php` | URL とミドルウェア。プレフィックスは `/api` |
| `Http/Middleware` | セッション認証（`cognito`）と組織所属（`org.member`） |
| `Http/Requests` | 代表エンドポイントの入力検証（FormRequest） |
| `Http/Controllers/Api` | ユースケースの手順、JSON 形、権限の追加判定 |
| `Services/` | 認証、招待、組織コンテキスト、通知など手順が長いもの |
| `Support/` | 共有 JSON、メディア、並び替え、アクセス判定など状態を持たない処理 |
| `Models/` | テーブルと関連。ドメインごとにサブディレクトリ |
| `Events/` | ボード／WBS 向けブロードキャスト。タスク変更の履歴テーブルや Observer はない |
| `Enums/` | PHP の列挙。DB の文字列と対応 |

コントローラは `ApiController` を継承し、スペースが組織に属するか、閲覧できるか、アーカイブ済みでないか、を共通メソッドで止める。

## リクエストの通り方

API ルートはステートフルである。`bootstrap/app.php` が Cookie 復号 → セッション開始 → CSRF 検証を、フレームワーク既定の API ミドルウェアより前に掛ける。並びは変えない。

```
HTTP
  → セッション / CSRF
  → cognito（必要なルート）
  → org.member（/orgs/{organization}/...）
  → ルートモデル束縛
  → FormRequest またはコントローラ内 validate
  → Eloquent
  → JSON
  → （変更系の一部）SafeBroadcast::toOthers
```

`{organization}` は slug（`Organization::getRouteKeyName`）。`workspace` / `task` / `document` などは数値 ID（`routes/api.php` の `Route::pattern`）。

組織に属さないリソースを ID で引いた場合は 404。所属していない組織は 403。未認証は 401。

## ルートの置き方

| グループ | ミドルウェア | 例 |
| --- | --- | --- |
| `auth/*`、招待の確認・受諾 | なし（ログアウトと登録は CSRF の対象） | ログイン開始、コールバック、`/invites/{token}` |
| `/me`、通知、組織作成 | `cognito` | プロフィール、利用組織の切替 |
| `/orgs/{organization}/...` | `cognito` + `org.member` | スペース、タスク、資料、設定 |

放送認可は `routes/channels.php`。プレフィックス `/api`、ミドルウェアはセッション一式と `cognito`。

入力の max 長は `FieldLengthLimits` 経由で `shared/` と揃える。FormRequest になっているのはスペース作成・更新とタスク作成。残りはコントローラ内の `$request->validate` がある。

## 変更の副作用

| 契機 | 副作用 |
| --- | --- |
| リスト／タスクの変更 | コントローラが `ShouldBroadcastNow` のイベントを `toOthers()` で送る |
| スペース担当者の更新 | `workspace_assignees` を更新する |
| 非 production 起動 | `shared/*.json` と PHP 定数の一致を assert |
| production 起動 | `ProductionConfigValidator` が危険な設定なら起動を止める |

一覧の検索・全件返却は `ListQuery` に寄せる。ページネーション上限で打ち切らない一覧がある。

## テスト

`backend/tests/Feature` が HTTP 経由の振る舞い、`tests/Unit` が JWT や共有定数などの単体。組織 API の共通セットアップは `Tests\Feature\Concerns\InteractsWithOrganizationApi`。実行は `php artisan test`。
