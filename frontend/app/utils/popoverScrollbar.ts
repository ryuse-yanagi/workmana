/** CSS 変数。幅 mixin `popover-panel-width` が参照する */
import {
  computePosition,
  flip,
  offset,
  shift,
  type Placement,
} from '@floating-ui/dom'

export const POPOVER_SCROLLBAR_GUTTER_VAR = '--tm-popover-scrollbar-gutter'
/** オーバーレイ型スクロールバー用の右パディング（クラシック型では 0） */
export const POPOVER_SCROLLBAR_OVERLAY_PAD_VAR = '--tm-popover-scrollbar-overlay-pad'

/** ビューポート端からポップオーバー外縁までの余白（CSS `$popover-viewport-inset` と揃える） */
export const POPOVER_VIEWPORT_INSET = 8
/** ポップオーバー幅の viewport クランプ（左右 inset の合計） */
export const POPOVER_VIEWPORT_WIDTH_PAD = POPOVER_VIEWPORT_INSET * 2
/**
 * 下端に収まらないときの基準高さ（内容がこれを超える場合の下限／表示上限の目安）。
 * ビューポートがそれ未満のときは可能な最大高さに落とす。
 */
export const POPOVER_FLIPPED_MAX_HEIGHT = 480

/**
 * 固定配置ポップオーバーをビューポート内に収める（上下左右に pad 以上の余白）。
 * Floating UI の shift と同じパディング規則でクランプする。
 */
export function clampPopoverBox (
  top: number,
  left: number,
  width: number,
  height: number,
  pad: number = POPOVER_VIEWPORT_INSET,
): { top: number; left: number } {
  if (typeof window === 'undefined') {
    return { top, left }
  }
  // Floating UI shift({ padding }) と同等のビューポートクランプ
  const maxLeft = window.innerWidth - pad - width
  const maxTop = window.innerHeight - pad - height
  return {
    left: Math.min(Math.max(left, pad), Math.max(pad, maxLeft)),
    top: Math.min(Math.max(top, pad), Math.max(pad, maxTop)),
  }
}

/**
 * Floating UI でアンカー基準の preferred 座標を計算し、既存の縦 flip／gutter 規則へ渡す。
 * 見た目の配置ロジック（480px flip 等）は resolveFlippedPopoverVerticalLayout を維持する。
 */
export async function computeFloatingAnchorPoint (
  anchor: Element,
  floating: HTMLElement,
  options?: {
    placement?: Placement
    pad?: number
    gap?: number
  },
): Promise<{ x: number; y: number; placement: Placement }> {
  const pad = options?.pad ?? POPOVER_VIEWPORT_INSET
  const gap = options?.gap ?? 6
  const placement = options?.placement ?? 'bottom-start'
  const result = await computePosition(anchor, floating, {
    strategy: 'fixed',
    placement,
    middleware: [
      offset(gap),
      flip({ padding: pad }),
      shift({ padding: pad }),
    ],
  })
  return { x: result.x, y: result.y, placement: result.placement }
}

/**
 * preferredTop（ボタン上端など）から下に降る配置。
 * 内容が下端に収まるならそのまま。
 * 収まらないとき:
 * - 内容 ≤ 480 → 全文表示。下端 pad 余白を保ち、上端はボタン位置以下にならないよう寄せる
 * - 内容 > 480 → 下端 pad 余白を保ち、高さは max(480, ボタンまで届く分)（利用可能範囲内）
 * contentHeight 未計測（0）のときは preferred に置き、後続の実測で補正する。
 */
