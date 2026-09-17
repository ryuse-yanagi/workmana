/** ボード列の最小キー（ドラッグ・可視判定など） */
export type BoardListKey = {
  key: string
  listId: number
}

/** ボード列の表示付き定義（CRUD・列 DnD など） */
export type BoardListDef = BoardListKey & {
  title: string
  color: string
  color_index: number
}

/** useApi 互換のボード向け API クライアント型 */
export type BoardApi = <T>(
  url: string,
  opts?: { method?: string; body?: unknown },
) => Promise<T>
