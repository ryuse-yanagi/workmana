# フロントエンドのサーバー状態キャッシュ

スペース一覧・ボード・WBS・設定・資料・アーカイブなど、API 由来の画面データを **TanStack Query（`@tanstack/vue-query`）** で保持する。

意思決定の経緯は [`../../decisions/frontend-foundations.md`](../../decisions/frontend-foundations.md)。

## 採用技術

| レイヤー | 技術 | 役割 |
| --- | --- | --- |
| キャッシュ本体 | **TanStack Query** | 重複リクエスト排除、`fetchQuery` / `setQueryData` / `removeQueries` |
| プラグイン | `frontend/app/plugins/vue-query.ts` | シングルトン `QueryClient` を Vue に注入 |
| キー定義 | `frontend/app/lib/queryKeys.ts` | org / workspace / archived などの queryKey |
| クライアント | `frontend/app/lib/queryClient.ts` | 既定オプション |

## 既定ポリシー

既存の自前 SWR（表示はキャッシュ、最新化は明示的）に揃える。

| オプション | 値 | 理由 |
| --- | --- | --- |
| `staleTime` | `Infinity`（既定） | 勝手に古く扱わない |
| `refetchOnWindowFocus` | `false` | focus 再取得はしない |
| `retry` | `false` | 失敗時は stale を維持（従来どおり fail-soft） |

`fetchSnapshot` 相当は呼び出しのたびにネットワークへ行くため、その呼び出しでは `staleTime: 0` の `fetchQuery` を使う。

## 責務の置き方

ページデータ composable の **公開 API は従来どおり**（`fetchSnapshot` / `getCached` / `invalidateCached` / patch・upsert など）。内部の正本だけ QueryClient に移した。

主な composable:

- `useOrgWorkspaceIndexPageData`
- `useWorkspaceBoardPageData`
- `useWorkspaceWbsPageData`
- `useOrgDocumentsPageData`
- `useOrgSettingsPageData` / `useOrgSettingsResource`
- `useArchivedTasksCache` / `useArchivedNamedItemsCache`

横断の破棄は `invalidateOrgDerivedCaches` / `useSessionScopedCaches`。プロフィール更新などは `queryCacheMapAdapter` 経由で Map 互換に触る。

## Vue への伝播

一覧など一部は、Query の購読ではなく従来の `cacheRevision` + `notifyCacheChanged()` で computed を起こす。patch 後は明示 notify が必要。

## リアルタイムとの関係

ボード／WBS の他クライアント更新は Echo / Reverb（[`../realtime/sync.md`](../realtime/sync.md)）。Query キャッシュは REST 取得・楽観更新・明示 revalidate の正本であり、WebSocket 配信そのものではない。

## 注意

- シングルトン `QueryClient` は、かつてのモジュール `Map` と同様にプロセス内共有。SSR でリクエスト横断にキャッシュを載せる場合は per-request 化を検討する。
- ボードの `staleCacheKeys` など、Query 外のメタデータは一部モジュール局所のまま。