export function resolveFlippedPopoverVerticalLayout (
  preferredTop: number,
  options?: {
    pad?: number
    /** 内容の自然高。未計測時は 0（preferred 維持） */
    contentHeight?: number
  },
): { top: number; maxHeight: number } {
  const pad = options?.pad ?? POPOVER_VIEWPORT_INSET
  if (typeof window === 'undefined') {
    return { top: preferredTop, maxHeight: POPOVER_FLIPPED_MAX_HEIGHT }
  }
  const bottomLimit = window.innerHeight - pad
  const available = Math.max(0, bottomLimit - pad)
  const flippedBase = Math.min(POPOVER_FLIPPED_MAX_HEIGHT, available)
  const topClamped = Math.max(pad, preferredTop)
  const spaceFromPreferred = Math.max(0, bottomLimit - topClamped)
  const contentHeight = Math.max(0, options?.contentHeight ?? 0)

  if (contentHeight <= 0) {
    // 未計測時はクリップせず自然高を測れる余白を渡し、次フレームで確定する
    return {
      top: topClamped,
      maxHeight: available,
    }
  }

  if (spaceFromPreferred >= contentHeight) {
    return {
      top: topClamped,
      maxHeight: spaceFromPreferred,
    }
  }

  // ボタン位置から下に降る前提で収まらない → 下端余白を保って上げる
  if (contentHeight <= flippedBase) {
    // 全文表示。可能ならボタン上端に揃え、はみ出す分だけ上へ（下端は pad）
    const top = Math.max(pad, Math.min(topClamped, bottomLimit - contentHeight))
    return {
      top,
      maxHeight: bottomLimit - top,
    }
  }

  // 内容が 480 超: 最低 480px。さらにボタン上端まで届くよう伸ばす
  const reachToButton = spaceFromPreferred
  const displayHeight = Math.min(
    available,
    contentHeight,
    Math.max(flippedBase, reachToButton),
  )
  const top = Math.max(pad, bottomLimit - displayHeight)
  return {
    top,
    maxHeight: bottomLimit - top,
  }
}

/** FloatingMenu の概算高さ（実測前の仮配置用） */
export function estimateFloatingMenuHeight (itemCount: number): number {
  const paddingY = 16
  const itemHeight = 37
  const dividers = Math.max(0, itemCount - 1)
  return paddingY + Math.max(1, itemCount) * itemHeight + dividers
}

export function resolveMeasuredFloatingMenuHeight (fallbackItemCount: number): number {
  if (typeof document === 'undefined') {
    return estimateFloatingMenuHeight(fallbackItemCount)
  }
  const menuEl = document.querySelector<HTMLElement>('[data-floating-menu]')
  const measured = menuEl?.getBoundingClientRect().height
  if (measured && measured > 0) {
    return measured
  }
  return estimateFloatingMenuHeight(fallbackItemCount)
}

/** 各ポップオーバーの基準幅（CSS mixin と揃える） */
export const POPOVER_PANEL_BASE_WIDTH = {
  date: 275,
  effort: 259,
  progressRate: 259,
  members: 320,
  memberDetail: 307,
  labels: 320,
  list: 360,
  parent: 360,
  description: 600,
  descriptionModal: 448,
  ganttColor: 336,
  status: 320,
  /** DocumentCategorySelect 用（ステータス選択と同じレイアウト） */
  category: 320,
  /** TaskFormPane のカテゴリピッカー（ステータスと同じ幅） */
  categoryPicker: 320,
  assigneePicker: 320,
  hierarchy: 280,
  checklistAdd: 320,
} as const

/** 実際に overflow-y: auto でスクロールする要素（外側の overflow:hidden シェルは含めない） */
const POPOVER_SCROLLER_SELECTOR = [
  '.popover-scroll',
  '.workspace-status-select__list',
  '.document-category-select__list',
  '.board-filter-body',
  'textarea.description-input',
  '.description-input',
].join(',')

/** classicScrollbarWidth が 0（オーバーレイ型）でも右端が隠れないよう確保する幅 */
const OVERLAY_SCROLLBAR_RESERVE_PX = 12
/** `thin-scrollbar` mixin（webkit 6px / Firefox thin）と揃えた計測用クラス */
const THIN_SCROLLBAR_PROBE_CLASS = 'tm-popover-scrollbar-width-probe'
const THIN_SCROLLBAR_PROBE_STYLE_ID = 'tm-popover-scrollbar-probe-style'

let cachedClassicScrollbarWidth: number | null = null

function ensureThinScrollbarProbeStyles (): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(THIN_SCROLLBAR_PROBE_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = THIN_SCROLLBAR_PROBE_STYLE_ID
  // `_mixin.scss` の thin-scrollbar と同じ幅で測る（デフォルトバー幅だと gutter が過大になる）
  style.textContent = `
.${THIN_SCROLLBAR_PROBE_CLASS} {
  scrollbar-width: thin;
}
.${THIN_SCROLLBAR_PROBE_CLASS}::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
`
  document.head.appendChild(style)
}

