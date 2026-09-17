import type { Ref } from 'vue'
import type { WbsTask } from './useWbsTaskGroups'
import type { WorkspaceListOption } from './useTaskPopoverEditor'
import type { TaskFormLabel, TaskFormMember } from './useTaskFormHelpers'
import {
  flattenLabelCategories,
  normalizeLabelCategories,
  resolveAndSortLabels,
  type LabelCategoryGroup,
} from './useLabelCategories'
import { sortMembersByDisplayName } from './useMemberDisplay'
import { useApi } from './useApi'
import { useWorkspaceWbsPageData, type WorkspaceWbsPageSnapshot } from './useWorkspaceWbsPageData'
import { useOrgWorkspaceIndexPageData } from './useOrgWorkspaceIndexPageData'
import { useWorkspaceBoardPageData } from './useWorkspaceBoardPageData'
import { resolveListColors } from '../utils/colorPresetResolution'
import { isAccessDeniedMessage } from '../utils/resourceAccessError'
import { buildWbsReorderPayload } from './useWbsTaskGroups'

export function useWbsPageLoad (options: {
  orgSlug: MaybeRefOrGetter<string>
  workspaceId: MaybeRefOrGetter<string>
  editMode: MaybeRefOrGetter<boolean>
  /** persist 時にキャッシュへ載せるメンバー一覧（候補解決後） */
  getWorkspaceMembers: () => TaskFormMember[]
  onBeforeApplySnapshot?: () => void
}) {
  const { api } = useApi()
  const { getCached: getWbsCached, setCached: setWbsCached } = useWorkspaceWbsPageData()
  const { touchCachedWorkspaceUpdatedAt } = useOrgWorkspaceIndexPageData()
  const { patchCachedTasks } = useWorkspaceBoardPageData()

  const loading = ref(true)
  const error = ref<string | null>(null)
  const tasks = ref<WbsTask[]>([])
  const orgLabels = ref<TaskFormLabel[]>([])
  const orgLabelCategories = ref<LabelCategoryGroup[]>([])
  const workspaceMembersSnapshot = ref<TaskFormMember[]>([])
  const workspaceLists = ref<WorkspaceListOption[]>([])

  /** 進行中の WBS 取得を無効化するための世代番号（作成直後の古い応答で上書きしない） */
  let wbsLoadGeneration = 0
  /** 非サイレント load のネスト数（世代無効化でも loading を確実に戻す） */
  let wbsLoadingDepth = 0

  function bumpLoadGeneration () {
    wbsLoadGeneration += 1
  }

  function applyWbsSnapshot (snapshot: WorkspaceWbsPageSnapshot) {
    options.onBeforeApplySnapshot?.()
    tasks.value = snapshot.tasks
    orgLabels.value = snapshot.orgLabels
    orgLabelCategories.value = snapshot.orgLabelCategories ?? []
    workspaceMembersSnapshot.value = snapshot.workspaceMembers
    workspaceLists.value = snapshot.workspaceLists
  }

  function buildWbsSnapshot (): WorkspaceWbsPageSnapshot {
    return {
      tasks: tasks.value,
      orgLabels: orgLabels.value,
      orgLabelCategories: orgLabelCategories.value,
      workspaceMembers: options.getWorkspaceMembers(),
      workspaceLists: workspaceLists.value,
    }
  }

  function persistWbsCache () {
    if (tasks.value.length === 0 && loading.value) {
      return
    }
    const orgSlug = toValue(options.orgSlug)
    const workspaceId = toValue(options.workspaceId)
    setWbsCached(orgSlug, workspaceId, buildWbsSnapshot())
    touchCachedWorkspaceUpdatedAt(orgSlug, Number(workspaceId))
  }

  async function loadWbsTasks (opts?: { silent?: boolean }) {
    const generation = ++wbsLoadGeneration
    const showLoading = !opts?.silent
    if (showLoading) {
      wbsLoadingDepth += 1
      loading.value = true
    }
    error.value = null
    const orgSlug = toValue(options.orgSlug)
    const workspaceId = toValue(options.workspaceId)
    try {
      const [tasksRes, labelCategoriesRes, listsRes] = await Promise.all([
        api<{ data: WbsTask[] }>(
          `/orgs/${orgSlug}/workspaces/${workspaceId}/tasks/wbs`,
        ),
        api<{ data: LabelCategoryGroup[] }>(
          `/orgs/${orgSlug}/task-label-categories`,
        ),
        api<{ data: WorkspaceListOption[] }>(
          `/orgs/${orgSlug}/workspaces/${workspaceId}/lists`,
        ),
      ])
      const orgLabelCategoriesNext = normalizeLabelCategories(labelCategoriesRes.data ?? [])
      if (generation !== wbsLoadGeneration) {
        return
      }
      // サイレント再取得中に編集が始まった場合はタスク並びを上書きしない
      if (opts?.silent && toValue(options.editMode)) {
        orgLabels.value = flattenLabelCategories(orgLabelCategoriesNext)
        orgLabelCategories.value = orgLabelCategoriesNext
        workspaceLists.value = resolveListColors([...(listsRes.data ?? [])]).sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        )
        persistWbsCache()
        return
      }
      const catalogLabels = flattenLabelCategories(orgLabelCategoriesNext)
      tasks.value = (tasksRes.data ?? []).map(task => ({
        ...task,
        assignees: sortMembersByDisplayName(task.assignees ?? []),
        labels: task.labels ? resolveAndSortLabels(task.labels, catalogLabels) : task.labels,
      }))
      orgLabels.value = catalogLabels
      orgLabelCategories.value = orgLabelCategoriesNext
      workspaceLists.value = resolveListColors([...(listsRes.data ?? [])]).sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      )
      persistWbsCache()
    } catch (e: unknown) {
      if (generation !== wbsLoadGeneration) {
        return
      }
      if (!opts?.silent) {
        const message = e instanceof Error ? e.message : 'WBSの読み込みに失敗しました'
        if (isAccessDeniedMessage(message)) {
          await navigateTo(`/org/${orgSlug}/workspaces`, { replace: true })
          return
        }
        error.value = message
        tasks.value = []
        orgLabels.value = []
        orgLabelCategories.value = []
        workspaceMembersSnapshot.value = []
        workspaceLists.value = []
      }
    } finally {
      if (showLoading) {
        wbsLoadingDepth = Math.max(0, wbsLoadingDepth - 1)
        if (wbsLoadingDepth === 0) {
          loading.value = false
        }
      }
    }
  }

  function refreshOnViewSwitch (): Promise<void> {
    // 編集セッション中はローカル並びを壊さない
    if (toValue(options.editMode)) {
      return Promise.resolve()
    }
    const orgSlug = toValue(options.orgSlug)
    const workspaceId = toValue(options.workspaceId)
    // keep-alive 済みで既に表示データがあるときはキャッシュ再適用でちらつかせない
    if (tasks.value.length === 0) {
      const cached = getWbsCached(orgSlug, workspaceId)
      if (cached) {
        applyWbsSnapshot(cached)
      }
    }
    return loadWbsTasks({ silent: tasks.value.length > 0 })
  }

  async function saveWbsOrder (updatedTasks: WbsTask[]): Promise<boolean> {
    const orgSlug = toValue(options.orgSlug)
    const workspaceId = toValue(options.workspaceId)
    try {
      await api<{ data: { ok: boolean } }>(
        `/orgs/${orgSlug}/workspaces/${workspaceId}/tasks/wbs/reorder`,
        {
          method: 'PATCH',
          body: { tasks: buildWbsReorderPayload(updatedTasks) },
        },
      )
      persistWbsCache()
      patchCachedTasks(
        orgSlug,
        workspaceId,
        updatedTasks.map(task => ({
          id: task.id,
          sort_order: task.sort_order,
          parent_task_id: task.parent_task_id ?? null,
          is_parent_task: task.is_parent_task,
        })),
      )
      return true
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'タスクの並び順の保存に失敗しました'
      await loadWbsTasks()
      return false
    }
  }

  return {
    loading,
    error,
    tasks: tasks as Ref<WbsTask[]>,
    orgLabels,
    orgLabelCategories,
    workspaceMembersSnapshot,
    workspaceLists,
    applyWbsSnapshot,
    buildWbsSnapshot,
    persistWbsCache,
    loadWbsTasks,
    refreshOnViewSwitch,
    bumpLoadGeneration,
    saveWbsOrder,
    getWbsCached,
  }
}
