import type { Ref } from 'vue'
import type { LabelCategoryGroup } from '../label/useLabelCategories'
import {
  filterLabelCategories,
  labelCategoriesFromFlat,
  sortLabelsByCatalogOrder,
} from '../label/useLabelCategories'
import { dismissPopoverFromOutsidePointer, isInsideFloatingPopover, isPopoverTriggerTarget } from '../../utils/ui/uiInteraction'
import { schedulePopoverInputFocus } from '../../utils/ui/schedulePopoverInputFocus'
import {
  resolvePopoverExposedInput,
  resolvePopoverExposedRoot,
} from '../../utils/ui/popoverComponentRef'
import {
  POPOVER_PANEL_BASE_WIDTH,
  POPOVER_VIEWPORT_INSET,
  buildAnchoredPopoverStyle,
  computeAnchoredPopoverBelowLayout,
  popoverPositionVisibilityStyle,
  refineAnchoredPopoverWithFloatingUi,
  schedulePopoverOpenLayout,
} from '../../utils/ui/popoverScrollbar'
import { useExclusivePopover } from '../ui/useExclusivePopover'
import { TASK_POPOVER_WEEKDAY_LABELS } from '../../utils/task/taskPopoverTypes'
import {
  type TaskFormCategory,
  type TaskFormDraft,
  type TaskFormLabel,
  type TaskFormMember,
  EFFORT_UNIT_LABEL,
  PROGRESS_RATE_UNIT_LABEL,
  effortValueToDraft,
  formatEffortAmount,
  formatEffortDisplay,
  formatPeriodDisplay,
  formatProgressRateDisplay,
  labelBarTextColor,
  memberEmailLine,
  normalizeEffortHours,
  normalizeProgressRate,
  parseEffortDraft,
  parseProgressRateDraft,
  progressRateValueToDraft,
  resolveStoredEffortValue,
  resolveStoredProgressRate,
  sanitizeEffortDraftInput,
  sanitizeProgressRateDraftInput,
  toDateInputValue,
  buildTaskCalendarCells,
  resolveTaskDateRangePick,
} from './useTaskFormHelpers'
import { sortMembersByDisplayName } from '../member/useMemberDisplay'
export type TaskFormPopoverType =
  | 'period'
  | 'effort'
  | 'progress-rate'
  | 'members'
  | 'member-detail'
  | 'labels'
  | 'category'
  | 'status'
type UseTaskFormPaneOptions = {
  draft: Ref<TaskFormDraft>
  orgLabels: Ref<TaskFormLabel[]>
  labelCategories?: Ref<LabelCategoryGroup[]>
  workspaceMembers: Ref<TaskFormMember[]>
  disabled: Ref<boolean>
  documentCategories?: Ref<TaskFormCategory[]>
  workspaceStatuses?: Ref<TaskFormCategory[]>
}
const POPOVER_ANCHOR_GAP = 6
const POPOVER_MIN_HEIGHT = 120

