import type { ComputedRef, Ref } from 'vue'
import type { WorkspaceBoardTask } from './useWorkspaceBoardPageData'
import { type TaskFormDefaultsSource } from './useTaskFormHelpers'
import { withResolvedListColor } from '../utils/colorPresetResolution'
import { useTransientIdFlash } from './useTransientIdFlash'

type ListDefLike = {
  key: string
  title: string
  listId: number
  color: string
  color_index: number
}

type ApiClient = <T>(url: string, opts?: Record<string, unknown>) => Promise<T>

/**
 * ボードのリスト/タスク作成・編集・削除・タイトル編集フロー。
 */
export function useBoardListTaskCrud<TList extends ListDefLike> (options: {
  api: ApiClient
  slug: Ref<string> | ComputedRef<string>
  workspaceId: Ref<string> | ComputedRef<string>
  lists: Ref<TList[]>
  tasks: Ref<WorkspaceBoardTask[] | null>
  error: Ref<string | null>
  pageReady: Ref<boolean>
  taskAddOpen: Ref<boolean>
  taskAddListId: Ref<number | null>
  taskAddParentTaskId: Ref<number | null>
  taskAddParentDefaults: Ref<TaskFormDefaultsSource | null>
  taskDetailOpen: Ref<boolean> | ComputedRef<boolean>
  addChildTaskTransitionPending: Ref<boolean>
  modalFadeOutMs: number
  listFormOpen: Ref<boolean>
  listFormLoading: Ref<boolean>
  listModalMode: Ref<'add' | 'edit'>
  listEditTarget: Ref<TList | null>
  listFormModalRef: Ref<{ setSubmitError: (message: string) => void } | null>
  listDeleteOpen: Ref<boolean>
  listDeleteLoading: Ref<boolean>
  listDeleteTarget: Ref<TList | null>
  listDeleteModalRef: Ref<{ setSubmitError: (message: string) => void } | null>
  editingListKey: Ref<string | null>
  listEditDrafts: Record<string, string>
  listRenamePending: Ref<boolean>
  suppressListTitleClick: Ref<boolean>
  editingTaskId: Ref<number | null>
  taskTitleDraft: Ref<string>
  taskRenamePending: Ref<boolean>
  rebuildBoardFromTasks: () => void
  syncBoardPageCache: () => void
  load: (opts?: { refresh?: boolean }) => Promise<void>
}) {
  const {
    api,
    slug,
    workspaceId,
    lists,
    tasks,
    error,
    pageReady,
    taskAddOpen,
    taskAddListId,
    taskAddParentTaskId,
    taskAddParentDefaults,
    taskDetailOpen,
    addChildTaskTransitionPending,
    modalFadeOutMs,
    listFormOpen,
    listFormLoading,
    listModalMode,
    listEditTarget,
    listFormModalRef,
    listDeleteOpen,
    listDeleteLoading,
    listDeleteTarget,
    listDeleteModalRef,
    editingListKey,
    listEditDrafts,
    listRenamePending,
    suppressListTitleClick,
    editingTaskId,
    taskTitleDraft,
    taskRenamePending,
    rebuildBoardFromTasks,
    syncBoardPageCache,
    load,
  } = options

  const justCreatedTasks = useTransientIdFlash<number>()
  const justCreatedLists = useTransientIdFlash<string>()
  const justCreatedTaskIds = justCreatedTasks.ids
  const justCreatedListKeys = justCreatedLists.ids

  function isTaskJustCreated (taskId: number): boolean {
    return justCreatedTasks.has(taskId)
  }
  function markTaskAsJustCreated (taskId: number) {
    justCreatedTasks.mark(taskId)
  }
  function isListJustCreated (listKey: string): boolean {
    return justCreatedLists.has(listKey)
  }
  function markListAsJustCreated (listKey: string) {
    justCreatedLists.mark(listKey)
  }

  function stripManualLineBreaks (value: string) {
    return value.replace(/\r?\n/g, '')
  }

  function defaultTaskAddListId (): number | null {
    return lists.value[0]?.listId ?? null
  }

  const canAddTaskFromHeader = computed(() => pageReady.value && defaultTaskAddListId() !== null)

  function openTaskAddFromHeader () {
    const listId = defaultTaskAddListId()
    if (listId === null) {
      return
    }
    openTaskAddModal(listId)
  }

  function openTaskAddModal (listId: number, parentTaskId: number | null = null) {
    taskAddListId.value = listId
    taskAddParentTaskId.value = parentTaskId
    taskAddParentDefaults.value = null
    taskAddOpen.value = true
  }

  async function onAddChildTaskFromDetail (payload: { parentTaskId: number; listId: number | null }) {
    if (addChildTaskTransitionPending.value) {
      return
    }
    const listId = payload.listId ?? defaultTaskAddListId()
    if (listId === null) {
      return
    }
    addChildTaskTransitionPending.value = true
    taskDetailOpen.value = false
    const fadeOutDone = new Promise<void>((resolve) => {
      window.setTimeout(resolve, modalFadeOutMs)
    })
    let defaults: TaskFormDefaultsSource | null = null
    try {
      const [detail] = await Promise.all([
        api<TaskFormDefaultsSource>(
          `/orgs/${slug.value}/workspaces/${workspaceId.value}/tasks/${payload.parentTaskId}`,
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

  function onTaskAddedFromModal (added: WorkspaceBoardTask) {
    if (!tasks.value) {
      tasks.value = []
    }
    tasks.value.push(added)
    rebuildBoardFromTasks()
    markTaskAsJustCreated(added.id)
    syncBoardPageCache()
  }

  async function onListFormSubmit ({
    name,
    color_index,
  }: {
    name: string
    color_index: number
  }) {
    if (listFormLoading.value) return
    listFormLoading.value = true
    try {
      if (listModalMode.value === 'add') {
        const created = await api<{ id: number; name: string; color_index: number; sort_order: number }>(
          `/orgs/${slug.value}/workspaces/${workspaceId.value}/lists`,
          {
            method: 'POST',
            body: { name, color_index, sort_order: lists.value.length },
          },
        )
        listFormOpen.value = false
        await load({ refresh: true })
        markListAsJustCreated(`list_${created.id}`)
        return
      }
      const target = listEditTarget.value
      if (!target) {
        return
      }
      const updated = await api<{
        id: number
        name: string
        color_index: number
        sort_order: number
      }>(
        `/orgs/${slug.value}/workspaces/${workspaceId.value}/lists/${target.listId}`,
        {
          method: 'PATCH',
          body: { name, color_index },
        },
      )
      const row = lists.value.find(item => item.listId === target.listId)
      if (row) {
        const resolved = withResolvedListColor(updated)
        row.title = updated.name
        row.color = resolved.color
        row.color_index = resolved.color_index
      }
      listFormOpen.value = false
      listEditTarget.value = null
      listModalMode.value = 'add'
    } catch (e: unknown) {
      listFormModalRef.value?.setSubmitError(
        e instanceof Error ? e.message : (
          listModalMode.value === 'edit'
            ? 'リスト更新に失敗しました'
            : 'リスト追加に失敗しました'
        ),
      )
    } finally {
      listFormLoading.value = false
    }
  }

  async function confirmListDelete () {
    const target = listDeleteTarget.value
    if (!target || listDeleteLoading.value) {
      return
    }
    listDeleteLoading.value = true
    try {
      await api(
        `/orgs/${slug.value}/workspaces/${workspaceId.value}/lists/${target.listId}`,
        { method: 'DELETE' },
      )
      listDeleteOpen.value = false
      listDeleteTarget.value = null
      await load({ refresh: true })
    } catch (e: unknown) {
      listDeleteModalRef.value?.setSubmitError(
        e instanceof Error ? e.message : 'リスト削除に失敗しました',
      )
    } finally {
      listDeleteLoading.value = false
    }
  }

  function onListTitleClick (list: TList) {
    if (suppressListTitleClick.value) {
      return
    }
    void startListEdit(list)
  }

  async function startListEdit (list: TList) {
    editingTaskId.value = null
    editingListKey.value = list.key
    listEditDrafts[list.key] = list.title
  }

  function cancelListEdit () {
    editingListKey.value = null
  }

  async function confirmListTitle (list: TList) {
    if (listRenamePending.value || editingListKey.value !== list.key) {
      return
    }
    const name = (listEditDrafts[list.key] || '').trim()
    if (!name || name === list.title) {
      cancelListEdit()
      return
    }
    await saveListTitle(list)
  }

  async function saveListTitle (list: TList) {
    const name = (listEditDrafts[list.key] || '').trim()
    if (!name) return
    listRenamePending.value = true
    error.value = null
    try {
      await api<{ id: number; name: string; sort_order: number }>(
        `/orgs/${slug.value}/workspaces/${workspaceId.value}/lists/${list.listId}`,
        { method: 'PATCH', body: { name } },
      )
      const row = lists.value.find(item => item.key === list.key)
      if (row) row.title = name
      editingListKey.value = null
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'リスト名の更新に失敗しました'
    } finally {
      listRenamePending.value = false
    }
  }

  function cancelTaskEdit () {
    editingTaskId.value = null
    taskTitleDraft.value = ''
  }

  async function saveTaskTitle (task: WorkspaceBoardTask) {
    const title = stripManualLineBreaks(taskTitleDraft.value).trim()
    if (!title) return
    taskRenamePending.value = true
    error.value = null
    try {
      await api<{ title: string }>(
        `/orgs/${slug.value}/workspaces/${workspaceId.value}/tasks/${task.id}`,
        { method: 'PATCH', body: { title } },
      )
      task.title = title
      editingTaskId.value = null
      taskTitleDraft.value = ''
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'タスク名の更新に失敗しました'
    } finally {
      taskRenamePending.value = false
    }
  }

  watch(listFormOpen, (open) => {
    if (open) {
      return
    }
    if (listModalMode.value === 'edit') {
      listModalMode.value = 'add'
      listEditTarget.value = null
    }
  })

  watch(listDeleteOpen, (open) => {
    if (!open) {
      listDeleteTarget.value = null
    }
  })

  return {
    justCreatedTaskIds,
    justCreatedListKeys,
    isTaskJustCreated,
    markTaskAsJustCreated,
    isListJustCreated,
    markListAsJustCreated,
    stripManualLineBreaks,
    defaultTaskAddListId,
    canAddTaskFromHeader,
    openTaskAddFromHeader,
    openTaskAddModal,
    onAddChildTaskFromDetail,
    onTaskAddedFromModal,
    onListFormSubmit,
    confirmListDelete,
    onListTitleClick,
    startListEdit,
    cancelListEdit,
    confirmListTitle,
    saveListTitle,
    cancelTaskEdit,
    saveTaskTitle,
  }
}
