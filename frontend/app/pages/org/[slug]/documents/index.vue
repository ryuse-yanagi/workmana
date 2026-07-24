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
            class="primary-btn"
            type="button"
            :disabled="pending"
            @click="openDocumentCreateModal"
          >
            <NotebookPen :size="20" :stroke-width="2.25" aria-hidden="true" />
            新規作成
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
      <Teleport to="body">
        <ul
          v-if="openMenuDocument && documentMenuPosition"
          class="document-card-menu-dropdown"
          role="menu"
          :style="documentMenuStyle"
        >
          <li role="none">
            <button
              type="button"
              class="document-card-menu-item"
              role="menuitem"
              :disabled="pending"
              @click="openDocumentEditModal(openMenuDocument)"
            >
              編集
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              class="document-card-menu-item document-card-menu-item--danger"
              role="menuitem"
              :disabled="pending"
              @click="openDocumentDeleteModal(openMenuDocument)"
            >
              削除
            </button>
          </li>
        </ul>
      </Teleport>
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
      <DocumentDeleteModal
        ref="documentDeleteModalRef"
        v-model="documentDeleteModalOpen"
        :document-name="documentDeleteTarget?.name ?? ''"
        :loading="deletePending"
        @confirm="confirmDocumentDelete"
      />
    </template>
  </main>
