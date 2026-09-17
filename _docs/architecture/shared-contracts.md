# FE / BE 共有契約

色パレットとフィールド文字数上限など、フロントと API で食い違うとバグになる定数の正本を `shared/` に置く。

意思決定の経緯は [`../decisions/frontend-foundations.md`](../decisions/frontend-foundations.md)。

## 正本ファイル

| ファイル | 内容 |
| --- | --- |
| `shared/color-presets.json` | 30色パレット、標準色 index、ガント配色順、レガシー HEX |
| `shared/field-length-limits.json` | 名前・メール・タスクタイトル・コメント等の max / min |
| `shared/default-named-color-items.json` | 既定ボードリスト／スペースステータス／資料カテゴリ、配列 max |

Nuxt は `#shared` エイリアス（`nuxt.config.ts`）で import。Laravel は `App\Support\SharedJson` でリポジトリ直下の `shared/` を読む。

## フロントエンド

| 領域 | 実装 |
| --- | --- |
| 色 | `frontend/app/constants/colorPresets.ts` が JSON を再 export／派生関数を提供 |
| 文字数 | `frontend/app/constants/fieldLengthLimits.ts` が JSON を再 export |
| 既定マスタ | `frontend/app/components/settings/types.ts` が `default-named-color-items.json` を参照 |
| バリデーション | `frontend/app/utils/formValidation.ts` が **Zod** で長さ・メール等を検証（文言は従来どおり日本語） |

## バックエンド

| 領域 | 実装 |
| --- | --- |
| 色 | `LabelColorPresets` / `BoardListColors` が JSON（または互換定数）を参照。レガシー HEX からの index 解決もここ |
| 文字数 | `FieldLengthLimits` に PHP 定数を保持し、`assertMatchesSharedJson()` で JSON と一致検証 |
| 既定マスタ | `DefaultBoardLists` / `DefaultWorkspaceStatuses` / `DefaultDocumentCategories` が JSON を読む |
| 起動時チェック | 非 production で `AppServiceProvider` が色・文字数の整合を assert |
| 入力検証 | 代表エンドポイントは **FormRequest**（例: `StoreWorkspaceRequest` / `UpdateWorkspaceRequest` / `StoreTaskRequest`）。ルールの max は `FieldLengthLimits` を参照 |

## 変更手順

1. `shared/*.json` を先に更新する
2. FE の派生ロジック（コントラスト色など）が必要なら `colorPresets.ts` 側を調整
3. BE の `FieldLengthLimits` 定数を JSON に合わせて更新（assert が落ちる）
4. 関連する FormRequest / フロントの Zod メッセージを確認

色や上限をコードの片側だけ直すと、ラベル表示ずれや 422 不一致の原因になる。
