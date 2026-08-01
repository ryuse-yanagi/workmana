<template>
  <main
    class="list-page"
    :style="listPageCssVars"
  >
    <template v-if="fatalLoadError">
      <PageLoadFatal :message="fatalLoadError" @retry="retryInitialLoad" />
    </template>
    <template v-else-if="pageReady">
      <header class="page-header">
        <div class="subheader">
          <p class="subheader-title">Documents</p>
          <div class="subheader-filters">
            <select v-model="sortMode" class="header-sort" aria-label="並び順">
              <option value="newest">ID降順</option>
              <option value="oldest">ID昇順</option>
              <option value="name">名前順</option>
            </select>
            <p class="subheader-count" aria-live="polite">{{ visibleDocuments.length }} 件</p>
            <input
              v-model.trim="searchQuery"
              class="header-search"
              type="search"
              placeholder="資料名で検索"
              aria-label="検索"
            />
          </div>
          <button
            class="ghost-btn"
            type="button"
            :disabled="pending"
            @click="archivedDocumentsOpen = true"
          >
            <Archive :size="18" :stroke-width="2.25" aria-hidden="true" />
            アーカイブ済み
          </button>
          <button
            class="primary-btn"
            type="button"
            :disabled="pending"
            @click="openDocumentCreateModal"
          >
            <NotebookPen :size="20" :stroke-width="2.25" aria-hidden="true" />
            資料作成
          </button>
        </div>
      </header>
      <div class="page-shell-fade">
        <p v-if="error" class="err">{{ error }}</p>
        <section class="table-card">
          <div class="table-wrap">
            <table class="document-table">
              <thead>
                <tr>
                  <th>資料名</th>
                  <th>説明</th>
                  <th>カテゴリ</th>
                  <th aria-hidden="true"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!visibleDocuments.length">
                  <td colspan="4" class="empty">該当する資料がありません。</td>
                </tr>
                  <tr
                  v-for="document in visibleDocuments"
                  :key="document.id"
                  :class="[
                    'clickable-row',
                    {
                      'document-row--fade-in': isDocumentJustCreated(document.id),
                      'document-row--loading': loadingDocumentId === document.id,
                    },
                  ]"
                  role="button"
                  tabindex="0"
                  :aria-busy="loadingDocumentId === document.id"
                  @pointerenter="warmDocument(document.id)"
                  @focusin="warmDocument(document.id)"
                  @pointerdown="onDocumentPointerDown($event, document.id)"
                  @pointermove="onDocumentPointerMove($event, document.id)"
                  @pointerup="onDocumentPointerUp($event, document.id)"
                  @pointercancel="onDocumentPointerCancel"
                  @contextmenu.prevent="onDocumentContextMenu(document.id, $event)"
                  @keydown.enter.prevent="goToDocument(document.id)"
                  @keydown.space.prevent="goToDocument(document.id)"
                >
                  <td colspan="4" class="document-card-cell">
                    <div class="document-card">
                      <div
                        v-if="document.labels?.length"
                        class="document-card__labels"
                      >
                        <OverflowFlexRow :watch-key="document.labels.length">
                          <LabelStrip
                            v-for="label in document.labels"
                            :key="label.id"
                            :label="label"
                            size="md"
                          />
                        </OverflowFlexRow>
                      </div>
                      <div class="document-card__body">
                        <div class="document-card__name">
                          <p class="name-text">{{ document.name }}</p>
                        </div>
                        <div class="document-card__description">
                          <p v-if="document.description" class="description-text">
                            {{ document.description }}
                          </p>
                        </div>
                        <div class="document-card__category">
                          <DocumentCategorySelect
                            :category="resolveDocumentCategoryOption(document.category)"
                            :categories="documentCategories"
                            :pending="updatingCategoryDocumentId === document.id"
                            @select="category => updateDocumentCategory(document, category)"
                          />
                        </div>
                        <div class="document-card__actions">
                          <button
                            type="button"
                            class="document-card__menu-btn"
                            aria-label="資料のメニュー"
                            :aria-expanded="openMenuDocumentId === document.id"
                            @pointerdown.stop
                            @pointerup.stop
                            @click.stop="toggleDocumentMenu(document.id, $event)"
                          >
                            <Ellipsis :size="20" :stroke-width="2.25" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <FloatingMenu
        :open="Boolean(openMenuDocument && documentMenuPosition)"
        :style="documentMenuStyle"
        :disabled="pending"
        :items="documentMenuItems"
        @select="onDocumentMenuSelect"
      />
      <DocumentCreateModal
        v-model="documentFormModalOpen"
        :mode="documentFormMode"
        :title="documentFormMode === 'edit' ? '資料の編集' : '資料の作成'"
        :initial-values="documentFormInitialValues"
        :org-slug="slug"
        :labels="documentLabels"
        :categories="documentCategories"
        :loading="pending"
        @submit="onDocumentFormSubmit"
      />
      <ConfirmModal
        v-model="documentArchiveConfirmOpen"
        title="資料のアーカイブ確認"
        :message="documentArchiveTarget ? `「${documentArchiveTarget.name}」をアーカイブしますか？` : ''"
        confirm-text="アーカイブ"
        :loading="archivePending"
        @confirm="confirmDocumentArchive"
      />
      <ArchivedNamedItemsModal
        v-model="archivedDocumentsOpen"
        :org-slug="slug"
        resource="documents"
        item-kind="資料"
        :can-manage-archive="isOrgAdmin"
        @restored="onDocumentRestored"
        @deleted="onDocumentPermanentlyDeleted"
      />
    </template>
  </main>
