# ADR: フロント基盤ライブラリと FE/BE 共有契約

- ステータス: Accepted
- 日付: 2026-09-13

## 背景

アプリ完成度と実装の安定性のため、次を揃えたい。

- 画面データのキャッシュ／再取得の一貫性
- ポップオーバー配置とモーダルのキーボード a11y
- 色・文字数上限の FE/BE ドリフト防止
- DOM 定型処理のライフサイクル漏れ低減
- 未使用の TipTap 依存の整理

現行のドメインロジック（WBS DnD・ガント・ボード拡張など）は差し替えず、基盤だけ標準化する。

## 決定

| 領域 | 決定 |
| --- | --- |
| サーバー状態 | **TanStack Query**（`@tanstack/vue-query`）。composable 公開 API は維持し、内部正本を QueryClient へ |
| ポップオーバー配置 | **Floating UI**。縦配置の製品ルールは自前、水平 shift をライブラリへ |
| モーダル a11y | **focus-trap**（背面閉じ・Escape は既存ロジック） |
| フォーム検証（FE） | **Zod**（既存の日本語エラー文言を維持） |
| DOM 定型 | **VueUse**（必要な箇所から） |
| 共有定数 | リポジトリ直下 `shared/*.json` を正本 |
| API 検証構造 | 代表ルートを Laravel **FormRequest** 化 |
| リッチテキスト | 未使用だった **TipTap を削除**（採用する場合は別 ADR） |

現行の実装詳細は次を参照。

- [`../architecture/frontend-server-state.md`](../architecture/frontend-server-state.md)
- [`../architecture/frontend-overlays.md`](../architecture/frontend-overlays.md)
- [`../architecture/shared-contracts.md`](../architecture/shared-contracts.md)

## 検討した代替案（要約）

| 候補 | 不採用の要点 |
| --- | --- |
| 自前 Map キャッシュのまま拡大 | 定型（dedupe / invalidate）が散在し続ける |
| SWR（Vercel） | Vue / Nuxt との相性より TanStack Query の方が現行 composable 置換に近い |
| ポップオーバー全面を headless UI キットへ | 既存の dismiss／計測ルールの再配線コストが大きい |
| dayjs 全面 | 日付はほぼ `YYYY-MM-DD`。完成度のボトルネックではない |
| TipTap 本採用 | 現状 textarea 運用。依存だけ残すのは非生産的 |

## 影響範囲

- `frontend/package.json` の依存追加・TipTap 削除
- `frontend/app/lib/*` / `plugins/vue-query.ts` / 各 page-data composable
- `frontend/app/composables/useModalFocusTrap.ts` と主要モーダル
- `shared/` と BE `SharedJson` / FormRequest
- README・本ディレクトリの設計ドキュメント

## 未決定 / フォロー

- コンポーネントからの直接 `useQuery` / `useMutation` 利用への段階移行
- SSR 時の per-request `QueryClient`
- 残るインライン `$request->validate` の FormRequest 化範囲
- リッチテキスト編集を製品要件にする場合のエディタ選定

