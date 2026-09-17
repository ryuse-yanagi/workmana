import type { Ref } from 'vue'
import type { LabelCategoryGroup } from './useLabelCategories'
import {
  filterLabelCategories,
  labelCategoriesFromFlat,
  resolveAndSortLabels,
  sortLabelsByCatalogOrder,
} from './useLabelCategories'
import { dismissPopoverFromOutsidePointer, isInsideFloatingPopover, isPopoverTriggerTarget } from '../utils/uiInteraction'
import {
  resolvePopoverExposedInput,
  resolvePopoverExposedRoot,
} from '../utils/popoverComponentRef'
import { schedulePopoverInputFocus } from '../utils/schedulePopoverInputFocus'
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
import { useExclusivePopover } from './useExclusivePopover'
import { useApi } from './useApi'
import {
  type TaskFormDraft,
  type TaskFormLabel,
  type TaskFormMember,
  EFFORT_UNIT_LABEL,
  PROGRESS_RATE_UNIT_LABEL,
  effortValueToDraft,
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
import { sortMembersByDisplayName } from './useMemberDisplay'
import { TASK_POPOVER_WEEKDAY_LABELS } from '../utils/taskPopoverTypes'
export type WorkspaceListOption = {
  id: number
  name: string
  color: string
  sort_order?: number
  color_index?: number
}
export type TaskPopoverEditable = {
  id: number
  title: string
  description?: string | null
  list_id?: number | null
  list_name?: string | null
  sort_order?: number
  start_date?: string | null
  due_date?: string | null
  effort_hours?: number | string | null
  progress_rate?: number | string | null
  assignees?: TaskFormMember[]
  labels?: TaskFormLabel[]
}
export type PopoverType =
  | 'period'
  | 'effort'
  | 'progress-rate'
  | 'members'
  | 'member-detail'
  | 'labels'
  | 'description'
  | 'list'
type TaskPatchResponse = {
  id: number
  title: string
  description: string | null
  list_id?: number | null
  sort_order?: number
  start_date: string | null
  due_date: string | null
  effort_hours: number | string | null
  progress_rate: number | string | null
  assignees: TaskFormMember[]
  labels: TaskFormLabel[]
}
type UseTaskPopoverEditorOptions = {
  orgSlug: string
  workspaceId: string
  orgLabels: Ref<TaskFormLabel[]>
  labelCategories?: Ref<LabelCategoryGroup[]>
  workspaceMembers: Ref<TaskFormMember[]>
  workspaceLists: Ref<WorkspaceListOption[]>
  task: Ref<TaskPopoverEditable | null>
  onUpdated: (task: TaskPopoverEditable) => void
  disabled?: Ref<boolean>
  /** true のとき説明ポップオーバーは閲覧専用（閉じても保存しない） */
  readonlyDescription?: Ref<boolean>
  zIndex?: number
}
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
function effortSource (
  task: TaskPopoverEditable,
): Pick<TaskFormDraft, 'effort_hours'> {
  return {
    effort_hours: task.effort_hours ?? null,
  }
}
function progressRateSource (
  task: TaskPopoverEditable,
): Pick<TaskFormDraft, 'progress_rate'> {
  return {
    progress_rate: task.progress_rate ?? null,
  }
}
export function resolveListName (
  listId: number | null | undefined,
  lists: WorkspaceListOption[],
): string | null {
  if (listId == null) return null
  return lists.find(list => list.id === listId)?.name ?? null
}
export function resolveListColor (
  listId: number | null | undefined,
  lists: WorkspaceListOption[],
): string | null {
  if (listId == null) return null
  return lists.find(list => list.id === listId)?.color ?? null
}
function patchToEditable (
  patch: TaskPatchResponse,
  previous: TaskPopoverEditable,
  lists: WorkspaceListOption[],
  catalogLabels: Array<{ id: number }> = [],
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
    effort_hours: patch.effort_hours,
    progress_rate: patch.progress_rate,
    assignees: sortMembersByDisplayName(patch.assignees),
    labels: patch.labels !== undefined
      ? resolveAndSortLabels(patch.labels, catalogLabels)
      : previous.labels,
  }
}
export function useTaskPopoverEditor (options: UseTaskPopoverEditorOptions) {
  const { api } = useApi()
  const popoverZIndex = options.zIndex ?? 80
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
  const progressRateDraft = ref<string | number>('')
  const progressRateInputRef = ref<HTMLInputElement | null>(null)
  const descriptionInputRef = ref<HTMLTextAreaElement | null>(null)
  const descriptionDraft = ref('')
  const dateSaving = ref(false)
  const effortSaving = ref(false)
  const progressRateSaving = ref(false)
  const descriptionSaving = ref(false)
  const listSaving = ref(false)
  const pickerMutationPending = ref(false)
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
  const activeCalendarDate = computed(() => {
    const task = options.task.value
    if (!task || activePopover.value !== 'period') return null
    return toDateInputValue(task.start_date) || toDateInputValue(task.due_date) || null
  })
  const periodRangeStartIso = computed(() => {
    const task = options.task.value
    if (!task || activePopover.value !== 'period') return null
    return toDateInputValue(task.start_date) || null
  })
  const periodRangeEndIso = computed(() => {
    const task = options.task.value
    if (!task || activePopover.value !== 'period') return null
    return toDateInputValue(task.due_date) || null
  })
  const canClearCalendarDate = computed(() => (
    !!(toDateInputValue(options.task.value?.start_date) || toDateInputValue(options.task.value?.due_date))
  ))
  const canClearEffort = computed(() => String(effortDraft.value ?? '').trim() !== '')
  const canClearProgressRate = computed(() => String(progressRateDraft.value ?? '').trim() !== '')
  const canClearAssignees = computed(() => (options.task.value?.assignees ?? []).length > 0)
  const canClearLabels = computed(() => (options.task.value?.labels ?? []).length > 0)
  const canClearDescription = computed(() => {
    if (options.readonlyDescription?.value) return false
    return String(descriptionDraft.value ?? '').trim() !== ''
  })
  const calendarMonthLabel = computed(() => {
    const y = calendarCursor.value.getFullYear()
    const m = calendarCursor.value.getMonth() + 1
    return `${y}年${m}月`
  })
  const calendarCells = computed(() => buildTaskCalendarCells(calendarCursor.value))
  function taskEndpoint (): string | null {
    const task = options.task.value
    if (!task) return null
    return `/orgs/${options.orgSlug}/workspaces/${options.workspaceId}/tasks/${task.id}`
  }
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
  function resolveDescriptionInputEl (): HTMLTextAreaElement | null {
    const fromPopover = resolvePopoverExposedInput(popoverElRef.value)
    if (fromPopover instanceof HTMLTextAreaElement) return fromPopover
    return descriptionInputRef.value
  }
  function capturePopoverAnchor (event?: Event): HTMLElement | null {
    const fromEvent = event?.currentTarget
    if (fromEvent instanceof HTMLElement) return fromEvent
    const target = event?.target
    if (target instanceof Element) {
      const cellButton = target.closest('.workspace-wbs__cell-btn')
      if (cellButton instanceof HTMLElement) return cellButton
    }
    return null
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
  function positionPopover (visible = true) {
    const anchor = popoverAnchorEl.value
    const popover = resolvePopoverElement()
    if (!anchor || !popover) return
    const pad = POPOVER_VIEWPORT_INSET
    const topPad = POPOVER_VIEWPORT_TOP_PAD
    const gap = POPOVER_ANCHOR_GAP
    const anchorRect = anchor.getBoundingClientRect()
    const type = activePopover.value
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

    popoverStyle.value = {
      position: 'fixed',
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      maxHeight: `${maxHeight}px`,
      ...(forceHeight || isDescriptionEdit || scrollbarGutter > 0
        ? { height: `${maxHeight}px` }
        : {}),
      zIndex: String(popoverZIndex),
      ...popoverPositionVisibilityStyle(visible),
      ...(useExplicitWidth ? popoverStablePanelWidthStyle(panelWidth!) : {}),
      ...popoverScrollbarLayoutStyle(scrollbarGutter, useExplicitWidth),
    }
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
  function dismissPopover () {
    activePopover.value = null
    selectedMember.value = null
    popoverError.value = null
    pendingDate.value = null
    // popoverStyle は leave 完了後に消す（フェードアウトを維持）
    // 途中で失敗した更新フラグが残ると、開いても変更できなくなる
    listSaving.value = false
    pickerMutationPending.value = false
    dateSaving.value = false
    effortSaving.value = false
    progressRateSaving.value = false
    descriptionSaving.value = false
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
    if (activePopover.value === 'description') {
      const closing = 'description'
      // 閲覧専用表示では保存しない（編集ボタン押下などと競合させない）
      if (!options.readonlyDescription?.value) {
        await saveDescription()
      }
      if (activePopover.value !== closing) {
        resolvePopoverLeaveWait()
        return
      }
      dismissPopover()
      await leaveDone
      return
    }
    dismissPopover()
    await leaveDone
  }
  /**
   * 別ポップオーバーへ切り替える前に現在のものを閉じる。
   * 同種トグルなら閉じただけで false。不正入力で閉じられなかった場合も false。
   */
  async function beginPopoverOpen (next: PopoverType): Promise<boolean> {
    const current = activePopover.value
    if (current === next) {
      await closePopover()
      return false
    }
    if (current != null) {
      await closePopover()
      if (activePopover.value != null) return false
    }
    return true
  }
  function resetTransientMutationLocks () {
    listSaving.value = false
    pickerMutationPending.value = false
    dateSaving.value = false
    effortSaving.value = false
    progressRateSaving.value = false
    descriptionSaving.value = false
  }
  function patchLocalTask (patch: Partial<TaskPopoverEditable>) {
    const task = options.task.value
    if (!task) return
    const merged = { ...task, ...patch }
    options.task.value = merged
    options.onUpdated(merged)
  }
  function previewDescriptionInWbs () {
    // 閲覧専用では下書きの同期プレビューを行わない
    if (options.readonlyDescription?.value) return
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
    const effortHours = parsed === null ? null : normalizeEffortHours(parsed)
    options.onUpdated({
      ...task,
      effort_hours: effortHours,
    })
  }
  function previewProgressRateInWbs () {
    if (activePopover.value !== 'progress-rate') return
    const task = options.task.value
    if (!task) return
    const parsed = parseProgressRateDraft(progressRateDraft.value)
    if (parsed === 'invalid') return
    const progressRate = parsed === null ? null : normalizeProgressRate(parsed)
    options.onUpdated({
      ...task,
      progress_rate: progressRate,
    })
  }
  async function applyPatchResponse (updated: TaskPatchResponse) {
    const task = options.task.value
    if (!task || updated.id !== task.id) return
    const merged = patchToEditable(updated, task, options.workspaceLists.value, options.orgLabels.value)
    options.task.value = merged
    options.onUpdated(merged)
  }
  async function saveEffort () {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || effortSaving.value) return false
    const parsed = parseEffortDraft(effortDraft.value)
    if (parsed === 'invalid') {
      popoverError.value = '工数は0以上の数値で入力してください'
      effortDraft.value = effortValueToDraft(effortSource(task))
      return false
    }
    const effortHours = parsed === null ? null : normalizeEffortHours(parsed)
    const currentValue = resolveStoredEffortValue(effortSource(task))
    if (effortHours === currentValue) {
      popoverError.value = null
      return true
    }
    const previousHours = task.effort_hours ?? null
    patchLocalTask({
      effort_hours: effortHours,
    })
    effortSaving.value = true
    popoverError.value = null
    try {
      const updated = await api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { effort_hours: effortHours },
      })
      await applyPatchResponse(updated)
      effortDraft.value = effortValueToDraft(effortSource(options.task.value ?? task))
      return true
    } catch (e: unknown) {
      patchLocalTask({
        effort_hours: previousHours,
      })
      effortDraft.value = effortValueToDraft(effortSource(task))
      popoverError.value = e instanceof Error ? e.message : '工数の更新に失敗しました'
      return false
    } finally {
      effortSaving.value = false
    }
  }
  async function finalizeEffortPopover () {
    const closing = activePopover.value
    if (closing !== 'effort') return
    const parsed = parseEffortDraft(effortDraft.value)
    if (parsed === 'invalid') {
      popoverError.value = '工数は0以上の数値で入力してください'
      return
    }
    popoverError.value = null
    const saved = await saveEffort()
    if (!saved) {
      return
    }
    // 保存中に別ポップオーバーへ切り替わっていたら閉じない
    if (activePopover.value !== closing) return
    dismissPopover()
  }
  async function saveProgressRate () {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || progressRateSaving.value) return false
    const parsed = parseProgressRateDraft(progressRateDraft.value)
    if (parsed === 'invalid') {
      popoverError.value = '進捗率は0〜100の整数で入力してください'
      progressRateDraft.value = progressRateValueToDraft(progressRateSource(task))
      return false
    }
    const progressRate = parsed === null ? null : normalizeProgressRate(parsed)
    const currentValue = resolveStoredProgressRate(progressRateSource(task))
    if (progressRate === currentValue) {
      popoverError.value = null
      return true
    }
    const previousRate = task.progress_rate ?? null
    patchLocalTask({
      progress_rate: progressRate,
    })
    progressRateSaving.value = true
    popoverError.value = null
    try {
      const updated = await api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { progress_rate: progressRate },
      })
      await applyPatchResponse(updated)
      progressRateDraft.value = progressRateValueToDraft(progressRateSource(options.task.value ?? task))
      return true
    } catch (e: unknown) {
      patchLocalTask({
        progress_rate: previousRate,
      })
      progressRateDraft.value = progressRateValueToDraft(progressRateSource(task))
      popoverError.value = e instanceof Error ? e.message : '進捗率の更新に失敗しました'
      return false
    } finally {
      progressRateSaving.value = false
    }
  }
  async function finalizeProgressRatePopover () {
    const closing = activePopover.value
    if (closing !== 'progress-rate') return
    const parsed = parseProgressRateDraft(progressRateDraft.value)
    if (parsed === 'invalid') {
      popoverError.value = '進捗率は0〜100の整数で入力してください'
      return
    }
    popoverError.value = null
    const saved = await saveProgressRate()
    if (!saved) {
      return
    }
    if (activePopover.value !== closing) return
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
  useExclusivePopover(
    () => activePopover.value != null,
    () => { void closePopover() },
  )
  function shouldIgnorePopoverOutsideClose (target: Node): boolean {
    // トリガー再クリック／別ポップオーバー切替は click 側で処理する（mouseup で先行クローズしない）
    if (isPopoverTriggerTarget(target)) {
      return true
    }
    const el = target instanceof Element ? target : target.parentElement
    if (!el) {
      return false
    }
    if (el.closest('.popover-layer, .popover, .popover-shell')) {
      return true
    }
    // 閲覧専用の説明（入力済み）は、ポップオーバー外クリックで閉じる。
    // 説明セル自体は click で開閉するため、外側クローズ対象外にする
    // （mouseup で閉じた直後に click で再度開くのを防ぐ）。
    if (activePopover.value === 'description' && options.readonlyDescription?.value) {
      const notesCell = el.closest('.workspace-wbs__cell-btn--notes')
      return !!(notesCell && notesCell.getAttribute('aria-disabled') !== 'true')
    }
    // セル側のクリックで開閉が処理されるため外側クローズ対象外。
    // ただし操作無効なセル（空の説明など）は何も起きないので閉じる。
    const cell = el.closest(
      '.workspace-wbs__cell-btn, .workspace-wbs__avatar-btn, .workspace-wbs__members-cell',
    )
    if (cell && cell.getAttribute('aria-disabled') !== 'true') {
      return true
    }
    const anchor = popoverAnchorEl.value
    if (anchor?.contains(el)) {
      return true
    }
    return false
  }
  function handlePopoverOutsidePointerUp (event: MouseEvent) {
    if (!activePopover.value || event.button !== 0) return
    const target = event.target
    if (!(target instanceof Node)) return
    if (isInsideFloatingPopover(target)) return
    if (resolvePopoverElement()?.contains(target)) return
    if (shouldIgnorePopoverOutsideClose(target)) return
    // 閲覧専用の説明は保存不要なので同期 dismiss で閉じる
    if (activePopover.value === 'description' && options.readonlyDescription?.value) {
      dismissPopoverFromOutsidePointer(target, dismissPopover)
      return
    }
    if (activePopover.value === 'member-detail') {
      dismissPopoverFromOutsidePointer(target, dismissPopover)
      return
    }
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
    if (next && !prev) {
      bindPopoverListeners()
      return
    }
    if (!next && prev) {
      unbindPopoverListeners()
    }
  })
  onBeforeUnmount(() => {
    unbindPopoverListeners()
  })
  watch(labelSearchQuery, () => {
    if (activePopover.value === 'labels') updatePopoverPosition()
  })
  watch(descriptionDraft, () => {
    previewDescriptionInWbs()
    if (activePopover.value === 'description') {
      updatePopoverPosition()
    }
  })
  watch(effortDraft, () => {
    previewEffortInWbs()
  })
  watch(progressRateDraft, () => {
    previewProgressRateInWbs()
  })
  function isDisabled (): boolean {
    return options.disabled?.value ?? false
  }
  function openDatePicker (event?: Event) {
    void (async () => {
      const task = options.task.value
      if (!task || isDisabled()) return
      // await 後は event.currentTarget が null になるため、先にアンカーを保持する
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('period'))) return
      resetTransientMutationLocks()
      popoverAnchorEl.value = anchor
      activePopover.value = 'period'
      popoverError.value = null
      const startIso = toDateInputValue(task.start_date) || null
      const dueIso = toDateInputValue(task.due_date) || null
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
  async function pickCalendarDay (iso: string) {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || activePopover.value !== 'period' || dateSaving.value) return
    const nextRange = resolveTaskDateRangePick(iso, task.start_date, task.due_date)
    if (!nextRange) {
      popoverError.value = null
      return
    }
    await applyPeriodRange(nextRange)
  }
  async function pickCalendarRange (range: { start_date: string; due_date: string }) {
    if (activePopover.value !== 'period' || dateSaving.value) return
    await applyPeriodRange(range)
  }
  async function applyPeriodRange (nextRange: { start_date: string; due_date: string }) {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint) return
    const prevStart = task.start_date ?? null
    const prevDue = task.due_date ?? null
    if (
      toDateInputValue(prevStart) === nextRange.start_date
      && toDateInputValue(prevDue) === nextRange.due_date
    ) {
      popoverError.value = null
      return
    }
    pendingDate.value = nextRange.start_date
    patchLocalTask(nextRange)
    popoverError.value = null
    dateSaving.value = true
    try {
      const updated = await api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: nextRange,
      })
      await applyPatchResponse(updated)
    } catch (e: unknown) {
      patchLocalTask({ start_date: prevStart, due_date: prevDue })
      pendingDate.value = toDateInputValue(prevStart) || toDateInputValue(prevDue) || null
      popoverError.value = e instanceof Error ? e.message : '日付の更新に失敗しました'
    } finally {
      dateSaving.value = false
    }
  }
  async function clearCalendarDate () {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || activePopover.value !== 'period' || dateSaving.value || isDisabled()) {
      return
    }
    const prevStart = task.start_date ?? null
    const prevDue = task.due_date ?? null
    pendingDate.value = null
    if (!prevStart && !prevDue) {
      return
    }
    patchLocalTask({ start_date: null, due_date: null })
    popoverError.value = null
    dateSaving.value = true
    try {
      const updated = await api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { start_date: null, due_date: null },
      })
      await applyPatchResponse(updated)
    } catch (e: unknown) {
      patchLocalTask({ start_date: prevStart, due_date: prevDue })
      pendingDate.value = toDateInputValue(prevStart) || toDateInputValue(prevDue) || null
      popoverError.value = e instanceof Error ? e.message : '日付の更新に失敗しました'
    } finally {
      dateSaving.value = false
    }
  }
  async function clearEffort () {
    if (isDisabled() || effortSaving.value) return
    effortDraft.value = ''
    popoverError.value = null
    const inputEl = resolveEffortInputEl()
    if (inputEl) {
      inputEl.value = ''
    }
    await saveEffort()
  }
  async function clearProgressRate () {
    if (isDisabled() || progressRateSaving.value) return
    progressRateDraft.value = ''
    popoverError.value = null
    const inputEl = resolveProgressRateInputEl()
    if (inputEl) {
      inputEl.value = ''
    }
    await saveProgressRate()
  }
  async function clearAssignees () {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || pickerMutationPending.value || isDisabled()) return
    const previousAssignees = [...(task.assignees ?? [])]
    if (!previousAssignees.length) return
    pickerMutationPending.value = true
    patchLocalTask({ assignees: [] })
    popoverError.value = null
    try {
      const updated = await api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { assignee_ids: [] },
      })
      await applyPatchResponse(updated)
    } catch (e: unknown) {
      patchLocalTask({ assignees: previousAssignees })
      popoverError.value = e instanceof Error ? e.message : '担当者の更新に失敗しました'
    } finally {
      pickerMutationPending.value = false
    }
  }
  async function clearLabels () {
    const task = options.task.value
    const endpoint = taskEndpoint()
    if (!task || !endpoint || pickerMutationPending.value || isDisabled()) return
    const previousLabels = [...(task.labels ?? [])]
    if (!previousLabels.length) return
    pickerMutationPending.value = true
    patchLocalTask({ labels: [] })
    popoverError.value = null
    try {
      const updated = await api<TaskPatchResponse>(endpoint, {
        method: 'PATCH',
        body: { label_ids: [] },
      })
      await applyPatchResponse(updated)
    } catch (e: unknown) {
      patchLocalTask({ labels: previousLabels })
      popoverError.value = e instanceof Error ? e.message : 'ラベルの更新に失敗しました'
    } finally {
      pickerMutationPending.value = false
    }
  }
  async function clearDescription () {
    if (options.readonlyDescription?.value || isDisabled() || descriptionSaving.value) return
    descriptionDraft.value = ''
    previewDescriptionInWbs()
    await saveDescription()
  }
  function openEffortPicker (event?: Event) {
    void (async () => {
      const task = options.task.value
      if (!task || isDisabled()) return
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('effort'))) return
      resetTransientMutationLocks()
      popoverAnchorEl.value = anchor
      activePopover.value = 'effort'
      popoverError.value = null
      effortDraft.value = effortValueToDraft(effortSource(task))
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
      const task = options.task.value
      if (!task || isDisabled()) return
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('progress-rate'))) return
      resetTransientMutationLocks()
      popoverAnchorEl.value = anchor
      activePopover.value = 'progress-rate'
      popoverError.value = null
      progressRateDraft.value = progressRateValueToDraft(progressRateSource(task))
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
      const task = options.task.value
      if (!task || isDisabled()) return
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('members'))) return
      resetTransientMutationLocks()
      selectedMember.value = null
      popoverAnchorEl.value = anchor
      activePopover.value = 'members'
      popoverError.value = null
      updatePopoverPosition()
    })()
  }
  function openMemberDetail (member: TaskFormMember, event: Event) {
    void (async () => {
      const task = options.task.value
      if (!task || isDisabled()) return
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
        await closePopover()
        if (activePopover.value != null) return
      }
      resetTransientMutationLocks()
      selectedMember.value = member
      popoverAnchorEl.value = anchor
      activePopover.value = 'member-detail'
      popoverError.value = null
      updatePopoverPosition()
    })()
  }
  function openLabelPicker (event?: Event) {
    void (async () => {
      const task = options.task.value
      if (!task || isDisabled()) return
      // await 後は event.currentTarget が null になるため、先にアンカーを保持する
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('labels'))) return
      resetTransientMutationLocks()
      labelSearchQuery.value = ''
      popoverAnchorEl.value = anchor
      activePopover.value = 'labels'
      popoverError.value = null
      updatePopoverPosition()
    })()
  }
  function openDescriptionPicker (event?: Event) {
    void (async () => {
      const task = options.task.value
      if (!task || isDisabled()) return
      // await 後は event.currentTarget が null になるため、先にアンカーを保持する
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('description'))) return
      resetTransientMutationLocks()
      descriptionDraft.value = task.description ?? ''
      popoverAnchorEl.value = anchor
      activePopover.value = 'description'
      popoverError.value = null
      updatePopoverPosition()
      if (options.readonlyDescription?.value) return
      schedulePopoverInputFocus(() => resolveDescriptionInputEl(), { select: 'end' })
    })()
  }
  function openListPicker (event?: Event) {
    void (async () => {
      const task = options.task.value
      if (!task || isDisabled()) return
      // await 後は event.currentTarget が null になるため、先にアンカーを保持する
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('list'))) return
      resetTransientMutationLocks()
      popoverAnchorEl.value = anchor
      activePopover.value = 'list'
      popoverError.value = null
      updatePopoverPosition()
    })()
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
    const nextListName = resolveListName(listId, options.workspaceLists.value)
    patchLocalTask({
      list_id: listId,
      list_name: nextListName,
    })
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
      assignees: sortMembersByDisplayName(
        isAssigned
          ? previousAssignees.filter(m => m.id !== member.id)
          : [...previousAssignees, member],
      ),
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
      labels: sortLabelsByCatalogOrder(
        isSelected
          ? previousLabels.filter(item => item.id !== label.id)
          : [...previousLabels, label],
        options.orgLabels.value,
      ),
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
    EFFORT_UNIT_LABEL,
    PROGRESS_RATE_UNIT_LABEL,
    activePopover,
    selectedMember,
    popoverError,
    popoverStyle,
    popoverElRef,
    labelSearchQuery,
    effortDraft,
    effortInputRef,
    progressRateDraft,
    progressRateInputRef,
    descriptionInputRef,
    descriptionDraft,
    descriptionSaving,
    weekdayLabels,
    filteredOrgLabels,
    filteredLabelCategories,
    activeCalendarDate,
    periodRangeStartIso,
    periodRangeEndIso,
    canClearCalendarDate,
    canClearEffort,
    canClearProgressRate,
    canClearAssignees,
    canClearLabels,
    canClearDescription,
    calendarMonthLabel,
    calendarCells,
    labelBarTextColor,
    memberEmailLine,
    pendingDate,
    dateSaving,
    effortSaving,
    progressRateSaving,
    openDatePicker,
    shiftCalendarMonth,
    pickCalendarDay,
    pickCalendarRange,
    clearCalendarDate,
    clearEffort,
    clearProgressRate,
    clearAssignees,
    clearLabels,
    clearDescription,
    openEffortPicker,
    updateEffortDraft,
    finalizeEffortPopover,
    openProgressRatePicker,
    updateProgressRateDraft,
    finalizeProgressRatePopover,
    closePopover,
    dismissPopover,
    notifyPopoverAfterLeave,
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
