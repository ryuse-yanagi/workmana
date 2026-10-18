type ListOp<T> = (items: T[]) => T[]

/**
 * 一覧取得の途中で届いた追加・削除を、取得結果で消さない。
 * キャッシュが無いあいだの変更は取得完了時に足し、取得中にキャッシュを更新したらそのキャッシュを残す。
 */
export function createListWriteGuard<T>() {
  const writes = new Map<string, number>()
  const pending = new Map<string, ListOp<T>[]>()

  function storageKey(queryKey: readonly unknown[]): string {
    return JSON.stringify(queryKey)
  }

  function record(queryKey: readonly unknown[], cached: T[] | null, op: ListOp<T>): T[] | null {
    const key = storageKey(queryKey)
    writes.set(key, (writes.get(key) ?? 0) + 1)
    if (cached) {
      return op(cached)
    }
    const ops = pending.get(key) ?? []
    ops.push(op)
    pending.set(key, ops)
    return null
  }

  function seen(queryKey: readonly unknown[]): number {
    return writes.get(storageKey(queryKey)) ?? 0
  }

  function settle(
    queryKey: readonly unknown[],
    startedAt: number,
    serverItems: T[],
    cached: T[] | null,
  ): { items: T[], keptCache: boolean } {
    const key = storageKey(queryKey)
    const ops = pending.get(key) ?? []
    pending.delete(key)
    const changed = (writes.get(key) ?? 0) !== startedAt
    if (changed && cached) {
      return {
        items: ops.reduce((items, op) => op(items), cached),
        keptCache: true,
      }
    }
    return {
      items: ops.reduce((items, op) => op(items), serverItems),
      keptCache: false,
    }
  }

  function clear(): void {
    writes.clear()
    pending.clear()
  }

  return { record, seen, settle, clear }
}
