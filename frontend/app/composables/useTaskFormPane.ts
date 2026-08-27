import type { Ref } from 'vue'
import type { LabelCategoryGroup } from './useLabelCategories'
import { filterLabelCategories, labelCategoriesFromFlat } from './useLabelCategories'
import { dismissPopoverFromOutsidePointer } from '../utils/uiInteraction'
import { popoverMaxHeightStyle, popoverScrollbarGutterStyle, popoverWidthExtraForGutter, resolvePopoverScrollbarGutter } from '../utils/popoverScrollbar'
import { useExclusivePopover } from './useExclusivePopover'
import {
  type TaskFormCategory,
  type TaskFormDraft,
  type TaskFormLabel,
  type TaskFormMember,
  EFFORT_UNIT_LABEL,
  effortValueToDraft,
  formatDateDisplay,
  formatEffortAmount,
  formatEffortDisplay,
  labelBarTextColor,
  memberEmailLine,
  normalizeEffortHours,
  parseEffortDraft,
  resolveStoredEffortValue,
  sanitizeEffortDraftInput,
  toDateInputValue,
} from './useTaskFormHelpers'
import { sortMembersByDisplayName } from './useMemberDisplay'
export type TaskFormPopoverType =
  | 'start-date'
  | 'due-date'
  | 'effort'
  | 'members'
  | 'member-detail'
  | 'labels'
  | 'category'
  | 'status'
