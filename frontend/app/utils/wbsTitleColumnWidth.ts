import {
  WBS_COLUMN_MIN_WIDTH,
  WBS_LIST_COLUMN_MIN_WIDTH,
  WBS_TITLE_COLUMN_MIN_WIDTH,
} from '../composables/useWbsColumnResize'
import type { WbsDisplayRow } from '../composables/useWbsTaskGroups'

/** WorkspaceWbsView.scss の --wbs-* とレイアウト定数（px） */
const WBS_TITLE_TD_PADDING_LEFT = 8
/** .workspace-wbs__toggle / .workspace-wbs__drag-handle の幅（同一） */
const WBS_LEADING_CONTROL_WIDTH = 20
/** .workspace-wbs__title-field の margin-left（--wbs-title-after-leading-gap） */
const WBS_TITLE_AFTER_LEADING_GAP = 6
const WBS_CHILD_NEST_INDENT = 24
/** .workspace-wbs__title-text / title-input の左右 padding */
const WBS_TITLE_FIELD_HORIZONTAL_PADDING = 8 * 2
const WBS_TITLE_TEXT_BORDER_WIDTH = 2
const WBS_TASK_MENU_WIDTH = 32
const WBS_TASK_MENU_MARGIN_LEFT = 4
const WBS_COL_DIVIDER_INSET = 12
const WBS_TITLE_FONT_SIZE_PX = 14
/** ellipsis-dots.client.ts が切り詰め時に付与する文字列 */
const WBS_ELLIPSIS_DOTS = '...'
/** サブピクセル誤差・計測誤差用 */
const WBS_TITLE_WIDTH_SAFETY_PX = 2
/** リスト列セル — 先頭以外の左 inset（10px + 区切り線左 12px） */
const WBS_LIST_CELL_BTN_PADDING_LEFT = 10 + WBS_COL_DIVIDER_INSET
const WBS_LIST_WIDTH_SAFETY_PX = 2
/** ヘッダー列 — .workspace-wbs__header-label padding-right / テキスト左右 inset */
const WBS_HEADER_TEXT_INSET = 10
/** ヘッダー列 — 先頭以外の th padding-left のうち区切り線分 */
const WBS_HEADER_CELL_PADDING_LEFT_EXTRA = WBS_COL_DIVIDER_INSET
const WBS_HEADER_FONT_SIZE_PX = 12

let textProbe: HTMLSpanElement | null = null
let cachedDotsWidth: Record<500 | 700, number> = { 500: 0, 700: 0 }

function resolveWbsTitleFontFamily (): string {
  if (!import.meta.client) {
    return 'sans-serif'
  }
  const wbsEl = document.querySelector('.workspace-wbs')
  if (wbsEl instanceof HTMLElement) {
    return window.getComputedStyle(wbsEl).fontFamily || 'sans-serif'
  }
  return window.getComputedStyle(document.body).fontFamily || 'sans-serif'
}

function getTextProbe (): HTMLSpanElement | null {
  if (!import.meta.client) {
    return null
  }
  if (!textProbe) {
    textProbe = document.createElement('span')
    textProbe.setAttribute('aria-hidden', 'true')
    Object.assign(textProbe.style, {
      position: 'fixed',
      left: '-9999px',
      top: '0',
      visibility: 'hidden',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      fontSize: `${WBS_TITLE_FONT_SIZE_PX}px`,
      lineHeight: '1',
      padding: '0',
      border: '0',
      margin: '0',
    })
    document.body.appendChild(textProbe)
  }
  textProbe.style.fontFamily = resolveWbsTitleFontFamily()
  return textProbe
}

function measureProbeTextWidth (
  text: string,
  fontWeight: 500 | 700,
  fontSizePx = WBS_TITLE_FONT_SIZE_PX,
  letterSpacing = 'normal',
): number {
  const probe = getTextProbe()
  if (!probe) {
    return text.length * (fontSizePx * 0.65)
  }
  probe.style.fontSize = `${fontSizePx}px`
  probe.style.fontWeight = String(fontWeight)
  probe.style.letterSpacing = letterSpacing
  probe.textContent = text
  return probe.getBoundingClientRect().width
}

function measureEllipsisDotsWidth (fontWeight: 500 | 700): number {
  if (cachedDotsWidth[fontWeight] > 0) {
    return cachedDotsWidth[fontWeight]
  }
  const width = measureProbeTextWidth(WBS_ELLIPSIS_DOTS, fontWeight)
  cachedDotsWidth[fontWeight] = width
  return width
}

/** タスク名テキスト + ellipsis-dots プラグインの "..." 分 */
export function measureWbsTitleTextWidth (text: string, fontWeight: 500 | 700): number {
  if (!text) {
    return 0
  }
  return (
    measureProbeTextWidth(text, fontWeight)
    + measureEllipsisDotsWidth(fontWeight)
  )
}

