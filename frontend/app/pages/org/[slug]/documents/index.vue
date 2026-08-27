<template>
  <main
    class="list-page"
    :style="listPageCssVars"
  >
    <template v-if="fatalLoadError">
      <PageLoadFatal :message="fatalLoadError" @retry="retryInitialLoad" />
    </template>
    <template v-else>
      <header class="page-header">
        <div class="subheader">
          <p class="subheader-title">
            <NotebookText :size="20" :stroke-width="2.25" class="subheader-title__icon" aria-hidden="true" />
            Documents
          </p>
          <div class="subheader-filters">
            <select
              v-model="sortMode"
              class="header-sort"
              aria-label="並び順"
              :disabled="!pageReady"
            >
              <option value="created">作成日時順</option>
              <option value="updated">更新日時順</option>
              <option value="name">名前順</option>
            </select>
            <p class="subheader-count" aria-live="polite">{{ pageReady ? `${visibleDocuments.length} 件` : '' }}</p>
            <input
              v-model.trim="searchQuery"
              class="header-search"
              type="search"
              placeholder="資料名を検索..."
              aria-label="検索"
              :disabled="!pageReady"
            />
          </div>
          <button
            class="primary-btn"
            type="button"
            :disabled="pending || !pageReady"
            @click="openDocumentCreateModal"
          >
            <NotebookPen :size="20" :stroke-width="2.25" aria-hidden="true" />
            資料作成
          </button>
          <div class="subheader-actions" data-subheader-actions-root>
            <button
              ref="listFilterTriggerRef"
              type="button"
              class="subheader-menu-btn"
              :aria-expanded="listFilterOpen"
              aria-haspopup="dialog"
              aria-label="絞り込み"
              :disabled="pending || !pageReady"
              @click.stop="toggleListFilter"
            >
              <ListFilter :size="18" :stroke-width="2.25" aria-hidden="true" />
            </button>
            <button
              ref="subheaderMenuTriggerRef"
              type="button"
              class="subheader-menu-btn"
              :aria-expanded="subheaderMenuOpen"
              aria-haspopup="menu"
              aria-label="メニュー"
              :disabled="pending || !pageReady"
              @click.stop="toggleSubheaderMenu"
            >
              <Ellipsis :size="18" :stroke-width="2.25" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      <div class="page-shell-fade">
        <p v-if="error" class="err">{{ error }}</p>
        <section class="table-card">
          <div
            v-if="!pageReady"
            class="page-await-spacer"
            aria-busy="true"
            aria-label="読み込み中"
          >
            <div class="spinner" />
          </div>
          <div v-else class="table-wrap">
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
        <div
          v-if="listFilterOpen && listFilterPosition"
          ref="listFilterDropdownRef"
          class="board-filter-dropdown"
          role="dialog"
          aria-label="絞り込み"
          :style="listFilterStyle"
          @click.stop
        >
          <section class="board-filter-section">
            <h3 class="board-filter-section-title">ラベル</h3>
            <ul class="board-filter-options">
              <li>
                <label class="board-filter-option">
                  <input
                    type="checkbox"
                    :checked="isLabelFilterSelected('unset')"
                    @change="toggleLabelFilter('unset')"
                  >
                  <span>未設定</span>
                </label>
              </li>
            </ul>
            <div
              v-for="category in labelFilterCategories"
              :key="category.id"
              class="board-filter-label-group"
            >
              <p class="board-filter-category-title">{{ category.name }}</p>
              <ul class="board-filter-options">
                <li v-for="label in category.labels" :key="label.id">
                  <label class="board-filter-option">
                    <input
                      type="checkbox"
                      :checked="isLabelFilterSelected(String(label.id))"
                      @change="toggleLabelFilter(String(label.id))"
                    >
                    <span
                      class="board-filter-label-bar"
                      :style="{
                        backgroundColor: label.color,
                        color: labelBarTextColor(label.color),
                      }"
                    >{{ label.name }}</span>
                  </label>
                </li>
              </ul>
            </div>
          </section>
          <section class="board-filter-section">
            <h3 class="board-filter-section-title">カテゴリ</h3>
            <ul class="board-filter-options">
              <li>
                <label class="board-filter-option">
                  <input
                    type="checkbox"
                    :checked="isCategoryFilterSelected('unset')"
                    @change="toggleCategoryFilter('unset')"
                  >
                  <span>未設定</span>
                </label>
              </li>
            </ul>
            <div class="board-filter-label-group">
              <ul class="board-filter-options">
                <li v-for="category in documentCategories" :key="category.name">
                  <label class="board-filter-option">
                    <input
                      type="checkbox"
                      :checked="isCategoryFilterSelected(category.name)"
                      @change="toggleCategoryFilter(category.name)"
                    >
                    <span
                      class="board-filter-label-bar"
                      :style="{
                        backgroundColor: category.color,
                        color: labelBarTextColor(category.color),
                      }"
                    >{{ category.name }}</span>
                  </label>
                </li>
              </ul>
            </div>
          </section>
        </div>
      </Teleport>
      <FloatingMenu
        :open="Boolean(subheaderMenuOpen && subheaderMenuPosition)"
        density="compact"
        :flush="false"
        :style="subheaderMenuStyle"
        :disabled="pending"
        :items="subheaderMenuItems"
        @select="onSubheaderMenuSelect"
        @close="closeSubheaderMenu"
      />
      <FloatingMenu
        :open="Boolean(openMenuDocument && documentMenuPosition)"
        :style="documentMenuStyle"
        :disabled="pending"
        :items="documentMenuItems"
        @select="onDocumentMenuSelect"
        @close="closeDocumentMenu"
      />
      <DocumentCreateModal
        ref="documentFormModalRef"
        v-model="documentFormModalOpen"
        :mode="documentFormMode"
        :title="documentFormMode === 'edit' ? '資料の編集' : '資料の作成'"
        :initial-values="documentFormInitialValues"
        :org-slug="slug"
        :labels="documentLabels"
        :label-categories="documentLabelCategories"
        :categories="documentCategories"
        :loading="pending"
        @submit="onDocumentFormSubmit"
      />
      <ConfirmModal
        v-model="documentArchiveConfirmOpen"
        title="資料のアーカイブ確認"
        :message="documentArchiveTarget
          ? buildDestructiveConfirmMessage('資料', 'アーカイブ', documentArchiveTarget.name)
          : ''"
        confirm-text="アーカイブ"
        variant="danger"
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
import { Ellipsis, ListFilter, NotebookPen, NotebookText } from 'lucide-vue-next'
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from '../../../../composables/raceWithTimeout'
import { withAppLoadingCursor } from '../../../../composables/useAppLoadingCursor'
import { useApi } from '../../../../composables/useApi'
import {
  useOrgDocumentsPageData,
  type OrgDocument,
  type OrgDocumentCategory,
  type OrgDocumentsPageSnapshot,
} from '../../../../composables/useOrgDocumentsPageData'
import { labelBarTextColor, type TaskFormCategory, type TaskFormLabel } from '../../../../composables/useTaskFormHelpers'
import type { LabelCategoryGroup } from '../../../../composables/useLabelCategories'
import { resolveLabelColors, resolveStandardColors } from '../../../../utils/colorPresetResolution'
import { buildDestructiveConfirmMessage } from '../../../../utils/destructiveConfirmMessage'
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
import { useDropdownEscapeClose } from '../../../../composables/useDropdownEscapeClose'
import { useExclusivePopover } from '../../../../composables/useExclusivePopover'
import { popoverScrollbarGutterStyle, popoverWidthExtraForGutter, resolvePopoverScrollbarGutter } from '../../../../utils/popoverScrollbar'
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
const documentLabelCategories = ref<LabelCategoryGroup[]>([])
const pageReady = ref(false)
const fatalLoadError = ref<string | null>(null)
const error = ref<string | null>(null)
const pending = ref(false)
const documentFormModalOpen = ref(false)
const documentFormModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const documentFormMode = ref<'create' | 'edit'>('create')
const documentEditTarget = ref<OrgDocument | null>(null)
const documentArchiveConfirmOpen = ref(false)
const documentArchiveTarget = ref<OrgDocument | null>(null)
const archivedDocumentsOpen = ref(false)
const archivePending = ref(false)
const openMenuDocumentId = ref<number | null>(null)
const documentMenuPosition = ref<{ top: number; left: number } | null>(null)
const DOCUMENT_MENU_MIN_WIDTH = 160
const subheaderMenuOpen = ref(false)
const subheaderMenuTriggerRef = ref<HTMLElement | null>(null)
const subheaderMenuPosition = ref<{ top: number; left: number } | null>(null)
const SUBHEADER_MENU_MIN_WIDTH = 220
const listFilterOpen = ref(false)
const listFilterTriggerRef = ref<HTMLElement | null>(null)
const listFilterDropdownRef = ref<HTMLElement | null>(null)
const listFilterPosition = ref<{ top: number; left: number; scrollbarGutter: number } | null>(null)
const LIST_FILTER_WIDTH = 384
const LIST_FILTER_BOTTOM_OFFSET = 12
const labelFilterSelected = ref(new Set<string>())
const categoryFilterSelected = ref(new Set<string>())
const searchQuery = ref('')
const debouncedSearchQuery = ref('')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
let searchRequestSeq = 0
const sortMode = ref<'created' | 'updated' | 'name'>('created')
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
    ? [...documents.value]
    : searchQuery.value.trim()
      ? documents.value.filter(document => document.name.toLowerCase().includes(searchQuery.value.trim().toLowerCase()))
      : [...documents.value]
  const sorted = filtered.filter(document => (
    matchesLabelFilter(document)
    && matchesCategoryFilter(document)
  ))
  if (sortMode.value === 'name') {
    return sorted.sort((a, b) => a.name.localeCompare(b.name, 'ja') || b.id - a.id)
  }
  if (sortMode.value === 'updated') {
    return sorted.sort((a, b) => compareTimestampDesc(a.updated_at, b.updated_at) || b.id - a.id)
  }
  return sorted.sort((a, b) => compareTimestampDesc(a.created_at, b.created_at) || b.id - a.id)
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
const subheaderMenuStyle = computed(() => {
  if (!subheaderMenuPosition.value) {
    return undefined
  }
  const { top, left } = subheaderMenuPosition.value
  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${SUBHEADER_MENU_MIN_WIDTH}px`,
    zIndex: 80,
  }
})
const listFilterStyle = computed(() => {
  if (!listFilterPosition.value) {
    return {}
  }
  const { top, left, scrollbarGutter } = listFilterPosition.value
  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    bottom: `${LIST_FILTER_BOTTOM_OFFSET}px`,
    width: `${LIST_FILTER_WIDTH + popoverWidthExtraForGutter(scrollbarGutter)}px`,
    zIndex: 1000,
    ...popoverScrollbarGutterStyle(scrollbarGutter),
  }
})
const labelFilterCategories = computed(() =>
  documentLabelCategories.value.filter(category => category.labels.length > 0),
)
function matchesLabelFilter (document: OrgDocument): boolean {
  if (labelFilterSelected.value.size === 0) {
    return true
  }
  const labels = document.labels ?? []
  if (labelFilterSelected.value.has('unset') && labels.length === 0) {
    return true
  }
  return labels.some(label => labelFilterSelected.value.has(String(label.id)))
}
function matchesCategoryFilter (document: OrgDocument): boolean {
  if (categoryFilterSelected.value.size === 0) {
    return true
  }
  const categoryName = document.category?.name
  if (categoryFilterSelected.value.has('unset') && !categoryName) {
    return true
  }
  return Boolean(categoryName && categoryFilterSelected.value.has(categoryName))
}
function isLabelFilterSelected (key: string): boolean {
  return labelFilterSelected.value.has(key)
}
function toggleLabelFilter (key: string) {
  const next = new Set(labelFilterSelected.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  labelFilterSelected.value = next
}
function isCategoryFilterSelected (key: string): boolean {
  return categoryFilterSelected.value.has(key)
}
function toggleCategoryFilter (key: string) {
  const next = new Set(categoryFilterSelected.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  categoryFilterSelected.value = next
}
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
  documentLabelCategories.value = snapshot.documentLabelCategories ?? []
}
function openDocumentCreateModal () {
  closeDocumentMenu()
  closeSubheaderMenu()
  closeListFilter()
  documentFormMode.value = 'create'
  documentEditTarget.value = null
  documentFormModalOpen.value = true
}
function closeDocumentMenu () {
  openMenuDocumentId.value = null
  documentMenuPosition.value = null
}
function closeSubheaderMenu () {
  subheaderMenuOpen.value = false
  subheaderMenuPosition.value = null
}
function closeListFilter () {
  listFilterOpen.value = false
  listFilterPosition.value = null
}
useExclusivePopover(listFilterOpen, closeListFilter)
useDropdownEscapeClose(listFilterOpen, closeListFilter)
function positionSubheaderMenu () {
  const anchor = subheaderMenuTriggerRef.value
  if (!anchor || !import.meta.client) {
    subheaderMenuPosition.value = null
    return
  }
  const rect = anchor.getBoundingClientRect()
  const pad = 8
  const gap = 6
  let left = rect.right - SUBHEADER_MENU_MIN_WIDTH
  left = Math.max(pad, Math.min(left, window.innerWidth - SUBHEADER_MENU_MIN_WIDTH - pad))
  subheaderMenuPosition.value = {
    top: rect.bottom + gap,
    left,
  }
}
function toggleSubheaderMenu () {
  if (subheaderMenuOpen.value) {
    closeSubheaderMenu()
    return
  }
  closeDocumentMenu()
  closeListFilter()
  subheaderMenuOpen.value = true
  nextTick(() => positionSubheaderMenu())
}
function positionListFilter () {
  const anchor = listFilterTriggerRef.value
  if (!anchor || !import.meta.client) {
    listFilterPosition.value = null
    return
  }
  const rect = anchor.getBoundingClientRect()
  const pad = 8
  const gap = 6
  const top = rect.bottom + gap
  const maxHeight = Math.max(0, window.innerHeight - top - LIST_FILTER_BOTTOM_OFFSET)
  const el = listFilterDropdownRef.value
  const scrollbarGutter = el
    ? resolvePopoverScrollbarGutter(el, maxHeight)
    : 0
  const width = LIST_FILTER_WIDTH + popoverWidthExtraForGutter(scrollbarGutter)
  let left = rect.right - width
  left = Math.max(pad, Math.min(left, window.innerWidth - width - pad))
  listFilterPosition.value = {
    top,
    left,
    scrollbarGutter,
  }
}
function openListFilter () {
  if (listFilterOpen.value) {
    return
  }
  closeDocumentMenu()
  closeSubheaderMenu()
  listFilterOpen.value = true
  nextTick(() => {
    positionListFilter()
    requestAnimationFrame(() => positionListFilter())
  })
}
function toggleListFilter () {
  if (listFilterOpen.value) {
    closeListFilter()
    return
  }
  openListFilter()
}
function openArchivedDocumentsModal () {
  closeSubheaderMenu()
  closeListFilter()
  archivedDocumentsOpen.value = true
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
  closeSubheaderMenu()
  closeListFilter()
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
  { key: 'edit', label: '資料の編集' },
  { key: 'archive', label: '資料のアーカイブ', danger: true },
]
const subheaderMenuItems: FloatingMenuItem[] = [
  { key: 'archived', label: 'アーカイブ済み資料' },
]
function onSubheaderMenuSelect (item: FloatingMenuItem) {
  if (item.key === 'archived') {
    openArchivedDocumentsModal()
  }
}
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
    if (el?.closest('[data-subheader-actions-root]')) {
      return
    }
    if (el?.closest('[data-floating-menu]')) {
      return
    }
    if (el?.closest('.board-filter-dropdown')) {
      return
    }
  }
  closeDocumentMenu()
  closeSubheaderMenu()
  closeListFilter()
}
function onWindowResize () {
  closeDocumentMenu()
  closeSubheaderMenu()
  closeListFilter()
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
    || subheaderMenuOpen.value
    || listFilterOpen.value
    || pending.value
    || archivePending.value
  ) {
    return false
  }
  return true
}
function onDocumentListKeydown (event: KeyboardEvent) {
  const key = event.key
  if (key !== 'n' && key !== 'N' && key !== 'f' && key !== 'F') {
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
  if (key === 'f' || key === 'F') {
    event.preventDefault()
    openListFilter()
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
    const message = e instanceof Error ? e.message : '作成に失敗しました'
    error.value = message
    documentFormModalRef.value?.setSubmitError(message)
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
    const message = e instanceof Error ? e.message : '更新に失敗しました'
    error.value = message
    documentFormModalRef.value?.setSubmitError(message)
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
  void prefetchDocument(slug.value, documentId).catch(() => {})
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
  const requestSeq = ++searchRequestSeq
  const q = query.trim()
  const path = q
    ? `/orgs/${slug.value}/documents?q=${encodeURIComponent(q)}`
    : `/orgs/${slug.value}/documents`
  const res = await api<{ data: OrgDocument[] }>(path)
  if (requestSeq !== searchRequestSeq) {
    return
  }
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
  closeSubheaderMenu()
  closeListFilter()
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
  closeSubheaderMenu()
  closeListFilter()
})
</script>
<style lang="scss" scoped src="~/assets/styles/pages/org/slug/documents/index.scss"></style>
