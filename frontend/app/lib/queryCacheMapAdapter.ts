import { queryClient } from './queryClient'

/**
 * 組織 slug をキーに、QueryClient のキャッシュを Map として読み書きする。
 */
export class QueryCacheMapAdapter<TValue> implements Map<string, TValue> {
  readonly [Symbol.toStringTag] = 'Map'

  constructor (
    private readonly rootKey: string,
    private readonly slugIndex: number,
    private readonly buildQueryKey: (slug: string) => readonly unknown[],
  ) {}

  private matches (queryKey: readonly unknown[]): boolean {
    return queryKey[0] === this.rootKey && typeof queryKey[this.slugIndex] === 'string'
  }

  private slugFromKey (queryKey: readonly unknown[]): string {
    return queryKey[this.slugIndex] as string
  }

  private entriesArray (): Array<[string, TValue]> {
    return queryClient.getQueriesData<TValue>({ queryKey: [this.rootKey] })
      .flatMap(([queryKey, data]) => {
        if (!this.matches(queryKey) || data == null) {
          return []
        }
        return [[this.slugFromKey(queryKey), data] as [string, TValue]]
      })
  }

  get size (): number {
    return this.entriesArray().length
  }

  get (key: string): TValue | undefined {
    return queryClient.getQueryData(this.buildQueryKey(key)) as TValue | undefined
  }

  set (key: string, value: TValue): this {
    queryClient.setQueryData(this.buildQueryKey(key), value)
    return this
  }

  has (key: string): boolean {
    return this.get(key) !== undefined
  }

  delete (key: string): boolean {
    const existed = this.has(key)
    queryClient.removeQueries({ queryKey: this.buildQueryKey(key), exact: true })
    return existed
  }

  clear (): void {
    queryClient.removeQueries({ queryKey: [this.rootKey] })
  }

  forEach (
    callbackfn: (value: TValue, key: string, map: Map<string, TValue>) => void,
    thisArg?: unknown,
  ): void {
    for (const [key, value] of this.entriesArray()) {
      callbackfn.call(thisArg, value, key, this)
    }
  }

  * keys (): IterableIterator<string> {
    for (const [key] of this.entriesArray()) {
      yield key
    }
  }

  * values (): IterableIterator<TValue> {
    for (const [, value] of this.entriesArray()) {
      yield value
    }
  }

  * entries (): IterableIterator<[string, TValue]> {
    yield * this.entriesArray()
  }

  [Symbol.iterator] (): IterableIterator<[string, TValue]> {
    return this.entries()
  }

  getOrInsert (key: string, defaultValue: TValue): TValue {
    const existing = this.get(key)
    if (existing !== undefined) {
      return existing
    }
    this.set(key, defaultValue)
    return defaultValue
  }

  getOrInsertComputed (key: string, callback: () => TValue): TValue {
    const existing = this.get(key)
    if (existing !== undefined) {
      return existing
    }
    const value = callback()
    this.set(key, value)
    return value
  }
}

/**
 * `slug:スペースID` をキーに、QueryClient のキャッシュを Map として読み書きする。
 */
export class QueryCacheCompositeMapAdapter<TValue> implements Map<string, TValue> {
  readonly [Symbol.toStringTag] = 'Map'

  constructor (
    private readonly rootKey: string,
    private readonly buildQueryKey: (compositeKey: string) => readonly unknown[],
    private readonly compositeFromQueryKey: (queryKey: readonly unknown[]) => string,
  ) {}

  private matches (queryKey: readonly unknown[]): boolean {
    return queryKey[0] === this.rootKey
  }

  private entriesArray (): Array<[string, TValue]> {
    return queryClient.getQueriesData<TValue>({ queryKey: [this.rootKey] })
      .flatMap(([queryKey, data]) => {
        if (!this.matches(queryKey) || data == null) {
          return []
        }
        return [[this.compositeFromQueryKey(queryKey), data] as [string, TValue]]
      })
  }

  get size (): number {
    return this.entriesArray().length
  }

  get (key: string): TValue | undefined {
    return queryClient.getQueryData(this.buildQueryKey(key)) as TValue | undefined
  }

  set (key: string, value: TValue): this {
    queryClient.setQueryData(this.buildQueryKey(key), value)
    return this
  }

  has (key: string): boolean {
    return this.get(key) !== undefined
  }

  delete (key: string): boolean {
    const existed = this.has(key)
    queryClient.removeQueries({ queryKey: this.buildQueryKey(key), exact: true })
    return existed
  }

  clear (): void {
    queryClient.removeQueries({ queryKey: [this.rootKey] })
  }

  forEach (
    callbackfn: (value: TValue, key: string, map: Map<string, TValue>) => void,
    thisArg?: unknown,
  ): void {
    for (const [key, value] of this.entriesArray()) {
      callbackfn.call(thisArg, value, key, this)
    }
  }

  * keys (): IterableIterator<string> {
    for (const [key] of this.entriesArray()) {
      yield key
    }
  }

  * values (): IterableIterator<TValue> {
    for (const [, value] of this.entriesArray()) {
      yield value
    }
  }

  * entries (): IterableIterator<[string, TValue]> {
    yield * this.entriesArray()
  }

  [Symbol.iterator] (): IterableIterator<[string, TValue]> {
    return this.entries()
  }

  getOrInsert (key: string, defaultValue: TValue): TValue {
    const existing = this.get(key)
    if (existing !== undefined) {
      return existing
    }
    this.set(key, defaultValue)
    return defaultValue
  }

  getOrInsertComputed (key: string, callback: () => TValue): TValue {
    const existing = this.get(key)
    if (existing !== undefined) {
      return existing
    }
    const value = callback()
    this.set(key, value)
    return value
  }
}

function compositeCacheKey (orgSlug: string, workspaceId: string): string {
  return `${orgSlug.trim()}:${workspaceId.trim()}`
}

function parseCompositeCacheKey (key: string): { slug: string, workspaceId: string } {
  const colon = key.indexOf(':')
  if (colon < 0) {
    return { slug: key, workspaceId: '' }
  }
  return {
    slug: key.slice(0, colon),
    workspaceId: key.slice(colon + 1),
  }
}

export function workspaceViewCompositeFromQueryKey (queryKey: readonly unknown[]): string {
  return compositeCacheKey(String(queryKey[1]), String(queryKey[2]))
}

export function workspaceViewQueryKeyFromComposite (
  rootKey: 'workspaceBoard' | 'workspaceWbs',
  compositeKey: string,
): readonly unknown[] {
  const { slug, workspaceId } = parseCompositeCacheKey(compositeKey)
  return rootKey === 'workspaceBoard'
    ? ['workspaceBoard', slug, workspaceId]
    : ['workspaceWbs', slug, workspaceId]
}
