import type { Ref } from 'vue'
import { dismissPopoverFromOutsidePointer } from '../utils/uiInteraction'
import { useApi } from './useApi'
import {
  type TaskFormDraft,
  type TaskFormEffortUnit,
  type TaskFormLabel,
  type TaskFormMember,
  effortUnitLabel,
  effortValueToDraft,
  labelBarTextColor,
  memberEmailLine,
  normalizeEffortValue,
  parseEffortDraft,
  resolveEffortUnit,
  resolveStoredEffortValue,
  sanitizeEffortDraftInput,
  toDateInputValue,
  unitValueToHours,
} from './useTaskFormHelpers'
import { useOrgEffortSettings } from './useOrgEffortSettings'

export type ProjectListOption = { id: number; name: string; color: string; sort_order?: number }

export type TaskPopoverEditable = {
  id: number
  title: string
  description?: string | null
  list_id?: number | null
  list_name?: string | null
  sort_order?: number
  start_date?: string | null
  due_date?: string | null
  effort_value?: number | string | null
  effort_hours?: number | string | null
  effort_unit?: string | null
  assignees?: TaskFormMember[]
  labels?: TaskFormLabel[]
}

export type PopoverType =
  | 'start-date'
  | 'due-date'
  | 'effort'
  | 'members'
  | 'member-detail'
  | 'labels'
  | 'description'
  | 'list'

type CalendarCell = {
  key: string
  iso: string
  day: number
  inMonth: boolean
  isToday: boolean
}

type TaskPatchResponse = {
  id: number
  title: string
  description: string | null
  list_id?: number | null
  sort_order?: number
  start_date: string | null
  due_date: string | null
  effort_hours: number | string | null
  effort_value?: number | string | null
  effort_unit?: string | null
  assignees: TaskFormMember[]
  labels: TaskFormLabel[]
}

type UseTaskPopoverEditorOptions = {
  orgSlug: string
  projectId: string
  orgLabels: Ref<TaskFormLabel[]>
  projectMembers: Ref<TaskFormMember[]>
  projectLists: Ref<ProjectListOption[]>
  task: Ref<TaskPopoverEditable | null>
  onUpdated: (task: TaskPopoverEditable) => void
  disabled?: Ref<boolean>
  zIndex?: number
}

const POPOVER_VIEWPORT_PAD = 12
const POPOVER_ANCHOR_GAP = 6
const POPOVER_MIN_HEIGHT = 120
const POPOVER_DEFAULT_WIDTH_PX = 312

function effortSource (
  task: TaskPopoverEditable,
  orgEffortUnit: TaskFormEffortUnit,
): Pick<TaskFormDraft, 'effort_value' | 'effort_hours' | 'effort_unit'> {
  const effortValue = task.effort_value ?? null
  return {
    effort_value: effortValue,
    effort_hours: task.effort_hours ?? null,
    effort_unit: effortValue === null ? null : resolveEffortUnit(task.effort_unit, orgEffortUnit),
  }
}

function resolveListName (
  listId: number | null | undefined,
  lists: ProjectListOption[],
): string | null {
  if (listId == null) return null
  return lists.find(list => list.id === listId)?.name ?? null
}

export function resolveListColor (
  listId: number | null | undefined,
  lists: ProjectListOption[],
): string | null {
  if (listId == null) return null
  return lists.find(list => list.id === listId)?.color ?? null
}

function patchToEditable (
  patch: TaskPatchResponse,
  previous: TaskPopoverEditable,
  lists: ProjectListOption[],
): TaskPopoverEditable {
  const listId = patch.list_id !== undefined ? patch.list_id : previous.list_id
  return {
    ...previous,
    id: patch.id,
    title: patch.title,
    description: patch.description,
    list_id: listId,
    list_name: resolveListName(listId, lists) ?? previous.list_name ?? null,
    sort_order: patch.sort_order !== undefined ? patch.sort_order : previous.sort_order,
    start_date: patch.start_date,
    due_date: patch.due_date,
    effort_value: patch.effort_value ?? null,
    effort_hours: patch.effort_hours,
    effort_unit: patch.effort_unit ?? null,
    assignees: patch.assignees,
    labels: patch.labels,
  }
}