</template>
<script setup lang="ts">
import { Ellipsis, NotebookPen } from 'lucide-vue-next'
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
import { resolveStandardColors } from '../../../../utils/colorPresetResolution'
import {
  getTopmostModalOverlay,
  isKeyboardShortcutBlockedTarget,
} from '../../../../utils/uiInteraction'
import DocumentCategorySelect from '../../../../components/documents/DocumentCategorySelect.vue'
import DocumentCreateModal from '../../../../components/modals/DocumentCreateModal.vue'
import DocumentDeleteModal from '../../../../components/modals/DocumentDeleteModal.vue'
import LabelStrip from '../../../../components/ui/LabelStrip.vue'
import OverflowFlexRow from '../../../../components/ui/OverflowFlexRow.vue'
definePageMeta({
  name: 'org-slug-documents',
  key: route => route.fullPath,
  keepalive: true,
})
const route = useRoute()
const slug = computed(() => route.params.slug as string)
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
const documentDeleteModalOpen = ref(false)
const documentDeleteTarget = ref<OrgDocument | null>(null)
const documentDeleteModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const deletePending = ref(false)
const openMenuDocumentId = ref<number | null>(null)
const documentMenuPosition = ref<{ top: number; left: number } | null>(null)
const DOCUMENT_MENU_MIN_WIDTH = 160
const searchQuery = ref('')
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
  const query = searchQuery.value.toLowerCase()
  const filtered = query
    ? documents.value.filter(document => document.name.toLowerCase().includes(query))
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
function openDocumentDeleteModal (document: OrgDocument) {
  closeDocumentMenu()
  documentDeleteTarget.value = document
  documentDeleteModalOpen.value = true
}
function onGlobalClick (ev: Event) {
  const t = ev.target
  if (t instanceof Node) {
    const el = t instanceof Element ? t : t.parentElement
    if (el?.closest('.document-card__menu-btn')) {
      return
    }
    if (el?.closest('.document-card-menu-dropdown')) {
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
    || documentDeleteModalOpen.value
    || openMenuDocumentId.value !== null
    || pending.value
    || deletePending.value
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
async function confirmDocumentDelete () {
  const target = documentDeleteTarget.value
  if (!target || deletePending.value) return
  deletePending.value = true
  error.value = null
  try {
    await withAppLoadingCursor(async () => {
      await api(`/orgs/${slug.value}/documents/${target.id}`, {
        method: 'DELETE',
      })
      documentDeleteModalOpen.value = false
      documentDeleteTarget.value = null
      documents.value = documents.value.filter(document => document.id !== target.id)
      invalidateCached(slug.value)
      invalidateDocumentCached(slug.value, target.id)
      await load({ refresh: true })
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '削除に失敗しました'
    documentDeleteModalRef.value?.setSubmitError(message)
    error.value = message
  } finally {
    deletePending.value = false
  }
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
<style lang="scss" scoped>
.list-page {
  min-height: calc(100dvh - var(--global-header-offset, 56px));
  padding: 0 14px 14px;
  margin-top: calc(-1 * var(--app-shell-page-pad, 3.5px));
  padding-top: 0;
  box-sizing: border-box;
}
.table-card,
.err {
  max-width: 1304px;
  margin-left: auto;
  margin-right: auto;
}
.page-header {
  position: sticky;
  top: var(--global-header-offset, 56px);
  z-index: 40;
  width: calc(100% + 28px);
  margin-left: -14px;
  margin-right: -14px;
  @include mixin.page-header-shell;
  padding: 0 14px;
}
.page-header > * {
  width: 100%;
  height: 100%;
}
.subheader {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}
.subheader::-webkit-scrollbar {
  display: none;
}
.subheader-title {
  @include mixin.page-header-title;
  letter-spacing: 0.05em;
}
.subheader-filters {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.header-search,
.header-sort {
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 0 8px;
  font-size: 11.48px;
  background: #fff;
  color: #0f172a;
  box-sizing: border-box;
  height: 32px;
  line-height: 32px;
}
.header-search {
  flex: 1;
  min-width: 84px;
  max-width: 252px;
}
.header-search::placeholder {
  color: #94a3b8;
}
.header-search:focus,
.header-sort:focus {
  @include mixin.input-focus-ring;
}
.header-sort {
  flex-shrink: 0;
  width: 94.5px;
  padding-right: 21px;
  cursor: pointer;
}
.subheader-count {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  white-space: nowrap;
  flex-shrink: 0;
}
.table-card {
  background: transparent;
  border: none;
  border-radius: 10px;
  overflow: visible;
  margin-top: 8px;
}
.table-wrap {
  overflow-x: auto;
  background: transparent;
}
.document-table {
  --col-name-width: 536px;
  --col-description-width: 588px;
  --col-category-width: 128px;
  --col-actions-width: 52px;
  width: 1304px;
  max-width: 1304px;
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0 8px;
}
.document-table th,
.document-table td {
  text-align: left;
  padding: 0;
  color: #1e293b;
}
.document-table tbody tr {
  height: 80px;
}
.document-table th {
  height: 24px;
  box-sizing: border-box;
  background: none;
  color: #64748b;
  font-size: 14px;
  letter-spacing: 0.02em;
  vertical-align: middle;
  text-align: left;
  padding: 0 16px;
}
.document-table th:nth-child(1) {
  width: var(--col-name-width);
  max-width: var(--col-name-width);
  padding: 0 16px 0 32px;
}
.document-table th:nth-child(2) {
  width: var(--col-description-width);
  max-width: var(--col-description-width);
}
.document-table th:nth-child(3) {
  width: var(--col-category-width);
  max-width: var(--col-category-width);
  text-align: center;
}
.document-table th:nth-child(4) {
  width: var(--col-actions-width);
  max-width: var(--col-actions-width);
  padding: 0 16px 0 0;
}
.document-card-cell {
  height: 80px;
  box-sizing: border-box;
  vertical-align: middle;
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}
.document-card {
  position: relative;
  height: 80px;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid #edf2f7;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}
.document-card__labels {
  position: absolute;
  top: 6px;
  left: 0;
  z-index: 1;
  box-sizing: border-box;
  width: var(--col-name-width);
  max-width: var(--col-name-width);
  padding: 0 16px 0 32px;
  min-width: 0;
  pointer-events: none;
}
.document-card__body {
  height: 100%;
  display: flex;
  align-items: center;
  min-width: 1304px;
}
.document-card__name {
  width: var(--col-name-width);
  max-width: var(--col-name-width);
  box-sizing: border-box;
  padding: 0 16px 0 32px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
  flex-shrink: 0;
  font-weight: 600;
  font-size: 16px;
}
.document-card__description {
  width: var(--col-description-width);
  max-width: var(--col-description-width);
  box-sizing: border-box;
  padding: 4px 16px 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
  flex-shrink: 0;
  font-size: 14px;
}
.document-card__category {
  width: var(--col-category-width);
  max-width: var(--col-category-width);
  box-sizing: border-box;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  flex-shrink: 0;
}
.document-card__actions {
  width: var(--col-actions-width);
  max-width: var(--col-actions-width);
  box-sizing: border-box;
  padding: 0 16px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.document-card__menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
}
.document-card__menu-btn:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.document-card-menu-dropdown {
  margin: 0;
  padding: 4.9px 0;
  list-style: none;
  background: #fff;
  border: 1px solid mixin.$border;
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14);
}
.document-card-menu-item {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  padding: 7.7px 11.9px;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  color: mixin.$text;
  cursor: pointer;
  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
}
.document-card-menu-item--danger {
  color: mixin.$danger;
}
.clickable-row {
  cursor: pointer;
}
.clickable-row:hover:not(.document-row--loading) {
  opacity: 0.8;
}
.document-row--loading,
.document-row--loading:hover {
  opacity: 0.6;
  cursor: wait;
}
.document-row--fade-in {
  animation: documentRowFadeIn 220ms ease-out;
}
@keyframes documentRowFadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.clickable-row:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: -2px;
}
.name-text {
  margin: 0;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.description-text {
  margin: 0;
  width: 100%;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  max-height: calc(1.4em * 2);
  color: #475569;
  word-break: break-word;
  white-space: pre-line;
}
.empty {
  text-align: center;
  color: #64748b;
  padding: 14px;
}
.primary-btn {
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 6px 28px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.1em;
  background: mixin.$main;
  color: mixin.$white;
  white-space: nowrap;
  flex-shrink: 0;
  gap: 6px;
}
button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.err {
  margin-top: 0;
  margin-bottom: 12px;
  color: mixin.$danger;
  font-weight: 700;
}
</style>
