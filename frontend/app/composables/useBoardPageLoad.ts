import type { Ref } from 'vue'
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from './raceWithTimeout'
import { withAppLoadingCursor } from './useAppLoadingCursor'
import { sortMembersByDisplayName } from './useMemberDisplay'
import { resolveAndSortLabels } from './useLabelCategories'
import {
  useWorkspaceBoardPageData,
  type WorkspaceBoardLabel,
  type WorkspaceBoardLabelCategory,
  type WorkspaceBoardPageSnapshot,
  type WorkspaceBoardParentTask,
  type WorkspaceBoardTask,
} from './useWorkspaceBoardPageData'
import { useOrgWorkspaceIndexPageData } from './useOrgWorkspaceIndexPageData'
import { useWorkspaceWbsPageData } from './useWorkspaceWbsPageData'
import { withResolvedListColor } from '../utils/colorPresetResolution'
import { isAccessDeniedMessage } from '../utils/resourceAccessError'
import type { TaskAttachmentsByTaskId } from '../components/task/taskAttachmentTypes'
import type { TaskDetailMember } from '../components/modals/TaskDetailModal.vue'

type BoardListDef = {
  key: string
  title: string
  listId: number
  color: string
  color_index: number
}

/**
 * ボードページのロード / キャッシュ適用 / 初回フェードインを担当する。
 */
