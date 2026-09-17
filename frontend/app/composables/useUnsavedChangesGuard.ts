import type { MaybeRefOrGetter } from 'vue'

type LeaveResolver = (allow: boolean) => void

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
    if (!guardEnabled.value || !toValue(options.isDirty)) {
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

  function enableGuard () {
    guardEnabled.value = true
    bindBeforeUnload()
  }

  function disableGuard () {
    guardEnabled.value = false
    unbindBeforeUnload()
    if (leaveModalOpen.value) {
      cancelLeave()
    }
  }

  removeRouterGuard = router.beforeEach((to, from) => {
    if (!guardEnabled.value) {
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
