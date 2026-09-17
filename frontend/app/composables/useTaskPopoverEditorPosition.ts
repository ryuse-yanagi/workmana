import type { Ref } from 'vue'
import {
  POPOVER_PANEL_BASE_WIDTH,
  POPOVER_VIEWPORT_INSET,
  resolveFlippedPopoverVerticalLayout,
  popoverPositionVisibilityStyle,
  popoverScrollbarLayoutStyle,
  popoverStablePanelWidthStyle,
  resolveAnchoredPopoverLayoutWidth,
  resolvePopoverScrollbarGutter,
  schedulePopoverOpenLayout,
} from '../utils/popoverScrollbar'
import type { PopoverType } from './useTaskPopoverEditor'

const POPOVER_VIEWPORT_TOP_PAD = 200
const POPOVER_ANCHOR_GAP = 6
const POPOVER_MIN_HEIGHT = 120
const DESCRIPTION_POPOVER_MAX_WIDTH = 600

function resolvePopoverBaseWidth (type: PopoverType | null): number | null {
  switch (type) {
    case 'period':
      return POPOVER_PANEL_BASE_WIDTH.date
    case 'effort':
      return POPOVER_PANEL_BASE_WIDTH.effort
    case 'progress-rate':
      return POPOVER_PANEL_BASE_WIDTH.progressRate
    case 'members':
    case 'member-detail':
      return POPOVER_PANEL_BASE_WIDTH.members
    case 'labels':
      return POPOVER_PANEL_BASE_WIDTH.labels
    case 'list':
      return POPOVER_PANEL_BASE_WIDTH.list
    default:
      return null
  }
}

function resolveDescriptionPopoverWidth (): number {
  const viewportMax = import.meta.client
    ? Math.max(0, window.innerWidth - 21)
    : DESCRIPTION_POPOVER_MAX_WIDTH
  return Math.min(DESCRIPTION_POPOVER_MAX_WIDTH, viewportMax || DESCRIPTION_POPOVER_MAX_WIDTH)
}

function resolveWbsTop (anchor: HTMLElement): number | null {
  const table = anchor.closest('table.workspace-wbs')
    ?? anchor.closest('.workspace-wbs-board__frame')
  if (!(table instanceof HTMLElement)) {
    return null
  }
  return table.getBoundingClientRect().top
}

/** ボード内の先頭WBS（見出し）上端。セクション分割された親なしWBSでも共通の上限にする */
function resolveBoardWbsTop (anchor: HTMLElement): number | null {
  const board = anchor.closest('.workspace-wbs-board')
  if (board instanceof HTMLElement) {
    const headerCell = board.querySelector(
      '.workspace-wbs thead th, .workspace-wbs__header-cell',
    )
    if (headerCell instanceof HTMLElement) {
      return headerCell.getBoundingClientRect().top
    }
    const firstFrame = board.querySelector('.workspace-wbs-board__frame')
    if (firstFrame instanceof HTMLElement) {
      return firstFrame.getBoundingClientRect().top
    }
  }
  return resolveWbsTop(anchor)
}

function measurePopoverContentHeight (popover: HTMLElement): number {
  const style = popover.style
  const prevMaxHeight = style.maxHeight
  const prevHeight = style.height
  style.maxHeight = 'none'
  style.height = 'auto'
  const height = Math.ceil(
    popover.scrollHeight
    || popover.offsetHeight
    || popover.getBoundingClientRect().height
    || 0,
  )
  style.maxHeight = prevMaxHeight
  style.height = prevHeight
  return Math.max(POPOVER_MIN_HEIGHT, height)
}

function resolveSideLeft (
  anchorRect: DOMRect,
  popoverWidth: number,
  pad: number,
  gap: number,
): number {
  let left = anchorRect.right + gap
  if (left + popoverWidth > window.innerWidth - pad) {
    left = anchorRect.left - gap - popoverWidth
  }
  return Math.max(pad, Math.min(left, window.innerWidth - pad - popoverWidth))
}

type UseTaskPopoverEditorPositionOptions = {
  activePopover: Ref<PopoverType | null>
  popoverStyle: Ref<Record<string, string>>
  popoverAnchorEl: Ref<HTMLElement | null>
  resolvePopoverElement: () => HTMLElement | null
  popoverZIndex: number
  readonlyDescription?: Ref<boolean>
}

/**
 * WBS タスク編集ポップオーバー専用の幅解決・配置・レイアウト更新。
 * TaskDetailModal / TaskFormPane の配置とは共有しない。
 */
