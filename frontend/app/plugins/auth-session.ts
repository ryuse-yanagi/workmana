/**
 * ヘッダーが初回表示する前にセッションを共有 state へ載せる。
 * SSR は Cookie を Laravel へ転送して payload にユーザーを載せる（失敗しても TTFB を長く縛らない）。
 * クライアントはフォント読み込みと並列で取り、session-ready まで画面を出さない。
 */
export default defineNuxtPlugin(async () => {
  const { fetchSession, session } = useAuth()
  if (import.meta.server) {
    await fetchSession({ timeout: 1500 })
    return
  }
  void fetchSession({ force: !session.value?.user })
})