/**
 * オーバレイ型スクロールバーでは 0。
 * クラシック型ではポップオーバー実スクロール（thin）と同じ予約幅。
 */
export function classicScrollbarWidth (): number {
  if (typeof document === 'undefined') return 0
  if (cachedClassicScrollbarWidth != null) return cachedClassicScrollbarWidth
  ensureThinScrollbarProbeStyles()
  const probe = document.createElement('div')
  probe.className = THIN_SCROLLBAR_PROBE_CLASS
  probe.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;visibility:hidden'
  document.body.appendChild(probe)
  cachedClassicScrollbarWidth = Math.max(0, probe.offsetWidth - probe.clientWidth)
  probe.remove()
  return cachedClassicScrollbarWidth
}

export function popoverScrollbarGutterStyle (gutterPx: number): Record<string, string> {
  return popoverScrollbarLayoutStyle(gutterPx, false)
}

/**
 * スクロール必要時はパネル幅を広げてコンテンツ幅を維持する。
 * - gutter: パネル幅加算のみ（宿主の padding 8px には足さない）
 * - overlay-pad: オーバーレイ型のときだけスクロール内容の内側余白
 */
export function popoverScrollbarLayoutStyle (
  gutterPx: number,
  _explicitPanelWidth: boolean,
): Record<string, string> {
  const amount = Math.max(0, gutterPx)
  if (amount <= 0) {
    return {
      [POPOVER_SCROLLBAR_GUTTER_VAR]: '0px',
      [POPOVER_SCROLLBAR_OVERLAY_PAD_VAR]: '0px',
    }
  }
  const overlayPad = classicScrollbarWidth() === 0 ? amount : 0
  return {
    [POPOVER_SCROLLBAR_GUTTER_VAR]: `${amount}px`,
    [POPOVER_SCROLLBAR_OVERLAY_PAD_VAR]: `${overlayPad}px`,
  }
}

/**
 * 高さ制約を外した自然高を測る。
 * top+bottom や height 固定の状態では getBoundingClientRect が余白込みになるため。
 */
export function measurePopoverNaturalHeight (popover: HTMLElement): number {
  const scroller = resolvePopoverScroller(popover)
  const popoverPrev = {
    maxHeight: popover.style.maxHeight,
    height: popover.style.height,
    bottom: popover.style.bottom,
  }
  const scrollerPrev = {
    maxHeight: scroller.style.maxHeight,
    height: scroller.style.height,
  }
  try {
    popover.style.maxHeight = 'none'
    popover.style.height = 'auto'
    popover.style.bottom = 'auto'
    if (scroller !== popover) {
      scroller.style.maxHeight = 'none'
      scroller.style.height = 'auto'
    }
    void popover.offsetHeight
    return Math.ceil(popover.scrollHeight || popover.offsetHeight || 0)
  } finally {
    popover.style.maxHeight = popoverPrev.maxHeight
    popover.style.height = popoverPrev.height
    popover.style.bottom = popoverPrev.bottom
    scroller.style.maxHeight = scrollerPrev.maxHeight
    scroller.style.height = scrollerPrev.height
  }
}

/**
 * flex 列 + 内側スクロールのポップオーバー用。
 * スクロールが必要なときは max-height だけでなく height も固定する
 * （max-height だけだと内側が縮まずスクロール不能になることがある）。
 */
export function popoverMaxHeightStyle (
  maxHeightPx: number,
  scrollbarGutterPx: number,
): Record<string, string> {
  const maxHeight = `${Math.max(0, maxHeightPx)}px`
  if (scrollbarGutterPx > 0) {
    return { maxHeight, height: maxHeight }
  }
  return { maxHeight }
}

function isVerticallyScrollableStyle (el: Element): boolean {
  if (!(el instanceof HTMLElement)) {
    return false
  }
  const overflowY = getComputedStyle(el).overflowY
  return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
}

export function resolvePopoverScroller (root: HTMLElement): HTMLElement {
  if (root.matches(POPOVER_SCROLLER_SELECTOR)) {
    const nested = root.querySelector(POPOVER_SCROLLER_SELECTOR)
    if (nested instanceof HTMLElement) {
      return nested
    }
    return root
  }
  const preferred = root.querySelector(POPOVER_SCROLLER_SELECTOR)
  if (preferred instanceof HTMLElement) {
    return preferred
  }
  const candidates = root.querySelectorAll('*')
  for (const el of candidates) {
    if (el instanceof HTMLElement && isVerticallyScrollableStyle(el)) {
      return el
    }
  }
  return root
}

