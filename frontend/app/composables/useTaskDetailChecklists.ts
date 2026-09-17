import type { Ref } from 'vue'
import type { TaskChecklist } from '../components/task/TaskDetailChecklistBlock.vue'
import type { TaskDetail } from '../components/modals/TaskDetailModal.vue'
import { useApi } from './useApi'

/**
 * タスク詳細のチェックリスト保存（デバウンス付き PATCH）。
 */
export function useTaskDetailChecklists (options: {
  task: Ref<TaskDetail | null>
  orgSlug: MaybeRefOrGetter<string>
  workspaceId: MaybeRefOrGetter<string | number>
  saveError: Ref<string | null>
  isStillShowingTask: (requestTaskId: number) => boolean
  dismissPopover: () => void
  checklistBlockRef: Ref<HTMLElement | null>
  onUpdated?: (detail: TaskDetail) => void
}) {
  const { api } = useApi()
  const checklists = ref<TaskChecklist[]>([])
  const checklistTitleDraft = ref('')
  const checklistAddFormOpenId = ref<number | null>(null)
  const checklistSaving = ref(false)
  const checklistTitleInputRef = ref<HTMLInputElement | null>(null)

  let checklistSaveTimer: ReturnType<typeof setTimeout> | null = null
  let checklistSaveSeq = 0
  let lastPersistedChecklists: TaskChecklist[] = []

  function clearChecklistSaveTimer () {
    if (checklistSaveTimer) {
      clearTimeout(checklistSaveTimer)
      checklistSaveTimer = null
    }
  }

  function cancelPendingChecklistSave () {
    clearChecklistSaveTimer()
    checklistSaveSeq += 1
    checklistSaving.value = false
  }

  function hydrateChecklists (next: TaskChecklist[]) {
    checklists.value = next
    lastPersistedChecklists = next
  }

  function resetChecklists () {
    cancelPendingChecklistSave()
    checklists.value = []
    lastPersistedChecklists = []
    checklistAddFormOpenId.value = null
    checklistTitleDraft.value = ''
  }

  function createTempChecklistId (): number {
    return -Date.now()
  }

  function checklistPayloadForApi (list: TaskChecklist[]): Array<{
    id?: number
    title: string
    items: TaskChecklist['items']
  }> {
    return list.map(({ id, title, items }) => (
      id > 0
        ? { id, title, items }
        : { title, items }
    ))
  }

  function submitChecklistAdd () {
    if (!options.task.value) return
    const title = checklistTitleDraft.value.trim() || 'チェックリスト'
    const tempId = createTempChecklistId()
    const next = [...checklists.value, { id: tempId, title, items: [] }]
    checklistAddFormOpenId.value = tempId
    void saveChecklists(next)
    options.dismissPopover()
    nextTick(() => {
      options.checklistBlockRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  function setChecklistAddFormOpen (checklistId: number, open: boolean) {
    checklistAddFormOpenId.value = open ? checklistId : (
      checklistAddFormOpenId.value === checklistId ? null : checklistAddFormOpenId.value
    )
  }

  function updateChecklist (checklistId: number, nextChecklist: TaskChecklist) {
    if (!options.task.value) return
    void saveChecklists(checklists.value.map(item => (
      item.id === checklistId ? { ...nextChecklist, id: checklistId } : item
    )))
  }

  function deleteChecklist (checklistId: number) {
    if (!options.task.value) return
    if (checklistAddFormOpenId.value === checklistId) {
      checklistAddFormOpenId.value = null
    }
    void saveChecklists(checklists.value.filter(item => item.id !== checklistId))
  }

  async function saveChecklists (next: TaskChecklist[]) {
    if (!options.task.value) return
    checklists.value = next
    clearChecklistSaveTimer()
    checklistSaveTimer = setTimeout(() => {
      checklistSaveTimer = null
      void persistChecklists(checklists.value)
    }, 300)
  }

  async function persistChecklists (next: TaskChecklist[]) {
    if (!options.task.value) return
    const requestTaskId = options.task.value.id
    const rollback = lastPersistedChecklists
    const openTempId = checklistAddFormOpenId.value
    const seq = ++checklistSaveSeq
    checklistSaving.value = true
    options.saveError.value = null
    try {
      const updated = await api<TaskDetail>(
        `/orgs/${toValue(options.orgSlug)}/workspaces/${toValue(options.workspaceId)}/tasks/${requestTaskId}`,
        { method: 'PATCH', body: { checklists: checklistPayloadForApi(next) } },
      )
      if (seq !== checklistSaveSeq || !options.isStillShowingTask(requestTaskId)) return
      checklists.value = updated.checklists ?? []
      lastPersistedChecklists = checklists.value
      if (openTempId != null && openTempId < 0) {
        const openIndex = next.findIndex(item => item.id === openTempId)
        const persisted = checklists.value[openIndex]
        checklistAddFormOpenId.value = persisted?.id ?? null
      }
      if (options.task.value) {
        options.onUpdated?.({ ...options.task.value, checklists: checklists.value })
      }
    } catch (e: unknown) {
      if (seq !== checklistSaveSeq || !options.isStillShowingTask(requestTaskId)) return
      checklists.value = rollback
      options.saveError.value = e instanceof Error ? e.message : 'チェックリストの保存に失敗しました'
    } finally {
      if (seq === checklistSaveSeq) {
        checklistSaving.value = false
      }
    }
  }

  return {
    checklists,
    checklistTitleDraft,
    checklistAddFormOpenId,
    checklistSaving,
    checklistTitleInputRef,
    cancelPendingChecklistSave,
    hydrateChecklists,
    resetChecklists,
    submitChecklistAdd,
    setChecklistAddFormOpen,
    updateChecklist,
    deleteChecklist,
    saveChecklists,
    persistChecklists,
  }
}
