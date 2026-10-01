/** 一覧・設定・スペース詳細など、ビューポート内に収める画面向け */
export function useWorkspaceViewPageRoot () {
  useHead({
    htmlAttrs: {
      class: 'workspace-view-page-root',
    },
    bodyAttrs: {
      class: 'workspace-view-page-root',
    },
  })
}

/**
 * グローバルヘッダー高さから sticky CSS 変数を供給する。
 * ResizeObserver + resize で追従。追加更新コールバックも可。
 */
export function useStickyHeaderOffsets (options?: {
  /** ヘッダー高さ更新後の追加処理（本文リサイズ等） */
  onUpdate?: () => void
  /**
   * true（既定）: onMounted で resize / ResizeObserver を登録。
   * false: 呼び出し側が `updateStickyOffsets` を既存の resize ハンドラ等から呼ぶ。
   */
  autoBind?: boolean
}) {
  const globalHeaderOffsetPx = ref(56)
  let globalHeaderObserver: ResizeObserver | null = null
  let bound = false

  function readGlobalHeaderHeight (): number {
    if (!import.meta.client) {
      return 56
    }
    const el = document.querySelector('.global-header') as HTMLElement | null
    if (!el) {
      return 56
    }
    return Math.ceil(el.getBoundingClientRect().height)
  }

  function updateStickyOffsets () {
    if (!import.meta.client) {
      return
    }
    globalHeaderOffsetPx.value = readGlobalHeaderHeight()
    options?.onUpdate?.()
  }

  function bindStickyOffsets () {
    if (!import.meta.client || bound) {
      return
    }
    bound = true
    updateStickyOffsets()
    window.addEventListener('resize', updateStickyOffsets)
    const globalHeader = document.querySelector('.global-header') as HTMLElement | null
    if (globalHeader && 'ResizeObserver' in window) {
      globalHeaderObserver = new ResizeObserver(() => {
        updateStickyOffsets()
      })
      globalHeaderObserver.observe(globalHeader)
    }
    void document.fonts?.ready?.then(() => {
      updateStickyOffsets()
    })
  }

  function unbindStickyOffsets () {
    if (!import.meta.client || !bound) {
      return
    }
    bound = false
    window.removeEventListener('resize', updateStickyOffsets)
    globalHeaderObserver?.disconnect()
    globalHeaderObserver = null
  }

  const pageCssVars = computed(() => ({
    '--global-header-offset': `${globalHeaderOffsetPx.value}px`,
    '--app-shell-page-pad': '4px',
  } as Record<string, string>))

  if (options?.autoBind !== false) {
    onMounted(() => {
      nextTick(() => bindStickyOffsets())
    })
    onBeforeUnmount(unbindStickyOffsets)
  }

  return {
    globalHeaderOffsetPx,
    pageCssVars,
    updateStickyOffsets,
    bindStickyOffsets,
    unbindStickyOffsets,
  }
}

/** @deprecated useStickyHeaderOffsets を推奨。既存呼び出し互換。 */
export function useWorkspaceViewPageCssVars () {
  const { pageCssVars } = useStickyHeaderOffsets()
  return pageCssVars
}
