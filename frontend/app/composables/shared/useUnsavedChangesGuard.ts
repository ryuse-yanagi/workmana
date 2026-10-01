import type { MaybeRefOrGetter } from 'vue'

type LeaveResolver = (allow: boolean) => void
type LogoutDiscarder = () => void | Promise<void>

/** ログアウト時に、ログイン中の画面が未保存変更を戻す。 */
const logoutDiscarders = new Set<LogoutDiscarder>()

/**
 * ログアウトのように、未保存を保存せずページを離すとき true。
 * beforeunload が遷移を止めると、セッションを消した画面に残ってしまう。
 */
let unloadPromptSuppressed = false

/** 未保存の離脱確認を通さず、ページ遷移を許可する。 */
export function allowUnloadWithoutUnsavedPrompt (): void {
  unloadPromptSuppressed = true
}

export class UnsavedDiscardError extends Error {
  constructor () {
    super('変更の破棄に失敗しました')
    this.name = 'UnsavedDiscardError'
  }
}

/**
 * ログアウトより前に呼ぶ。セッションがあるうちに、表示中の未保存変更を破棄する。
 * WBS は編集のたびにサーバーへ送っているため、ここで編集前の内容へ戻す。
 */
export async function discardUnsavedChangesForLogout (): Promise<void> {
  const pending = [...logoutDiscarders].map(discard => discard())
  const results = await Promise.allSettled(pending)
  if (results.some(result => result.status === 'rejected')) {
    throw new UnsavedDiscardError()
  }
}

/**
 * 未保存変更があるときの離脱確認（アプリ内遷移はモーダル、タブ閉じは beforeunload）。
 * isDirty が true のときだけブロックする。
 *
 * KeepAlive / ネストコンポーネントでは onBeforeRouteLeave が効かないことがあるため、
 * router.beforeEach でガードする。
 */
export function useUnsavedChangesGuard (options: {
  isDirty: MaybeRefOrGetter<boolean>
  onSave: () => boolean | void | Promise<boolean | void>
  onDiscard: () => void | Promise<void>
}) {
  const router = useRouter()
  const leaveModalOpen = ref(false)
  const leaveSaving = ref(false)
  /** この画面がアクティブなときだけガードする（KeepAlive の非表示インスタンスを除外） */
  const guardEnabled = ref(false)
  let pendingResolve: LeaveResolver | null = null
  let beforeUnloadBound = false
  let removeRouterGuard: (() => void) | null = null

  function takePending (): LeaveResolver | null {
    const resolve = pendingResolve
    pendingResolve = null
    return resolve
  }

  function runGuard (): Promise<boolean> {
    if (pendingResolve) {
      return Promise.resolve(false)
    }
    leaveModalOpen.value = true
    return new Promise<boolean>((resolve) => {
      pendingResolve = resolve
    })
  }

  async function confirmSaveAndLeave () {
    if (leaveSaving.value) {
      return
    }
    leaveSaving.value = true
    try {
      const result = await options.onSave()
      const resolve = takePending()
      leaveModalOpen.value = false
      resolve?.(result !== false)
    } catch {
      const resolve = takePending()
      leaveModalOpen.value = false
      resolve?.(false)
    } finally {
      leaveSaving.value = false
    }
  }

  async function confirmDiscardAndLeave () {
    if (leaveSaving.value) {
      return
    }
    try {
      await options.onDiscard()
    } finally {
      const resolve = takePending()
      leaveModalOpen.value = false
      resolve?.(true)
    }
  }

  function cancelLeave () {
    if (leaveSaving.value) {
      return
    }
    const resolve = takePending()
    leaveModalOpen.value = false
    resolve?.(false)
  }

  watch(leaveModalOpen, (open) => {
    // ✕ / 背景クリックなど、明示ハンドラ以外で閉じられた場合
    if (!open && pendingResolve) {
      const resolve = takePending()
      resolve?.(false)
    }
  })

  function onBeforeUnload (event: BeforeUnloadEvent) {
    if (unloadPromptSuppressed || !guardEnabled.value || !toValue(options.isDirty)) {
      return
    }
    event.preventDefault()
    event.returnValue = ''
  }

  function bindBeforeUnload () {
    if (!import.meta.client || beforeUnloadBound) {
      return
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    beforeUnloadBound = true
  }

  function unbindBeforeUnload () {
    if (!import.meta.client || !beforeUnloadBound) {
      return
    }
    window.removeEventListener('beforeunload', onBeforeUnload)
    beforeUnloadBound = false
  }

  async function discardForLogout () {
    if (!guardEnabled.value || !toValue(options.isDirty)) {
      return
    }
    await options.onDiscard()
    if (leaveModalOpen.value) {
      const resolve = takePending()
      leaveModalOpen.value = false
      resolve?.(true)
    }
  }

  function enableGuard () {
    guardEnabled.value = true
    bindBeforeUnload()
    logoutDiscarders.add(discardForLogout)
  }

  function disableGuard () {
    guardEnabled.value = false
    unbindBeforeUnload()
    logoutDiscarders.delete(discardForLogout)
    if (leaveModalOpen.value) {
      cancelLeave()
    }
  }

  removeRouterGuard = router.beforeEach((to, from) => {
    if (unloadPromptSuppressed || !guardEnabled.value) {
      return true
    }
    if (to.fullPath === from.fullPath) {
      return true
    }
    if (!toValue(options.isDirty)) {
      return true
    }
    return runGuard()
  })

  onMounted(enableGuard)
  onActivated(enableGuard)
  onDeactivated(disableGuard)
  onBeforeUnmount(() => {
    disableGuard()
    removeRouterGuard?.()
    removeRouterGuard = null
    if (pendingResolve) {
      const resolve = takePending()
      resolve?.(false)
    }
  })

  return {
    leaveModalOpen,
    leaveSaving,
    confirmSaveAndLeave,
    confirmDiscardAndLeave,
    cancelLeave,
  }
}
