import type { MaybeRefOrGetter } from 'vue'
import { getTopmostModalOverlay, isKeyboardShortcutBlockedTarget } from '../../utils/ui/uiInteraction'

/** meta/ctrl/alt/repeat 付きはビューショートカット対象外 */
export function isViewShortcutModifierBlocked (event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey || event.repeat
}

/** フィルターボタンが DOM 上で操作可能か */
export function isFilterTriggerAvailable (el: HTMLElement | null | undefined): boolean {
  if (!el || !el.isConnected || !import.meta.client) {
    return false
  }
  const style = getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false
  }
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

/**
 * モーダル最前面 + 呼び出し側の追加ブロック条件でショートカット可否を判定する。
 */
export function createViewShortcutGate (isBlocked: () => boolean): () => boolean {
  return () => {
    if (getTopmostModalOverlay()) {
      return false
    }
    return !isBlocked()
  }
}

/**
 * ビュー共通のキーダウン登録。入力中ターゲットは呼び出し側で追加判定してもよい。
 */
export function useViewKeyboardShortcuts (options: {
  onKeydown: (event: KeyboardEvent) => void
  enabled?: MaybeRefOrGetter<boolean>
  /** keepAlive ページ向け。true なら onActivated/onDeactivated でも付け外し */
  useKeepAlive?: boolean
}) {
  function shouldListen (): boolean {
    if (options.enabled === undefined) {
      return true
    }
    return Boolean(toValue(options.enabled))
  }

  function bind () {
    if (!import.meta.client || !shouldListen()) {
      return
    }
    document.addEventListener('keydown', options.onKeydown)
  }

  function unbind () {
    if (!import.meta.client) {
      return
    }
    document.removeEventListener('keydown', options.onKeydown)
  }

  onMounted(bind)
  onBeforeUnmount(unbind)

  if (options.useKeepAlive) {
    onActivated(bind)
    onDeactivated(unbind)
  }

  return {
    isModifierBlocked: isViewShortcutModifierBlocked,
    isTypingBlocked: isKeyboardShortcutBlockedTarget,
    bind,
    unbind,
  }
}
