import type { Ref } from 'vue'
import type { WbsTask, WbsReorderSnapshot } from './useWbsTaskGroups'
import type { TaskPopoverEditable } from './useTaskPopoverEditor'
import { taskApiPath } from '../utils/apiPaths'
import { useApi } from './useApi'
import { useWorkspaceBoardPageData } from './useWorkspaceBoardPageData'
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard'
import { caretIndexAtClientX } from '../utils/inputCaretFromPoint'

function cloneWbsTasks (source: WbsTask[]): WbsTask[] {
  try {
    return structuredClone(toRaw(source)) as WbsTask[]
  } catch {
    // Proxy などが混ざると structuredClone が失敗することがある
    return JSON.parse(JSON.stringify(toRaw(source))) as WbsTask[]
  }
}

function normalizeDateOnly (value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] ?? null
}

function sameIdList (a: number[], b: number[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

function normalizeEffortForDiff (value: WbsTask['effort_hours']): number | null {
  if (value == null || value === '') {
    return null
  }
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeProgressRateForDiff (value: WbsTask['progress_rate']): number | null {
  if (value == null || value === '') {
    return null
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 100) {
    return null
  }
  return n
}

function serializeTaskForSessionDiff (task: WbsTask) {
  const description = (task.description ?? '').trim()
  return {
    id: task.id,
    title: (task.title ?? '').trim(),
    description: description === '' ? null : description,
    list_id: task.list_id ?? null,
    start_date: normalizeDateOnly(task.start_date),
    due_date: normalizeDateOnly(task.due_date),
    effort_hours: normalizeEffortForDiff(task.effort_hours),
    progress_rate: normalizeProgressRateForDiff(task.progress_rate),
    gantt_bar_color: task.gantt_bar_color?.trim().toLowerCase() || null,
    sort_order: task.sort_order ?? 0,
    parent_task_id: task.parent_task_id ?? null,
    is_parent_task: Boolean(task.is_parent_task),
    assignee_ids: (task.assignees ?? []).map(member => member.id).sort((a, b) => a - b),
    label_ids: (task.labels ?? []).map(label => label.id).sort((a, b) => a - b),
  }
}

export function buildFieldRevertPatch (
  current: WbsTask,
  snapshot: WbsTask,
): Record<string, unknown> | null {
  const body: Record<string, unknown> = {}
  if (current.title !== snapshot.title) {
    body.title = snapshot.title
  }
  if ((current.description ?? null) !== (snapshot.description ?? null)) {
    body.description = snapshot.description ?? null
  }
  if ((current.list_id ?? null) !== (snapshot.list_id ?? null) && snapshot.list_id != null) {
    body.list_id = snapshot.list_id
  }
  if (normalizeDateOnly(current.start_date) !== normalizeDateOnly(snapshot.start_date)) {
    body.start_date = snapshot.start_date ?? null
  }
  if (normalizeDateOnly(current.due_date) !== normalizeDateOnly(snapshot.due_date)) {
    body.due_date = snapshot.due_date ?? null
  }
  if ((current.effort_hours ?? null) !== (snapshot.effort_hours ?? null)) {
    body.effort_hours = snapshot.effort_hours ?? null
  }
  if ((current.progress_rate ?? null) !== (snapshot.progress_rate ?? null)) {
    body.progress_rate = snapshot.progress_rate ?? null
  }
  const currentColor = current.gantt_bar_color?.trim() || null
  const snapshotColor = snapshot.gantt_bar_color?.trim() || null
  if (currentColor !== snapshotColor) {
    body.gantt_bar_color = snapshot.gantt_bar_color ?? null
  }
  const currentAssigneeIds = (current.assignees ?? []).map(member => member.id).sort((a, b) => a - b)
  const snapshotAssigneeIds = (snapshot.assignees ?? []).map(member => member.id).sort((a, b) => a - b)
  if (!sameIdList(currentAssigneeIds, snapshotAssigneeIds)) {
    body.assignee_ids = snapshotAssigneeIds
  }
  const currentLabelIds = (current.labels ?? []).map(label => label.id).sort((a, b) => a - b)
  const snapshotLabelIds = (snapshot.labels ?? []).map(label => label.id).sort((a, b) => a - b)
  if (!sameIdList(currentLabelIds, snapshotLabelIds)) {
    body.label_ids = snapshotLabelIds
  }
  if ((current.parent_task_id ?? null) !== (snapshot.parent_task_id ?? null)) {
    body.parent_task_id = snapshot.parent_task_id ?? null
  }
  if (Boolean(current.is_parent_task) !== Boolean(snapshot.is_parent_task)) {
    body.is_parent_task = Boolean(snapshot.is_parent_task)
  }
  return Object.keys(body).length > 0 ? body : null
}

export function useWbsEditSession (options: {
  editMode: Ref<boolean>
  tasks: Ref<WbsTask[]>
  collapsedParentIds: Ref<Set<number>>
  error: Ref<string | null>
  orgSlug: MaybeRefOrGetter<string>
  workspaceId: MaybeRefOrGetter<string>
  dismissEditInteractions: () => void
  persistAndDismissEditInteractions: () => Promise<void>
  persistWbsCache: () => void
  saveWbsOrder: (updatedTasks: WbsTask[]) => Promise<boolean>
  closeTaskMenu: () => void
  syncTaskUpdate: (updated: TaskPopoverEditable) => void
}) {
  const { api } = useApi()
  const { patchCachedTasks } = useWorkspaceBoardPageData()
  const editMode = options.editMode
  const editSaving = ref(false)
  const reorderSnapshot = ref<WbsReorderSnapshot | null>(null)
  const editingTitleTaskId = ref<number | null>(null)
  const titleDraft = ref('')
  const titleSaving = ref(false)
  /** blur が focus 直後に走って入力モードが即座に閉じるのを防ぐ */
  let titleEditOpening = false
  const titleInputEls = new Map<number, HTMLInputElement>()

  /** 編集中に即時 PATCH した項目を、セッション開始時の内容へサーバー側でも戻す */
  async function revertSessionFieldChangesToSnapshot (
    currentTasks: WbsTask[],
    snapshotTasks: WbsTask[],
  ): Promise<void> {
    const orgSlug = toValue(options.orgSlug)
    const workspaceId = toValue(options.workspaceId)
    const snapById = new Map(snapshotTasks.map(task => [task.id, task]))
    const requests: Promise<unknown>[] = []
    for (const current of currentTasks) {
      const snapshot = snapById.get(current.id)
      if (!snapshot) {
        continue
      }
      const body = buildFieldRevertPatch(current, snapshot)
      if (!body) {
        continue
      }
      requests.push(
        api(
          taskApiPath(orgSlug, workspaceId, current.id),
          { method: 'PATCH', body },
        ),
      )
    }
    if (requests.length === 0) {
      return
    }
    await Promise.all(requests)
  }

  function beginEditSession () {
    options.dismissEditInteractions()
    if (!reorderSnapshot.value) {
      try {
        reorderSnapshot.value = {
          tasks: cloneWbsTasks(options.tasks.value),
          collapsedParentIds: new Set(options.collapsedParentIds.value),
        }
      } catch (e: unknown) {
        options.error.value = e instanceof Error ? e.message : '編集の開始に失敗しました'
        reorderSnapshot.value = {
          tasks: options.tasks.value.map(task => ({ ...task })),
          collapsedParentIds: new Set(options.collapsedParentIds.value),
        }
      }
    }
    options.collapsedParentIds.value = new Set()
  }

  function startEdit (): boolean {
    if (options.tasks.value.length === 0) {
      editMode.value = false
      return false
    }
    // ヘッダー表示と実編集状態を同時に立てる（watch だけに依存しない）
    if (!editMode.value || !reorderSnapshot.value) {
      beginEditSession()
    }
    editMode.value = true
    return true
  }

  async function abandonEditSession (opts?: { restoreFields?: boolean }): Promise<boolean> {
    const snapshot = reorderSnapshot.value
    if (!snapshot) {
      editMode.value = false
      return true
    }
    const currentTasks = cloneWbsTasks(options.tasks.value)
    const restoreFields = opts?.restoreFields !== false
    editSaving.value = true
    options.error.value = null
    const orgSlug = toValue(options.orgSlug)
    const workspaceId = toValue(options.workspaceId)
    try {
      if (restoreFields) {
        await revertSessionFieldChangesToSnapshot(currentTasks, snapshot.tasks)
      }
      options.tasks.value = cloneWbsTasks(snapshot.tasks)
      options.collapsedParentIds.value = new Set(snapshot.collapsedParentIds)
      patchCachedTasks(
        orgSlug,
        workspaceId,
        snapshot.tasks.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description ?? null,
          list_id: task.list_id ?? null,
          sort_order: task.sort_order,
          parent_task_id: task.parent_task_id ?? null,
          is_parent_task: Boolean(task.is_parent_task),
          start_date: task.start_date ?? null,
          due_date: task.due_date ?? null,
          gantt_bar_color: task.gantt_bar_color ?? null,
          effort_hours: task.effort_hours ?? null,
          progress_rate: task.progress_rate ?? null,
          labels: task.labels,
          assignees: task.assignees,
        })),
      )
      options.persistWbsCache()
      reorderSnapshot.value = null
      editMode.value = false
      return true
    } catch (e: unknown) {
      options.error.value = e instanceof Error ? e.message : '変更の破棄に失敗しました'
      return false
    } finally {
      editSaving.value = false
    }
  }

  async function cancelEdit (): Promise<boolean> {
    if (!editMode.value || editSaving.value) {
      return false
    }
    options.dismissEditInteractions()
    return abandonEditSession({ restoreFields: true })
  }

  async function confirmEdit (): Promise<boolean> {
    if (!editMode.value || editSaving.value) {
      return false
    }
    await options.persistAndDismissEditInteractions()
    editSaving.value = true
    options.error.value = null
    try {
      const ok = await options.saveWbsOrder(options.tasks.value)
      if (!ok) {
        reorderSnapshot.value = null
        editMode.value = false
        return false
      }
      const snapshot = reorderSnapshot.value
      if (snapshot) {
        options.collapsedParentIds.value = new Set(snapshot.collapsedParentIds)
      }
      reorderSnapshot.value = null
      editMode.value = false
      return true
    } finally {
      editSaving.value = false
    }
  }

  function hasSessionDiffFromSnapshot (): boolean {
    if (!reorderSnapshot.value) {
      return false
    }
    const current = options.tasks.value
      .map(serializeTaskForSessionDiff)
      .sort((a, b) => a.id - b.id)
    const snapshot = reorderSnapshot.value.tasks
      .map(serializeTaskForSessionDiff)
      .sort((a, b) => a.id - b.id)
    if (current.length !== snapshot.length) {
      return true
    }
    return JSON.stringify(current) !== JSON.stringify(snapshot)
  }

  function isTitleDraftDirty (): boolean {
    if (editingTitleTaskId.value == null) {
      return false
    }
    const task = options.tasks.value.find(row => row.id === editingTitleTaskId.value)
    if (!task) {
      return false
    }
    return titleDraft.value.trim() !== task.title
  }

  function setTitleInputEl (taskId: number, el: unknown) {
    if (el instanceof HTMLInputElement) {
      titleInputEls.set(taskId, el)
      return
    }
    titleInputEls.delete(taskId)
  }

  async function startTitleEdit (task: WbsTask, opts?: { clientX?: number }) {
    options.closeTaskMenu()
    titleEditOpening = true
    editingTitleTaskId.value = task.id
    titleDraft.value = task.title
    await nextTick()
    const el = titleInputEls.get(task.id)
    if (el) {
      el.focus({ preventScroll: true })
      if (opts?.clientX != null) {
        const index = caretIndexAtClientX(el, opts.clientX)
        el.setSelectionRange(index, index)
      } else {
        const len = el.value.length
        el.setSelectionRange(len, len)
      }
    }
    requestAnimationFrame(() => {
      titleEditOpening = false
    })
  }

  function onTitleFieldActivate (task: WbsTask, event?: Event) {
    if (!editMode.value || editingTitleTaskId.value === task.id) {
      return
    }
    if (event instanceof MouseEvent && event.button !== 0) {
      return
    }
    if (event?.target instanceof Element && event.target.closest('.workspace-wbs__toggle, .workspace-wbs__drag-handle, .workspace-wbs__task-menu')) {
      return
    }
    // click（ドラッグなし）でのみ入力開始。pointerdown だと画面ドラッグスクロールできない
    const clientX = event instanceof MouseEvent ? event.clientX : undefined
    void startTitleEdit(task, { clientX })
  }

  function onTitleCellMouseDown (task: WbsTask, event: MouseEvent) {
    if (editingTitleTaskId.value !== task.id) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('.workspace-wbs__title-input')) return
    if (target.closest('.workspace-wbs__toggle, .workspace-wbs__drag-handle, .workspace-wbs__task-menu')) return
    event.preventDefault()
  }

  function cancelTitleEdit () {
    titleEditOpening = false
    editingTitleTaskId.value = null
    titleDraft.value = ''
  }

  async function confirmTitleEdit (task: WbsTask) {
    if (titleEditOpening || titleSaving.value || editingTitleTaskId.value !== task.id) return
    const title = titleDraft.value.trim()
    if (!title || title === task.title) {
      cancelTitleEdit()
      return
    }
    titleSaving.value = true
    try {
      const orgSlug = toValue(options.orgSlug)
      const workspaceId = toValue(options.workspaceId)
      await api<{ title: string }>(
        taskApiPath(orgSlug, workspaceId, task.id),
        { method: 'PATCH', body: { title } },
      )
      options.syncTaskUpdate({ ...task, title })
      cancelTitleEdit()
    } catch (e: unknown) {
      options.error.value = e instanceof Error ? e.message : 'タスク名の更新に失敗しました'
    } finally {
      titleSaving.value = false
    }
  }

  /**
   * 編集開始時スナップショットと実データが違うときだけ未保存。
   * 一度変えても元に戻せば false（確認モーダルなし）。
   */
  const hasUnsavedChanges = computed(() => {
    if (!editMode.value) {
      return false
    }
    if (editSaving.value) {
      return true
    }
    if (isTitleDraftDirty()) {
      return true
    }
    return hasSessionDiffFromSnapshot()
  })

  const {
    leaveModalOpen,
    leaveDiscarding,
    confirmDiscardAndLeave,
  } = useUnsavedChangesGuard({
    isDirty: () => hasUnsavedChanges.value,
    onDiscard: async () => {
      const ok = await cancelEdit()
      if (!ok) {
        throw new Error('変更の破棄に失敗しました')
      }
    },
  })

  watch(editMode, (active, wasActive) => {
    if (active && !wasActive) {
      // 親が true にしただけで startEdit を経由しない場合でもセッションを張る
      if (options.tasks.value.length === 0) {
        editMode.value = false
        return
      }
      if (!reorderSnapshot.value) {
        beginEditSession()
      }
      return
    }
    if (!active && wasActive) {
      options.dismissEditInteractions()
      // cancelEdit / confirmEdit 経由なら snapshot は既に null
      if (reorderSnapshot.value && !editSaving.value) {
        void abandonEditSession({ restoreFields: true })
      }
    }
  })

  onDeactivated(() => {
    if (editSaving.value) {
      return
    }
    if (!editMode.value) {
      return
    }
    // ガード通過後の安全策（未保存なら破棄）
    void cancelEdit()
  })

  function resetEditState () {
    // snapshot を先に消す（editMode false の watch が abandon/revert しないように）
    reorderSnapshot.value = null
    editSaving.value = false
    editMode.value = false
    cancelTitleEdit()
  }

  return {
    editSaving,
    reorderSnapshot,
    beginEditSession,
    startEdit,
    cancelEdit,
    confirmEdit,
    abandonEditSession,
    buildFieldRevertPatch,
    revertSessionFieldChangesToSnapshot,
    hasSessionDiffFromSnapshot,
    hasUnsavedChanges,
    leaveModalOpen,
    leaveDiscarding,
    confirmDiscardAndLeave,
    resetEditState,
    cloneWbsTasks,
    editingTitleTaskId,
    titleDraft,
    titleSaving,
    setTitleInputEl,
    startTitleEdit,
    onTitleFieldActivate,
    onTitleCellMouseDown,
    cancelTitleEdit,
    confirmTitleEdit,
  }
}
