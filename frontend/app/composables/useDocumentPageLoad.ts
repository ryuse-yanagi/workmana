import type { MaybeRefOrGetter } from 'vue'
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from './raceWithTimeout'
import { withAppLoadingCursor } from './useAppLoadingCursor'
import {
  useOrgDocumentsPageData,
  type OrgDocument,
  type OrgDocumentCategory,
} from './useOrgDocumentsPageData'
import type { TaskFormCategory } from './useTaskFormHelpers'
import {
  removeDocumentFromWorkspaceDetailCache,
  useWorkspaceDetailMeta,
} from './useWorkspaceDetailMeta'
import { useOrgSafeRedirect } from './useOrgSafeRedirect'
import type { OrgWorkspaceDocumentItem } from './useOrgWorkspaceIndexPageData'
import { workspaceDocumentPath } from './useWorkspaceViewRoutes'
import { resolveStandardColors } from '../utils/colorPresetResolution'
import {
  standardColorEmphasisText,
  standardColorSurfaceBackground,
} from '../constants/colorPresets'
import { isAccessDeniedMessage } from '../utils/resourceAccessError'

/**
 * 資料詳細ページの取得・シェル用メタ・サイドバー一覧ヘルパ。
 */
export function useDocumentPageLoad (options: {
  orgSlug: MaybeRefOrGetter<string>
  workspaceId: MaybeRefOrGetter<string>
  documentId: MaybeRefOrGetter<string>
  onLayoutAfterLoad?: () => void | Promise<void>
  onRetryReset?: () => void
}) {
  const router = useRouter()
  const slug = computed(() => String(toValue(options.orgSlug) ?? '').trim())
  const workspaceId = computed(() => String(toValue(options.workspaceId) ?? ''))
  const documentId = computed(() => String(toValue(options.documentId) ?? ''))
  const { redirectToOrgWorkspaceList } = useOrgSafeRedirect()
  const {
    fetchSnapshot,
    getCached,
    fetchDocument,
    prefetchDocument,
    getDocumentCached,
    invalidateDocumentCached,
    removeDocumentCached,
  } = useOrgDocumentsPageData()

  const currentDocument = ref<OrgDocument | null>(null)
  const parentWorkspaceId = computed(() => (
    workspaceId.value || String(currentDocument.value?.workspace_id ?? '')
  ))
  const {
    workspace: parentWorkspace,
    ensureLoaded: ensureParentWorkspaceLoaded,
  } = useWorkspaceDetailMeta(() => slug.value, () => parentWorkspaceId.value)
  const workspaceDocuments = computed(() => parentWorkspace.value?.documents ?? [])

  const documentCategories = ref<OrgDocumentCategory[]>([])
  const pageReady = ref(false)
  const fatalLoadError = ref<string | null>(null)
  const isDocumentShellLoading = computed(() => !pageReady.value && !fatalLoadError.value)

  const pendingDocumentMeta = computed((): OrgWorkspaceDocumentItem | null => {
    const id = Number(documentId.value)
    if (!Number.isFinite(id)) {
      return null
    }
    return workspaceDocuments.value.find(item => item.id === id) ?? null
  })
  const shellWorkspaceId = computed(() => (
    parentWorkspaceId.value
    || String(currentDocument.value?.workspace_id ?? workspaceId.value)
  ))
  const shellWorkspaceName = computed(() => (
    parentWorkspace.value?.name
    ?? currentDocument.value?.workspace_name
    ?? null
  ))
  const shellDocumentName = computed(() => (
    currentDocument.value?.name
    ?? pendingDocumentMeta.value?.name
    ?? null
  ))
  const shellDocumentDescription = computed(() => {
    if (currentDocument.value) {
      return currentDocument.value.description
    }
    const description = pendingDocumentMeta.value?.description
    return description == null ? null : description
  })
  const shellCategoryOption = computed((): TaskFormCategory | null => {
    if (currentDocument.value) {
      return resolveDocumentCategoryOption(currentDocument.value.category)
    }
    const category = pendingDocumentMeta.value?.category
    if (!category) {
      return null
    }
    return resolveDocumentCategoryOption(category)
  })

  function resolveDocumentCategoryOption (
    category: OrgDocument['category'] | OrgWorkspaceDocumentItem['category'],
  ): TaskFormCategory | null {
    if (!category) {
      return null
    }
    const resolved = resolveStandardColors([category])[0]
    if (!resolved?.color) {
      return null
    }
    return {
      name: resolved.name,
      color: resolved.color,
    }
  }

  function applyDocument (value: OrgDocument): boolean {
    if (value.archived_at) {
      removeDocumentCached(slug.value, value.id)
      removeDocumentFromWorkspaceDetailCache(slug.value, value.workspace_id, value.id)
      void navigateTo(`/org/${slug.value}/workspaces/${value.workspace_id}`)
      return false
    }
    const routeWorkspaceId = Number(workspaceId.value)
    if (Number.isFinite(routeWorkspaceId) && value.workspace_id !== routeWorkspaceId) {
      void navigateTo(
        workspaceDocumentPath(slug.value, value.workspace_id, value.id),
        { replace: true },
      )
      return false
    }
    currentDocument.value = value
    void ensureParentWorkspaceLoaded()
    return true
  }

  function prefetchWorkspaceDocument (targetDocumentId: number): void {
    if (!import.meta.client) {
      return
    }
    if (Number(documentId.value) === targetDocumentId && pageReady.value) {
      return
    }
    const path = workspaceDocumentPath(slug.value, parentWorkspaceId.value, targetDocumentId)
    void preloadRouteComponents(path).catch(() => {})
    void prefetchDocument(slug.value, targetDocumentId).catch(() => {})
  }

  function navigateToWorkspaceDocument (targetDocumentId: number): void {
    if (currentDocument.value?.id === targetDocumentId) {
      return
    }
    prefetchWorkspaceDocument(targetDocumentId)
    void router.push(workspaceDocumentPath(slug.value, parentWorkspaceId.value, targetDocumentId))
  }

  function documentDescription (document: OrgWorkspaceDocumentItem): string | null {
    const text = document.description?.trim()
    return text || null
  }

  function documentCategoryLabel (document: OrgWorkspaceDocumentItem) {
    const category = document.category ?? null
    if (!category?.name?.trim()) {
      return null
    }
    const resolved = resolveStandardColors([category])[0] ?? category
    if (!resolved.color) {
      return null
    }
    return {
      name: resolved.name ?? category.name,
      color: standardColorSurfaceBackground(resolved.color),
    }
  }

  function documentCategoryTextColor (document: OrgWorkspaceDocumentItem): string | undefined {
    const category = document.category
    if (!category?.name?.trim()) {
      return undefined
    }
    const resolved = resolveStandardColors([category])[0] ?? category
    if (!resolved.color) {
      return undefined
    }
    return standardColorEmphasisText(resolved.color)
  }

  function applyCategories (categories: OrgDocumentCategory[]) {
    documentCategories.value = categories
  }

  async function ensureCategoriesLoaded () {
    const cached = getCached(slug.value)
    if (cached) {
      applyCategories(cached.documentCategories)
      return
    }
    try {
      const snapshot = await fetchSnapshot(slug.value)
      applyCategories(snapshot.documentCategories)
    } catch {
      // カテゴリ取得失敗時はプルダウンを空のままにする
    }
  }

  async function redirectAwayFromMissingDocument (): Promise<void> {
    if (workspaceId.value) {
      await navigateTo(`/org/${slug.value}/workspaces/${workspaceId.value}`, { replace: true })
      return
    }
    await redirectToOrgWorkspaceList(slug.value)
  }

  let loadInflight: Promise<void> | null = null
  async function load () {
    if (loadInflight) {
      await loadInflight
      return
    }
    loadInflight = (async () => {
      fatalLoadError.value = null
      void ensureCategoriesLoaded()
      const detailCached = getDocumentCached(slug.value, documentId.value)
      const cached = detailCached
      if (cached) {
        if (applyDocument(cached)) {
          pageReady.value = true
        }
        return
      }
      try {
        await withAppLoadingCursor(async () => {
          const result = await raceWithTimeout(
            () => fetchDocument(slug.value, documentId.value),
            TM_PAGE_LOAD_TIMEOUT_MS,
          )
          if (!result.ok) {
            if (result.reason === 'timeout') {
              fatalLoadError.value = timeoutMessage()
              return
            }
            if (isAccessDeniedMessage(result.message)) {
              await redirectAwayFromMissingDocument()
              return
            }
            fatalLoadError.value = result.message
            return
          }
          if (applyDocument(result.value)) {
            pageReady.value = true
          }
        })
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : '読み込みに失敗しました'
        if (isAccessDeniedMessage(message)) {
          await redirectAwayFromMissingDocument()
          return
        }
        fatalLoadError.value = message
      } finally {
        if (import.meta.client) {
          await nextTick()
          await options.onLayoutAfterLoad?.()
        }
      }
    })()
    try {
      await loadInflight
    } finally {
      loadInflight = null
    }
  }

  function retryLoad () {
    invalidateDocumentCached(slug.value, documentId.value)
    pageReady.value = false
    currentDocument.value = null
    options.onRetryReset?.()
    void load()
  }

  function hydrateFromCache (): boolean {
    const cached = getDocumentCached(slug.value, documentId.value)
    if (cached && applyDocument(cached)) {
      pageReady.value = true
      return true
    }
    return false
  }

  function bootstrapLoad () {
    if (hydrateFromCache()) {
      return
    }
    if (!pageReady.value) {
      void load()
    }
  }

  onBeforeMount(() => {
    bootstrapLoad()
    void ensureCategoriesLoaded()
    void ensureParentWorkspaceLoaded()
  })

  onActivated(() => {
    bootstrapLoad()
    void ensureCategoriesLoaded()
    void ensureParentWorkspaceLoaded()
    if (import.meta.client) {
      void nextTick(async () => {
        await options.onLayoutAfterLoad?.()
      })
    }
  })

  onMounted(() => {
    if (!pageReady.value && !fatalLoadError.value) {
      void load()
    } else {
      void ensureCategoriesLoaded()
    }
  })

  return {
    currentDocument,
    parentWorkspaceId,
    parentWorkspace,
    workspaceDocuments,
    documentCategories,
    pageReady,
    fatalLoadError,
    isDocumentShellLoading,
    pendingDocumentMeta,
    shellWorkspaceId,
    shellWorkspaceName,
    shellDocumentName,
    shellDocumentDescription,
    shellCategoryOption,
    resolveDocumentCategoryOption,
    applyDocument,
    prefetchWorkspaceDocument,
    navigateToWorkspaceDocument,
    documentDescription,
    documentCategoryLabel,
    documentCategoryTextColor,
    ensureCategoriesLoaded,
    load,
    retryLoad,
  }
}
