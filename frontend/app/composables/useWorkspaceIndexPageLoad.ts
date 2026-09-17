import type { MaybeRefOrGetter } from 'vue'
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from './raceWithTimeout'
import { withAppLoadingCursor } from './useAppLoadingCursor'
import {
  useOrgWorkspaceIndexPageData,
  useOrgWorkspaceIndexCacheRevision,
  type OrgWorkspaceIndexPageSnapshot,
  type OrgWorkspaceStatus,
} from './useOrgWorkspaceIndexPageData'
import { useWorkspaceMutations } from './useWorkspaceMutations'
import type { TaskFormMember } from './useTaskFormHelpers'
import { useTransientIdFlash } from './useTransientIdFlash'
import { useStickyHeaderOffsets } from './useWorkspaceViewPageRoot'
import { useWorkspaceBoardPageData } from './useWorkspaceBoardPageData'
import { useOrgSafeRedirect } from './useOrgSafeRedirect'
import { useWorkspaceListFilters } from './useWorkspaceListFilters'
import { DEFAULT_WORKSPACE_STATUS_ITEMS } from '../components/settings/types'
import { resolveStandardColors } from '../utils/colorPresetResolution'
import { isAccessDeniedMessage } from '../utils/resourceAccessError'

export type WorkspaceIndexLabel = { id: number; name: string; color: string }

export type WorkspaceIndexRow = {
  id: number
  name: string
  description?: string | null
  status?: OrgWorkspaceStatus | null
  labels?: WorkspaceIndexLabel[]
  assignees?: TaskFormMember[]
  created_at?: string
  updated_at?: string
  pinned?: boolean
  pinned_at?: string | null
}

/**
 * スペース一覧の取得・表示フィルタ・作成/更新/アーカイブ・遷移ウォーム。
 */