type CalendarCell = {
  key: string
  iso: string
  day: number
  inMonth: boolean
  isToday: boolean
}
type UseTaskFormPaneOptions = {
  draft: Ref<TaskFormDraft>
  orgLabels: Ref<TaskFormLabel[]>
  labelCategories?: Ref<LabelCategoryGroup[]>
  workspaceMembers: Ref<TaskFormMember[]>
  disabled: Ref<boolean>
  documentCategories?: Ref<TaskFormCategory[]>
  workspaceStatuses?: Ref<TaskFormCategory[]>
}
const POPOVER_VIEWPORT_PAD = 12
const POPOVER_ANCHOR_GAP = 6
const POPOVER_MIN_HEIGHT = 120
const POPOVER_DEFAULT_WIDTH_PX = 312
export function useTaskFormPane (options: UseTaskFormPaneOptions) {
  const activePopover = ref<TaskFormPopoverType | null>(null)
  const selectedMember = ref<TaskFormMember | null>(null)
  const popoverError = ref<string | null>(null)
  const popoverStyle = ref<Record<string, string>>({})
  const popoverElRef = ref<{ rootRef: HTMLElement | null } | HTMLElement | null>(null)
  const actionButtonsRef = ref<HTMLElement | null>(null)
  const effortDetailAnchorRef = ref<HTMLElement | null>(null)
  const popoverAnchorEl = ref<HTMLElement | null>(null)
  const calendarCursor = ref(new Date())
  const pendingDate = ref<string | null>(null)
  const titleInputRef = ref<HTMLTextAreaElement | null>(null)
  const labelSearchQuery = ref('')
  const categorySearchQuery = ref('')
  const statusSearchQuery = ref('')
  const effortDraft = ref<string | number>('')
  const effortInputRef = ref<HTMLInputElement | null>(null)
  let removePopoverResizeListener: (() => void) | null = null
  const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土']
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
  const calendarMonthLabel = computed(() => {
    const y = calendarCursor.value.getFullYear()
    const m = calendarCursor.value.getMonth() + 1
    return `${y}年${m}月`
  })
  const calendarCells = computed((): CalendarCell[] => {
    const year = calendarCursor.value.getFullYear()
    const month = calendarCursor.value.getMonth()
    const first = new Date(year, month, 1)
    const startOffset = first.getDay()
    const todayIso = toDateInputValue(new Date())
    const cells: CalendarCell[] = []
    const gridStart = new Date(year, month, 1 - startOffset)
    for (let i = 0; i < 42; i++) {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
      const iso = toDateInputValue(date)
      cells.push({
        key: `${iso}-${i}`,
        iso,
        day: date.getDate(),
        inMonth: date.getMonth() === month,
        isToday: iso === todayIso,
      })
    }
    return cells
  })
  function resolvePopoverElement (): HTMLElement | null {
    const target = popoverElRef.value
    if (!target) return null
    if (target instanceof HTMLElement) return target
    return target.rootRef
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
  function resolveEffortPopoverAnchor (event?: Event): HTMLElement | null {
    const clicked = event?.currentTarget
    const detailAnchor = effortDetailAnchorRef.value
    if (detailAnchor && clicked instanceof Node && detailAnchor.contains(clicked)) {
      return getEffortDisplayButton() ?? detailAnchor
    }
    return capturePopoverAnchor(event)
  }
  function positionPopover () {
    const anchor = popoverAnchorEl.value
    const popover = resolvePopoverElement()
    if (!anchor || !popover) return
    const pad = POPOVER_VIEWPORT_PAD
    const gap = POPOVER_ANCHOR_GAP
    const anchorRect = anchor.getBoundingClientRect()
    const spaceBelow = window.innerHeight - anchorRect.bottom - pad
    const spaceAbove = anchorRect.top - pad
    let top: number
    let maxHeight: number
    if (spaceBelow >= POPOVER_MIN_HEIGHT) {
      top = anchorRect.bottom + gap
      maxHeight = Math.max(POPOVER_MIN_HEIGHT, Math.floor(spaceBelow - gap))
    } else {
      maxHeight = Math.max(POPOVER_MIN_HEIGHT, Math.floor(spaceAbove - gap))
      top = Math.max(pad, anchorRect.top - gap - maxHeight)
    }
    const scrollbarGutter = resolvePopoverScrollbarGutter(popover, maxHeight)
    const measuredWidth = popover.offsetWidth || popover.getBoundingClientRect().width
    const popoverWidth = (measuredWidth > 0 ? measuredWidth : POPOVER_DEFAULT_WIDTH_PX) + popoverWidthExtraForGutter(scrollbarGutter)
    let left = anchorRect.left
    if (left + popoverWidth > window.innerWidth - pad) {
      left = anchorRect.right - popoverWidth
    }
    popoverStyle.value = {
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      zIndex: '210',
      ...popoverMaxHeightStyle(maxHeight, scrollbarGutter),
      ...popoverScrollbarGutterStyle(scrollbarGutter),
    }
  }
  function updatePopoverPosition () {
    nextTick(() => {
      requestAnimationFrame(() => {
        positionPopover()
        if (!popoverElRef.value) {
          requestAnimationFrame(() => positionPopover())
        }
      })
    })
  }
  function dismissPopover () {
    activePopover.value = null
    selectedMember.value = null
    popoverError.value = null
    pendingDate.value = null
    popoverStyle.value = {}
  }
  async function finalizeEffortPopover () {
    if (activePopover.value !== 'effort') return
    const parsed = parseEffortDraft(effortDraft.value)
    if (parsed === 'invalid') {
      popoverError.value = '工数は0以上の数値で入力してください'
      return
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
    dismissPopover()
  }
  function clearEffort () {
    if (activePopover.value !== 'effort') return
    effortDraft.value = ''
    options.draft.value = {
      ...options.draft.value,
      effort_hours: null,
    }
    dismissPopover()
  }
  const canClearCalendarDate = computed(() => !!pendingDate.value)
  const canClearEffort = computed(() => {
    if (String(effortDraft.value ?? '').trim() !== '') {
      return true
    }
    return resolveStoredEffortValue(options.draft.value) !== null
  })
  async function closePopover () {
    if (activePopover.value === 'effort') {
      await finalizeEffortPopover()
      return
    }
    dismissPopover()
  }
  useExclusivePopover(
    () => activePopover.value != null,
    () => { void closePopover() },
  )
  function shouldIgnorePopoverOutsideClose (target: Node): boolean {
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
    return true
  }
  function handlePopoverOutsidePointerUp (event: MouseEvent) {
    if (!activePopover.value || event.button !== 0) return
    const target = event.target
    if (!(target instanceof Node)) return
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
  function openDatePicker (target: 'start' | 'due', event?: Event) {
    const next: TaskFormPopoverType = target === 'start' ? 'start-date' : 'due-date'
    if (activePopover.value === next) {
      void closePopover()
      return
    }
    popoverAnchorEl.value = capturePopoverAnchor(event)
    activePopover.value = next
    popoverError.value = null
    const existing = target === 'start'
      ? options.draft.value.start_date
      : options.draft.value.due_date
    pendingDate.value = toDateInputValue(existing) || null
    const base = pendingDate.value
      ? new Date(`${pendingDate.value}T12:00:00`)
      : new Date()
    calendarCursor.value = new Date(base.getFullYear(), base.getMonth(), 1)
    updatePopoverPosition()
  }
  function shiftCalendarMonth (delta: number) {
    const next = new Date(calendarCursor.value)
    next.setMonth(next.getMonth() + delta, 1)
    calendarCursor.value = next
  }
  function pickCalendarDay (iso: string) {
    if (!activePopover.value) return
    const field = activePopover.value === 'start-date' ? 'start_date' : 'due_date'
    pendingDate.value = iso
    options.draft.value = { ...options.draft.value, [field]: iso }
  }
  function clearCalendarDate () {
    if (!activePopover.value) return
    if (activePopover.value !== 'start-date' && activePopover.value !== 'due-date') {
      return
    }
    const field = activePopover.value === 'start-date' ? 'start_date' : 'due_date'
    pendingDate.value = null
    options.draft.value = { ...options.draft.value, [field]: null }
  }
  function openEffortPicker (event?: Event) {
    if (options.disabled.value) return
    if (activePopover.value === 'effort') {
      void closePopover()
      return
    }
    popoverAnchorEl.value = resolveEffortPopoverAnchor(event)
    activePopover.value = 'effort'
    popoverError.value = null
    effortDraft.value = effortValueToDraft(options.draft.value)
    updatePopoverPosition()
    nextTick(() => {
      effortInputRef.value?.focus()
      effortInputRef.value?.select()
    })
  }
  function updateEffortDraft (raw: string | number) {
    const sanitized = sanitizeEffortDraftInput(String(raw ?? ''))
    effortDraft.value = sanitized
    const inputEl = effortInputRef.value
    if (inputEl && inputEl.value !== sanitized) {
      inputEl.value = sanitized
    }
  }
  function openMemberPicker (event?: Event) {
    if (activePopover.value === 'members') {
      void closePopover()
      return
    }
    selectedMember.value = null
    popoverAnchorEl.value = capturePopoverAnchor(event)
    activePopover.value = 'members'
    popoverError.value = null
    updatePopoverPosition()
  }
  function openMemberDetail (member: TaskFormMember, event: Event) {
    if (activePopover.value === 'member-detail' && selectedMember.value?.id === member.id) {
      void closePopover()
      return
    }
    selectedMember.value = member
    popoverAnchorEl.value = event.currentTarget as HTMLElement
    activePopover.value = 'member-detail'
    popoverError.value = null
    updatePopoverPosition()
  }
  function openLabelPicker (event?: Event) {
    if (activePopover.value === 'labels') {
      void closePopover()
      return
    }
    labelSearchQuery.value = ''
    popoverAnchorEl.value = capturePopoverAnchor(event)
    activePopover.value = 'labels'
    popoverError.value = null
    updatePopoverPosition()
  }
  function openCategoryPicker (event?: Event) {
    if (activePopover.value === 'category') {
      void closePopover()
      return
    }
    categorySearchQuery.value = ''
    popoverAnchorEl.value = capturePopoverAnchor(event)
    activePopover.value = 'category'
    popoverError.value = null
    updatePopoverPosition()
  }
  function openStatusPicker (event?: Event) {
    if (activePopover.value === 'status') {
      void closePopover()
      return
    }
    statusSearchQuery.value = ''
    popoverAnchorEl.value = capturePopoverAnchor(event)
    activePopover.value = 'status'
    popoverError.value = null
    updatePopoverPosition()
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
      labels: exists
        ? current.filter(item => item.id !== label.id)
        : [...current, label],
    }
    popoverError.value = null
  }
  function selectCategory (category: TaskFormCategory) {
    if (options.disabled?.value) return
    options.draft.value = {
      ...options.draft.value,
      category,
    }
    popoverError.value = null
  }
  function selectStatus (status: TaskFormCategory) {
    if (options.disabled?.value) return
    options.draft.value = {
      ...options.draft.value,
      status,
    }
    popoverError.value = null
  }
  function resetPaneState () {
    dismissPopover()
    labelSearchQuery.value = ''
    categorySearchQuery.value = ''
    statusSearchQuery.value = ''
    effortDraft.value = ''
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
    titleInputRef,
    labelSearchQuery,
    categorySearchQuery,
    statusSearchQuery,
    effortDraft,
    effortInputRef,
    weekdayLabels,
    filteredOrgLabels,
    filteredLabelCategories,
    filteredDocumentCategories,
    filteredWorkspaceStatuses,
    showEffortDetailSection,
    effortDetailDisplayText,
    calendarMonthLabel,
    calendarCells,
    formatDateDisplay,
    labelBarTextColor,
    memberEmailLine,
    canClearCalendarDate,
    canClearEffort,
    openDatePicker,
    shiftCalendarMonth,
    pickCalendarDay,
    clearCalendarDate,
    openEffortPicker,
    updateEffortDraft,
    finalizeEffortPopover,
    clearEffort,
    closePopover,
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
  }
}