export function useBoardPageLoad (options: {
  slug: Ref<string>
  workspaceId: Ref<string>
  lists: Ref<BoardListDef[]>
  tasks: Ref<WorkspaceBoardTask[] | null>
  tasksByList: Record<string, WorkspaceBoardTask[]>
  orgLabels: Ref<WorkspaceBoardLabel[]>
  orgLabelCategories: Ref<WorkspaceBoardLabelCategory[]>
  workspaceMembersSnapshot: Ref<TaskDetailMember[]>
  boardParentTasks: Ref<WorkspaceBoardParentTask[]>
  taskAttachmentsByTaskId: Ref<TaskAttachmentsByTaskId>
  error: Ref<string | null>
  editingTaskId: Ref<number | null>
  editingListKey: Ref<string | null>
  rebuildBoardFromTasks: () => void
  onLayoutAfterLoad?: () => void | Promise<void>
}) {
  const pageReady = ref(false)
  const pending = ref(false)
  const boardShouldFadeIn = ref(false)
  const fatalLoadError = ref<string | null>(null)
  let boardInitialRevealDone = false
  let boardFadeInTimer: ReturnType<typeof setTimeout> | null = null

  const {
    fetchSnapshot: fetchBoardSnapshot,
    getCached: getBoardCached,
    invalidateCached: invalidateBoardCached,
    isCachedStale: isBoardCacheStale,
    clearCachedStale: clearBoardCacheStale,
    replaceCachedBoardState,
  } = useWorkspaceBoardPageData()
  const { touchCachedWorkspaceUpdatedAt } = useOrgWorkspaceIndexPageData()

  async function fetchBoardPayload () {
    return fetchBoardSnapshot(options.slug.value, options.workspaceId.value)
  }

  function applyBoardSnapshot (snapshot: WorkspaceBoardPageSnapshot) {
    const sortedLists = [...snapshot.lists].sort((a, b) => a.sort_order - b.sort_order)
    options.lists.value = sortedLists.map((row) => {
      const resolved = withResolvedListColor(row)
      return {
        key: `list_${row.id}`,
        title: row.name,
        listId: row.id,
        color: resolved.color,
        color_index: resolved.color_index,
      }
    })
    for (const list of options.lists.value) {
      if (!(list.key in options.tasksByList)) options.tasksByList[list.key] = []
    }
    const catalogLabels = resolveAndSortLabels(snapshot.orgLabels, snapshot.orgLabels)
    options.tasks.value = snapshot.tasks.map(task => ({
      ...task,
      assignees: sortMembersByDisplayName(task.assignees ?? []),
      labels: task.labels ? resolveAndSortLabels(task.labels, catalogLabels) : task.labels,
    }))
    options.orgLabels.value = catalogLabels
    options.orgLabelCategories.value = snapshot.orgLabelCategories ?? []
    options.workspaceMembersSnapshot.value = snapshot.workspaceMembers
    options.boardParentTasks.value = snapshot.parentTasks
    options.taskAttachmentsByTaskId.value = snapshot.taskAttachmentsByTaskId ?? {}
    options.rebuildBoardFromTasks()
  }

  function syncBoardPageCache () {
    if (!pageReady.value || !options.tasks.value) {
      return
    }
    replaceCachedBoardState(options.slug.value, options.workspaceId.value, {
      tasks: options.tasks.value,
      parentTasks: options.boardParentTasks.value,
    })
    touchCachedWorkspaceUpdatedAt(options.slug.value, Number(options.workspaceId.value))
    // ボードと WBS のタスク正本は分けているため、ボード側更新後は WBS を破棄して再取得させる
    const { invalidateCached: invalidateWbs } = useWorkspaceWbsPageData()
    invalidateWbs(options.slug.value, options.workspaceId.value)
  }

  function applyBoardPayload (data: Awaited<ReturnType<typeof fetchBoardPayload>>) {
    applyBoardSnapshot(data)
  }

  function isBoardLocalEditActive (): boolean {
    return options.editingTaskId.value != null || options.editingListKey.value != null
  }

  function clearBoardFadeInTimer () {
    if (boardFadeInTimer === null) return
    clearTimeout(boardFadeInTimer)
    boardFadeInTimer = null
  }

  function revealLoadedBoard () {
    if (boardInitialRevealDone) return
    boardInitialRevealDone = true
    clearBoardFadeInTimer()
    boardShouldFadeIn.value = true
    boardFadeInTimer = setTimeout(() => {
      boardShouldFadeIn.value = false
      boardFadeInTimer = null
    }, 260)
  }

  function resetBoardReveal () {
    boardInitialRevealDone = false
    boardShouldFadeIn.value = false
    clearBoardFadeInTimer()
  }

  function markBoardReady () {
    const wasReady = pageReady.value
    pageReady.value = true
    if (!wasReady) {
      revealLoadedBoard()
    }
  }

  async function load (opts?: { refresh?: boolean; silent?: boolean }) {
    const refresh = opts?.refresh ?? false
    const silent = opts?.silent ?? false
    options.error.value = null
    if (!refresh) {
      fatalLoadError.value = null
    }
    const applyFreshPayload = async () => {
      const data = await fetchBoardPayload()
      if (isBoardLocalEditActive()) {
        return
      }
      applyBoardPayload(data)
      markBoardReady()
      clearBoardCacheStale(options.slug.value, options.workspaceId.value)
    }
    try {
      if (!pageReady.value && !refresh) {
        const cached = getBoardCached(options.slug.value, options.workspaceId.value)
        if (cached) {
          applyBoardSnapshot(cached)
          markBoardReady()
          return
        }
        // 初回は中央スピナーで待つ（AppLoadingCursor は使わない）
        const r = await raceWithTimeout(() => fetchBoardPayload(), TM_PAGE_LOAD_TIMEOUT_MS)
        if (!r.ok) {
          if (r.reason === 'timeout') {
            fatalLoadError.value = timeoutMessage()
            return
          }
          if (isAccessDeniedMessage(r.message)) {
            await navigateTo(`/org/${options.slug.value}/workspaces`, { replace: true })
            return
          }
          fatalLoadError.value = r.message
          return
        }
        applyBoardPayload(r.value)
        markBoardReady()
      } else if (silent && pageReady.value) {
        await applyFreshPayload()
      } else if (!pageReady.value) {
        // pageReady 前の refresh も中央スピナーのまま待つ
        await applyFreshPayload()
      } else {
        await withAppLoadingCursor(applyFreshPayload)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '読み込みに失敗しました'
      if (!pageReady.value && !refresh) {
        if (isAccessDeniedMessage(msg)) {
          await navigateTo(`/org/${options.slug.value}/workspaces`, { replace: true })
          return
        }
        fatalLoadError.value = msg
      } else {
        options.error.value = msg
      }
    } finally {
      if (import.meta.client) {
        await options.onLayoutAfterLoad?.()
      }
    }
  }

  function refreshOnViewSwitch (): Promise<void> {
    if (!pageReady.value) {
      return load()
    }
    if (isBoardLocalEditActive()) {
      return Promise.resolve()
    }
    // keep-alive 済みの表示をキャッシュ再適用で上書きしない（API で最新化）
    return load({ refresh: true, silent: true })
  }

  function retryBoardLoad () {
    fatalLoadError.value = null
    invalidateBoardCached(options.slug.value, options.workspaceId.value)
    resetBoardReveal()
    pageReady.value = false
    void load()
  }

  return {
    pageReady,
    pending,
    boardShouldFadeIn,
    fatalLoadError,
    applyBoardSnapshot,
    syncBoardPageCache,
    load,
    refreshOnViewSwitch,
    retryBoardLoad,
    revealLoadedBoard,
    markBoardReady,
    resetBoardReveal,
    clearBoardFadeInTimer,
    getBoardCached,
    isBoardCacheStale,
    invalidateBoardCached,
  }
}
