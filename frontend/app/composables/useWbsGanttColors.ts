import type { Ref } from 'vue'
import type { WbsTask } from './useWbsTaskGroups'
import {
  currentYearMonth,
  resolveGanttBarColor,
  resolveTaskDateRange,
  shiftVisibleMonth,
} from './useGanttCalendar'
import { ganttBarColorAtSequenceIndex } from '../constants/colorPresets'
import { useApi } from './useApi'
import { useWorkspaceBoardPageData } from './useWorkspaceBoardPageData'

function normalizeDateOnly (value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] ?? null
}

export function useWbsGanttColors (options: {
  orgSlug: MaybeRefOrGetter<string>
  workspaceId: MaybeRefOrGetter<string>
  tasks: Ref<WbsTask[]>
  error: Ref<string | null>
  persistWbsCache: () => void
  wbsScrollEl: Ref<HTMLElement | null>
}) {
  const { api } = useApi()
  const { patchCachedTasks } = useWorkspaceBoardPageData()

  /** 色未保存の既存バー向け表示色（applySnapshot 時にクリア） */
  const unsavedGanttBarColorByTaskId = new Map<number, string>()

  const initialMonth = currentYearMonth()
  const visibleYear = ref(initialMonth.year)
  const visibleMonth = ref(initialMonth.month)
  const colorPopoverOpen = ref(false)
  const colorPopoverAnchor = ref<{ top: number; left: number; right: number } | null>(null)
  const colorPopoverValue = ref('')
  const colorPopoverTaskId = ref<number | null>(null)
  const pendingGanttColorOpen = ref<{ taskId: number; clientX: number; clientY: number } | null>(null)
  const colorSaving = ref(false)
  const ganttDateSaving = ref(false)

  const canClearGanttColor = computed(() => {
    const taskId = colorPopoverTaskId.value
    if (taskId == null) return false
    const task = options.tasks.value.find(row => row.id === taskId)
    return Boolean(task?.gantt_bar_color?.trim())
  })

  function clearAllUnsavedGanttBarColors () {
    unsavedGanttBarColorByTaskId.clear()
  }

  /**
   * 色未保存の既存バー向け表示色。
   * 他バーの増減で再計算されないよう、タスク単位で一度決めた色を固定する。
   */
  function countSavedGanttBarColors (excludeTaskId?: number): number {
    let barCount = 0
    for (const task of options.tasks.value) {
      if (excludeTaskId != null && task.id === excludeTaskId) {
        continue
      }
      if (task.gantt_bar_color?.trim()) {
        barCount += 1
      }
    }
    return barCount
  }

  /** 既存の保存色＋固定済み未保存色の数から、次に自動割当する色を決める */
  function nextAutoGanttBarColor (excludeTaskId?: number): string {
    let barCount = countSavedGanttBarColors(excludeTaskId)
    for (const [taskId] of unsavedGanttBarColorByTaskId) {
      if (excludeTaskId != null && taskId === excludeTaskId) {
        continue
      }
      if (options.tasks.value.some(task => task.id === taskId && task.gantt_bar_color?.trim())) {
        continue
      }
      barCount += 1
    }
    return ganttBarColorAtSequenceIndex(barCount)
  }

  function clearUnsavedGanttBarColor (taskId: number) {
    unsavedGanttBarColorByTaskId.delete(taskId)
  }

  function resolveGanttColorForDateChange (
    task: WbsTask,
    nextStart: string | null,
    nextDue: string | null,
  ): { nextColor: string | null; colorChanged: boolean } {
    const prevColor = task.gantt_bar_color ?? null
    const shouldAssignColor = Boolean(nextStart && nextDue) && !task.gantt_bar_color?.trim()
    const shouldClearColor = !nextStart && !nextDue && Boolean(
      task.gantt_bar_color?.trim() || unsavedGanttBarColorByTaskId.has(task.id),
    )
    if (shouldAssignColor) {
      const nextColor = unsavedGanttBarColorByTaskId.get(task.id) ?? nextAutoGanttBarColor(task.id)
      clearUnsavedGanttBarColor(task.id)
      return { nextColor, colorChanged: true }
    }
    if (shouldClearColor) {
      clearUnsavedGanttBarColor(task.id)
      return { nextColor: null, colorChanged: Boolean(prevColor?.trim()) }
    }
    return { nextColor: prevColor, colorChanged: false }
  }

  function resolveTaskGanttBarColor (task: WbsTask): string {
    if (task.gantt_bar_color?.trim()) {
      clearUnsavedGanttBarColor(task.id)
      return resolveGanttBarColor(task)
    }
    // 新規作成プレビュー（日付なし）: 次の自動割当色（編集中バー自身のプレビューのみ）
    if (!resolveTaskDateRange(task)) {
      clearUnsavedGanttBarColor(task.id)
      return nextAutoGanttBarColor(task.id)
    }
    // 日付あり・色未保存: 初回に固定し、他バー編集では絶対に変えない
    const frozen = unsavedGanttBarColorByTaskId.get(task.id)
    if (frozen) {
      return frozen
    }
    const color = nextAutoGanttBarColor(task.id)
    unsavedGanttBarColorByTaskId.set(task.id, color)
    return color
  }

  async function commitGanttDateRange (taskId: number, start: string | null, end: string | null) {
    closeColorPopover()
    const idx = options.tasks.value.findIndex(task => task.id === taskId)
    if (idx < 0) {
      return
    }
    const current = options.tasks.value[idx]!
    const prevStart = current.start_date ?? null
    const prevDue = current.due_date ?? null
    const prevColor = current.gantt_bar_color ?? null
    const nextStart = start
    const nextDue = end
    if (
      normalizeDateOnly(prevStart) === nextStart
      && normalizeDateOnly(prevDue) === nextDue
    ) {
      return
    }
    const { nextColor, colorChanged } = resolveGanttColorForDateChange(current, nextStart, nextDue)
    // 編集対象タスク以外は tasks / cache / API のいずれも更新しない
    options.tasks.value[idx] = {
      ...current,
      start_date: nextStart,
      due_date: nextDue,
      ...(colorChanged ? { gantt_bar_color: nextColor } : {}),
    }
    const orgSlug = toValue(options.orgSlug)
    const workspaceId = toValue(options.workspaceId)
    patchCachedTasks(orgSlug, workspaceId, [{
      id: taskId,
      start_date: nextStart,
      due_date: nextDue,
      ...(colorChanged ? { gantt_bar_color: nextColor } : {}),
    }])
    options.persistWbsCache()
    ganttDateSaving.value = true
    options.error.value = null
    try {
      await api(
        `/orgs/${orgSlug}/workspaces/${workspaceId}/tasks/${taskId}`,
        {
          method: 'PATCH',
          body: {
            start_date: nextStart,
            due_date: nextDue,
            ...(colorChanged ? { gantt_bar_color: nextColor } : {}),
          },
        },
      )
    } catch (e: unknown) {
      options.tasks.value[idx] = {
        ...options.tasks.value[idx]!,
        start_date: prevStart,
        due_date: prevDue,
        gantt_bar_color: prevColor,
      }
      patchCachedTasks(orgSlug, workspaceId, [{
        id: taskId,
        start_date: prevStart,
        due_date: prevDue,
        gantt_bar_color: prevColor,
      }])
      options.persistWbsCache()
      options.error.value = e instanceof Error ? e.message : 'ガントバーの日付更新に失敗しました'
    } finally {
      ganttDateSaving.value = false
    }
  }

  async function applyVisibleMonth (year: number, month: number) {
    const scroller = options.wbsScrollEl.value
    const scrollLeft = scroller?.scrollLeft ?? 0
    const scrollTop = scroller?.scrollTop ?? 0
    visibleYear.value = year
    visibleMonth.value = month
    await nextTick()
    if (!scroller) {
      return
    }
    scroller.scrollLeft = scrollLeft
    scroller.scrollTop = scrollTop
  }

  function goPrevMonth () {
    const next = shiftVisibleMonth(visibleYear.value, visibleMonth.value, -1)
    void applyVisibleMonth(next.year, next.month)
  }

  function goNextMonth () {
    const next = shiftVisibleMonth(visibleYear.value, visibleMonth.value, 1)
    void applyVisibleMonth(next.year, next.month)
  }

  function goCurrentMonth () {
    const now = currentYearMonth()
    void applyVisibleMonth(now.year, now.month)
  }

  function openGanttColorPopover (taskId: number, clientX: number, clientY: number) {
    const task = options.tasks.value.find(row => row.id === taskId)
    if (!task || !resolveTaskDateRange(task)) {
      return
    }
    if (colorPopoverOpen.value && colorPopoverTaskId.value === taskId) {
      pendingGanttColorOpen.value = null
      closeColorPopover()
      return
    }
    if (colorPopoverOpen.value) {
      pendingGanttColorOpen.value = { taskId, clientX, clientY }
      colorPopoverOpen.value = false
      return
    }
    applyGanttColorPopoverOpen(taskId, clientX, clientY)
  }

  function applyGanttColorPopoverOpen (taskId: number, clientX: number, clientY: number) {
    const task = options.tasks.value.find(row => row.id === taskId)
    if (!task || !resolveTaskDateRange(task)) {
      return
    }
    colorPopoverTaskId.value = taskId
    colorPopoverValue.value = resolveTaskGanttBarColor(task)
    colorPopoverAnchor.value = {
      top: clientY,
      left: clientX,
      right: clientX,
    }
    colorPopoverOpen.value = true
  }

  function closeColorPopover () {
    pendingGanttColorOpen.value = null
    colorPopoverOpen.value = false
  }

  function onColorPopoverAfterLeave () {
    if (!colorPopoverOpen.value) {
      colorPopoverAnchor.value = null
      colorPopoverTaskId.value = null
    }
    const pending = pendingGanttColorOpen.value
    if (!pending) {
      return
    }
    pendingGanttColorOpen.value = null
    applyGanttColorPopoverOpen(pending.taskId, pending.clientX, pending.clientY)
  }

  function syncTaskGanttColor (taskId: number, color: string) {
    const idx = options.tasks.value.findIndex(task => task.id === taskId)
    if (idx < 0) {
      return
    }
    clearUnsavedGanttBarColor(taskId)
    // 色ピッカー対象の1タスクのみ更新する
    options.tasks.value[idx] = {
      ...options.tasks.value[idx]!,
      gantt_bar_color: color,
    }
    const orgSlug = toValue(options.orgSlug)
    const workspaceId = toValue(options.workspaceId)
    patchCachedTasks(orgSlug, workspaceId, [{
      id: taskId,
      gantt_bar_color: color,
    }])
    options.persistWbsCache()
  }

  async function saveGanttBarColor (color: string) {
    const taskId = colorPopoverTaskId.value
    if (taskId == null || colorSaving.value) {
      return
    }
    colorPopoverValue.value = color
    colorSaving.value = true
    options.error.value = null
    const orgSlug = toValue(options.orgSlug)
    const workspaceId = toValue(options.workspaceId)
    try {
      await api(
        `/orgs/${orgSlug}/workspaces/${workspaceId}/tasks/${taskId}`,
        { method: 'PATCH', body: { gantt_bar_color: color } },
      )
      syncTaskGanttColor(taskId, color)
      closeColorPopover()
    } catch (e: unknown) {
      options.error.value = e instanceof Error ? e.message : 'ガントバーの色の更新に失敗しました'
    } finally {
      colorSaving.value = false
    }
  }

  async function clearGanttBarColor () {
    const taskId = colorPopoverTaskId.value
    if (taskId == null || colorSaving.value) {
      return
    }
    const task = options.tasks.value.find(row => row.id === taskId)
    if (!task?.gantt_bar_color?.trim()) {
      return
    }
    colorSaving.value = true
    options.error.value = null
    const orgSlug = toValue(options.orgSlug)
    const workspaceId = toValue(options.workspaceId)
    try {
      await api(
        `/orgs/${orgSlug}/workspaces/${workspaceId}/tasks/${taskId}`,
        { method: 'PATCH', body: { gantt_bar_color: null } },
      )
      clearUnsavedGanttBarColor(taskId)
      const idx = options.tasks.value.findIndex(row => row.id === taskId)
      if (idx >= 0) {
        options.tasks.value[idx] = {
          ...options.tasks.value[idx]!,
          gantt_bar_color: null,
        }
        patchCachedTasks(orgSlug, workspaceId, [{
          id: taskId,
          gantt_bar_color: null,
        }])
        options.persistWbsCache()
        colorPopoverValue.value = resolveTaskGanttBarColor(options.tasks.value[idx]!)
      }
    } catch (e: unknown) {
      options.error.value = e instanceof Error ? e.message : 'ガントバーの色の更新に失敗しました'
    } finally {
      colorSaving.value = false
    }
  }

  return {
    visibleYear,
    visibleMonth,
    colorPopoverOpen,
    colorPopoverAnchor,
    colorPopoverValue,
    colorPopoverTaskId,
    colorSaving,
    canClearGanttColor,
    ganttDateSaving,
    clearAllUnsavedGanttBarColors,
    countSavedGanttBarColors,
    nextAutoGanttBarColor,
    clearUnsavedGanttBarColor,
    resolveGanttColorForDateChange,
    resolveTaskGanttBarColor,
    commitGanttDateRange,
    applyVisibleMonth,
    goPrevMonth,
    goNextMonth,
    goCurrentMonth,
    openGanttColorPopover,
    applyGanttColorPopoverOpen,
    closeColorPopover,
    onColorPopoverAfterLeave,
    syncTaskGanttColor,
    saveGanttBarColor,
    clearGanttBarColor,
  }
}