function resolveTaskFormPopoverBaseWidth (type: TaskFormPopoverType | null): number {
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
    case 'category':
      return POPOVER_PANEL_BASE_WIDTH.categoryPicker
    case 'status':
      return POPOVER_PANEL_BASE_WIDTH.status
    default:
      return POPOVER_PANEL_BASE_WIDTH.date
  }
}
export function useTaskFormPane (options: UseTaskFormPaneOptions) {
  const activePopover = ref<TaskFormPopoverType | null>(null)
  const selectedMember = ref<TaskFormMember | null>(null)
  const popoverError = ref<string | null>(null)
  const popoverStyle = ref<Record<string, string>>(popoverPositionVisibilityStyle(false))
  const popoverElRef = ref<{ rootRef: HTMLElement | null } | HTMLElement | null>(null)
  const actionButtonsRef = ref<HTMLElement | null>(null)
  const effortDetailAnchorRef = ref<HTMLElement | null>(null)
  const progressRateDetailAnchorRef = ref<HTMLElement | null>(null)
  const popoverAnchorEl = ref<HTMLElement | null>(null)
  const calendarCursor = ref(new Date())
  const pendingDate = ref<string | null>(null)
  const titleInputRef = ref<HTMLTextAreaElement | null>(null)
  const labelSearchQuery = ref('')
  const categorySearchQuery = ref('')
  const statusSearchQuery = ref('')
  const effortDraft = ref<string | number>('')
  const effortInputRef = ref<HTMLInputElement | null>(null)
  const progressRateDraft = ref<string | number>('')
  const progressRateInputRef = ref<HTMLInputElement | null>(null)
  let removePopoverResizeListener: (() => void) | null = null
  const weekdayLabels = [...TASK_POPOVER_WEEKDAY_LABELS]
  const filteredOrgLabels = computed(() => {
    const query = labelSearchQuery.value.trim().toLowerCase()
    if (!query) return options.orgLabels.value
    return options.orgLabels.value.filter(label => label.name.toLowerCase().includes(query))
  })
  const filteredLabelCategories = computed(() => {
    return filterLabelCategories(
      labelCategoriesFromFlat(options.labelCategories?.value, options.orgLabels.value),
      labelSearchQuery.value,
    )
  })
  const filteredDocumentCategories = computed(() => {
    const categories = options.documentCategories?.value ?? []
    const query = categorySearchQuery.value.trim().toLowerCase()
    if (!query) return categories
    return categories.filter(category => category.name.toLowerCase().includes(query))
  })
  const filteredWorkspaceStatuses = computed(() => {
    const statuses = options.workspaceStatuses?.value ?? []
    const query = statusSearchQuery.value.trim().toLowerCase()
    if (!query) return statuses
    return statuses.filter(status => status.name.toLowerCase().includes(query))
  })
  const showEffortDetailSection = computed(() => {
    if (activePopover.value === 'effort') {
      const parsed = parseEffortDraft(effortDraft.value)
      return parsed !== null && parsed !== 'invalid'
    }
    return resolveStoredEffortValue(options.draft.value) !== null
  })
  const effortDetailDisplayText = computed(() => {
    if (activePopover.value === 'effort') {
      const parsed = parseEffortDraft(effortDraft.value)
      if (parsed === null || parsed === 'invalid') return ''
      return `${formatEffortAmount(parsed)} ${EFFORT_UNIT_LABEL}`
    }
    return formatEffortDisplay(options.draft.value)
  })
  const showProgressRateDetailSection = computed(() => {
    if (activePopover.value === 'progress-rate') {
      const parsed = parseProgressRateDraft(progressRateDraft.value)
      return parsed !== null && parsed !== 'invalid'
    }
    return resolveStoredProgressRate(options.draft.value) !== null
  })
  const progressRateDetailDisplayText = computed(() => {
    if (activePopover.value === 'progress-rate') {
      const parsed = parseProgressRateDraft(progressRateDraft.value)
      if (parsed === null || parsed === 'invalid') return ''
      return `${parsed} ${PROGRESS_RATE_UNIT_LABEL}`
    }
    return formatProgressRateDisplay(options.draft.value)
  })
  const calendarMonthLabel = computed(() => {
    const y = calendarCursor.value.getFullYear()
    const m = calendarCursor.value.getMonth() + 1
    return `${y}年${m}月`
  })
  const calendarCells = computed(() => buildTaskCalendarCells(calendarCursor.value))
  function resolvePopoverElement (): HTMLElement | null {
    return resolvePopoverExposedRoot(popoverElRef.value)
  }
  function resolveEffortInputEl (): HTMLInputElement | null {
    const fromPopover = resolvePopoverExposedInput(popoverElRef.value)
    if (fromPopover instanceof HTMLInputElement) return fromPopover
    return effortInputRef.value
  }
  function resolveProgressRateInputEl (): HTMLInputElement | null {
    const fromPopover = resolvePopoverExposedInput(popoverElRef.value)
    if (fromPopover instanceof HTMLInputElement) return fromPopover
    return progressRateInputRef.value
  }
  function capturePopoverAnchor (event?: Event): HTMLElement | null {
    const fromEvent = event?.currentTarget
    if (fromEvent instanceof HTMLElement) return fromEvent
    return actionButtonsRef.value
  }
  function getEffortDisplayButton (): HTMLButtonElement | null {
    const section = effortDetailAnchorRef.value
    return section?.querySelector('.detail-value-btn') ?? null
  }
  function getProgressRateDisplayButton (): HTMLButtonElement | null {
    const section = progressRateDetailAnchorRef.value
    return section?.querySelector('.detail-value-btn') ?? null
  }
  function resolveEffortPopoverAnchor (event?: Event): HTMLElement | null {
    const clicked = event?.currentTarget
    const detailAnchor = effortDetailAnchorRef.value
    if (detailAnchor && clicked instanceof Node && detailAnchor.contains(clicked)) {
      return getEffortDisplayButton() ?? detailAnchor
    }
    return capturePopoverAnchor(event)
  }
  function resolveProgressRatePopoverAnchor (event?: Event): HTMLElement | null {
    const clicked = event?.currentTarget
    const detailAnchor = progressRateDetailAnchorRef.value
    if (detailAnchor && clicked instanceof Node && detailAnchor.contains(clicked)) {
      return getProgressRateDisplayButton() ?? detailAnchor
    }
    return capturePopoverAnchor(event)
  }
  async function positionPopover (visible = true) {
    const anchor = popoverAnchorEl.value
    const popover = resolvePopoverElement()
    if (!anchor || !popover) return
    let layout = computeAnchoredPopoverBelowLayout(
      anchor.getBoundingClientRect(),
      resolveTaskFormPopoverBaseWidth(activePopover.value),
      popover,
      {
        pad: POPOVER_VIEWPORT_INSET,
        gap: POPOVER_ANCHOR_GAP,
        minHeight: POPOVER_MIN_HEIGHT,
      },
    )
    if (visible) {
      layout = await refineAnchoredPopoverWithFloatingUi(anchor, popover, layout, {
        pad: POPOVER_VIEWPORT_INSET,
        gap: POPOVER_ANCHOR_GAP,
      })
    }
    popoverStyle.value = buildAnchoredPopoverStyle(layout, { zIndex: 210, visible })
  }
  function updatePopoverPosition () {
    const wasVisible = popoverStyle.value.visibility === 'visible'
    if (!wasVisible) {
      popoverStyle.value = popoverPositionVisibilityStyle(false)
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
  function onPopoverAfterEnter () {
    updatePopoverPosition()
    if (activePopover.value === 'effort') {
      schedulePopoverInputFocus(() => resolveEffortInputEl(), { select: 'all' })
      return
    }
    if (activePopover.value === 'progress-rate') {
      schedulePopoverInputFocus(() => resolveProgressRateInputEl(), { select: 'all' })
    }
  }
  function dismissPopover () {
    activePopover.value = null
    selectedMember.value = null
    popoverError.value = null
    pendingDate.value = null
    // popoverStyle は leave 完了後に消す（フェードアウトを維持）
  }
  let popoverLeaveResolve: (() => void) | null = null
  function resolvePopoverLeaveWait () {
    popoverLeaveResolve?.()
    popoverLeaveResolve = null
  }
  function notifyPopoverAfterLeave () {
    if (activePopover.value == null) {
      popoverStyle.value = popoverPositionVisibilityStyle(false)
    }
    resolvePopoverLeaveWait()
  }
  function armPopoverLeaveWait (): Promise<void> {
    return new Promise((resolve) => {
      const previous = popoverLeaveResolve
      popoverLeaveResolve = resolve
      previous?.()
    })
  }
  async function finalizeEffortPopover (opts?: { dismiss?: boolean }): Promise<boolean> {
    const shouldDismiss = opts?.dismiss ?? true
    const closing = activePopover.value
    if (closing !== 'effort') return true
    const parsed = parseEffortDraft(effortDraft.value)
    if (parsed === 'invalid') {
      popoverError.value = '工数は0以上の数値で入力してください'
      return false
    }
    popoverError.value = null
    if (parsed !== null) {
      const effortHours = normalizeEffortHours(parsed)
      options.draft.value = {
        ...options.draft.value,
        effort_hours: effortHours,
      }
    } else {
      options.draft.value = {
        ...options.draft.value,
        effort_hours: null,
      }
    }
    if (activePopover.value !== closing) return true
    if (shouldDismiss) dismissPopover()
    return true
  }
  async function finalizeProgressRatePopover (opts?: { dismiss?: boolean }): Promise<boolean> {
    const shouldDismiss = opts?.dismiss ?? true
    const closing = activePopover.value
    if (closing !== 'progress-rate') return true
    const parsed = parseProgressRateDraft(progressRateDraft.value)
    if (parsed === 'invalid') {
      popoverError.value = '進捗率は0〜100の整数で入力してください'
      return false
    }
    popoverError.value = null
    if (parsed !== null) {
      const progressRate = normalizeProgressRate(parsed)
      options.draft.value = {
        ...options.draft.value,
        progress_rate: progressRate,
      }
    } else {
      options.draft.value = {
        ...options.draft.value,
        progress_rate: null,
      }
    }
    if (activePopover.value !== closing) return true
    if (shouldDismiss) dismissPopover()
    return true
  }
  const canClearCalendarDate = computed(() => (
    !!(toDateInputValue(options.draft.value.start_date) || toDateInputValue(options.draft.value.due_date))
  ))
  const periodRangeStartIso = computed(() => toDateInputValue(options.draft.value.start_date) || null)
  const periodRangeEndIso = computed(() => toDateInputValue(options.draft.value.due_date) || null)
  const canClearEffort = computed(() => String(effortDraft.value ?? '').trim() !== '')
  const canClearProgressRate = computed(() => String(progressRateDraft.value ?? '').trim() !== '')
  const canClearAssignees = computed(() => options.draft.value.assignees.length > 0)
  const canClearLabels = computed(() => options.draft.value.labels.length > 0)
  const canClearStatus = computed(() => options.draft.value.status != null)
  const canClearCategory = computed(() => options.draft.value.category != null)
  async function closePopover () {
    if (activePopover.value == null) {
      return
    }
    const leaveDone = armPopoverLeaveWait()
    if (activePopover.value === 'effort') {
      await finalizeEffortPopover()
      if (activePopover.value != null) {
        resolvePopoverLeaveWait()
        return
      }
      await leaveDone
      return
    }
    if (activePopover.value === 'progress-rate') {
      await finalizeProgressRatePopover()
      if (activePopover.value != null) {
        resolvePopoverLeaveWait()
        return
      }
      await leaveDone
      return
    }
    dismissPopover()
    await leaveDone
  }
  async function commitActivePopover (): Promise<boolean> {
    const current = activePopover.value
    if (current === 'effort') {
      return finalizeEffortPopover({ dismiss: false })
    }
    if (current === 'progress-rate') {
      return finalizeProgressRatePopover({ dismiss: false })
    }
    return true
  }
  /**
   * 別ポップオーバーへ切り替える前に現在の入力を確定する。
   * 同種トグルなら閉じただけで false。不正入力で確定できなかった場合も false。
   * 切替時は leave を待たず、呼び出し側が種類を上書きする。
   */
  async function beginPopoverOpen (next: TaskFormPopoverType): Promise<boolean> {
    const current = activePopover.value
    if (current === next) {
      await closePopover()
      return false
    }
    if (current != null) {
      return commitActivePopover()
    }
    return true
  }
  useExclusivePopover(
    () => activePopover.value != null,
    () => { void closePopover() },
  )
  function shouldIgnorePopoverOutsideClose (target: Node): boolean {
    if (isPopoverTriggerTarget(target)) return true
    const anchor = popoverAnchorEl.value
    if (!anchor?.contains(target)) return false
    if (activePopover.value === 'effort') {
      const detailAnchor = effortDetailAnchorRef.value
      if (detailAnchor?.contains(target)) {
        const displayButton = getEffortDisplayButton()
        return !!displayButton && displayButton.contains(target)
      }
      return true
    }
    if (activePopover.value === 'progress-rate') {
      const detailAnchor = progressRateDetailAnchorRef.value
      if (detailAnchor?.contains(target)) {
        const displayButton = getProgressRateDisplayButton()
        return !!displayButton && displayButton.contains(target)
      }
      return true
    }
    return true
  }
  function handlePopoverOutsidePointerUp (event: MouseEvent) {
    if (!activePopover.value || event.button !== 0) return
    const target = event.target
    if (!(target instanceof Node)) return
    if (isInsideFloatingPopover(target)) return
    if (resolvePopoverElement()?.contains(target)) return
    if (shouldIgnorePopoverOutsideClose(target)) return
    dismissPopoverFromOutsidePointer(target, closePopover)
  }
  function onPopoverEscape (event: KeyboardEvent) {
    if (event.key !== 'Escape' || !activePopover.value) return
    event.preventDefault()
    event.stopPropagation()
    void closePopover()
  }
  function bindPopoverListeners () {
    document.addEventListener('keydown', onPopoverEscape)
    document.addEventListener('mouseup', handlePopoverOutsidePointerUp, true)
    const onResize = () => updatePopoverPosition()
    window.addEventListener('resize', onResize)
    removePopoverResizeListener = () => window.removeEventListener('resize', onResize)
  }
  function unbindPopoverListeners () {
    document.removeEventListener('keydown', onPopoverEscape)
    document.removeEventListener('mouseup', handlePopoverOutsidePointerUp, true)
    removePopoverResizeListener?.()
    removePopoverResizeListener = null
  }
  watch(activePopover, (next, prev) => {
    if (next && !prev) bindPopoverListeners()
    if (!next && prev) unbindPopoverListeners()
  })
  onBeforeUnmount(() => {
    unbindPopoverListeners()
  })
  watch(labelSearchQuery, () => {
    if (activePopover.value === 'labels') updatePopoverPosition()
  })
  watch(categorySearchQuery, () => {
    if (activePopover.value === 'category') updatePopoverPosition()
  })
  watch(statusSearchQuery, () => {
    if (activePopover.value === 'status') updatePopoverPosition()
  })
  function openDatePicker (event?: Event) {
    void (async () => {
      // await 後は event.currentTarget が null になるため、先にアンカーを保持する
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('period'))) return
      popoverAnchorEl.value = anchor
      activePopover.value = 'period'
      popoverError.value = null
      const startIso = toDateInputValue(options.draft.value.start_date) || null
      const dueIso = toDateInputValue(options.draft.value.due_date) || null
      pendingDate.value = startIso || dueIso
      const baseIso = startIso || dueIso
      const base = baseIso
        ? new Date(`${baseIso}T12:00:00`)
        : new Date()
      calendarCursor.value = new Date(base.getFullYear(), base.getMonth(), 1)
      updatePopoverPosition()
    })()
  }
  function shiftCalendarMonth (delta: number) {
    const next = new Date(calendarCursor.value)
    next.setMonth(next.getMonth() + delta, 1)
    calendarCursor.value = next
    popoverError.value = null
  }
  function pickCalendarDay (iso: string) {
    if (activePopover.value !== 'period') return
    const nextRange = resolveTaskDateRangePick(
      iso,
      options.draft.value.start_date,
      options.draft.value.due_date,
    )
    if (!nextRange) {
      popoverError.value = null
      return
    }
    applyPeriodRange(nextRange)
  }
  function pickCalendarRange (range: { start_date: string; due_date: string }) {
    if (activePopover.value !== 'period') return
    applyPeriodRange(range)
  }
  function applyPeriodRange (nextRange: { start_date: string; due_date: string }) {
    pendingDate.value = nextRange.start_date
    popoverError.value = null
    options.draft.value = {
      ...options.draft.value,
      start_date: nextRange.start_date,
      due_date: nextRange.due_date,
    }
  }
  function clearCalendarDate () {
    if (activePopover.value !== 'period') return
    pendingDate.value = null
    popoverError.value = null
    options.draft.value = {
      ...options.draft.value,
      start_date: null,
      due_date: null,
    }
  }
  function clearEffortDraft () {
    if (options.disabled?.value) return
    effortDraft.value = ''
    popoverError.value = null
    const inputEl = resolveEffortInputEl()
    if (inputEl) {
      inputEl.value = ''
    }
    options.draft.value = {
      ...options.draft.value,
      effort_hours: null,
    }
  }
  function clearProgressRateDraft () {
    if (options.disabled?.value) return
    progressRateDraft.value = ''
    popoverError.value = null
    const inputEl = resolveProgressRateInputEl()
    if (inputEl) {
      inputEl.value = ''
    }
    options.draft.value = {
      ...options.draft.value,
      progress_rate: null,
    }
  }
  function clearAssignees () {
    if (options.disabled?.value) return
    if (!options.draft.value.assignees.length) return
    options.draft.value = {
      ...options.draft.value,
      assignees: [],
    }
    popoverError.value = null
  }
  function clearLabels () {
    if (options.disabled?.value) return
    if (!options.draft.value.labels.length) return
    options.draft.value = {
      ...options.draft.value,
      labels: [],
    }
    popoverError.value = null
  }
  function clearStatus () {
    if (options.disabled?.value) return
    if (!options.draft.value.status) return
    options.draft.value = {
      ...options.draft.value,
      status: null,
    }
    popoverError.value = null
  }
  function clearCategory () {
    if (options.disabled?.value) return
    if (!options.draft.value.category) return
    options.draft.value = {
      ...options.draft.value,
      category: null,
    }
    popoverError.value = null
  }
  function openEffortPicker (event?: Event) {
    void (async () => {
      if (options.disabled.value) return
      // await 後は event.currentTarget が null になるため、先にアンカーを保持する
      const anchor = resolveEffortPopoverAnchor(event)
      if (!(await beginPopoverOpen('effort'))) return
      popoverAnchorEl.value = anchor
      activePopover.value = 'effort'
      popoverError.value = null
      effortDraft.value = effortValueToDraft(options.draft.value)
      updatePopoverPosition()
      schedulePopoverInputFocus(() => resolveEffortInputEl(), { select: 'all' })
    })()
  }
  function updateEffortDraft (raw: string | number) {
    const sanitized = sanitizeEffortDraftInput(String(raw ?? ''))
    effortDraft.value = sanitized
    const inputEl = resolveEffortInputEl()
    if (inputEl && inputEl.value !== sanitized) {
      inputEl.value = sanitized
    }
  }
  function openProgressRatePicker (event?: Event) {
    void (async () => {
      if (options.disabled.value) return
      // await 後は event.currentTarget が null になるため、先にアンカーを保持する
      const anchor = resolveProgressRatePopoverAnchor(event)
      if (!(await beginPopoverOpen('progress-rate'))) return
      popoverAnchorEl.value = anchor
      activePopover.value = 'progress-rate'
      popoverError.value = null
      progressRateDraft.value = progressRateValueToDraft(options.draft.value)
      updatePopoverPosition()
      schedulePopoverInputFocus(() => resolveProgressRateInputEl(), { select: 'all' })
    })()
  }
  function updateProgressRateDraft (raw: string | number) {
    const sanitized = sanitizeProgressRateDraftInput(String(raw ?? ''))
    progressRateDraft.value = sanitized
    const inputEl = resolveProgressRateInputEl()
    if (inputEl && inputEl.value !== sanitized) {
      inputEl.value = sanitized
    }
  }
  function openMemberPicker (event?: Event) {
    void (async () => {
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('members'))) return
      selectedMember.value = null
      popoverAnchorEl.value = anchor
      activePopover.value = 'members'
      popoverError.value = null
      updatePopoverPosition()
    })()
  }
  function openMemberDetail (member: TaskFormMember, event: Event) {
    void (async () => {
      // await 後は event.currentTarget が null になるため、先にアンカーを保持する
      const anchor = event.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : capturePopoverAnchor(event)
      if (!anchor) return
      if (activePopover.value === 'member-detail' && selectedMember.value?.id === member.id) {
        await closePopover()
        return
      }
      if (activePopover.value != null && activePopover.value !== 'member-detail') {
        if (!(await beginPopoverOpen('member-detail'))) return
      }
      selectedMember.value = member
      popoverAnchorEl.value = anchor
      activePopover.value = 'member-detail'
      popoverError.value = null
      updatePopoverPosition()
    })()
  }
  function openLabelPicker (event?: Event) {
    void (async () => {
      // await 後は event.currentTarget が null になるため、先にアンカーを保持する
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('labels'))) return
      labelSearchQuery.value = ''
      popoverAnchorEl.value = anchor
      activePopover.value = 'labels'
      popoverError.value = null
      updatePopoverPosition()
    })()
  }
  function openCategoryPicker (event?: Event) {
    void (async () => {
      // await 後は event.currentTarget が null になるため、先にアンカーを保持する
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('category'))) return
      categorySearchQuery.value = ''
      popoverAnchorEl.value = anchor
      activePopover.value = 'category'
      popoverError.value = null
      updatePopoverPosition()
    })()
  }
  function openStatusPicker (event?: Event) {
    void (async () => {
      // await 後は event.currentTarget が null になるため、先にアンカーを保持する
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('status'))) return
      statusSearchQuery.value = ''
      popoverAnchorEl.value = anchor
      activePopover.value = 'status'
      popoverError.value = null
      updatePopoverPosition()
    })()
  }
  function isMemberAssigned (memberId: number): boolean {
    return options.draft.value.assignees.some(member => member.id === memberId)
  }
  function isLabelSelected (labelId: number): boolean {
    return options.draft.value.labels.some(label => label.id === labelId)
  }
  function isCategorySelected (categoryName: string): boolean {
    return options.draft.value.category?.name === categoryName
  }
  function isStatusSelected (statusName: string): boolean {
    return options.draft.value.status?.name === statusName
  }
  function toggleMember (member: TaskFormMember) {
    if (options.disabled?.value) return
    const current = options.draft.value.assignees
    const exists = current.some(item => item.id === member.id)
    options.draft.value = {
      ...options.draft.value,
      assignees: sortMembersByDisplayName(
        exists
          ? current.filter(item => item.id !== member.id)
          : [...current, member],
      ),
    }
    popoverError.value = null
  }
  function removeMember (member: TaskFormMember) {
    options.draft.value = {
      ...options.draft.value,
      assignees: options.draft.value.assignees.filter(item => item.id !== member.id),
    }
    dismissPopover()
  }
  function toggleLabel (label: TaskFormLabel) {
    if (options.disabled?.value) return
    const current = options.draft.value.labels
    const exists = current.some(item => item.id === label.id)
    options.draft.value = {
      ...options.draft.value,
      labels: sortLabelsByCatalogOrder(
        exists
          ? current.filter(item => item.id !== label.id)
          : [...current, label],
        options.orgLabels.value,
      ),
    }
    popoverError.value = null
  }
  function selectCategory (category: TaskFormCategory) {
    if (options.disabled?.value) return
    options.draft.value = {
      ...options.draft.value,
      category: isCategorySelected(category.name) ? null : category,
    }
    popoverError.value = null
  }
  function selectStatus (status: TaskFormCategory) {
    if (options.disabled?.value) return
    options.draft.value = {
      ...options.draft.value,
      status: isStatusSelected(status.name) ? null : status,
    }
    popoverError.value = null
  }
  function resetPaneState () {
    dismissPopover()
    labelSearchQuery.value = ''
    categorySearchQuery.value = ''
    statusSearchQuery.value = ''
    effortDraft.value = ''
    progressRateDraft.value = ''
  }
  function focusTitleInput () {
    if (!import.meta.client) {
      return
    }
    nextTick(() => {
      requestAnimationFrame(() => {
        titleInputRef.value?.focus()
      })
    })
  }
  return {
    activePopover,
    selectedMember,
    popoverError,
    popoverStyle,
    popoverElRef,
    actionButtonsRef,
    effortDetailAnchorRef,
    progressRateDetailAnchorRef,
    titleInputRef,
    labelSearchQuery,
    categorySearchQuery,
    statusSearchQuery,
    effortDraft,
    effortInputRef,
    progressRateDraft,
    progressRateInputRef,
    weekdayLabels,
    filteredOrgLabels,
    filteredLabelCategories,
    filteredDocumentCategories,
    filteredWorkspaceStatuses,
    showEffortDetailSection,
    effortDetailDisplayText,
    showProgressRateDetailSection,
    progressRateDetailDisplayText,
    calendarMonthLabel,
    calendarCells,
    formatPeriodDisplay,
    labelBarTextColor,
    memberEmailLine,
    canClearCalendarDate,
    periodRangeStartIso,
    periodRangeEndIso,
    canClearEffort,
    canClearProgressRate,
    canClearAssignees,
    canClearLabels,
    canClearStatus,
    canClearCategory,
    openDatePicker,
    shiftCalendarMonth,
    pickCalendarDay,
    pickCalendarRange,
    clearCalendarDate,
    clearEffortDraft,
    clearProgressRateDraft,
    clearAssignees,
    clearLabels,
    clearStatus,
    clearCategory,
    openEffortPicker,
    updateEffortDraft,
    finalizeEffortPopover,
    openProgressRatePicker,
    updateProgressRateDraft,
    finalizeProgressRatePopover,
    closePopover,
    notifyPopoverAfterLeave,
    openMemberPicker,
    openMemberDetail,
    openLabelPicker,
    openCategoryPicker,
    openStatusPicker,
    isMemberAssigned,
    isLabelSelected,
    isCategorySelected,
    isStatusSelected,
    toggleMember,
    removeMember,
    toggleLabel,
    selectCategory,
    selectStatus,
    resetPaneState,
    focusTitleInput,
    updatePopoverPosition,
    onPopoverAfterEnter,
  }
}
