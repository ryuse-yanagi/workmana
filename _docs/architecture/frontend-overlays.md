# フロントエンドのオーバーレイ UI

モーダル・ポップオーバー・ドロップダウンの配置とフォーカスまわり。見た目の SCSS やドメイン固有の開閉ルールは各コンポーネントに残し、共通の基盤だけライブラリに寄せる。

意思決定の経緯は [`../decisions/frontend-foundations.md`](../decisions/frontend-foundations.md)。

## 採用技術

| 関心 | 技術 | 役割 |
| --- | --- | --- |
| 配置 | **Floating UI**（`@floating-ui/dom`） | アンカー基準の座標・viewport shift |
| フォーカス | **focus-trap** | モーダル内へのフォーカス閉じ込め |
| DOM 定型 | **VueUse**（`@vueuse/core`） | Escape リスナー、`ResizeObserver` など |

## ポップオーバー配置

- 共通ロジック: `frontend/app/utils/popoverScrollbar.ts`
- **縦方向**（下端余白・480px 規則・自然高計測・scrollbar gutter）はアプリ固有のまま
- **水平方向**の viewport クランプ／shift に Floating UI を使う（`refineAnchoredPopoverWithFloatingUi` など）
- 呼び出し側の代表: `TaskDetailModal` / `useTaskFormPane` の `positionPopover`

背面クリック閉じ・排他ポップオーバー（`useExclusivePopover`）・ポインタジェスチャは従来の `uiInteraction` 系を維持する。

## モーダルフォーカス

- `frontend/app/composables/useModalFocusTrap.ts`
- 適用: `BaseModal` / `TaskDetailModal`
- Escape・Ctrl+Enter・オーバーレイ背面閉じは既存ハンドラのまま（trap 側の Escape 解除はオフ）
- body へ Teleport したポップオーバーも trap 集合に含め、モーダル開中のフィールド編集を阻害しない

## VueUse の利用箇所

| 箇所 | 用途 |
| --- | --- |
| `useDropdownEscapeClose` | 開いている間だけ `keydown`（Escape） |
| `useModalScrollbarGutter` | カード／スクローラの `useResizeObserver` |

ドラッグスクロールや三点リーダーなど、製品固有プラグインは自前のまま。

