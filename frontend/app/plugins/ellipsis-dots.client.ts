/**
 * 省略表記をブラウザ既定の「…」ではなく「...」で表示する。
 * Chrome / Safari は text-overflow の文字列指定に未対応のため、実テキストを切り詰める。
 */
const TRUNCATE_SELECTOR = [
  '.workspace-wbs__header-label',
  '.workspace-wbs__title-text',
  '.workspace-wbs__ellipsis',
  '.workspace-wbs__cell-btn--text > span:not(.workspace-wbs__placeholder)',
  '.member-picker-name',
  '.member-detail-name',
  '.member-detail-email',
  '.list-picker-label',
  '.task-detail-parent-task',
  '.task-detail-list-badge',
  '.subheader-doc-name',
  '.subheader-workspace-name',
  '.workspace-linked-items-modal__item-name',
  '.name-text',
  '.description-text',
  '.label-strip',
  '.label-strip__text',
  '.profile-name',
].join(', ')
const DOTS = '...'
type TruncateState = {
  kind: 'text' | 'input'
  node?: Text
  full: string
  applied: string
  width: number
  height: number
}
export default defineNuxtPlugin(() => {
  if (!import.meta.client) {
    return
  }
  const states = new WeakMap<Element, TruncateState>()
  /** 切り詰め対象は「意味のあるテキストノードがちょうど 1 つ」の要素に限る */
  function findTextNode (el: Element): Text | null {
    let found: Text | null = null
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) {
        continue
      }
      const text = node as Text
      if (text.data.trim() === '') {
        continue
      }
      if (found) {
        return null
      }
      found = text
    }
    return found
  }
  function fits (el: Element, clamped: boolean): boolean {
    return clamped
      ? el.scrollHeight <= el.clientHeight + 2
      : el.scrollWidth <= el.clientWidth + 1
  }
  function readFullText (previous: TruncateState | undefined, current: string): string {
    return previous && previous.applied === current ? previous.full : current
  }
  function truncateInput (el: HTMLInputElement) {
    const previous = states.get(el)
    const current = el.value
    const full = readFullText(previous, current)
    const width = el.clientWidth
    const height = el.clientHeight
    if (width === 0 && height === 0) {
      return
    }
    if (
      previous
      && previous.kind === 'input'
      && previous.full === full
      && previous.applied === current
      && previous.width === width
      && previous.height === height
    ) {
      return
    }
    if (el.style.textOverflow !== 'clip') {
      el.style.textOverflow = 'clip'
    }
    if (el.value !== full) {
      el.value = full
    }
    if (fits(el, false)) {
      states.set(el, {
        kind: 'input',
        full,
        applied: full,
        width: el.clientWidth,
        height: el.clientHeight,
      })
      return
    }
    let low = 0
    let high = full.length
    while (low < high) {
      const middle = Math.ceil((low + high) / 2)
      el.value = full.slice(0, middle).trimEnd() + DOTS
      if (fits(el, false)) {
        low = middle
      } else {
        high = middle - 1
      }
    }
    el.value = full.slice(0, low).trimEnd() + DOTS
    states.set(el, {
      kind: 'input',
      full,
      applied: el.value,
      width: el.clientWidth,
      height: el.clientHeight,
    })
  }
  function truncate (el: Element) {
    if (el instanceof HTMLInputElement) {
      truncateInput(el)
      return
    }
    const node = findTextNode(el)
    if (!node) {
      return
    }
    const style = getComputedStyle(el)
    // インライン要素は clientWidth が当てにならないため対象外
    if (style.display === 'inline' || style.display === 'none') {
      return
    }
    const previous = states.get(el)
    const current = node.data
    const full = readFullText(previous, current)
    const width = el.clientWidth
    const height = el.clientHeight
    if (width === 0 && height === 0) {
      return
    }
    if (
      previous
      && previous.kind === 'text'
      && previous.node === node
      && previous.full === full
      && previous.applied === current
      && previous.width === width
      && previous.height === height
    ) {
      return
    }
    // ブラウザ既定の「…」が併記されないようにする
    if (el instanceof HTMLElement && el.style.textOverflow !== 'clip') {
      el.style.textOverflow = 'clip'
    }
    if (node.data !== full) {
      node.data = full
    }
    const clamped = style.webkitLineClamp !== 'none' && style.webkitLineClamp !== ''
    if (fits(el, clamped)) {
      states.set(el, {
        kind: 'text',
        node,
        full,
        applied: full,
        width: el.clientWidth,
        height: el.clientHeight,
      })
      return
    }
    let low = 0
    let high = full.length
    while (low < high) {
      const middle = Math.ceil((low + high) / 2)
      node.data = full.slice(0, middle).trimEnd() + DOTS
      if (fits(el, clamped)) {
        low = middle
      } else {
        high = middle - 1
      }
    }
    node.data = full.slice(0, low).trimEnd() + DOTS
    states.set(el, {
      kind: 'text',
      node,
      full,
      applied: node.data,
      width: el.clientWidth,
      height: el.clientHeight,
    })
  }
  let scheduled = false
  const observed = new WeakSet<Element>()
  const resizeObserver = new ResizeObserver(() => scheduleScan())
  function scan () {
    scheduled = false
    for (const el of document.querySelectorAll(TRUNCATE_SELECTOR)) {
      if (!observed.has(el)) {
        observed.add(el)
        resizeObserver.observe(el)
      }
      truncate(el)
    }
    // 自身の書き換え分は監視対象から除外する
    mutationObserver.takeRecords()
  }
  function scheduleScan () {
    if (scheduled) {
      return
    }
    scheduled = true
    requestAnimationFrame(scan)
  }
  const mutationObserver = new MutationObserver(() => scheduleScan())
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['value'],
  })
  window.addEventListener('resize', scheduleScan)
  scheduleScan()
})