/** リスト名テキスト + ellipsis-dots プラグインの "..." 分 */
export function measureWbsListTextWidth (text: string, fontWeight: 500 | 700): number {
  if (!text) {
    return 0
  }
  return (
    measureProbeTextWidth(text, fontWeight)
    + measureEllipsisDotsWidth(fontWeight)
  )
}

function titleRowLeadingWidth (kind: WbsDisplayRow['kind'], editMode: boolean): number {
  if (kind === 'child') {
    return WBS_LEADING_CONTROL_WIDTH + WBS_CHILD_NEST_INDENT
  }
  return WBS_LEADING_CONTROL_WIDTH
}

function titleRowChromeWidth (kind: WbsDisplayRow['kind']): number {
  return Math.max(
    titleRowLeadingWidth(kind, false),
    titleRowLeadingWidth(kind, true),
  ) + (
    WBS_TITLE_TD_PADDING_LEFT
    + WBS_TITLE_AFTER_LEADING_GAP
    + WBS_TITLE_FIELD_HORIZONTAL_PADDING
    + WBS_TITLE_TEXT_BORDER_WIDTH
    + WBS_TASK_MENU_WIDTH
    + WBS_TASK_MENU_MARGIN_LEFT
  )
}

export function computeWbsTitleColumnMinWidth (
  rows: readonly WbsDisplayRow[],
): number {
  let maxWidth = WBS_TITLE_COLUMN_MIN_WIDTH
  for (const row of rows) {
    const title = row.task.title?.trim()
    if (!title) {
      continue
    }
    const fontWeight = row.kind === 'parent' ? 700 : 500
    const requiredWidth = Math.ceil(
      titleRowChromeWidth(row.kind)
      + measureWbsTitleTextWidth(title, fontWeight)
      + WBS_TITLE_WIDTH_SAFETY_PX,
    )
    if (requiredWidth > maxWidth) {
      maxWidth = requiredWidth
    }
  }
  return maxWidth
}

/** ヘッダー見出しテキスト + ellipsis-dots プラグインの "..." 分 */
export function measureWbsHeaderLabelTextWidth (text: string): number {
  if (!text) {
    return 0
  }
  return (
    measureProbeTextWidth(text, 700, WBS_HEADER_FONT_SIZE_PX, '0.02em')
    + measureEllipsisDotsWidth(700)
  )
}

/** ヘッダー見出しが左右対称の余白で収まる列幅 */
export function computeWbsHeaderLabelColumnMinWidth (label: string): number {
  const trimmed = label.trim()
  if (!trimmed) {
    return WBS_COLUMN_MIN_WIDTH
  }
  return Math.ceil(
    WBS_HEADER_TEXT_INSET
    + WBS_HEADER_CELL_PADDING_LEFT_EXTRA
    + WBS_HEADER_TEXT_INSET
    + measureWbsHeaderLabelTextWidth(trimmed)
    + WBS_TITLE_WIDTH_SAFETY_PX,
  )
}

/** 工数の最大表示（整数4桁 + 小数2桁 + 単位）。EFFORT_DRAFT_MAX_* と一致 */
const WBS_EFFORT_MAX_DISPLAY = '9999.99 h'

/** 工数列 — 「9999.99 h」とヘッダー「工数」が切れない最小幅 */
export function computeWbsEffortColumnMinWidth (): number {
  const textWidth = Math.max(
    measureWbsListTextWidth(WBS_EFFORT_MAX_DISPLAY, 500),
    measureWbsListTextWidth(WBS_EFFORT_MAX_DISPLAY, 700),
  )
  return Math.max(
    WBS_COLUMN_MIN_WIDTH,
    computeWbsHeaderLabelColumnMinWidth('工数'),
    Math.ceil(
      WBS_LIST_CELL_BTN_PADDING_LEFT
      + textWidth
      + WBS_LIST_WIDTH_SAFETY_PX
    ),
  )
}

export function computeWbsListColumnMinWidth (
  listNames: readonly string[],
): number {
  let maxWidth = Math.max(
    WBS_LIST_COLUMN_MIN_WIDTH,
    computeWbsHeaderLabelColumnMinWidth('リスト'),
  )
  const chromeWidth = (
    WBS_LIST_CELL_BTN_PADDING_LEFT
    + WBS_LIST_WIDTH_SAFETY_PX
  )
  for (const raw of listNames) {
    const name = raw.trim()
    if (!name) {
      continue
    }
    const textWidth = Math.max(
      measureWbsListTextWidth(name, 500),
      measureWbsListTextWidth(name, 700),
    )
    const requiredWidth = Math.ceil(chromeWidth + textWidth)
    if (requiredWidth > maxWidth) {
      maxWidth = requiredWidth
    }
  }
  return maxWidth
}

/** 計測用プローブのフォントキャッシュをクリア（WBS 描画後に再計測するとき） */
export function resetWbsTitleWidthMeasureCache (): void {
  cachedDotsWidth = { 500: 0, 700: 0 }
}