export function useTaskPopoverEditor (options: UseTaskPopoverEditorOptions) {
  const { api } = useApi()
  const { getOrgEffortUnit, ensureOrgEffortSettings } = useOrgEffortSettings()
  const popoverZIndex = options.zIndex ?? 80
  const orgEffortUnit = computed(() => getOrgEffortUnit(options.orgSlug))

  const activePopover = ref<PopoverType | null>(null)
  const selectedMember = ref<TaskFormMember | null>(null)
  const popoverError = ref<string | null>(null)
  const popoverStyle = ref<Record<string, string>>({})
  const popoverElRef = ref<{ rootRef: HTMLElement | null } | HTMLElement | null>(null)
  const popoverAnchorEl = ref<HTMLElement | null>(null)
  const calendarCursor = ref(new Date())
  const pendingDate = ref<string | null>(null)
  const labelSearchQuery = ref('')
  const effortDraft = ref<string | number>('')
  const effortInputRef = ref<HTMLInputElement | null>(null)
  const descriptionDraft = ref('')

  const dateSaving = ref(false)
  const effortSaving = ref(false)
  const descriptionSaving = ref(false)
  const listSaving = ref(false)
  const pickerMutationPending = ref(false)

  let removePopoverResizeListener: (() => void) | null = null

  const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土']

  const filteredOrgLabels = computed(() => {
    const query = labelSearchQuery.value.trim().toLowerCase()
    if (!query) return options.orgLabels.value
    return options.orgLabels.value.filter(label => label.name.toLowerCase().includes(query))
  })

  const activeCalendarDate = computed(() => {
    const task = options.task.value
    if (!task) return null
    if (activePopover.value === 'start-date') {
      return toDateInputValue(task.start_date) || null
    }
    if (activePopover.value === 'due-date') {
      return toDateInputValue(task.due_date) || null
    }
    return null
  })

  const canClearCalendarDate = computed(() => !!pendingDate.value)

  const canClearEffort = computed(() => {
    if (String(effortDraft.value ?? '').trim() !== '') {
      return true
    }
    const task = options.task.value
    if (!task) {
      return false
    }
    return resolveStoredEffortValue(effortSource(task, orgEffortUnit.value)) !== null
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

  function taskEndpoint (): string | null {
    const task = options.task.value
    if (!task) return null
    return `/orgs/${options.orgSlug}/projects/${options.projectId}/tasks/${task.id}`
  }

  function resolvePopoverElement (): HTMLElement | null {
    const target = popoverElRef.value
    if (!target) return null
    if (target instanceof HTMLElement) return target
    return target.rootRef
  }

  function capturePopoverAnchor (event?: Event): HTMLElement | null {
    const fromEvent = event?.currentTarget
    if (fromEvent instanceof HTMLElement) return fromEvent
    return null
  }

  function positionPopover () {
    const anchor = popoverAnchorEl.value
    const popover = resolvePopoverElement()
    if (!anchor || !popover) return

    const pad = POPOVER_VIEWPORT_PAD
    const gap = POPOVER_ANCHOR_GAP
    const anchorRect = anchor.getBoundingClientRect()
    const measuredWidth = popover.offsetWidth || popover.getBoundingClientRect().width
    const popoverWidth = measuredWidth > 0 ? measuredWidth : POPOVER_DEFAULT_WIDTH_PX

    let left = anchorRect.left
    if (left + popoverWidth > window.innerWidth - pad) {
      left = anchorRect.right - popoverWidth
    }

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

    popoverStyle.value = {
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      maxHeight: `${maxHeight}px`,
      zIndex: String(popoverZIndex),
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

  function patchLocalTask (patch: Partial<TaskPopoverEditable>) {
    const task = options.task.value
    if (!task) return
    const merged = { ...task, ...patch }
    options.task.value = merged
    options.onUpdated(merged)
  }

  function previewDescriptionInWbs () {
    if (activePopover.value !== 'description') return
    const task = options.task.value
    if (!task) return
    const description = descriptionDraft.value
    options.onUpdated({
      ...task,
      description: description.trim() === '' ? null : description,
    })
  }

  function previewEffortInWbs () {
    if (activePopover.value !== 'effort') return
    const task = options.task.value
    if (!task) return
    const parsed = parseEffortDraft(effortDraft.value)
    if (parsed === 'invalid') return
    const unit = orgEffortUnit.value
    const effortValue = parsed === null ? null : normalizeEffortValue(parsed)
    options.onUpdated({
      ...task,
      effort_value: effortValue,
      effort_hours: effortValue === null ? null : unitValueToHours(effortValue, unit),
      effort_unit: effortValue === null ? null : unit,
    })
  }

  async function applyPatchResponse (updated: TaskPatchResponse) {
    const task = options.task.value
    if (!task || updated.id !== task.id) return
    const merged = patchToEditable(updated, task, options.projectLists.value)
    options.task.value = merged
    options.onUpdated(merged)
  }

  async function saveEffort () {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || effortSaving.value) return

    const parsed = parseEffortDraft(effortDraft.value)
    if (parsed === 'invalid') {
      popoverError.value = '工数は0以上の数値で入力してください'
      effortDraft.value = effortValueToDraft(effortSource(task, orgEffortUnit.value))
      return
    }

    const unit = orgEffortUnit.value
    const effortValue = parsed === null ? null : normalizeEffortValue(parsed)
    const effortUnit = effortValue === null ? null : unit
    const currentValue = resolveStoredEffortValue(effortSource(task, orgEffortUnit.value))
    const currentUnit = currentValue === null ? null : resolveEffortUnit(task.effort_unit, orgEffortUnit.value)

    if (effortValue === currentValue && effortUnit === currentUnit) {
      popoverError.value = null
      return
    }

    const previousValue = task.effort_value ?? null
    const previousHours = task.effort_hours ?? null
    const previousUnit = task.effort_unit ?? null
    patchLocalTask({
      effort_value: effortValue,
      effort_hours: effortValue === null ? null : unitValueToHours(effortValue, unit),
      effort_unit: effortUnit,
    })
    effortSaving.value = true
    popoverError.value = null
    try {
      const updated = await api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { effort_value: effortValue, effort_unit: effortUnit },
      })
      await applyPatchResponse(updated)
      effortDraft.value = effortValueToDraft(effortSource(options.task.value ?? task, orgEffortUnit.value))
    } catch (e: unknown) {
      patchLocalTask({
        effort_value: previousValue,
        effort_hours: previousHours,
        effort_unit: previousUnit,
      })
      effortDraft.value = effortValueToDraft(effortSource(task, orgEffortUnit.value))
      popoverError.value = e instanceof Error ? e.message : '工数の更新に失敗しました'
    } finally {
      effortSaving.value = false
    }
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
      await saveEffort()
    }
    dismissPopover()
  }

  async function clearEffort () {
    if (activePopover.value !== 'effort' || effortSaving.value || isDisabled()) {
      return
    }

    effortDraft.value = ''
    const task = options.task.value
    const currentValue = task
      ? resolveStoredEffortValue(effortSource(task, orgEffortUnit.value))
      : null
    if (currentValue === null) {
      dismissPopover()
      return
    }

    await saveEffort()
    dismissPopover()
  }

  async function saveDescription () {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || descriptionSaving.value) return

    const description = descriptionDraft.value
    const normalized = description.trim() === '' ? null : description
    if ((normalized ?? '') === (task.description ?? '')) return

    descriptionSaving.value = true
    popoverError.value = null
    try {
      const updated = await api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { description: normalized },
      })
      await applyPatchResponse(updated)
      descriptionDraft.value = options.task.value?.description ?? ''
    } catch (e: unknown) {
      popoverError.value = e instanceof Error ? e.message : '説明の更新に失敗しました'
    } finally {
      descriptionSaving.value = false
    }
  }

  async function closePopover () {
    if (activePopover.value === 'effort') {
      await finalizeEffortPopover()
      return
    }
    if (activePopover.value === 'description') {
      await saveDescription()
      dismissPopover()
      return
    }
    dismissPopover()
  }

  function shouldIgnorePopoverOutsideClose (target: Node): boolean {
    const anchor = popoverAnchorEl.value
    if (!anchor?.contains(target)) return false
    return true
  }

  function handlePopoverOutsidePointerDown (event: MouseEvent) {
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
    document.addEventListener('mousedown', handlePopoverOutsidePointerDown, true)
    const onResize = () => updatePopoverPosition()
    window.addEventListener('resize', onResize)
    removePopoverResizeListener = () => window.removeEventListener('resize', onResize)
  }

  function unbindPopoverListeners () {
    document.removeEventListener('keydown', onPopoverEscape)
    document.removeEventListener('mousedown', handlePopoverOutsidePointerDown, true)
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

  watch(descriptionDraft, () => {
    previewDescriptionInWbs()
  })

  watch(effortDraft, () => {
    previewEffortInWbs()
  })

  function isDisabled (): boolean {
    return options.disabled?.value ?? false
  }

  function openDatePicker (target: 'start' | 'due', event?: Event) {
    const task = options.task.value
    if (!task || isDisabled()) return
    const next: PopoverType = target === 'start' ? 'start-date' : 'due-date'
    if (activePopover.value === next) {
      void closePopover()
      return
    }
    popoverAnchorEl.value = capturePopoverAnchor(event)
    activePopover.value = next
    popoverError.value = null
    const existing = target === 'start' ? task.start_date : task.due_date
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

  async function pickCalendarDay (iso: string) {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || !activePopover.value || dateSaving.value) return

    const field = activePopover.value === 'start-date' ? 'start_date' : 'due_date'
    const current = field === 'start_date' ? task.start_date : task.due_date
    pendingDate.value = iso
    if (toDateInputValue(current) === iso) {
      return
    }

    const previousDate = current ?? null
    patchLocalTask({ [field]: iso })
    popoverError.value = null
    dateSaving.value = true
    try {
      const updated = await api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { [field]: iso },
      })
      await applyPatchResponse(updated)
    } catch (e: unknown) {
      patchLocalTask({ [field]: previousDate })
      pendingDate.value = toDateInputValue(previousDate) || null
      popoverError.value = e instanceof Error ? e.message : '日付の更新に失敗しました'
    } finally {
      dateSaving.value = false
    }
  }

  async function clearCalendarDate () {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || !activePopover.value || dateSaving.value || isDisabled()) {
      return
    }
    if (activePopover.value !== 'start-date' && activePopover.value !== 'due-date') {
      return
    }

    const field = activePopover.value === 'start-date' ? 'start_date' : 'due_date'
    const current = field === 'start_date' ? task.start_date : task.due_date
    pendingDate.value = null
    if (!current) {
      return
    }

    const previousDate = current ?? null
    patchLocalTask({ [field]: null })
    popoverError.value = null
    dateSaving.value = true
    try {
      const updated = await api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { [field]: null },
      })
      await applyPatchResponse(updated)
    } catch (e: unknown) {
      patchLocalTask({ [field]: previousDate })
      pendingDate.value = toDateInputValue(previousDate) || null
      popoverError.value = e instanceof Error ? e.message : '日付の更新に失敗しました'
    } finally {
      dateSaving.value = false
    }
  }

  async function openEffortPicker (event?: Event) {
    const task = options.task.value
    if (!task || isDisabled() || effortSaving.value) return
    if (activePopover.value === 'effort') {
      void closePopover()
      return
    }
    await ensureOrgEffortSettings(options.orgSlug)
    popoverAnchorEl.value = capturePopoverAnchor(event)
    activePopover.value = 'effort'
    popoverError.value = null
    effortDraft.value = effortValueToDraft(effortSource(task, orgEffortUnit.value))
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
    const task = options.task.value
    if (!task || isDisabled()) return
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
    const task = options.task.value
    if (!task || isDisabled()) return
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
    const task = options.task.value
    if (!task || isDisabled()) return
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

  function openDescriptionPicker (event?: Event) {
    const task = options.task.value
    if (!task || isDisabled()) return
    if (activePopover.value === 'description') {
      void closePopover()
      return
    }
    descriptionDraft.value = task.description ?? ''
    popoverAnchorEl.value = capturePopoverAnchor(event)
    activePopover.value = 'description'
    popoverError.value = null
    updatePopoverPosition()
  }

  function openListPicker (event?: Event) {
    const task = options.task.value
    if (!task || isDisabled()) return
    if (activePopover.value === 'list') {
      void closePopover()
      return
    }
    popoverAnchorEl.value = capturePopoverAnchor(event)
    activePopover.value = 'list'
    popoverError.value = null
    updatePopoverPosition()
  }

  async function selectList (listId: number) {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || listSaving.value || isDisabled()) return
    if (task.list_id === listId) return

    listSaving.value = true
    const previousListId = task.list_id ?? null
    const previousListName = task.list_name ?? null
    const previousSortOrder = task.sort_order
    const nextListName = resolveListName(listId, options.projectLists.value)
    patchLocalTask({ list_id: listId, list_name: nextListName })
    popoverError.value = null
    try {
      const updated = await api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { list_id: listId },
      })
      await applyPatchResponse(updated)
    } catch (e: unknown) {
      patchLocalTask({
        list_id: previousListId,
        list_name: previousListName,
        sort_order: previousSortOrder,
      })
      popoverError.value = e instanceof Error ? e.message : 'リストの更新に失敗しました'
    } finally {
      listSaving.value = false
    }
  }

  function isMemberAssigned (memberId: number): boolean {
    return (options.task.value?.assignees ?? []).some(member => member.id === memberId)
  }

  function isLabelSelected (labelId: number): boolean {
    return (options.task.value?.labels ?? []).some(label => label.id === labelId)
  }

  async function toggleMember (member: TaskFormMember) {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || pickerMutationPending.value || isDisabled()) return

    pickerMutationPending.value = true
    const previousAssignees = [...(task.assignees ?? [])]
    const currentIds = previousAssignees.map(m => m.id)
    const isAssigned = currentIds.includes(member.id)
    const assignee_ids = isAssigned
      ? currentIds.filter(id => id !== member.id)
      : [...currentIds, member.id]

    patchLocalTask({
      assignees: isAssigned
        ? previousAssignees.filter(m => m.id !== member.id)
        : [...previousAssignees, member],
    })
    popoverError.value = null
    try {
      const updated = await api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { assignee_ids },
      })
      await applyPatchResponse(updated)
    } catch (e: unknown) {
      patchLocalTask({ assignees: previousAssignees })
      popoverError.value = e instanceof Error ? e.message : '担当者の更新に失敗しました'
    } finally {
      pickerMutationPending.value = false
    }
  }

  async function removeMember (member: TaskFormMember) {
    if (!isMemberAssigned(member.id)) return
    await toggleMember(member)
    if (!isMemberAssigned(member.id)) {
      dismissPopover()
    }
  }

  async function toggleLabel (label: TaskFormLabel) {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || pickerMutationPending.value || isDisabled()) return

    pickerMutationPending.value = true
    const previousLabels = [...(task.labels ?? [])]
    const currentIds = previousLabels.map(item => item.id)
    const isSelected = currentIds.includes(label.id)
    const label_ids = isSelected
      ? currentIds.filter(id => id !== label.id)
      : [...currentIds, label.id]

    patchLocalTask({
      labels: isSelected
        ? previousLabels.filter(item => item.id !== label.id)
        : [...previousLabels, label],
    })
    popoverError.value = null
    try {
      const updated = await api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { label_ids },
      })
      await applyPatchResponse(updated)
    } catch (e: unknown) {
      patchLocalTask({ labels: previousLabels })
      popoverError.value = e instanceof Error ? e.message : 'ラベルの更新に失敗しました'
    } finally {
      pickerMutationPending.value = false
    }
  }

  return {
    orgEffortUnit,
    effortUnitLabel,
    activePopover,
    selectedMember,
    popoverError,
    popoverStyle,
    popoverElRef,
    labelSearchQuery,
    effortDraft,
    effortInputRef,
    descriptionDraft,
    descriptionSaving,
    weekdayLabels,
    filteredOrgLabels,
    activeCalendarDate,
    canClearCalendarDate,
    canClearEffort,
    calendarMonthLabel,
    calendarCells,
    labelBarTextColor,
    memberEmailLine,
    pendingDate,
    dateSaving,
    effortSaving,
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
    openDescriptionPicker,
    openListPicker,
    listSaving,
    selectList,
    isMemberAssigned,
    isLabelSelected,
    toggleLabel,
    toggleMember,
    removeMember,
    saveDescription,
    updatePopoverPosition,
  }
}
