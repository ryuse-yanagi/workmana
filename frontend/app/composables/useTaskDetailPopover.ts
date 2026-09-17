import type { Ref } from 'vue'
import type {
  TaskDetail,
  TaskDetailMember,
} from '../components/modals/TaskDetailModal.vue'
import type { ParentTaskOption } from './useTaskDetailHierarchy'
import {
  parseEffortDraft,
  parseProgressRateDraft,
  resolveTaskDateRangePick,
  toDateInputValue,
} from './useTaskFormHelpers'
import { useExclusivePopover } from './useExclusivePopover'
import {
  dismissPopoverFromOutsidePointer,
  isInsideFloatingPopover,
  isPopoverTriggerTarget,
  POPOVER_TRIGGER_SELECTOR,
} from '../utils/uiInteraction'
import {
  POPOVER_PANEL_BASE_WIDTH,
  POPOVER_VIEWPORT_INSET,
  buildAnchoredPopoverStyle,
  computeAnchoredPopoverBelowLayout,
  popoverPositionVisibilityStyle,
  refineAnchoredPopoverWithFloatingUi,
  schedulePopoverOpenLayout,
} from '../utils/popoverScrollbar'
import {
  resolvePopoverExposedInput,
  resolvePopoverExposedRoot,
} from '../utils/popoverComponentRef'
import { schedulePopoverInputFocus } from '../utils/schedulePopoverInputFocus'

export type TaskDetailPopoverType =
  | 'period'
  | 'effort'
  | 'progress-rate'
  | 'members'
  | 'member-detail'
  | 'labels'
  | 'list'
  | 'checklist-add'
  | 'hierarchy'
  | 'parent-task'

/**
 * タスク詳細モーダルのポップオーバー開閉・配置・外側クリック／Escape。
 * オーバーレイ閉じ（armOverlayCloseGuard / close / backdrop）は SFC 側。
 */
