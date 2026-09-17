import type { Ref } from 'vue'
import type { WbsTask } from './useWbsTaskGroups'
import type { TaskFormDefaultsSource, TaskFormLabel } from './useTaskFormHelpers'
import type { WorkspaceListOption } from './useTaskPopoverEditor'
import type { TaskPopoverEditable } from './useTaskPopoverEditor'
import { resolveAndSortLabels } from './useLabelCategories'
import { sortMembersByDisplayName } from './useMemberDisplay'
import { useApi } from './useApi'
import { useArchivedTasksCache } from './useArchivedTasksCache'
import {
  useWorkspaceBoardPageData,
  type WorkspaceBoardTask,
} from './useWorkspaceBoardPageData'
import { withAppLoadingCursor } from './useAppLoadingCursor'
import { buildDestructiveConfirmMessage } from '../utils/destructiveConfirmMessage'
import { enrichTaskDetailHierarchy } from './useTaskHierarchy'
import { resolveParentTaskTitle } from './useTaskCardMeta'
import { useDropdownEscapeClose } from './useDropdownEscapeClose'
import type { AddedTask } from './useTaskAddModal'
import type { TaskDetail } from '../components/modals/TaskDetailModal.vue'
import type { FloatingMenuItem } from '../components/ui/FloatingMenu.vue'

type WbsReorderSnapshot = {
  tasks: WbsTask[]
  collapsedParentIds: Set<number>
}