</template>
<script setup lang="ts">
import { Archive, Ellipsis, NotebookPen } from 'lucide-vue-next'
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from '../../../../composables/raceWithTimeout'
import { withAppLoadingCursor } from '../../../../composables/useAppLoadingCursor'
import { useApi } from '../../../../composables/useApi'
import {
  useOrgDocumentsPageData,
  type OrgDocument,
  type OrgDocumentCategory,
  type OrgDocumentsPageSnapshot,
} from '../../../../composables/useOrgDocumentsPageData'
import type { TaskFormCategory, TaskFormLabel } from '../../../../composables/useTaskFormHelpers'
import { resolveLabelColors, resolveStandardColors } from '../../../../utils/colorPresetResolution'
import {
  getTopmostModalOverlay,
  isKeyboardShortcutBlockedTarget,
} from '../../../../utils/uiInteraction'
import DocumentCategorySelect from '../../../../components/documents/DocumentCategorySelect.vue'
import DocumentCreateModal from '../../../../components/modals/DocumentCreateModal.vue'
import ArchivedNamedItemsModal from '../../../../components/modals/ArchivedNamedItemsModal.vue'
import ConfirmModal from '../../../../components/modals/ConfirmModal.vue'
import FloatingMenu, { type FloatingMenuItem } from '../../../../components/ui/FloatingMenu.vue'
import LabelStrip from '../../../../components/ui/LabelStrip.vue'
import OverflowFlexRow from '../../../../components/ui/OverflowFlexRow.vue'
import { useOrgRole } from '../../../../composables/useOrgRole'
definePageMeta({
  name: 'org-slug-documents',
  key: route => route.fullPath,
  keepalive: true,
})
const route = useRoute()
const slug = computed(() => route.params.slug as string)
const { isOrgAdmin } = useOrgRole(slug)
const { api } = useApi()
const {
  fetchSnapshot,
  getCached,
  invalidateCached,
  prefetchDocument,
  invalidateDocumentCached,
} = useOrgDocumentsPageData()
const documents = ref<OrgDocumentsPageSnapshot['documents']>([])
const documentCategories = ref<OrgDocumentCategory[]>([])
const documentLabels = ref<TaskFormLabel[]>([])
const pageReady = ref(false)
const fatalLoadError = ref<string | null>(null)
const error = ref<string | null>(null)
const pending = ref(false)
const documentFormModalOpen = ref(false)
const documentFormMode = ref<'create' | 'edit'>('create')
const documentEditTarget = ref<OrgDocument | null>(null)
const documentArchiveConfirmOpen = ref(false)
const documentArchiveTarget = ref<OrgDocument | null>(null)
const archivedDocumentsOpen = ref(false)
const archivePending = ref(false)
const openMenuDocumentId = ref<number | null>(null)
const documentMenuPosition = ref<{ top: number; left: number } | null>(null)
const DOCUMENT_MENU_MIN_WIDTH = 160
const searchQuery = ref('')
const debouncedSearchQuery = ref('')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
const sortMode = ref<'newest' | 'oldest' | 'name'>('newest')
const loadingDocumentId = ref<number | null>(null)
const updatingCategoryDocumentId = ref<number | null>(null)
const justCreatedDocumentIds = reactive<Record<number, true>>({})
const globalHeaderOffsetPx = ref(46)
const CLICK_MOVE_TOLERANCE_PX = 6
const pointerPressState = ref<{
  documentId: number
  pointerId: number
  startX: number
  startY: number
  moved: boolean
} | null>(null)
const listPageCssVars = computed(() => ({
  '--global-header-offset': `${globalHeaderOffsetPx.value}px`,
  '--app-shell-page-pad': '3.5px',
} as Record<string, string>))
const visibleDocuments = computed(() => {
  const query = debouncedSearchQuery.value.trim().toLowerCase()
  const filtered = query
    ? documents.value
    : searchQuery.value.trim()
      ? documents.value.filter(document => document.name.toLowerCase().includes(searchQuery.value.trim().toLowerCase()))
      : [...documents.value]
  if (sortMode.value === 'name') {
    return filtered.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  }
  if (sortMode.value === 'oldest') {
    return filtered.sort((a, b) => a.id - b.id)
  }
  return filtered.sort((a, b) => b.id - a.id)
})
const openMenuDocument = computed(() => {
  const id = openMenuDocumentId.value
  if (id == null) return null
  return documents.value.find(document => document.id === id) ?? null
})
const documentMenuStyle = computed(() => {
  if (!documentMenuPosition.value) {
    return undefined
  }
  const { top, left } = documentMenuPosition.value
  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${DOCUMENT_MENU_MIN_WIDTH}px`,
    zIndex: 80,
  }
})
const documentFormInitialValues = computed(() => {
  if (documentFormMode.value !== 'edit' || !documentEditTarget.value) {
    return null
  }
  const target = documentEditTarget.value
  const labels = (target.labels ?? []).map((label) => {
    const fromOrg = documentLabels.value.find(item => item.id === label.id)
    return fromOrg ?? {
      id: label.id,
      name: label.name,
      color: '',
    }
  })
  return {
    name: target.name,
    description: target.description ?? null,
    category: resolveDocumentCategoryOption(target.category),
    labels,
  }
})
function resolveDocumentCategoryOption (category: OrgDocument['category']): TaskFormCategory | null {
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
function applyDocumentCategoryLocally (documentId: number, category: OrgDocument['category']) {
  documents.value = documents.value.map(document => (
    document.id === documentId
      ? { ...document, category }
      : document
  ))
}
async function updateDocumentCategory (document: OrgDocument, category: TaskFormCategory) {
  if (document.category?.name === category.name || updatingCategoryDocumentId.value !== null) {
    return
  }
  const previousCategory = document.category ?? null
  const nextCategory = {
    name: category.name,
    color_index: documentCategories.value.find(item => item.name === category.name)?.color_index ?? 0,
  }
  updatingCategoryDocumentId.value = document.id
  error.value = null
  applyDocumentCategoryLocally(document.id, nextCategory)
  try {
    const updated = await api<OrgDocument>(`/orgs/${slug.value}/documents/${document.id}`, {
      method: 'PATCH',
      body: { category: category.name },
    })
    applyDocumentCategoryLocally(document.id, updated.category)
  } catch (e: unknown) {
    applyDocumentCategoryLocally(document.id, previousCategory)
    error.value = e instanceof Error ? e.message : 'カテゴリの更新に失敗しました'
  } finally {
    if (updatingCategoryDocumentId.value === document.id) {
      updatingCategoryDocumentId.value = null
    }
  }
}
let globalHeaderObserver: ResizeObserver | null = null
function readGlobalHeaderHeight (): number {
  if (!import.meta.client) {
    return 52
  }
  const el = document.querySelector('.global-header') as HTMLElement | null
  if (!el) {
    return 52
  }
  return Math.ceil(el.getBoundingClientRect().height)
}
function updateStickyOffsets () {
  if (!import.meta.client) {
    return
  }
  globalHeaderOffsetPx.value = readGlobalHeaderHeight()
}
function applySnapshot (snapshot: OrgDocumentsPageSnapshot) {
  documents.value = snapshot.documents
  documentCategories.value = snapshot.documentCategories
  documentLabels.value = snapshot.documentLabels
}
function openDocumentCreateModal () {
  closeDocumentMenu()
  documentFormMode.value = 'create'
  documentEditTarget.value = null
  documentFormModalOpen.value = true
}
function closeDocumentMenu () {
  openMenuDocumentId.value = null
  documentMenuPosition.value = null
}
function positionDocumentMenu (anchor: HTMLElement) {
  if (!import.meta.client) {
    documentMenuPosition.value = null
    return
  }
  const rect = anchor.getBoundingClientRect()
  const pad = 8
  const gap = 4
  const menuWidth = DOCUMENT_MENU_MIN_WIDTH
  let left = rect.right + gap
  if (left + menuWidth > window.innerWidth - pad) {
    left = Math.max(pad, rect.left - gap - menuWidth)
  }
  documentMenuPosition.value = {
    top: rect.top,
    left,
  }
}
function openDocumentMenu (documentId: number, anchor: HTMLElement) {
  if (openMenuDocumentId.value === documentId) {
    closeDocumentMenu()
    return
  }
  positionDocumentMenu(anchor)
  openMenuDocumentId.value = documentId
}
function toggleDocumentMenu (documentId: number, event: MouseEvent) {
  const el = event.currentTarget
  if (!(el instanceof HTMLElement)) {
    return
  }
  openDocumentMenu(documentId, el)
}
function onDocumentContextMenu (documentId: number, event: MouseEvent) {
  pointerPressState.value = null
  const row = event.currentTarget
  if (!(row instanceof HTMLElement)) {
    return
  }
  const trigger = row.querySelector('.document-card__menu-btn')
  if (!(trigger instanceof HTMLElement)) {
    return
  }
  openDocumentMenu(documentId, trigger)
}
function openDocumentEditModal (document: OrgDocument) {
  closeDocumentMenu()
  documentFormMode.value = 'edit'
  documentEditTarget.value = document
  documentFormModalOpen.value = true
}
function openDocumentArchiveConfirm (document: OrgDocument) {
  closeDocumentMenu()
  documentArchiveTarget.value = document
  documentArchiveConfirmOpen.value = true
}
const documentMenuItems: FloatingMenuItem[] = [
  { key: 'edit', label: '編集' },
  { key: 'archive', label: 'アーカイブ' },
]
function onDocumentMenuSelect (item: FloatingMenuItem) {
  const document = openMenuDocument.value
  if (!document) return
  if (item.key === 'edit') {
    openDocumentEditModal(document)
    return
  }
  if (item.key === 'archive') {
    openDocumentArchiveConfirm(document)
  }
}
function onGlobalClick (ev: Event) {
  const t = ev.target
  if (t instanceof Node) {
    const el = t instanceof Element ? t : t.parentElement
    if (el?.closest('.document-card__menu-btn')) {
      return
    }
    if (el?.closest('[data-floating-menu]')) {
      return
    }
  }
  closeDocumentMenu()
}
function onWindowResize () {
  closeDocumentMenu()
}
function canUseDocumentListKeyboardShortcut (): boolean {
  if (!pageReady.value || fatalLoadError.value) {
    return false
  }
  if (getTopmostModalOverlay()) {
    return false
  }
  if (
    documentFormModalOpen.value
    || documentArchiveConfirmOpen.value
    || archivedDocumentsOpen.value
    || openMenuDocumentId.value !== null
    || pending.value
    || archivePending.value
  ) {
    return false
  }
  return true
}
function onDocumentListKeydown (event: KeyboardEvent) {
  const key = event.key
  if (key !== 'n' && key !== 'N') {
    return
  }
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
    return
  }
  if (isKeyboardShortcutBlockedTarget(event.target)) {
    return
  }
  if (!canUseDocumentListKeyboardShortcut()) {
    return
  }
  event.preventDefault()
  openDocumentCreateModal()
}
function isDocumentJustCreated (documentId: number): boolean {
  return !!justCreatedDocumentIds[documentId]
}
function markDocumentAsJustCreated (documentId: number) {
  justCreatedDocumentIds[documentId] = true
  setTimeout(() => {
    delete justCreatedDocumentIds[documentId]
  }, 260)
}
async function createDocument (payload: {
  name: string
  description: string | null
  category: string | null
  label_ids: number[]
}) {
  pending.value = true
  error.value = null
  try {
    await withAppLoadingCursor(async () => {
      const createdDocument = await api<OrgDocument>(`/orgs/${slug.value}/documents`, {
        method: 'POST',
        body: {
          name: payload.name,
          description: payload.description,
          category: payload.category,
          label_ids: payload.label_ids,
        },
      })
      documentFormModalOpen.value = false
      await load({ refresh: true })
      markDocumentAsJustCreated(createdDocument.id)
    })
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '作成に失敗しました'
  } finally {
    pending.value = false
  }
}
async function updateDocument (payload: {
  name: string
  description: string | null
  category: string | null
  label_ids: number[]
}) {
  const target = documentEditTarget.value
  if (!target) return
  pending.value = true
  error.value = null
  try {
    await withAppLoadingCursor(async () => {
      await api<OrgDocument>(`/orgs/${slug.value}/documents/${target.id}`, {
        method: 'PATCH',
        body: {
          name: payload.name,
          description: payload.description,
          category: payload.category,
          label_ids: payload.label_ids,
        },
      })
      documentFormModalOpen.value = false
      documentEditTarget.value = null
      invalidateCached(slug.value)
      invalidateDocumentCached(slug.value, target.id)
      await load({ refresh: true })
    })
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '更新に失敗しました'
  } finally {
    pending.value = false
  }
}
async function onDocumentFormSubmit (payload: {
  name: string
  description: string | null
  category: string | null
  label_ids: number[]
}) {
  if (documentFormMode.value === 'edit') {
    await updateDocument(payload)
    return
  }
  await createDocument(payload)
}
async function confirmDocumentArchive () {
  const target = documentArchiveTarget.value
  if (!target || archivePending.value) return
  archivePending.value = true
  error.value = null
  try {
    await withAppLoadingCursor(async () => {
      await api(`/orgs/${slug.value}/documents/${target.id}/archive`, {
        method: 'POST',
      })
      documentArchiveConfirmOpen.value = false
      documentArchiveTarget.value = null
      documents.value = documents.value.filter(document => document.id !== target.id)
      invalidateCached(slug.value)
      invalidateDocumentCached(slug.value, target.id)
    })
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'アーカイブに失敗しました'
  } finally {
    archivePending.value = false
  }
}

function onDocumentRestored () {
  invalidateCached(slug.value)
  void load({ refresh: true })
}

function onDocumentPermanentlyDeleted (documentId: number) {
  invalidateCached(slug.value)
  invalidateDocumentCached(slug.value, documentId)
}
async function load (opts?: { refresh?: boolean }) {
  const refresh = opts?.refresh ?? false
  error.value = null
  if (!refresh) {
    fatalLoadError.value = null
  }
  try {
    if (!pageReady.value && !refresh) {
      const cached = getCached(slug.value)
      if (cached) {
        applySnapshot(cached)
        pageReady.value = true
        return
      }
      await withAppLoadingCursor(async () => {
        const result = await raceWithTimeout(
          () => fetchSnapshot(slug.value),
          TM_PAGE_LOAD_TIMEOUT_MS,
        )
        if (!result.ok) {
          fatalLoadError.value = result.reason === 'timeout' ? timeoutMessage() : result.message
          return
        }
        applySnapshot(result.value)
        pageReady.value = true
      })
    } else {
      await withAppLoadingCursor(async () => {
        const snapshot = await fetchSnapshot(slug.value)
        applySnapshot(snapshot)
        pageReady.value = true
      })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '読み込みに失敗しました'
    if (!pageReady.value && !refresh) {
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
  invalidateCached(slug.value)
  pageReady.value = false
  void load({ refresh: true })
}
function warmDocument (documentId: number) {
  void prefetchDocument(slug.value, documentId)
}
function onDocumentPointerDown (event: PointerEvent, documentId: number) {
  if (event.button !== 0 || loadingDocumentId.value !== null) {
    pointerPressState.value = null
    return
  }
  pointerPressState.value = {
    documentId,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
  }
}
function onDocumentPointerMove (event: PointerEvent, documentId: number) {
  const state = pointerPressState.value
  if (!state || state.documentId !== documentId || state.pointerId !== event.pointerId) {
    return
  }
  if (state.moved) return
  const movedX = Math.abs(event.clientX - state.startX)
  const movedY = Math.abs(event.clientY - state.startY)
  if (movedX > CLICK_MOVE_TOLERANCE_PX || movedY > CLICK_MOVE_TOLERANCE_PX) {
    state.moved = true
  }
}
function onDocumentPointerCancel () {
  pointerPressState.value = null
}
function onDocumentPointerUp (event: PointerEvent, documentId: number) {
  const state = pointerPressState.value
  pointerPressState.value = null
  if (!state || state.documentId !== documentId || state.pointerId !== event.pointerId) {
    return
  }
  if (state.moved) {
    return
  }
  void goToDocument(documentId)
}
async function goToDocument (documentId: number) {
  if (loadingDocumentId.value !== null) {
    return
  }
  loadingDocumentId.value = documentId
  try {
    try {
      await prefetchDocument(slug.value, documentId)
    } catch {
      // 詳細画面側で再取得する
    }
    await navigateTo(`/org/${slug.value}/documents/${documentId}`)
  } finally {
    if (loadingDocumentId.value === documentId) {
      loadingDocumentId.value = null
    }
  }
}
function warmVisibleDocuments () {
  if (!pageReady.value) {
    return
  }
  for (const document of visibleDocuments.value) {
    void prefetchDocument(slug.value, document.id)
  }
}

async function fetchDocumentsWithSearch (query: string) {
  const q = query.trim()
  const path = q
    ? `/orgs/${slug.value}/documents?q=${encodeURIComponent(q)}`
    : `/orgs/${slug.value}/documents`
  const res = await api<{ data: OrgDocument[] }>(path)
  documents.value = (res.data ?? []).map(document => ({
    ...document,
    labels: resolveLabelColors(document.labels ?? []),
  }))
}

watch(searchQuery, (value) => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }
  searchDebounceTimer = setTimeout(() => {
    debouncedSearchQuery.value = value.trim()
  }, 300)
})

watch(debouncedSearchQuery, (query) => {
  if (!pageReady.value) {
    return
  }
  void fetchDocumentsWithSearch(query).catch((e: unknown) => {
    error.value = e instanceof Error ? e.message : '検索に失敗しました'
  })
})

watch(
  () => [pageReady.value, visibleDocuments.value] as const,
  () => {
    warmVisibleDocuments()
  },
  { immediate: true },
)
onBeforeMount(() => {
  const cached = getCached(slug.value)
  if (cached) {
    applySnapshot(cached)
    pageReady.value = true
  }
})
onActivated(() => {
  const cached = getCached(slug.value)
  if (cached) {
    applySnapshot(cached)
    pageReady.value = true
  } else if (pageReady.value) {
    // 詳細画面などでキャッシュが無効化された場合、keepalive の古い一覧を捨てて再取得
    void load({ refresh: true })
  }
  if (import.meta.client) {
    document.addEventListener('keydown', onDocumentListKeydown)
  }
})
onDeactivated(() => {
  closeDocumentMenu()
  if (import.meta.client) {
    document.removeEventListener('keydown', onDocumentListKeydown)
  }
})
onMounted(() => {
  if (!pageReady.value) {
    void load()
  }
  if (!import.meta.client) {
    return
  }
  document.addEventListener('click', onGlobalClick)
  document.addEventListener('keydown', onDocumentListKeydown)
  window.addEventListener('resize', onWindowResize)
  nextTick(() => {
    updateStickyOffsets()
    const globalHeader = document.querySelector('.global-header') as HTMLElement | null
    if (globalHeader && 'ResizeObserver' in window) {
      globalHeaderObserver = new ResizeObserver(() => {
        updateStickyOffsets()
      })
      globalHeaderObserver.observe(globalHeader)
    }
    window.addEventListener('resize', updateStickyOffsets)
  })
})
onBeforeUnmount(() => {
  if (!import.meta.client) {
    return
  }
  document.removeEventListener('click', onGlobalClick)
  document.removeEventListener('keydown', onDocumentListKeydown)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('resize', updateStickyOffsets)
  globalHeaderObserver?.disconnect()
  globalHeaderObserver = null
  closeDocumentMenu()
})
</script>
<style lang="scss" scoped src="~/assets/styles/pages/org/slug/documents/index.scss"></style>
