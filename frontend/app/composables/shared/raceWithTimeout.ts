/** 初回ページゲート用：長時間応答がない場合はタイムアウト扱いにする */
export const TM_PAGE_LOAD_TIMEOUT_MS = 10_000
export type RaceTimeoutResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'timeout' }
  | { ok: false; reason: 'error'; message: string }
export async function raceWithTimeout<T> (
  fn: () => Promise<T>,
  ms: number,
): Promise<RaceTimeoutResult<T>> {
  const result = await Promise.race([
    fn().then(
      (value) => ({ tag: 'done' as const, value }),
      (e: unknown) => ({
        tag: 'fail' as const,
        message: e instanceof Error ? e.message : '読み込みに失敗しました',
      }),
    ),
    new Promise<{ tag: 'timeout' }>((resolve) => {
      setTimeout(() => resolve({ tag: 'timeout' }), ms)
    }),
  ])
  if (result.tag === 'timeout') {
    return { ok: false, reason: 'timeout' }
  }
  if (result.tag === 'fail') {
    return { ok: false, reason: 'error', message: result.message }
  }
  return { ok: true, value: result.value }
}
export function timeoutMessage (): string {
  return '読み込みがタイムアウトしました。時間をおいて再度お試しください。'
}
