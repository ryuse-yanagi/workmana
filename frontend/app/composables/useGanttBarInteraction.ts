import {
  isTaskActiveOnDay,
  resolveTaskDateRange,
} from './useGanttCalendar'

export type GanttBarHitZone = 'empty' | 'body' | 'start-edge' | 'end-edge'

export type GanttSelectionPreview = {
  taskId: number
  start: string
  end: string
  mode: 'create' | 'resize-start' | 'resize-end' | 'move'
}

export type GanttClickSelection = {
  taskId: number
}

type PendingPointer = {
  taskId: number
  dayIso: string
  zone: GanttBarHitZone
  pointerId: number
  startX: number
  startY: number
  captureEl: HTMLElement
  originIndex: number
  originCenterX: number
  cellWidth: number
  /** move 用: 掴んだ時点のバー範囲 */
  originalStart?: string
  originalEnd?: string
}

/** この距離を超えてポインタが動いたらドラッグ開始 */
const DRAG_ACTIVATION_PX = 4
/** 開始／終了マスの端ヒット幅（セル幅に対する比率の下限付き） */
const EDGE_ZONE_PX = 14
const EDGE_ZONE_RATIO = 0.45
const MS_PER_DAY = 24 * 60 * 60 * 1000

function orderedRange (a: string, b: string): { start: string; end: string } {
  return a <= b ? { start: a, end: b } : { start: b, end: a }
}