function scrollbarGutterForOverflow (): number {
  const classic = classicScrollbarWidth()
  return classic > 0 ? classic : OVERLAY_SCROLLBAR_RESERVE_PX
}

/**
 * パネル幅に足す量。スクロール不要（gutterPx === 0）なら 0。
 */
export function popoverWidthExtraForGutter (gutterPx: number = 0): number {
  return Math.max(0, gutterPx)
}

/** 基準幅 + スクロールバー分を viewport 内に収めたレイアウト幅 */
export function resolveAnchoredPopoverLayoutWidth (
  baseWidthPx: number,
  gutterPx: number,
): number {
  const total = baseWidthPx + popoverWidthExtraForGutter(gutterPx)
  if (typeof window === 'undefined') {
    return total
  }
  return Math.min(total, window.innerWidth - POPOVER_VIEWPORT_WIDTH_PAD)
}

/** 基準幅にスクロールバー有無を反映したパネル幅スタイル */
export function popoverStablePanelWidthStyle (widthPx: number): Record<string, string> {
  const w = `${Math.round(widthPx)}px`
  return {
    width: w,
    minWidth: w,
    maxWidth: w,
  }
}

export function popoverPositionVisibilityStyle (isPositioned: boolean): Record<string, string> {
  return { visibility: isPositioned ? 'visible' : 'hidden' }
}

/**
 * 開くときの位置決めを確定してから表示する。
 * 1フレーム目で測り、制約適用後の 2 フレーム目で再測し、その後 onSettled。
 * 呼び出し側は onSettled まで visibility:hidden を維持すること。
 */
export function schedulePopoverOpenLayout (
  position: () => void,
  onSettled: () => void,
): void {
  if (typeof requestAnimationFrame !== 'function') {
    position()
    position()
    onSettled()
    return
  }
  requestAnimationFrame(() => {
    position()
    requestAnimationFrame(() => {
      position()
      onSettled()
    })
  })
}

export type AnchoredPopoverLayout = {
  top: number
  left: number
  maxHeight: number
  scrollbarGutter: number
  panelWidth: number
}

/** アンカー下に展開するポップオーバーの位置・幅を一括計算 */
export function computeAnchoredPopoverBelowLayout (
  anchorRect: DOMRect,
  baseWidthPx: number,
  popover: HTMLElement,
  options?: {
    pad?: number
    gap?: number
    minHeight?: number
    alignLeft?: boolean
  },
): AnchoredPopoverLayout {
  const pad = options?.pad ?? POPOVER_VIEWPORT_INSET
  const gap = options?.gap ?? 6
  const minHeight = options?.minHeight ?? 120
  const preferredTop = Math.max(pad, anchorRect.bottom + gap)
  // 拘束後の clientHeight ではなく自然高で縦配置を決める（2パス目のずれ防止）
  const measuredHeight = Math.ceil(measurePopoverNaturalHeight(popover) || 0)
  const vertical = resolveFlippedPopoverVerticalLayout(preferredTop, {
    pad,
    contentHeight: measuredHeight > 0 ? Math.max(minHeight, measuredHeight) : 0,
  })
  const top = vertical.top
  const maxHeight = Math.max(minHeight, vertical.maxHeight)
  const scrollbarGutter = resolvePopoverScrollbarGutter(popover, maxHeight, baseWidthPx)
  const panelWidth = resolveAnchoredPopoverLayoutWidth(baseWidthPx, scrollbarGutter)
  let left = options?.alignLeft === false ? anchorRect.right + gap : anchorRect.left
  if (left + panelWidth > window.innerWidth - pad) {
    left = options?.alignLeft === false
      ? anchorRect.left - gap - panelWidth
      : anchorRect.right - panelWidth
  }
  left = Math.max(pad, Math.min(left, window.innerWidth - panelWidth - pad))
  const clampHeight = measuredHeight > 0
    ? Math.min(measuredHeight, maxHeight)
    : Math.min(minHeight, maxHeight)
  // Floating UI shift と同じ padding 規則で最終クランプ
  const clamped = clampPopoverBox(top, left, panelWidth, clampHeight, pad)
  return {
    top: clamped.top,
    left: clamped.left,
    maxHeight,
    scrollbarGutter,
    panelWidth,
  }
}

