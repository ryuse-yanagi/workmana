import { onBeforeUnmount, watch, type WatchSource } from 'vue'

type ExclusivePopoverClose = () => void

type ExclusivePopoverClaim = {
  id: symbol
  close: ExclusivePopoverClose
}

let current: ExclusivePopoverClaim | null = null

export function isExclusivePopoverOpen (): boolean {
  return current != null
}

export function closeExclusivePopoverIfOpen (): boolean {
  if (!current) {
    return false
  }
  current.close()
  return true
}

/**
 * 同時に表示できるポップオーバーは1つ。新たに開く側が claim し、
 * 既に開いている側の close を呼ぶ。
 */
export function claimExclusivePopover (close: ExclusivePopoverClose): () => void {
  const id = Symbol('exclusive-popover')
  const previous = current && current.id !== id ? current : null
  current = { id, close }
  previous?.close()
  return () => {
    if (current?.id === id) {
      current = null
    }
  }
}

export function useExclusivePopover (
  isOpen: WatchSource<boolean>,
  close: ExclusivePopoverClose,
) {
  let release: (() => void) | null = null

  function drop () {
    release?.()
    release = null
  }

  watch(isOpen, (open) => {
    if (open) {
      drop()
      release = claimExclusivePopover(close)
      return
    }
    drop()
  }, { immediate: true })

  onBeforeUnmount(drop)
}
