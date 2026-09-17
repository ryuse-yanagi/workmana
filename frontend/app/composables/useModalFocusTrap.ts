import { createFocusTrap, type FocusTrap } from 'focus-trap'
import { onBeforeUnmount, watch, type Ref } from 'vue'

const FLOATING_FOCUS_ROOT_SELECTOR = [
  '.popover-layer',
  '.popover-shell',
  '.popover',
  '[data-popover-panel]',
  '.floating-menu',
  '.workspace-status-select__dropdown',
  '.document-category-select__dropdown',
  '.workspace-member-picker-popover',
  '.board-filter-dropdown',
  '.gantt-color-popover-layer',
  '.notifications-drawer',
].join(', ')

type UseModalFocusTrapOptions = {
  /** モーダルが開いているとき true */
  active: Ref<boolean> | (() => boolean)
  /** フォーカスを閉じ込めるルート（通常は dialog カード） */
  containerRef: Ref<HTMLElement | null>
  /**
   * 初期フォーカスを自前で行う場合 true（追加・作成フォームモーダルの primary input など）。
   * true のとき focus-trap はコンテナへ仮フォーカスし、既存の input focus を奪わない。
   */
  skipInitialFocus?: Ref<boolean> | (() => boolean)
  /** Escape は既存のモーダル側ハンドラに任せる（二重処理防止） */
  escapeDeactivates?: boolean
}

function resolveFlag (value: Ref<boolean> | (() => boolean) | undefined, fallback: boolean): boolean {
  if (value == null) {
    return fallback
  }
  return typeof value === 'function' ? value() : value.value
}

function collectTrapContainers (primary: HTMLElement): HTMLElement[] {
  const extras = Array.from(
    document.querySelectorAll<HTMLElement>(FLOATING_FOCUS_ROOT_SELECTOR),
  ).filter((el) => {
    const style = getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
  return [primary, ...extras]
}

/**
 * モーダル用フォーカストラップ。
 * 背面クリック閉じ・Escape・Ctrl+Enter は既存ロジックのまま。
 * body Teleport のポップオーバーも trap 集合に含め、フィールド編集を阻害しない。
 */
export function useModalFocusTrap (options: UseModalFocusTrapOptions) {
  let trap: FocusTrap | null = null

  function destroyTrap () {
    if (!trap) {
      return
    }
    try {
      trap.deactivate({ returnFocus: true })
    } catch {
      // already inactive
    }
    trap = null
  }

  function activateTrap () {
    if (!import.meta.client) {
      return
    }
    const container = options.containerRef.value
    if (!container) {
      return
    }
    destroyTrap()
    const skipInitial = resolveFlag(options.skipInitialFocus, false)
    trap = createFocusTrap(
      () => {
        const primary = options.containerRef.value
        if (!primary) {
          return []
        }
        return collectTrapContainers(primary)
      },
      {
        escapeDeactivates: options.escapeDeactivates ?? false,
        allowOutsideClick: true,
        returnFocusOnDeactivate: true,
        initialFocus: skipInitial
          ? false
          : undefined,
        fallbackFocus: () => options.containerRef.value ?? document.body,
      },
    )
    try {
      trap.activate()
    } catch {
      destroyTrap()
    }
  }

  function refreshTrap () {
    if (!trap || !resolveFlag(options.active, false)) {
      return
    }
    const primary = options.containerRef.value
    if (!primary) {
      return
    }
    try {
      trap.updateContainerElements(collectTrapContainers(primary))
    } catch {
      activateTrap()
    }
  }

  watch(
    () => resolveFlag(options.active, false),
    (open) => {
      if (open) {
        requestAnimationFrame(() => {
          if (resolveFlag(options.active, false)) {
            activateTrap()
          }
        })
      } else {
        destroyTrap()
      }
    },
    { immediate: true },
  )

  watch(
    () => options.containerRef.value,
    (el) => {
      if (el && resolveFlag(options.active, false)) {
        activateTrap()
      }
    },
  )

  onBeforeUnmount(() => {
    destroyTrap()
  })

  return {
    pauseFocusTrap: () => trap?.pause(),
    unpauseFocusTrap: () => trap?.unpause(),
    refreshFocusTrap: refreshTrap,
  }
}