/**
 * Floating UI でアンカー下配置の座標を検証・補正する（非同期）。
 * 既存の sync レイアウトと併用し、水平方向の shift をライブラリ側で確定する。
 */
export async function refineAnchoredPopoverWithFloatingUi (
  anchor: Element,
  popover: HTMLElement,
  layout: AnchoredPopoverLayout,
  options?: { pad?: number; gap?: number; placement?: Placement },
): Promise<AnchoredPopoverLayout> {
  const pad = options?.pad ?? POPOVER_VIEWPORT_INSET
  const gap = options?.gap ?? 6
  const placement = options?.placement ?? 'bottom-start'
  try {
    // 縦位置・高さは既存規則を維持。水平の viewport shift のみ Floating UI に委譲する。
    const result = await computePosition(anchor, popover, {
      strategy: 'fixed',
      placement,
      middleware: [
        offset(gap),
        shift({ padding: pad }),
      ],
    })
    const left = result.x
    const clamped = clampPopoverBox(
      layout.top,
      left,
      layout.panelWidth,
      Math.min(layout.maxHeight, measurePopoverNaturalHeight(popover) || layout.maxHeight),
      pad,
    )
    return {
      ...layout,
      top: layout.top,
      left: clamped.left,
    }
  } catch {
    return layout
  }
}

/** アンカー横に展開するポップオーバーの位置・幅を一括計算（既定は右隣、足りなければ反対側） */
export function computeAnchoredPopoverBesideLayout (
  anchorRect: DOMRect,
  baseWidthPx: number,
  popover: HTMLElement,
  options?: {
    pad?: number
    gap?: number
    minHeight?: number
    /** 優先する側。既定は right */
    prefer?: 'left' | 'right'
  },
): AnchoredPopoverLayout {
  const pad = options?.pad ?? POPOVER_VIEWPORT_INSET
  const gap = options?.gap ?? 6
  const minHeight = options?.minHeight ?? 120
  const preferLeft = options?.prefer === 'left'
  const preferredTop = Math.max(pad, anchorRect.top)
  const measuredHeight = Math.ceil(measurePopoverNaturalHeight(popover) || 0)
  const vertical = resolveFlippedPopoverVerticalLayout(preferredTop, {
    pad,
    contentHeight: measuredHeight > 0 ? Math.max(minHeight, measuredHeight) : 0,
  })
  const top = vertical.top
  const maxHeight = Math.max(minHeight, vertical.maxHeight)
  const scrollbarGutter = resolvePopoverScrollbarGutter(popover, maxHeight, baseWidthPx)
  const panelWidth = resolveAnchoredPopoverLayoutWidth(baseWidthPx, scrollbarGutter)
  let left = preferLeft
    ? anchorRect.left - gap - panelWidth
    : anchorRect.right + gap
  if (preferLeft) {
    if (left < pad) {
      left = anchorRect.right + gap
    }
  } else if (left + panelWidth > window.innerWidth - pad) {
    left = anchorRect.left - gap - panelWidth
  }
  left = Math.max(pad, Math.min(left, window.innerWidth - panelWidth - pad))
  const clampHeight = measuredHeight > 0
    ? Math.min(measuredHeight, maxHeight)
    : Math.min(minHeight, maxHeight)
  const clamped = clampPopoverBox(top, left, panelWidth, clampHeight, pad)
  return {
    top: clamped.top,
    left: clamped.left,
    maxHeight,
    scrollbarGutter,
    panelWidth,
  }
}

export function buildAnchoredPopoverStyle (
  layout: AnchoredPopoverLayout,
  options?: {
    zIndex?: number | string
    forceHeight?: boolean
    /** false のとき位置・幅は確定しても非表示（開くときの最終パスまで） */
    visible?: boolean
  },
): Record<string, string> {
  const { top, left, maxHeight, scrollbarGutter, panelWidth } = layout
  const fixedHeight = options?.forceHeight || scrollbarGutter > 0
  const visible = options?.visible !== false
  return {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    zIndex: String(options?.zIndex ?? 210),
    ...popoverPositionVisibilityStyle(visible),
    ...popoverStablePanelWidthStyle(panelWidth),
    ...popoverMaxHeightStyle(maxHeight, scrollbarGutter),
    ...popoverScrollbarLayoutStyle(scrollbarGutter, true),
    ...(fixedHeight ? { height: `${maxHeight}px` } : {}),
  }
}

