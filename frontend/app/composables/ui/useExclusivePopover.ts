import { nextTick, onBeforeUnmount, watch, type WatchSource } from 'vue'

type ExclusivePopoverClose = () => void

type ExclusivePopoverClaim = {
  id: symbol
  close: ExclusivePopoverClose
}

let current: ExclusivePopoverClaim | null = null
let outgoing: ExclusivePopoverClaim | null = null
let handoffToken = 0

export function isExclusivePopoverOpen (): boolean {
  return current != null || outgoing != null
}

function bumpHandoffToken () {
  handoffToken += 1
}

function closeClaim (claim: ExclusivePopoverClaim | null) {
  claim?.close()
}

export function closeExclusivePopoverIfOpen (): boolean {
  bumpHandoffToken()
  const prevOutgoing = outgoing
  const prevCurrent = current
  outgoing = null
  const had = prevOutgoing != null || prevCurrent != null
  closeClaim(prevOutgoing)
  closeClaim(prevCurrent)
  return had
}

/**
 * 新しいポップオーバーの配置が終わるまで前を残し、閉じと開きの隙間をなくす。
 * schedulePopoverOpenLayout（nextTick + 2 rAF）と揃える。
 */
function scheduleOutgoingClose (claim: ExclusivePopoverClaim) {
  const token = ++handoffToken
  outgoing = claim
  const finish = () => {
    if (token !== handoffToken) {
      return
    }
    if (outgoing?.id !== claim.id) {
      return
    }
    outgoing = null
    claim.close()
  }
  if (typeof requestAnimationFrame !== 'function') {
    finish()
    return
  }
  void nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(finish)
    })
  })
}

/**
 * 同時に操作できるポップオーバーは1つ。新たに開く側が claim し、
 * 既に開いている側は配置確定後に close する。
 */
export function claimExclusivePopover (close: ExclusivePopoverClose): () => void {
  const id = Symbol('exclusive-popover')
  const previous = current && current.id !== id ? current : null
  current = { id, close }
  if (previous) {
    if (outgoing && outgoing.id !== previous.id) {
      const stale = outgoing
      outgoing = null
      stale.close()
    }
    scheduleOutgoingClose(previous)
  }
  return () => {
    if (current?.id === id) {
      current = null
      const prevOutgoing = outgoing
      outgoing = null
      bumpHandoffToken()
      closeClaim(prevOutgoing)
    }
    if (outgoing?.id === id) {
      outgoing = null
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