export function useWorkspaceIndexPageLoad (options: {
  orgSlug: MaybeRefOrGetter<string>
}) {
  const router = useRouter()
  const slug = computed(() => String(toValue(options.orgSlug) ?? '').trim())
  const { redirectToMemberHome } = useOrgSafeRedirect()
  const {
    fetchSnapshot: fetchOrgWorkspaceIndexSnapshot,
    getCached: getOrgWorkspaceIndexCached,
    invalidateCached: invalidateOrgWorkspaceIndexCached,
    fetchAndUpsertWorkspace,
    warmWorkspaceCache,
    refreshSnapshotInBackground,
    removeCachedWorkspace,
    revalidateWorkspaceInBackground,
  } = useOrgWorkspaceIndexPageData()
  const cacheRevision = useOrgWorkspaceIndexCacheRevision()
  const workspaceMutations = useWorkspaceMutations(slug)
  const { warmWorkspaceBoardCache, prefetch } = useWorkspaceBoardPageData()

  /** 初回取得成功まで一覧を出さない（ヘッダーは先に表示） */
  const pageReady = ref(false)
  /** 初回のみ：タイムアウト／API 失敗時にブロッキング表示 */
  const fatalLoadError = ref<string | null>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)
  const searchQuery = ref('')
  const sortMode = ref<'created' | 'updated' | 'name'>('created')
  const archivePending = ref(false)

  const indexSnapshot = computed(() => {
    void cacheRevision.value
    return getOrgWorkspaceIndexCached(slug.value)
  })
  const workspaces = computed<WorkspaceIndexRow[]>(() => {
    return (indexSnapshot.value?.workspaces ?? []) as WorkspaceIndexRow[]
  })
  const orgLabels = computed(() => (indexSnapshot.value?.orgLabels ?? []) as WorkspaceIndexLabel[])
  const orgLabelCategories = computed(() => indexSnapshot.value?.orgLabelCategories ?? [])
  const orgMembers = computed(() => indexSnapshot.value?.orgMembers ?? [])
  const workspaceStatuses = computed(() => (
    indexSnapshot.value?.workspaceStatuses
    ?? resolveStandardColors(DEFAULT_WORKSPACE_STATUS_ITEMS)
  ))

  const listFilters = useWorkspaceListFilters({
    orgMembers,
    orgLabelCategories,
    workspaceStatuses,
  })

  const justCreatedWorkspaces = useTransientIdFlash<number>()
  const justCreatedWorkspaceIds = justCreatedWorkspaces.ids
  const listWrapShouldFadeIn = ref(false)
  let workspaceListInitialRevealDone = false
  const loadingWorkspaceId = ref<number | null>(null)

  const {
    pageCssVars: listPageCssVars,
    updateStickyOffsets,
    bindStickyOffsets,
    unbindStickyOffsets,
  } = useStickyHeaderOffsets({ autoBind: false })

  const visibleWorkspaces = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    const filtered = query
      ? workspaces.value.filter(workspace => workspace.name.toLowerCase().includes(query))
      : [...workspaces.value]
    const matched = filtered.filter(workspace => (
      listFilters.matchesAssigneeFilter(workspace)
      && listFilters.matchesLabelFilter(workspace)
      && listFilters.matchesStatusFilter(workspace)
    ))
    const compareBySortMode = (a: WorkspaceIndexRow, b: WorkspaceIndexRow): number => {
      if (sortMode.value === 'name') {
        return a.name.localeCompare(b.name, 'ja') || b.id - a.id
      }
      if (sortMode.value === 'updated') {
        return compareTimestampDesc(a.updated_at, b.updated_at) || b.id - a.id
      }
      return compareTimestampDesc(a.created_at, b.created_at) || b.id - a.id
    }
    return matched.sort((a, b) => {
      const aPinned = Boolean(a.pinned)
      const bPinned = Boolean(b.pinned)
      if (aPinned !== bPinned) {
        return aPinned ? -1 : 1
      }
      return compareBySortMode(a, b)
    })
  })

  function compareTimestampDesc (a?: string | null, b?: string | null): number {
    const aTime = a ? Date.parse(a) : Number.NaN
    const bTime = b ? Date.parse(b) : Number.NaN
    const aValid = Number.isFinite(aTime)
    const bValid = Number.isFinite(bTime)
    if (aValid && bValid) {
      return bTime - aTime
    }
    if (aValid) {
      return -1
    }
    if (bValid) {
      return 1
    }
    return 0
  }

  function isWorkspaceJustCreated (workspaceId: number): boolean {
    return justCreatedWorkspaces.has(workspaceId)
  }

  function markWorkspaceAsJustCreated (workspaceId: number) {
    justCreatedWorkspaces.mark(workspaceId)
  }

  function revealLoadedWorkspaces () {
    if (workspaceListInitialRevealDone) {
      return
    }
    workspaceListInitialRevealDone = true
    if (visibleWorkspaces.value.length > 0) {
      for (const workspace of visibleWorkspaces.value) {
        markWorkspaceAsJustCreated(workspace.id)
      }
      return
    }
    listWrapShouldFadeIn.value = true
    setTimeout(() => {
      listWrapShouldFadeIn.value = false
    }, 260)
  }

  function resetWorkspaceListReveal () {
    workspaceListInitialRevealDone = false
    listWrapShouldFadeIn.value = false
  }

  function applyOrgWorkspaceIndexSnapshot (_snapshot?: OrgWorkspaceIndexPageSnapshot) {
    // 正本はモジュールキャッシュ。画面は cacheRevision 経由で読む。
  }

  async function load (opts?: { refresh?: boolean }) {
    const refresh = opts?.refresh ?? false
    error.value = null
    if (!refresh) {
      fatalLoadError.value = null
    }
    try {
      if (!pageReady.value && !refresh) {
        const cached = getOrgWorkspaceIndexCached(slug.value)
        if (cached) {
          applyOrgWorkspaceIndexSnapshot(cached)
          pageReady.value = true
          return
        }
        await withAppLoadingCursor(async () => {
          const r = await raceWithTimeout(
            () => fetchOrgWorkspaceIndexSnapshot(slug.value),
            TM_PAGE_LOAD_TIMEOUT_MS,
          )
          if (!r.ok) {
            if (r.reason === 'timeout') {
              fatalLoadError.value = timeoutMessage()
              return
            }
            if (isAccessDeniedMessage(r.message)) {
              await redirectToMemberHome()
              return
            }
            fatalLoadError.value = r.message
            return
          }
          applyOrgWorkspaceIndexSnapshot(r.value)
          pageReady.value = true
        })
      } else if (refresh && pageReady.value) {
        // Stale-While-Revalidate: キャッシュ表示のまま裏で最新化
        await refreshSnapshotInBackground(slug.value)
        applyOrgWorkspaceIndexSnapshot()
      } else {
        await withAppLoadingCursor(async () => {
          const snapshot = await fetchOrgWorkspaceIndexSnapshot(slug.value)
          applyOrgWorkspaceIndexSnapshot(snapshot)
          pageReady.value = true
        })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '読み込みに失敗しました'
      if (!pageReady.value && !refresh) {
        if (isAccessDeniedMessage(msg)) {
          await redirectToMemberHome()
          return
        }
        fatalLoadError.value = msg
      } else {
        error.value = msg
      }
    } finally {
      if (import.meta.client) {
        await nextTick()
        updateStickyOffsets()
      }
    }
  }

  function retryInitialLoad () {
    fatalLoadError.value = null
    invalidateOrgWorkspaceIndexCached(slug.value)
    resetWorkspaceListReveal()
    pageReady.value = false
    void load()
  }

  async function createWorkspace (
    payload: {
      name: string
      description: string | null
      status: string | null
      label_ids: number[]
      assignee_ids: number[]
    },
    formControls: {
      closeModal: () => void
      setSubmitError: (message: string) => void
    },
  ) {
    pending.value = true
    error.value = null
    try {
      await withAppLoadingCursor(async () => {
        const createdWorkspace = await workspaceMutations.createWorkspace({
          name: payload.name,
          description: payload.description,
          status: payload.status,
          label_ids: payload.label_ids,
          assignee_ids: payload.assignee_ids,
        })
        formControls.closeModal()
        markWorkspaceAsJustCreated(createdWorkspace.id)
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '作成に失敗しました'
      error.value = message
      formControls.setSubmitError(message)
    } finally {
      pending.value = false
    }
  }

  async function updateWorkspace (
    target: WorkspaceIndexRow,
    payload: {
      name: string
      description: string | null
      status: string | null
      label_ids: number[]
      assignee_ids: number[]
    },
    formControls: {
      closeModal: () => void
      setSubmitError: (message: string) => void
    },
  ) {
    pending.value = true
    error.value = null
    try {
      await withAppLoadingCursor(async () => {
        await workspaceMutations.updateWorkspace(target.id, {
          name: payload.name,
          description: payload.description,
          status: payload.status,
          label_ids: payload.label_ids,
          assignee_ids: payload.assignee_ids,
        })
        formControls.closeModal()
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '更新に失敗しました'
      error.value = message
      formControls.setSubmitError(message)
    } finally {
      pending.value = false
    }
  }

  async function confirmWorkspaceArchive (
    target: WorkspaceIndexRow,
    controls: { closeConfirm: () => void },
  ) {
    if (archivePending.value) {
      return
    }
    archivePending.value = true
    error.value = null
    try {
      await withAppLoadingCursor(async () => {
        await workspaceMutations.archiveWorkspace(target.id)
        controls.closeConfirm()
      })
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'アーカイブに失敗しました'
    } finally {
      archivePending.value = false
    }
  }

  async function pinWorkspace (workspaceId: number) {
    try {
      await workspaceMutations.pinWorkspace(workspaceId)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'ピン留めに失敗しました'
    }
  }

  async function unpinWorkspace (workspaceId: number) {
    try {
      await workspaceMutations.unpinWorkspace(workspaceId)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'ピン留めの解除に失敗しました'
    }
  }

  function onWorkspaceRestored (restored: { id: number }) {
    void fetchAndUpsertWorkspace(slug.value, restored.id, { force: true })
  }

  function onWorkspacePermanentlyDeleted (workspaceId: number) {
    removeCachedWorkspace(slug.value, workspaceId)
    workspaceMutations.invalidateWorkspaceViews(workspaceId)
  }

  function workspaceDetailPath (workspaceId: number) {
    return `/org/${slug.value}/workspaces/${workspaceId}`
  }

  function warmWorkspaceBoard (workspaceId: number) {
    if (!import.meta.client) {
      return
    }
    const path = workspaceDetailPath(workspaceId)
    void preloadRouteComponents(path).catch(() => {})
    void warmWorkspaceBoardCache(slug.value, String(workspaceId))
    warmWorkspaceCache(slug.value, workspaceId)
  }

  function onWorkspacePointerDown (event: PointerEvent, workspaceId: number) {
    if (event.button !== 0 || loadingWorkspaceId.value !== null) {
      return
    }
    goToWorkspace(workspaceId)
  }

  function goToWorkspace (workspaceId: number) {
    if (loadingWorkspaceId.value !== null) {
      return
    }
    loadingWorkspaceId.value = workspaceId
    const path = workspaceDetailPath(workspaceId)
    void preloadRouteComponents(path).catch(() => {})
    void prefetch(slug.value, String(workspaceId))
    revalidateWorkspaceInBackground(slug.value, workspaceId)
    void router.push(path)
      .catch((e: unknown) => {
        error.value = e instanceof Error ? e.message : 'スペースを開けませんでした'
      })
      .finally(() => {
        if (loadingWorkspaceId.value === workspaceId) {
          loadingWorkspaceId.value = null
        }
      })
  }

  function warmVisibleWorkspaceBoards () {
    if (!pageReady.value || !import.meta.client) {
      return
    }
    for (const workspace of visibleWorkspaces.value) {
      warmWorkspaceBoard(workspace.id)
    }
  }

  watch(
    () => [pageReady.value, visibleWorkspaces.value] as const,
    () => {
      warmVisibleWorkspaceBoards()
    },
    { immediate: true },
  )

  watch(pageReady, async (ready) => {
    if (!ready) {
      return
    }
    await nextTick()
    revealLoadedWorkspaces()
  }, { immediate: true })

  onBeforeMount(() => {
    if (getOrgWorkspaceIndexCached(slug.value)) {
      pageReady.value = true
    }
  })

  onActivated(() => {
    if (getOrgWorkspaceIndexCached(slug.value)) {
      pageReady.value = true
    }
    if (pageReady.value) {
      void load({ refresh: true })
    }
  })

  onMounted(() => {
    if (!pageReady.value) {
      void load()
    }
    if (!import.meta.client) {
      return
    }
    nextTick(() => {
      bindStickyOffsets()
    })
  })

  onBeforeUnmount(() => {
    if (!import.meta.client) {
      return
    }
    unbindStickyOffsets()
  })

  return {
    pageReady,
    fatalLoadError,
    pending,
    error,
    searchQuery,
    sortMode,
    archivePending,
    workspaces,
    orgLabels,
    orgLabelCategories,
    orgMembers,
    workspaceStatuses,
    listFilters,
    justCreatedWorkspaceIds,
    listWrapShouldFadeIn,
    loadingWorkspaceId,
    listPageCssVars,
    visibleWorkspaces,
    isWorkspaceJustCreated,
    load,
    retryInitialLoad,
    createWorkspace,
    updateWorkspace,
    confirmWorkspaceArchive,
    pinWorkspace,
    unpinWorkspace,
    onWorkspaceRestored,
    onWorkspacePermanentlyDeleted,
    warmWorkspaceBoard,
    onWorkspacePointerDown,
    goToWorkspace,
  }
}