export function useWbsTaskActions (options: {
  orgSlug: MaybeRefOrGetter<string>
  workspaceId: MaybeRefOrGetter<string>
  tasks: Ref<WbsTask[]>
  editMode: MaybeRefOrGetter<boolean>
  loading: MaybeRefOrGetter<boolean>
  editSaving: MaybeRefOrGetter<boolean>
  error: Ref<string | null>
  orgLabels: Ref<TaskFormLabel[]>
  workspaceLists: Ref<WorkspaceListOption[]>
  isOrgAdmin: MaybeRefOrGetter<boolean>
  collapsedParentIds: Ref<Set<number>>
  reorderSnapshot: Ref<WbsReorderSnapshot | null>
  cloneWbsTasks: (source: WbsTask[]) => WbsTask[]
  persistWbsCache: () => void
  bumpLoadGeneration: () => void
  removeRealtimeWbsTask: (taskId: number) => void
  syncTaskUpdate: (updated: TaskPopoverEditable) => void
  dismissEditInteractions: () => void
  closeTaskMenu: () => void
  toggleTaskMenuState: (taskId: number, event: MouseEvent) => void
  openMenuTaskId: Ref<number | null>
}) {
  const { api } = useApi()
  const { upsertCachedTask: upsertArchivedTask } = useArchivedTasksCache()
  const {
    getCached: getBoardCached,
    replaceCachedBoardState,
  } = useWorkspaceBoardPageData()

  /** 詳細→追加のフェードアウト時間（TaskDetailModal.scss の leave と揃える） */
  const MODAL_FADE_OUT_MS = 120

  const taskAddOpen = ref(false)
  const taskAddListId = ref<number | null>(null)
  const taskAddParentTaskId = ref<number | null>(null)
  const taskAddParentDefaults = ref<TaskFormDefaultsSource | null>(null)
  const addChildTaskTransitionPending = ref(false)
  const detailTaskId = ref<number | null>(null)
  const archiveConfirmTask = ref<WbsTask | null>(null)
  const archivePending = ref(false)

  const taskDetailOpen = computed({
    get: () => detailTaskId.value !== null,
    set: (open: boolean) => {
      if (!open) {
        detailTaskId.value = null
      }
    },
  })
  const archiveConfirmOpen = computed({
    get: () => archiveConfirmTask.value !== null,
    set: (open: boolean) => {
      if (!open) {
        archiveConfirmTask.value = null
      }
    },
  })
  const archiveConfirmMessage = computed(() => {
    const task = archiveConfirmTask.value
    if (!task) return ''
    const childCount = options.tasks.value.filter(row => row.parent_task_id === task.id).length
    return buildDestructiveConfirmMessage(
      'タスク',
      'アーカイブ',
      task.title,
      childCount > 0 ? `※子タスク ${childCount} 件もアーカイブされます。` : null,
    )
  })
  const taskMenuItems = computed<FloatingMenuItem[]>(() => {
    const items: FloatingMenuItem[] = [
      { key: 'detail', label: 'タスク詳細' },
    ]
    if (toValue(options.isOrgAdmin)) {
      items.push({ key: 'archive', label: 'タスクのアーカイブ', danger: true })
    }
    return items
  })
  const openMenuTask = computed(() => {
    const id = options.openMenuTaskId.value
    if (id == null) {
      return null
    }
    return options.tasks.value.find(task => task.id === id) ?? null
  })

  function wbsTaskToTaskDetail (task: WbsTask): TaskDetail {
    return {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      list_id: task.list_id,
      sort_order: task.sort_order,
      start_date: task.start_date ?? null,
      due_date: task.due_date ?? null,
      effort_hours: task.effort_hours ?? null,
      progress_rate: task.progress_rate ?? null,
      assignees: sortMembersByDisplayName(task.assignees ?? []),
      labels: resolveAndSortLabels(task.labels, options.orgLabels.value),
      checklists: task.checklists ?? [],
      is_parent_task: Boolean(task.is_parent_task),
      parent_task_id: task.parent_task_id ?? null,
    }
  }

  const detailInitialTask = computed((): TaskDetail | null => {
    const id = detailTaskId.value
    if (id === null) {
      return null
    }
    const row = options.tasks.value.find(task => task.id === id)
    if (!row) {
      return null
    }
    return enrichTaskDetailHierarchy(
      wbsTaskToTaskDetail(row),
      options.tasks.value,
      listId => options.workspaceLists.value.find(list => list.id === listId)?.name ?? null,
    )
  })
  const detailHierarchyTasks = computed(() => options.tasks.value.map(task => ({
    id: task.id,
    title: task.title,
    parent_task_id: task.parent_task_id ?? null,
    parent_task_title: resolveParentTaskTitle(task, options.tasks.value),
    is_parent_task: Boolean(task.is_parent_task),
    start_date: task.start_date ?? null,
    due_date: task.due_date ?? null,
    effort_hours: task.effort_hours ?? null,
    progress_rate: task.progress_rate ?? null,
    labels: task.labels ?? [],
    assignees: task.assignees ?? [],
    list_id: task.list_id,
    list_name: task.list_name ?? options.workspaceLists.value.find(list => list.id === task.list_id)?.name ?? null,
    list_color: options.workspaceLists.value.find(list => list.id === task.list_id)?.color ?? null,
    sort_order: task.sort_order,
  })))
  const detailParentTasks = computed(() => options.tasks.value
    .filter(task => task.is_parent_task)
    .map(task => ({ id: task.id, title: task.title })))

  function defaultTaskAddListId (): number | null {
    return options.workspaceLists.value[0]?.id ?? null
  }

  function openTaskAdd () {
    if (toValue(options.loading) || toValue(options.editSaving)) {
      return
    }
    options.dismissEditInteractions()
    taskAddListId.value = defaultTaskAddListId()
    taskAddParentTaskId.value = null
    taskAddParentDefaults.value = null
    taskAddOpen.value = true
  }

  async function onAddChildTaskFromDetail (payload: { parentTaskId: number; listId: number | null }) {
    if (toValue(options.loading) || toValue(options.editSaving) || addChildTaskTransitionPending.value) {
      return
    }
    const listId = payload.listId ?? defaultTaskAddListId()
    if (listId === null) {
      return
    }
    addChildTaskTransitionPending.value = true
    options.dismissEditInteractions()
    taskDetailOpen.value = false
    const fadeOutDone = new Promise<void>((resolve) => {
      window.setTimeout(resolve, MODAL_FADE_OUT_MS)
    })
    let defaults: TaskFormDefaultsSource | null = null
    try {
      const orgSlug = toValue(options.orgSlug)
      const workspaceId = toValue(options.workspaceId)
      const [detail] = await Promise.all([
        api<TaskFormDefaultsSource>(
          `/orgs/${orgSlug}/workspaces/${workspaceId}/tasks/${payload.parentTaskId}`,
        ),
        fadeOutDone,
      ])
      defaults = detail
    } catch {
      await fadeOutDone
      defaults = null
    }
    taskAddListId.value = listId
    taskAddParentTaskId.value = payload.parentTaskId
    taskAddParentDefaults.value = defaults
    taskAddOpen.value = true
    addChildTaskTransitionPending.value = false
  }

  function addedTaskToWbsTask (added: AddedTask): WbsTask {
    const listId = added.list_id ?? null
    return {
      id: added.id,
      title: added.title,
      description: added.description ?? null,
      created_at: added.created_at ?? null,
      list_id: listId,
      list_name: options.workspaceLists.value.find(list => list.id === listId)?.name ?? null,
      start_date: added.start_date ?? null,
      due_date: added.due_date ?? null,
      effort_hours: added.effort_hours ?? null,
      progress_rate: added.progress_rate ?? null,
      assignees: sortMembersByDisplayName(added.assignees ?? []),
      labels: added.labels ? resolveAndSortLabels(added.labels, options.orgLabels.value) : [],
      sort_order: added.sort_order,
      is_parent_task: added.is_parent_task,
      parent_task_id: added.parent_task_id ?? null,
    }
  }

  function addedTaskToBoardTask (added: AddedTask): WorkspaceBoardTask {
    return {
      id: added.id,
      title: added.title,
      description: added.description ?? null,
      list_id: added.list_id ?? null,
      is_parent_task: added.is_parent_task,
      parent_task_id: added.parent_task_id ?? null,
      sort_order: added.sort_order,
      start_date: added.start_date ?? null,
      due_date: added.due_date ?? null,
      effort_hours: added.effort_hours ?? null,
      progress_rate: added.progress_rate ?? null,
      assignees: sortMembersByDisplayName(added.assignees ?? []),
      labels: added.labels ? resolveAndSortLabels(added.labels, options.orgLabels.value) : [],
    }
  }

  function syncBoardCacheAfterAdd (added: AddedTask) {
    const orgSlug = toValue(options.orgSlug)
    const workspaceId = toValue(options.workspaceId)
    const cached = getBoardCached(orgSlug, workspaceId)
    if (!cached) {
      return
    }
    const boardTask = addedTaskToBoardTask(added)
    replaceCachedBoardState(orgSlug, workspaceId, {
      tasks: [...cached.tasks, boardTask],
      parentTasks: added.is_parent_task
        ? [...cached.parentTasks, { id: added.id, title: added.title }]
        : cached.parentTasks,
    })
  }

  function onTaskAddedFromModal (added: AddedTask) {
    // 作成前に開始した silent reload が古い一覧で上書きしないように無効化する
    options.bumpLoadGeneration()
    const wbsTask = addedTaskToWbsTask(added)
    const exists = options.tasks.value.some(task => task.id === wbsTask.id)
    if (!exists) {
      options.tasks.value = [...options.tasks.value, wbsTask]
    }
    if (options.reorderSnapshot.value) {
      const snapExists = options.reorderSnapshot.value.tasks.some(task => task.id === wbsTask.id)
      if (!snapExists) {
        options.reorderSnapshot.value = {
          ...options.reorderSnapshot.value,
          tasks: [...options.reorderSnapshot.value.tasks, options.cloneWbsTasks([wbsTask])[0]!],
        }
      }
    }
    options.persistWbsCache()
    syncBoardCacheAfterAdd(added)
  }

  function toggleParentCollapse (parentId: number) {
    if (toValue(options.editMode)) {
      return
    }
    options.closeTaskMenu()
    const next = new Set(options.collapsedParentIds.value)
    if (next.has(parentId)) {
      next.delete(parentId)
    } else {
      next.add(parentId)
    }
    options.collapsedParentIds.value = next
  }

  function toggleTaskMenu (task: WbsTask, event: MouseEvent) {
    event.stopPropagation()
    event.preventDefault()
    options.toggleTaskMenuState(task.id, event)
  }

  const taskMenuOpen = computed({
    get: () => options.openMenuTaskId.value !== null,
    set: (open: boolean) => {
      if (!open) {
        options.closeTaskMenu()
      }
    },
  })
  useDropdownEscapeClose(taskMenuOpen, options.closeTaskMenu)

  function onTaskMenuSelect (item: FloatingMenuItem) {
    const task = openMenuTask.value
    if (!task) {
      return
    }
    if (item.key === 'detail') {
      openTaskDetail(task)
      return
    }
    if (item.key === 'archive') {
      openArchiveConfirm(task)
    }
  }

  function openTaskDetail (task: WbsTask) {
    options.closeTaskMenu()
    detailTaskId.value = task.id
  }

  function onTaskDetailNavigate (taskId: number) {
    if (detailTaskId.value === taskId) {
      return
    }
    detailTaskId.value = taskId
  }

  function onTaskDetailMissing () {
    detailTaskId.value = null
    void navigateTo(`/org/${toValue(options.orgSlug)}/workspaces`, { replace: true })
  }

  function onTaskDetailUpdated (detail: TaskDetail) {
    const listName = options.workspaceLists.value.find(list => list.id === detail.list_id)?.name ?? null
    options.syncTaskUpdate({
      id: detail.id,
      title: detail.title,
      description: detail.description ?? null,
      list_id: detail.list_id,
      list_name: listName,
      start_date: detail.start_date ?? null,
      due_date: detail.due_date ?? null,
      effort_hours: detail.effort_hours ?? null,
      progress_rate: detail.progress_rate ?? null,
      labels: detail.labels ?? [],
      assignees: detail.assignees ?? [],
    })
    const idx = options.tasks.value.findIndex(task => task.id === detail.id)
    if (idx < 0) {
      return
    }
    const current = options.tasks.value[idx]!
    const nextParentId = 'parent_task_id' in detail ? detail.parent_task_id ?? null : current.parent_task_id
    const nextIsParent = 'is_parent_task' in detail ? detail.is_parent_task ?? false : current.is_parent_task
    options.tasks.value[idx] = {
      ...current,
      parent_task_id: nextParentId,
      is_parent_task: nextIsParent,
      checklists: detail.checklists ?? current.checklists,
    }
    options.persistWbsCache()
  }

  function openArchiveConfirm (task: WbsTask) {
    options.closeTaskMenu()
    archiveConfirmTask.value = task
  }

  async function confirmArchiveTask () {
    const task = archiveConfirmTask.value
    if (!task || archivePending.value) {
      return
    }
    archivePending.value = true
    options.error.value = null
    const childSnapshots = options.tasks.value.filter(row => row.parent_task_id === task.id)
    try {
      await withAppLoadingCursor(async () => {
        const orgSlug = toValue(options.orgSlug)
        const workspaceId = toValue(options.workspaceId)
        await api(`/orgs/${orgSlug}/workspaces/${workspaceId}/tasks/${task.id}/archive`, {
          method: 'POST',
        })
        archiveConfirmTask.value = null
        if (detailTaskId.value === task.id) {
          detailTaskId.value = null
        }
        const removeIds = new Set<number>([task.id, ...childSnapshots.map(child => child.id)])
        options.tasks.value = options.tasks.value.filter(row => !removeIds.has(row.id))
        for (const childId of removeIds) {
          options.removeRealtimeWbsTask(childId)
        }
        upsertArchivedTask(orgSlug, workspaceId, {
          id: task.id,
          title: task.title,
          list_id: task.list_id,
          archived_at: new Date().toISOString(),
          labels: task.labels ?? [],
          assignees: task.assignees ?? [],
          start_date: task.start_date ?? null,
          due_date: task.due_date ?? null,
          effort_hours: task.effort_hours ?? null,
          progress_rate: task.progress_rate ?? null,
          is_parent_task: Boolean(task.is_parent_task),
          parent_task_id: task.parent_task_id ?? null,
          parent_task_title: resolveParentTaskTitle(task, [...childSnapshots, task]),
          archived_child_count: childSnapshots.length,
          archived_children: childSnapshots.map(child => ({
            id: child.id,
            title: child.title,
            list_id: child.list_id,
            archived_at: new Date().toISOString(),
            labels: child.labels ?? [],
            assignees: child.assignees ?? [],
            start_date: child.start_date ?? null,
            due_date: child.due_date ?? null,
            effort_hours: child.effort_hours ?? null,
            progress_rate: child.progress_rate ?? null,
            is_parent_task: false,
            parent_task_id: task.id,
            parent_task_title: task.title,
            archived_child_count: 0,
            archived_children: [],
          })),
        })
        const boardCached = getBoardCached(orgSlug, workspaceId)
        if (boardCached?.tasks) {
          replaceCachedBoardState(orgSlug, workspaceId, {
            ...boardCached,
            tasks: boardCached.tasks.filter(row => !removeIds.has(row.id)),
          })
        }
      })
    } catch (e: unknown) {
      options.error.value = e instanceof Error ? e.message : 'アーカイブに失敗しました'
    } finally {
      archivePending.value = false
    }
  }

  return {
    taskAddOpen,
    taskAddListId,
    taskAddParentTaskId,
    taskAddParentDefaults,
    detailTaskId,
    taskDetailOpen,
    archiveConfirmOpen,
    archiveConfirmMessage,
    archivePending,
    taskMenuItems,
    openMenuTask,
    detailInitialTask,
    detailHierarchyTasks,
    detailParentTasks,
    wbsTaskToTaskDetail,
    openTaskDetail,
    onTaskDetailNavigate,
    onTaskDetailMissing,
    onTaskDetailUpdated,
    openArchiveConfirm,
    confirmArchiveTask,
    defaultTaskAddListId,
    openTaskAdd,
    onAddChildTaskFromDetail,
    addedTaskToWbsTask,
    addedTaskToBoardTask,
    syncBoardCacheAfterAdd,
    onTaskAddedFromModal,
    toggleTaskMenu,
    onTaskMenuSelect,
    toggleParentCollapse,
  }
}