export function useTaskDetailPopover (options: {
  task: Ref<TaskDetail | null>
  saving: Ref<boolean>
  popoverElRef: Ref<{ rootRef: HTMLElement | null } | HTMLElement | null>
  effortInputRef: Ref<HTMLInputElement | null>
  progressRateInputRef: Ref<HTMLInputElement | null>
  effortDetailAnchorRef: Ref<HTMLElement | null>
  progressRateDetailAnchorRef: Ref<HTMLElement | null>
  listPickerBtnRef: Ref<HTMLElement | null>
  /** 遅延解決（他 composable 初期化後） */
  effortSaving: () => boolean
  progressRateSaving: () => boolean
  dateSaving: () => boolean
  parentSaving: () => boolean
  parentTasksLoading: () => boolean
  effortDraft: () => Ref<string | number>
  progressRateDraft: () => Ref<string | number>
  checklistTitleDraft: () => Ref<string>
  checklistTitleInputRef: () => Ref<HTMLInputElement | null>
  parentTasks: () => Ref<ParentTaskOption[]>
  effortValueToDraftFromTask: (detail: TaskDetail) => string
  progressRateValueToDraftFromTask: (detail: TaskDetail) => string
  saveEffort: () => Promise<boolean>
  saveProgressRate: () => Promise<boolean>
  applyPeriodRange: (range: { start_date: string | null; due_date: string | null }) => Promise<void>
  toggleMember: (member: TaskDetailMember) => Promise<void>
  fetchParentTasks: () => Promise<void>
  closeAttachmentMenu: () => void
  refreshFocusTrap: () => void
  armOverlayCloseGuard: (ms?: number) => void
}) {
  const activePopover = ref<TaskDetailPopoverType | null>(null)
  const selectedMember = ref<TaskDetailMember | null>(null)
  const popoverError = ref<string | null>(null)
  const popoverStyle = ref<Record<string, string>>({})
  const popoverAnchorEl = ref<HTMLElement | null>(null)
  const calendarCursor = ref(new Date())
  const pendingDate = ref<string | null>(null)
  const labelSearchQuery = ref('')
  const memberSearchQuery = ref('')

  function resolvePopoverElement (): HTMLElement | null {
    return resolvePopoverExposedRoot(options.popoverElRef.value)
  }
  function resolveEffortInputEl (): HTMLInputElement | null {
    const fromPopover = resolvePopoverExposedInput(options.popoverElRef.value)
    if (fromPopover instanceof HTMLInputElement) return fromPopover
    return options.effortInputRef.value
  }
  function resolveProgressRateInputEl (): HTMLInputElement | null {
    const fromPopover = resolvePopoverExposedInput(options.popoverElRef.value)
    if (fromPopover instanceof HTMLInputElement) return fromPopover
    return options.progressRateInputRef.value
  }

  function memberEmailLine (member: TaskDetailMember): string {
    const email = member.email?.trim()
    if (email) return email
    return `@user${member.id}`
  }
  function resolveEffortPopoverAnchor (event?: Event): HTMLElement | null {
    const clicked = event?.currentTarget
    const detailAnchor = options.effortDetailAnchorRef.value
    if (
      detailAnchor
      && clicked instanceof Node
      && detailAnchor.contains(clicked)
    ) {
      return getEffortDisplayButton() ?? detailAnchor
    }
    return capturePopoverAnchor(event)
  }
  function resolveProgressRatePopoverAnchor (event?: Event): HTMLElement | null {
    const clicked = event?.currentTarget
    const detailAnchor = options.progressRateDetailAnchorRef.value
    if (
      detailAnchor
      && clicked instanceof Node
      && detailAnchor.contains(clicked)
    ) {
      return getProgressRateDisplayButton() ?? detailAnchor
    }
    return capturePopoverAnchor(event)
  }
  function openEffortPicker (event?: Event) {
    void (async () => {
      if (!options.task.value || options.saving.value || options.effortSaving()) return
      const anchor = resolveEffortPopoverAnchor(event)
      if (!(await beginPopoverOpen('effort'))) return
      popoverAnchorEl.value = anchor
      activePopover.value = 'effort'
      popoverError.value = null
      options.effortDraft().value = options.effortValueToDraftFromTask(options.task.value)
      updatePopoverPosition()
      nextTick(() => {
        schedulePopoverInputFocus(() => resolveEffortInputEl(), { select: 'all' })
      })
    })()
  }
  function openProgressRatePicker (event?: Event) {
    void (async () => {
      if (!options.task.value || options.saving.value || options.progressRateSaving()) return
      const anchor = resolveProgressRatePopoverAnchor(event)
      if (!(await beginPopoverOpen('progress-rate'))) return
      popoverAnchorEl.value = anchor
      activePopover.value = 'progress-rate'
      popoverError.value = null
      options.progressRateDraft().value = options.progressRateValueToDraftFromTask(options.task.value)
      updatePopoverPosition()
      nextTick(() => {
        schedulePopoverInputFocus(() => resolveProgressRateInputEl(), { select: 'all' })
      })
    })()
  }
  /** 入力ありなら保存、未入力なら工数を消してから閉じる。不正値なら開いたまま。 */
  async function finalizeEffortPopover () {
    const closing = activePopover.value
    if (closing !== 'effort') return
    const parsed = parseEffortDraft(options.effortDraft().value)
    if (parsed === 'invalid') {
      popoverError.value = '工数は0以上の数値で入力してください'
      return
    }
    popoverError.value = null
    const saved = await options.saveEffort()
    if (!saved) {
      return
    }
    // 保存中に別ポップオーバーへ切り替わっていたら閉じない
    if (activePopover.value !== closing) return
    dismissPopover()
  }
  /** 入力ありなら保存、未入力なら進捗率を消してから閉じる。不正値なら開いたまま。 */
  async function finalizeProgressRatePopover () {
    const closing = activePopover.value
    if (closing !== 'progress-rate') return
    const parsed = parseProgressRateDraft(options.progressRateDraft().value)
    if (parsed === 'invalid') {
      popoverError.value = '進捗率は0〜100の整数で入力してください'
      return
    }
    popoverError.value = null
    const saved = await options.saveProgressRate()
    if (!saved) {
      return
    }
    if (activePopover.value !== closing) return
    dismissPopover()
  }
  function getEffortDisplayButton (): HTMLButtonElement | null {
    const section = options.effortDetailAnchorRef.value
    return section?.querySelector('.detail-value-btn') ?? null
  }
  function getProgressRateDisplayButton (): HTMLButtonElement | null {
    const section = options.progressRateDetailAnchorRef.value
    return section?.querySelector('.detail-value-btn') ?? null
  }
  function shouldIgnorePopoverOutsideClose (target: Node): boolean {
    // トリガー再クリック／別ポップオーバー切替は click 側で処理する（mouseup で先行クローズしない）
    if (isPopoverTriggerTarget(target)) {
      return true
    }
    if (activePopover.value === 'list') {
      const listBtn = options.listPickerBtnRef.value
      if (listBtn?.contains(target)) {
        return true
      }
    }
    const anchor = popoverAnchorEl.value
    if (!anchor?.contains(target)) {
      return false
    }
    // 工数: アンカーボタン（アクションバー or 詳細の値ボタン）再クリックはトグル用。
    // 詳細セクション内の余白・ラベルは外側クリックとして閉じる。
    if (activePopover.value === 'effort') {
      const detailAnchor = options.effortDetailAnchorRef.value
      if (detailAnchor?.contains(target)) {
        const displayButton = getEffortDisplayButton()
        return !!displayButton && displayButton.contains(target)
      }
      return true
    }
    // 進捗率: アンカーボタン（アクションバー or 詳細の値ボタン）再クリックはトグル用。
    // 詳細セクション内の余白・ラベルは外側クリックとして閉じる。
    if (activePopover.value === 'progress-rate') {
      const detailAnchor = options.progressRateDetailAnchorRef.value
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
    // 別ポップオーバーへ切り替えた後に leave が完了しても、新しい側の位置を消さない
    if (activePopover.value == null) {
      popoverStyle.value = popoverPositionVisibilityStyle(false)
    }
    // leave 待ちは必ず解除する（早期 return だと closePopover が永続待ちになり、
    // ユーザー情報へ切り替え不能・次の担当者ポップオーバーが未配置のまま左上表示になる）
    resolvePopoverLeaveWait()
  }
  function armPopoverLeaveWait (): Promise<void> {
    return new Promise((resolve) => {
      const previous = popoverLeaveResolve
      popoverLeaveResolve = resolve
      // 前の待ちを破棄せず完了扱いにする
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
    dismissPopover()
    await leaveDone
  }
  /**
   * 別ポップオーバーへ切り替える前に現在のものを閉じる。
   * 同種トグルなら閉じただけで false。不正入力で閉じられなかった場合も false。
   */
  async function beginPopoverOpen (next: TaskDetailPopoverType): Promise<boolean> {
    const current = activePopover.value
    if (current === next) {
      await closePopover()
      return false
    }
    if (current != null) {
      await closePopover()
      if (activePopover.value != null) {
        return false
      }
    }
    return true
  }
  useExclusivePopover(
    () => activePopover.value != null,
    () => { void closePopover() },
  )
  const POPOVER_ANCHOR_GAP = 6
  const POPOVER_MIN_HEIGHT = 120
  let removePopoverResizeListener: (() => void) | null = null

  function resolveTaskDetailPopoverBaseWidth (type: TaskDetailPopoverType | null): number {
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
      case 'list':
        return POPOVER_PANEL_BASE_WIDTH.list
      case 'labels':
        return POPOVER_PANEL_BASE_WIDTH.labels
      case 'hierarchy':
        return POPOVER_PANEL_BASE_WIDTH.hierarchy
      case 'parent-task':
        return POPOVER_PANEL_BASE_WIDTH.list
      case 'checklist-add':
        return POPOVER_PANEL_BASE_WIDTH.checklistAdd
      default:
        return POPOVER_PANEL_BASE_WIDTH.date
    }
  }
  /** await 後は event.currentTarget が null になるため、同期的に要素を保持する */
  function capturePopoverAnchor (event?: Event): HTMLElement | null {
    const fromEvent = event?.currentTarget
    if (fromEvent instanceof HTMLElement) {
      return fromEvent
    }
    const fromTarget = event?.target
    if (fromTarget instanceof Element) {
      const trigger = fromTarget.closest(
        `${POPOVER_TRIGGER_SELECTOR}, button, [role="button"]`,
      )
      if (trigger instanceof HTMLElement) {
        return trigger
      }
    }
    return null
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
    if (activePopover.value === 'checklist-add') {
      schedulePopoverInputFocus(() => options.checklistTitleInputRef().value)
    }
  }
  async function positionPopover (visible = true) {
    const anchor = popoverAnchorEl.value
    const popover = resolvePopoverElement()
    if (!anchor || !popover) return
    let layout = computeAnchoredPopoverBelowLayout(
      anchor.getBoundingClientRect(),
      resolveTaskDetailPopoverBaseWidth(activePopover.value),
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
  function openDatePicker (event?: Event) {
    void (async () => {
      if (!options.task.value) return
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('period'))) return
      popoverAnchorEl.value = anchor
      activePopover.value = 'period'
      popoverError.value = null
      const startIso = toDateInputValue(options.task.value.start_date) || null
      const dueIso = toDateInputValue(options.task.value.due_date) || null
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
    if (!options.task.value || activePopover.value !== 'period' || options.dateSaving()) return
    const nextRange = resolveTaskDateRangePick(iso, options.task.value.start_date, options.task.value.due_date)
    if (!nextRange) {
      popoverError.value = null
      return
    }
    await options.applyPeriodRange(nextRange)
  }
  async function pickCalendarRange (range: { start_date: string; due_date: string }) {
    if (!options.task.value || activePopover.value !== 'period' || options.dateSaving()) return
    await options.applyPeriodRange(range)
  }
  function openMemberPicker (event?: Event) {
    void (async () => {
      if (!options.task.value) return
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('members'))) return
      selectedMember.value = null
      popoverAnchorEl.value = anchor
      activePopover.value = 'members'
      popoverError.value = null
      updatePopoverPosition()
    })()
  }
  function openMemberDetail (member: TaskDetailMember, event: Event) {
    void (async () => {
      if (!options.task.value) return
      // await 後は event.currentTarget が null になるため、先にアンカーを保持する
      const anchor = event.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : capturePopoverAnchor(event)
      if (!anchor) return
      if (
        activePopover.value === 'member-detail'
        && selectedMember.value?.id === member.id
      ) {
        await closePopover()
        return
      }
      if (activePopover.value != null && activePopover.value !== 'member-detail') {
        await closePopover()
        if (activePopover.value != null) return
      }
      selectedMember.value = member
      popoverAnchorEl.value = anchor
      activePopover.value = 'member-detail'
      popoverError.value = null
      updatePopoverPosition()
    })()
  }
  async function removeMemberFromTask (member: TaskDetailMember) {
    if (!options.task.value || !isMemberAssigned(member.id)) return
    options.armOverlayCloseGuard()
    await options.toggleMember(member)
    if (!isMemberAssigned(member.id)) {
      closePopover()
    }
  }
  function isMemberAssigned (memberId: number): boolean {
    return (options.task.value?.assignees ?? []).some(member => member.id === memberId)
  }
  function onPopoverEscape (event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    if (!activePopover.value) return
    event.stopPropagation()
    closePopover()
  }
  watch(activePopover, (open) => {
    if (open === 'checklist-add') {
      schedulePopoverInputFocus(() => options.checklistTitleInputRef().value)
    }
    if (open) {
      options.closeAttachmentMenu()
      document.addEventListener('keydown', onPopoverEscape)
      document.addEventListener('mouseup', handlePopoverOutsidePointerUp, true)
      const onResize = () => updatePopoverPosition()
      window.addEventListener('resize', onResize)
      removePopoverResizeListener = () => window.removeEventListener('resize', onResize)
      updatePopoverPosition()
      requestAnimationFrame(() => options.refreshFocusTrap())
    } else {
      document.removeEventListener('keydown', onPopoverEscape)
      document.removeEventListener('mouseup', handlePopoverOutsidePointerUp, true)
      removePopoverResizeListener?.()
      removePopoverResizeListener = null
      requestAnimationFrame(() => options.refreshFocusTrap())
    }
  })
  watch(labelSearchQuery, () => {
    if (activePopover.value === 'labels') {
      updatePopoverPosition()
    }
  })
  watch(memberSearchQuery, () => {
    if (activePopover.value === 'members') {
      updatePopoverPosition()
    }
  })
  function cleanupPopoverListeners () {
    document.removeEventListener('keydown', onPopoverEscape)
    document.removeEventListener('mouseup', handlePopoverOutsidePointerUp, true)
    removePopoverResizeListener?.()
    removePopoverResizeListener = null
  }
  function openListPicker (event?: Event) {
    void (async () => {
      if (!options.task.value) return
      const fromEvent = event?.currentTarget
      const anchor = fromEvent instanceof HTMLElement
        ? fromEvent
        : options.listPickerBtnRef.value
      if (!(await beginPopoverOpen('list'))) return
      popoverAnchorEl.value = anchor
      activePopover.value = 'list'
      popoverError.value = null
      updatePopoverPosition()
    })()
  }
  function openLabelPicker (event?: Event) {
    void (async () => {
      if (!options.task.value) return
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('labels'))) return
      labelSearchQuery.value = ''
      popoverAnchorEl.value = anchor
      activePopover.value = 'labels'
      popoverError.value = null
      updatePopoverPosition()
    })()
  }
  function openChecklistPicker (event?: Event) {
    void (async () => {
      if (!options.task.value) return
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('checklist-add'))) return
      options.checklistTitleDraft().value = ''
      popoverAnchorEl.value = anchor
      activePopover.value = 'checklist-add'
      popoverError.value = null
      updatePopoverPosition()
      schedulePopoverInputFocus(() => options.checklistTitleInputRef().value)
    })()
  }
  function openHierarchyPopover (event?: Event) {
    void (async () => {
      if (!options.task.value) return
      const anchor = capturePopoverAnchor(event)
      if (!(await beginPopoverOpen('hierarchy'))) return
      popoverAnchorEl.value = anchor
      activePopover.value = 'hierarchy'
      popoverError.value = null
      updatePopoverPosition()
    })()
  }
  async function openParentTaskPicker (event?: Event) {
    if (!options.task.value || options.parentSaving()) return
    const fromEvent = event?.currentTarget
    const anchor = fromEvent instanceof HTMLElement
      ? fromEvent
      : null
    if (!(await beginPopoverOpen('parent-task'))) return
    popoverAnchorEl.value = anchor
    activePopover.value = 'parent-task'
    popoverError.value = null
    updatePopoverPosition()
    if (options.parentTasks().value.length === 0 && !options.parentTasksLoading()) {
      await options.fetchParentTasks()
      if (activePopover.value === 'parent-task') {
        updatePopoverPosition()
      }
    }
  }

  return {
    activePopover,
    selectedMember,
    popoverError,
    popoverStyle,
    popoverAnchorEl,
    calendarCursor,
    pendingDate,
    labelSearchQuery,
    memberSearchQuery,
    resolvePopoverElement,
    resolveEffortInputEl,
    resolveProgressRateInputEl,
    memberEmailLine,
    openEffortPicker,
    openProgressRatePicker,
    finalizeEffortPopover,
    finalizeProgressRatePopover,
    dismissPopover,
    notifyPopoverAfterLeave,
    closePopover,
    beginPopoverOpen,
    updatePopoverPosition,
    onPopoverAfterEnter,
    openDatePicker,
    shiftCalendarMonth,
    pickCalendarDay,
    pickCalendarRange,
    openMemberPicker,
    openMemberDetail,
    removeMemberFromTask,
    isMemberAssigned,
    cleanupPopoverListeners,
    openListPicker,
    openLabelPicker,
    openChecklistPicker,
    openHierarchyPopover,
    openParentTaskPicker,
  }
}