export function useTaskPopoverEditorPosition (
  options: UseTaskPopoverEditorPositionOptions,
) {
  function positionPopover (visible = true) {
    const anchor = options.popoverAnchorEl.value
    const popover = options.resolvePopoverElement()
    if (!anchor || !popover) return
    const pad = POPOVER_VIEWPORT_INSET
    const topPad = POPOVER_VIEWPORT_TOP_PAD
    const gap = POPOVER_ANCHOR_GAP
    const anchorRect = anchor.getBoundingClientRect()
    const type = options.activePopover.value
    const isDescription = type === 'description'
    const isDescriptionEdit = isDescription && !options.readonlyDescription?.value
    const descriptionWidth = isDescription
      ? resolveDescriptionPopoverWidth()
      : null
    const bottomLimit = window.innerHeight - pad
    let top: number
    let maxHeight: number
    let forceHeight = false

    if (isDescription) {
      if (isDescriptionEdit) {
        // 編集モード: ボード先頭WBS上端から画面下まで表示
        const wbsTop = resolveBoardWbsTop(anchor)
        top = Math.max(topPad, Math.round(wbsTop ?? anchorRect.top))
        maxHeight = Math.max(POPOVER_MIN_HEIGHT, Math.floor(bottomLimit - top))
        forceHeight = true
      } else {
        // 通常モード: 選択枠の隣。下に収まらなければ収まるまで上へ移動
        const popoverHeight = measurePopoverContentHeight(popover)
        top = Math.round(anchorRect.top)
        if (top + popoverHeight > bottomLimit) {
          top = bottomLimit - popoverHeight
        }
        top = Math.max(topPad, top)
        maxHeight = Math.max(POPOVER_MIN_HEIGHT, Math.floor(bottomLimit - top))
        if (popoverHeight > maxHeight) {
          forceHeight = true
        }
      }
    } else if (type === 'period' || type === 'effort' || type === 'progress-rate') {
      // カレンダー・工数・進捗率: 選択枠の高さから。下に収まらなければ上へずらす
      const popoverHeight = measurePopoverContentHeight(popover)
      top = Math.round(anchorRect.top)
      if (top + popoverHeight > bottomLimit) {
        top = bottomLimit - popoverHeight
      }
      top = Math.max(topPad, top)
      maxHeight = Math.max(POPOVER_MIN_HEIGHT, Math.floor(bottomLimit - top))
      if (popoverHeight > maxHeight) {
        forceHeight = true
      }
    } else if (
      type === 'members'
      || type === 'member-detail'
      || type === 'labels'
      || type === 'list'
    ) {
      // 担当・ラベル・リスト（親なし独立WBS含む）:
      // 枠上端から下に降る。収まらなければ下端余白を保ちつつ
      // 内容≤480は全文／>480は最低480かつ枠上端まで到達。WBS上端を超えるならそこで固定。
      const popoverHeight = measurePopoverContentHeight(popover)
      const cellTop = Math.max(topPad, Math.round(anchorRect.top))
      const boardWbsTop = Math.max(
        topPad,
        Math.round(resolveBoardWbsTop(anchor) ?? cellTop),
      )
      const vertical = resolveFlippedPopoverVerticalLayout(cellTop, {
        pad,
        contentHeight: popoverHeight,
      })
      if (vertical.top < boardWbsTop && cellTop + popoverHeight > bottomLimit) {
        top = boardWbsTop
        forceHeight = true
      } else {
        top = Math.max(topPad, vertical.top)
      }
      maxHeight = Math.max(POPOVER_MIN_HEIGHT, Math.floor(bottomLimit - top))
      if (popoverHeight > maxHeight) {
        forceHeight = true
      }
    } else {
      const wbsTop = resolveBoardWbsTop(anchor)
      top = Math.max(topPad, Math.round(wbsTop ?? anchorRect.top))
      maxHeight = Math.max(POPOVER_MIN_HEIGHT, Math.floor(bottomLimit - top))
    }

    // 最終ガード: はみ出す場合は共通ロジックで下端寄せ
    if (top + maxHeight > bottomLimit) {
      maxHeight = Math.max(POPOVER_MIN_HEIGHT, Math.floor(bottomLimit - top))
      forceHeight = true
    }
    const contentHeight = measurePopoverContentHeight(popover)
    if (contentHeight > 0 && top + contentHeight > bottomLimit) {
      const vertical = resolveFlippedPopoverVerticalLayout(top, {
        pad,
        contentHeight,
      })
      top = Math.max(topPad, vertical.top)
      maxHeight = Math.max(POPOVER_MIN_HEIGHT, vertical.maxHeight)
      if (contentHeight > maxHeight) {
        forceHeight = true
      }
    }

    const baseWidth = descriptionWidth ?? resolvePopoverBaseWidth(type)
    const scrollbarGutter = resolvePopoverScrollbarGutter(
      popover,
      maxHeight,
      baseWidth ?? POPOVER_PANEL_BASE_WIDTH.date,
    )
    const panelWidth = baseWidth != null
      ? resolveAnchoredPopoverLayoutWidth(baseWidth, scrollbarGutter)
      : null
    const layoutWidth = panelWidth ?? resolveAnchoredPopoverLayoutWidth(
      POPOVER_PANEL_BASE_WIDTH.date,
      scrollbarGutter,
    )
    const left = resolveSideLeft(anchorRect, layoutWidth, pad, gap)
    const useExplicitWidth = panelWidth != null

    options.popoverStyle.value = {
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      maxHeight: `${maxHeight}px`,
      ...(forceHeight || isDescriptionEdit || scrollbarGutter > 0
        ? { height: `${maxHeight}px` }
        : {}),
      zIndex: String(options.popoverZIndex),
      ...popoverPositionVisibilityStyle(visible),
      ...(useExplicitWidth ? popoverStablePanelWidthStyle(panelWidth!) : {}),
      ...popoverScrollbarLayoutStyle(scrollbarGutter, useExplicitWidth),
    }
  }

  function updatePopoverPosition () {
    const wasVisible = options.popoverStyle.value.visibility === 'visible'
    if (!wasVisible) {
      options.popoverStyle.value = popoverPositionVisibilityStyle(false)
      nextTick(() => {
        schedulePopoverOpenLayout(
          () => positionPopover(false),
          () => positionPopover(true),
        )
      })
      return
    }
    nextTick(() => {
      requestAnimationFrame(() => positionPopover(true))
    })
  }

  return {
    positionPopover,
    updatePopoverPosition,
  }
}
