/**
 * 「作成直後」ハイライト用の一時 ID セット。
 * Board のタスク/リスト、スペース一覧カードなどで共有。
 */
export function useTransientIdFlash<T extends string | number> (durationMs = 260) {
  const ids = reactive<Record<string, true>>({})

  function has (id: T): boolean {
    return !!ids[String(id)]
  }

  function mark (id: T): void {
    const key = String(id)
    ids[key] = true
    setTimeout(() => {
      delete ids[key]
    }, durationMs)
  }

  function clear (): void {
    for (const key of Object.keys(ids)) {
      delete ids[key]
    }
  }

  return {
    ids,
    has,
    mark,
    clear,
  }
}