function elementNeedsVerticalScroll (el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight + 1
}

/**
 * overflow-y: auto のスクロール要素で、縦スクロールが必要なら
 * 一覧幅を削らずパネルを広げるための量を返す。
 *
 * 基準幅（スクロールバーなし）で測定し、バーの有無でパネル幅を切り替える。
 */
export function resolvePopoverScrollbarGutter (
  popover: HTMLElement,
  popoverMaxHeightPx: number,
  baseWidthPx?: number | null,
): number {
  if (popoverMaxHeightPx <= 0) return 0

  const scroller = resolvePopoverScroller(popover)
  const popoverPrev = {
    maxHeight: popover.style.maxHeight,
    height: popover.style.height,
    width: popover.style.width,
    minWidth: popover.style.minWidth,
    maxWidth: popover.style.maxWidth,
    gutter: popover.style.getPropertyValue(POPOVER_SCROLLBAR_GUTTER_VAR),
    overlayPad: popover.style.getPropertyValue(POPOVER_SCROLLBAR_OVERLAY_PAD_VAR),
  }
  const scrollerPrev = {
    maxHeight: scroller.style.maxHeight,
    height: scroller.style.height,
    overflowY: scroller.style.overflowY,
  }

  // 測定中だけ gutter を 0 にする。表示中パネルで残すと一瞬レイアウトが潰れる
  popover.style.setProperty(POPOVER_SCROLLBAR_GUTTER_VAR, '0px')
  popover.style.setProperty(POPOVER_SCROLLBAR_OVERLAY_PAD_VAR, '0px')

  try {
    // 既にバー分だけ広い状態だと誤判定するため、基準幅で測る
    if (baseWidthPx != null && baseWidthPx > 0) {
      const baseWidth = `${Math.round(baseWidthPx)}px`
      popover.style.width = baseWidth
      popover.style.minWidth = baseWidth
      popover.style.maxWidth = baseWidth
    }

    // 1) 自然高が max を超える → 確実にスクロール必要（ラベル一覧など）
    popover.style.maxHeight = 'none'
    popover.style.height = 'auto'
    if (scroller !== popover) {
      scroller.style.maxHeight = 'none'
      scroller.style.height = 'auto'
    }
    void popover.offsetHeight
    const naturalHeight = Math.ceil(
      popover.scrollHeight || popover.offsetHeight || 0,
    )
    if (naturalHeight > popoverMaxHeightPx + 1) {
      return scrollbarGutterForOverflow()
    }

    // 2) 高さ固定時の内側スクロール（説明 textarea など）
    popover.style.maxHeight = `${popoverMaxHeightPx}px`
    popover.style.height = `${popoverMaxHeightPx}px`
    if (scroller !== popover) {
      scroller.style.maxHeight = scrollerPrev.maxHeight
      scroller.style.height = scrollerPrev.height
      scroller.style.overflowY = 'auto'
    }
    void popover.offsetHeight
    void scroller.offsetHeight

    return elementNeedsVerticalScroll(scroller) ? scrollbarGutterForOverflow() : 0
  } finally {
    popover.style.maxHeight = popoverPrev.maxHeight
    popover.style.height = popoverPrev.height
    popover.style.width = popoverPrev.width
    popover.style.minWidth = popoverPrev.minWidth
    popover.style.maxWidth = popoverPrev.maxWidth
    if (popoverPrev.gutter) {
      popover.style.setProperty(POPOVER_SCROLLBAR_GUTTER_VAR, popoverPrev.gutter)
    } else {
      popover.style.removeProperty(POPOVER_SCROLLBAR_GUTTER_VAR)
    }
    if (popoverPrev.overlayPad) {
      popover.style.setProperty(POPOVER_SCROLLBAR_OVERLAY_PAD_VAR, popoverPrev.overlayPad)
    } else {
      popover.style.removeProperty(POPOVER_SCROLLBAR_OVERLAY_PAD_VAR)
    }
    scroller.style.maxHeight = scrollerPrev.maxHeight
    scroller.style.height = scrollerPrev.height
    scroller.style.overflowY = scrollerPrev.overflowY
  }
}