function parseIsoDate (iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

function formatIsoDate (date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysIso (iso: string, delta: number): string {
  const date = parseIsoDate(iso)
  date.setDate(date.getDate() + delta)
  return formatIsoDate(date)
}

function daysBetweenIso (start: string, end: string): number {
  const a = parseIsoDate(start).getTime()
  const b = parseIsoDate(end).getTime()
  return Math.round((b - a) / MS_PER_DAY)
}

function edgeHitWidth (cellWidth: number): number {
  return Math.max(EDGE_ZONE_PX, Math.round(cellWidth * EDGE_ZONE_RATIO))
}

export function resolveGanttBarHitZone (
  task: { start_date?: string | null; due_date?: string | null },
  dayIso: string,
  clientX: number,
  cellRect: DOMRect,
): GanttBarHitZone {
  const range = resolveTaskDateRange(task)
  if (!range || !isTaskActiveOnDay(task, dayIso)) {
    return 'empty'
  }
  const localX = clientX - cellRect.left
  const edge = edgeHitWidth(cellRect.width)
  const isStart = dayIso === range.start
  const isEnd = dayIso === range.end
  if (isStart && isEnd) {
    if (localX <= edge) {
      return 'start-edge'
    }
    if (localX >= cellRect.width - edge) {
      return 'end-edge'
    }
    return 'body'
  }
  if (isStart && localX <= edge) {
    return 'start-edge'
  }
  if (isEnd && localX >= cellRect.width - edge) {
    return 'end-edge'
  }
  return 'body'
}

function isEditableKeyTarget (target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true
  }
  if (target.isContentEditable) {
    return true
  }
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

export function useGanttBarInteraction (options: {
  isInteractiveTask: (taskId: number) => boolean
  getTask: (taskId: number) => { start_date?: string | null; due_date?: string | null } | null
  onCommitRange: (taskId: number, start: string | null, end: string | null) => void | Promise<void>
  /** 既存バーをダブルクリックしたとき（色ピッカーを開く等） */
  onFilledBarDoubleClick?: (taskId: number, clientX: number, clientY: number) => void
  /** カレンダーに表示中の日付（左から順） */
  dayIsoList: () => readonly string[]
  scrollContainer?: Ref<HTMLElement | null> | (() => HTMLElement | null)
}) {
  const clickSelection = ref<GanttClickSelection | null>(null)
  const dragPreview = ref<GanttSelectionPreview | null>(null)
  const pointerActive = ref(false)
  const dragging = computed(() => dragPreview.value != null)
  let pending: PendingPointer | null = null
  let lockedScrollLeft = 0
  let lockedScrollTop = 0
  let scrollLocked = false
  let lastFilledClickAt = 0
  let lastFilledClickTaskId: number | null = null
  const FILLED_BAR_DBLCLICK_MS = 320

  function resolveScrollContainer (): HTMLElement | null {
    if (!options.scrollContainer) {
      return null
    }
    if (typeof options.scrollContainer === 'function') {
      return options.scrollContainer()
    }
    return options.scrollContainer.value
  }

  function onLockedScroll () {
    const el = resolveScrollContainer()
    if (!el || !scrollLocked) {
      return
    }
    if (el.scrollLeft !== lockedScrollLeft) {
      el.scrollLeft = lockedScrollLeft
    }
    if (el.scrollTop !== lockedScrollTop) {
      el.scrollTop = lockedScrollTop
    }
  }

  function lockScroll () {
    const el = resolveScrollContainer()
    if (!el || scrollLocked) {
      return
    }
    lockedScrollLeft = el.scrollLeft
    lockedScrollTop = el.scrollTop
    scrollLocked = true
    el.addEventListener('scroll', onLockedScroll, { passive: false })
  }

  function unlockScroll () {
    const el = resolveScrollContainer()
    if (el && scrollLocked) {
      el.removeEventListener('scroll', onLockedScroll)
    }
    scrollLocked = false
  }

  function clearClickSelection () {
    clickSelection.value = null
  }

  function isInsideGanttChart (target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false
    }
    return Boolean(
      target.closest('.workspace-table__day-cell')
      || target.closest('.workspace-table__day-header')
      || target.closest('.popover.popover--gantt-color'),
    )
  }

  function onDocumentPointerDown (event: PointerEvent) {
    if (event.button !== 0 || !clickSelection.value || dragging.value || pending) {
      return
    }
    if (isInsideGanttChart(event.target)) {
      return
    }
    clearClickSelection()
  }

  function clearSelectedBar () {
    const selected = clickSelection.value
    if (!selected || dragging.value || pending) {
      return false
    }
    if (!options.isInteractiveTask(selected.taskId)) {
      return false
    }
    const task = options.getTask(selected.taskId)
    if (!task || !resolveTaskDateRange(task)) {
      return false
    }
    clickSelection.value = null
    void options.onCommitRange(selected.taskId, null, null)
    return true
  }

  function onWindowKeyDown (event: KeyboardEvent) {
    if (event.key !== 'Delete' && event.key !== 'Backspace') {
      return
    }
    if (event.defaultPrevented || event.isComposing || isEditableKeyTarget(event.target)) {
      return
    }
    if (!clearSelectedBar()) {
      return
    }
    event.preventDefault()
  }

  function isBarSelected (taskId: number): boolean {
    return clickSelection.value?.taskId === taskId
  }

  function resolveCreatePreviewRange (
    task: { id: number; start_date?: string | null; due_date?: string | null },
  ): { start: string; end: string } | null {
    const preview = dragPreview.value
    if (preview && preview.taskId === task.id && preview.mode === 'create') {
      return { start: preview.start, end: preview.end }
    }
    return null
  }

  /** 新規作成ドラッグ中の作成範囲（枠線表示用） */
  function isDaySelectionOutlined (
    task: { id: number; start_date?: string | null; due_date?: string | null },
    dayIso: string,
  ): boolean {
    const range = resolveCreatePreviewRange(task)
    if (!range) {
      return false
    }
    return dayIso >= range.start && dayIso <= range.end
  }

  function isSelectionStartDay (
    task: { id: number; start_date?: string | null; due_date?: string | null },
    dayIso: string,
  ): boolean {
    return resolveCreatePreviewRange(task)?.start === dayIso
  }

  function isSelectionEndDay (
    task: { id: number; start_date?: string | null; due_date?: string | null },
    dayIso: string,
  ): boolean {
    return resolveCreatePreviewRange(task)?.end === dayIso
  }

  /** クリック選択中のバー（opacity 表示用） */
  function isSelectedFilledBarDay (
    task: { id: number; start_date?: string | null; due_date?: string | null },
    dayIso: string,
  ): boolean {
    return isBarSelected(task.id) && shouldShowFilledBar(task, dayIso)
  }

  /** ドラッグ置換プレビュー中は実バーを隠す */
  function shouldHideFilledBar (taskId: number): boolean {
    const preview = dragPreview.value
    return Boolean(preview && preview.taskId === taskId && preview.mode === 'create')
  }

  function shouldShowFilledBar (task: { id: number; start_date?: string | null; due_date?: string | null }, dayIso: string): boolean {
    if (shouldHideFilledBar(task.id)) {
      return false
    }
    const preview = dragPreview.value
    if (
      preview
      && preview.taskId === task.id
      && (preview.mode === 'resize-start' || preview.mode === 'resize-end' || preview.mode === 'move')
    ) {
      return dayIso >= preview.start && dayIso <= preview.end
    }
    return isTaskActiveOnDay(task, dayIso)
  }

  /**
   * ポインタの X 座標から日付を求める。
   * 重なった要素（固定列やポップオーバー）に影響されず左右どちらへも辿れる。
   */
  function resolveHoverIso (clientX: number): string {
    if (!pending) {
      return ''
    }
    const days = options.dayIsoList()
    if (!days.length || pending.cellWidth <= 0 || pending.originIndex < 0) {
      return pending.dayIso
    }
    const offset = Math.round((clientX - pending.originCenterX) / pending.cellWidth)
    const index = Math.min(days.length - 1, Math.max(0, pending.originIndex + offset))
    return days[index] ?? pending.dayIso
  }

  function activateDrag (from: PendingPointer) {
    const task = options.getTask(from.taskId)
    if (!task) {
      return
    }
    clearClickSelection()
    if (from.zone === 'start-edge') {
      const range = resolveTaskDateRange(task)
      if (!range) {
        return
      }
      dragPreview.value = {
        taskId: from.taskId,
        start: from.dayIso,
        end: range.end,
        mode: 'resize-start',
      }
      return
    }
    if (from.zone === 'end-edge') {
      const range = resolveTaskDateRange(task)
      if (!range) {
        return
      }
      dragPreview.value = {
        taskId: from.taskId,
        start: range.start,
        end: from.dayIso,
        mode: 'resize-end',
      }
      return
    }
    if (from.zone === 'body') {
      const range = resolveTaskDateRange(task)
      if (range) {
        from.originalStart = range.start
        from.originalEnd = range.end
        dragPreview.value = {
          taskId: from.taskId,
          start: range.start,
          end: range.end,
          mode: 'move',
        }
        return
      }
    }
    dragPreview.value = {
      taskId: from.taskId,
      start: from.dayIso,
      end: from.dayIso,
      mode: 'create',
    }
  }

  function updateDragFromPointer (clientX: number) {
    const preview = dragPreview.value
    if (!preview || !pending) {
      return
    }
    const hoverIso = resolveHoverIso(clientX) || pending.dayIso
    if (preview.mode === 'create') {
      const next = orderedRange(pending.dayIso, hoverIso)
      dragPreview.value = { ...preview, start: next.start, end: next.end }
      return
    }
    if (preview.mode === 'resize-start') {
      const end = preview.end
      const start = hoverIso <= end ? hoverIso : end
      dragPreview.value = { ...preview, start, end }
      return
    }
    if (preview.mode === 'resize-end') {
      const start = preview.start
      const end = hoverIso >= start ? hoverIso : start
      dragPreview.value = { ...preview, start, end }
      return
    }
    if (preview.mode === 'move') {
      const originalStart = pending.originalStart
      const originalEnd = pending.originalEnd
      if (!originalStart || !originalEnd) {
        return
      }
      const dayDelta = daysBetweenIso(pending.dayIso, hoverIso)
      const span = daysBetweenIso(originalStart, originalEnd)
      let nextStart = addDaysIso(originalStart, dayDelta)
      let nextEnd = addDaysIso(nextStart, span)
      const days = options.dayIsoList()
      if (days.length > 0) {
        const first = days[0]!
        const last = days[days.length - 1]!
        if (nextStart < first) {
          nextStart = first
          nextEnd = addDaysIso(nextStart, span)
        }
        if (nextEnd > last) {
          nextEnd = last
          nextStart = addDaysIso(nextEnd, -span)
          if (nextStart < first) {
            nextStart = first
          }
        }
      }
      dragPreview.value = { ...preview, start: nextStart, end: nextEnd }
    }
  }

  function unbindWindowListeners () {
    window.removeEventListener('pointermove', onWindowPointerMove)
    window.removeEventListener('pointerup', onWindowPointerUp)
    window.removeEventListener('pointercancel', onWindowPointerUp)
  }

  function bindWindowListeners () {
    window.addEventListener('pointermove', onWindowPointerMove)
    window.addEventListener('pointerup', onWindowPointerUp)
    window.addEventListener('pointercancel', onWindowPointerUp)
  }

  function finishInteraction (commit: boolean) {
    const preview = dragPreview.value
    const pendingSnapshot = pending
    if (pendingSnapshot?.captureEl.hasPointerCapture(pendingSnapshot.pointerId)) {
      try {
        pendingSnapshot.captureEl.releasePointerCapture(pendingSnapshot.pointerId)
      } catch {
        // ignore
      }
    }
    pending = null
    dragPreview.value = null
    pointerActive.value = false
    unlockScroll()
    unbindWindowListeners()
    if (commit && preview) {
      clickSelection.value = { taskId: preview.taskId }
      void options.onCommitRange(preview.taskId, preview.start, preview.end)
    }
  }

  function onWindowPointerMove (event: PointerEvent) {
    if (!pending || event.pointerId !== pending.pointerId) {
      return
    }
    if (dragPreview.value) {
      event.preventDefault()
      updateDragFromPointer(event.clientX)
      return
    }
    const dx = event.clientX - pending.startX
    const dy = event.clientY - pending.startY
    if (Math.hypot(dx, dy) > DRAG_ACTIVATION_PX) {
      try {
        pending.captureEl.setPointerCapture(pending.pointerId)
      } catch {
        // ignore
      }
      activateDrag(pending)
      updateDragFromPointer(event.clientX)
    }
  }

  function onWindowPointerUp (event: PointerEvent) {
    if (!pending || event.pointerId !== pending.pointerId) {
      return
    }
    if (dragPreview.value) {
      finishInteraction(true)
      return
    }
    // クリック
    // - 既存バー上: 選択（ダブルクリックで色ピッカー）
    // - 空マス: その日を単日バーとして塗る
    const { taskId, dayIso, zone } = pending
    pending = null
    pointerActive.value = false
    unlockScroll()
    unbindWindowListeners()
    if (!options.isInteractiveTask(taskId)) {
      return
    }
    if (zone !== 'empty') {
      const now = performance.now()
      const isDoubleClick = lastFilledClickTaskId === taskId
        && (now - lastFilledClickAt) <= FILLED_BAR_DBLCLICK_MS
      clickSelection.value = { taskId }
      if (isDoubleClick) {
        lastFilledClickAt = 0
        lastFilledClickTaskId = null
        options.onFilledBarDoubleClick?.(taskId, event.clientX, event.clientY)
      } else {
        lastFilledClickAt = now
        lastFilledClickTaskId = taskId
      }
      return
    }
    lastFilledClickAt = 0
    lastFilledClickTaskId = null
    clickSelection.value = { taskId }
    void options.onCommitRange(taskId, dayIso, dayIso)
  }

  function resolveDisplayedRange (task: { id: number; start_date?: string | null; due_date?: string | null }) {
    const preview = dragPreview.value
    if (preview && preview.taskId === task.id) {
      return { start: preview.start, end: preview.end }
    }
    return resolveTaskDateRange(task)
  }

  function isBarStartDay (
    task: { id: number; start_date?: string | null; due_date?: string | null },
    dayIso: string,
  ): boolean {
    if (!shouldShowFilledBar(task, dayIso)) {
      return false
    }
    return resolveDisplayedRange(task)?.start === dayIso
  }

  function isBarEndDay (
    task: { id: number; start_date?: string | null; due_date?: string | null },
    dayIso: string,
  ): boolean {
    if (!shouldShowFilledBar(task, dayIso)) {
      return false
    }
    return resolveDisplayedRange(task)?.end === dayIso
  }

  function onDayCellPointerDown (
    taskId: number,
    dayIso: string,
    event: PointerEvent,
    forcedZone?: Extract<GanttBarHitZone, 'start-edge' | 'end-edge'>,
  ) {
    if (event.button !== 0) {
      return
    }
    if (!options.isInteractiveTask(taskId)) {
      return
    }
    const task = options.getTask(taskId)
    if (!task) {
      return
    }
    const target = event.currentTarget
    if (!(target instanceof HTMLElement)) {
      return
    }
    // 日付マス操作中のネイティブ選択・スクロール開始を抑止
    event.preventDefault()
    const cell = (target.closest('.workspace-table__day-cell') as HTMLElement | null) ?? target
    const cellRect = cell.getBoundingClientRect()
    const zone = forcedZone ?? resolveGanttBarHitZone(task, dayIso, event.clientX, cellRect)
    pending = {
      taskId,
      dayIso,
      zone,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      captureEl: cell,
      originIndex: options.dayIsoList().indexOf(dayIso),
      originCenterX: cellRect.left + cellRect.width / 2,
      cellWidth: cellRect.width,
    }
    pointerActive.value = true
    lockScroll()
    bindWindowListeners()
  }

  onMounted(() => {
    window.addEventListener('keydown', onWindowKeyDown)
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
  })

  onBeforeUnmount(() => {
    pending = null
    pointerActive.value = false
    unlockScroll()
    unbindWindowListeners()
    window.removeEventListener('keydown', onWindowKeyDown)
    document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  })

  return {
    clickSelection,
    dragPreview,
    dragging,
    pointerActive,
    clearClickSelection,
    clearSelectedBar,
    isDaySelectionOutlined,
    isSelectionStartDay,
    isSelectionEndDay,
    isSelectedFilledBarDay,
    shouldShowFilledBar,
    isBarStartDay,
    isBarEndDay,
    onDayCellPointerDown,
  }
}
