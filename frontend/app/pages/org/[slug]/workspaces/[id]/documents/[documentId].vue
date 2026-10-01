<template>
  <main
    class="document-show-page"
    :class="{ 'document-show-page--loading': isDocumentShellLoading }"
    :style="pageCssVars"
    :aria-busy="isDocumentShellLoading ? true : undefined"
    :aria-label="isDocumentShellLoading ? '資料を読み込み中' : undefined"
  >
    <template v-if="fatalLoadError">
      <PageLoadFatal :message="fatalLoadError" @retry="retryLoad" />
    </template>
    <template v-else>
      <header class="page-header">
        <PageSubheader>
          <template #start>
            <NuxtLink
              :to="shellWorkspaceId
                ? `/org/${slug}/workspaces/${shellWorkspaceId}`
                : `/org/${slug}/workspaces`"
              class="subheader-title subheader-back-link"
              aria-label="スペース詳細に戻る"
            >
              スペース詳細
            </NuxtLink>
            <p
              v-if="shellDocumentName"
              class="subheader-doc-name"
              :title="shellDocumentName"
            >{{ shellDocumentName }}</p>
            <SkeletonBar
              v-else
              variant="subheader-name"
            />
          </template>
          <template #actions>
            <template v-if="pageReady && currentDocument">
              <SubheaderEditActions
                :editing="bodyEditing"
                :disabled="bodySaving"
                edit-label="本文編集"
                edit-title="本文編集（E）"
                @edit="startBodyEdit"
                @cancel="cancelBodyEdit"
                @save="confirmBodyEdit"
              />
              <SidebarToggleButton
                :open="sidebarOpen"
                @toggle="toggleSidebar"
              />
              <div class="document-header-menu" data-document-header-menu-root>
                <button
                  ref="documentMenuTriggerRef"
                  type="button"
                  class="subheader-menu-btn"
                  data-popover-trigger
                  aria-label="その他"
                  title="その他（M）"
                  :aria-expanded="documentMenuOpen"
                  @click.stop="toggleDocumentMenu"
                >
                  <Ellipsis :size="18" :stroke-width="2.25" aria-hidden="true" />
                </button>
              </div>
            </template>
            <template v-else>
              <div class="subheader-edit-with-divider" aria-hidden="true">
                <SkeletonBar variant="action-btn" />
              </div>
              <SidebarToggleButton
                :open="sidebarOpen"
                @toggle="toggleSidebar"
              />
              <SkeletonBar variant="icon-btn" />
            </template>
          </template>
        </PageSubheader>
      </header>
      <div class="page-shell-fade document-show-body">
        <div
          class="document-sidebar-slot"
          :class="{ 'document-sidebar-slot--closed': !sidebarOpen }"
          :aria-hidden="!sidebarOpen"
          :inert="!sidebarOpen"
        >
        <DetailSidebarShell base-class="document-sidebar">
          <template #title>
            <p
              v-if="shellDocumentName"
              class="document-sidebar__title"
              :aria-label="shellDocumentName"
            >
              {{ shellDocumentName }}
            </p>
            <SkeletonBar
              v-else
              variant="sidebar-title"
            />
          </template>
          <template #description>
            <SidebarDescription
              v-if="pageReady && currentDocument"
              :text="currentDocument.description"
              label="資料説明"
            />
            <SidebarDescription
              v-else-if="pendingDocumentMeta"
              :text="shellDocumentDescription"
              label="資料説明"
            />
            <DocumentSkeleton
              v-else
              variant="description"
            />
          </template>
          <template #fields>
            <section
              v-if="shellWorkspaceName"
              class="document-sidebar__field-section"
            >
              <h2 class="document-sidebar__field-heading">スペース</h2>
              <p class="document-sidebar__workspace-name">{{ shellWorkspaceName }}</p>
            </section>
            <section
              v-else-if="isDocumentShellLoading"
              class="document-sidebar__field-section"
              aria-hidden="true"
            >
              <SkeletonBar variant="field-heading" />
              <SkeletonBar variant="workspace-name" />
            </section>
            <section
              v-if="shellCategoryOption"
              class="document-sidebar__field-section"
            >
              <h2 class="document-sidebar__field-heading">カテゴリ</h2>
              <div class="document-sidebar__category">
                <DocumentCategorySelect
                  :category="shellCategoryOption"
                  :categories="documentCategories"
                  readonly
                />
              </div>
            </section>
            <section
              v-else-if="isDocumentShellLoading && !pendingDocumentMeta"
              class="document-sidebar__field-section"
              aria-hidden="true"
            >
              <SkeletonBar variant="field-heading" />
              <SkeletonBar variant="category" />
            </section>
          </template>
          <template #documents>
            <DocumentListPanel
              class="document-sidebar__field-section"
              :has-items="workspaceDocuments.length > 0"
              :loading="isDocumentShellLoading && workspaceDocuments.length === 0"
            >
              <template #toolbar-actions>
                <button
                  type="button"
                  class="document-sidebar__documents-add-btn"
                  title="資料追加（D）"
                  :disabled="documentAddPending || !parentWorkspaceId"
                  @click="void openDocumentAddModal()"
                >
                  <NotebookPen
                    :size="18"
                    :stroke-width="2.25"
                    aria-hidden="true"
                  />
                  資料追加
                </button>
              </template>
              <li
                v-for="document in workspaceDocuments"
                :key="document.id"
                class="document-list-panel__item"
              >
                <DocumentCard
                  :name="document.name"
                  :description="documentDescription(document)"
                  :category-label="documentCategoryLabel(document)"
                  :category-text-color="documentCategoryTextColor(document)"
                  @pointerenter="prefetchWorkspaceDocument(document.id)"
                  @focus="prefetchWorkspaceDocument(document.id)"
                  @click="navigateToWorkspaceDocument(document.id)"
                  @contextmenu="onDocumentCardContextMenu(document.id, $event)"
                >
                  <template #menu>
                    <CardMenuTrigger
                      :open="openDocumentCardMenuId === document.id"
                      aria-label="資料のメニュー"
                      @click="toggleDocumentCardMenu(document.id, $event)"
                    />
                  </template>
                </DocumentCard>
              </li>
              <template #loading>
                <DocumentSkeleton variant="document-list" />
              </template>
            </DocumentListPanel>
          </template>
        </DetailSidebarShell>
        </div>
        <section
          class="document-viewer"
          :class="{ 'document-viewer--editing': bodyEditing }"
        >
          <div
            v-if="!(pageReady && currentDocument)"
            class="document-viewer__body-loading"
            role="status"
            aria-busy="true"
            aria-label="本文を読み込み中"
          >
            <LoadingSpinner />
          </div>
          <div
            v-else
            ref="bodyScrollerRef"
            class="document-viewer__scroller"
          >
          <div class="document-viewer__scroller-body">
          <div
            class="document-viewer__page"
            :class="{
              'document-viewer__page--editing': bodyEditing,
              'document-viewer__page--fade-in': bodyShouldFadeIn,
            }"
          >
            <header class="document-viewer__heading">
              <h1
                v-if="shellDocumentName"
                class="document-viewer__title"
              >{{ shellDocumentName }}</h1>
              <SkeletonBar
                v-else
                variant="viewer-title"
              />
            </header>
            <div class="document-viewer__content">
              <textarea
                v-if="bodyEditing"
                ref="bodyInputRef"
                v-model="bodyDraft"
                class="document-viewer__body-input"
                :maxlength="DOCUMENT_BODY_MAX_LENGTH"
                :disabled="bodySaving"
                aria-label="資料本文"
                placeholder="本文を入力..."
                spellcheck="false"
                autocomplete="off"
                autocorrect="off"
                @input="onBodyInput"
                @keydown.escape.prevent.stop="cancelBodyEdit"
              />
              <p
                v-else-if="hasBodyContent"
                class="document-viewer__body"
              >{{ displayBodyText }}</p>
              <div
                v-else
                class="document-viewer__empty"
              >
                <span
                  class="document-viewer__empty-icon"
                  aria-hidden="true"
                >
                  <FileText :size="28" :stroke-width="1.75" />
                </span>
                <p class="document-viewer__empty-title">本文がありません</p>
              </div>
            </div>
            <footer class="document-viewer__page-footer">
              <p
                v-if="pageReady && bodyEditing && bodySaveError"
                class="document-viewer__save-error"
                role="alert"
              >{{ bodySaveError }}</p>
              <span
                v-if="pageReady && bodyEditing"
                class="document-viewer__char-count"
                :class="{ 'document-viewer__char-count--warn': bodyCharCountNearLimit }"
              >{{ bodyCharCountLabel }}</span>
            </footer>
          </div>
          </div>
          </div>
        </section>
      </div>
      <DocumentFormModal
        ref="documentAddModalRef"
        v-model="documentAddModalOpen"
        :org-slug="slug"
        :categories="documentFormCategories"
        :loading="documentAddPending"
        @submit="onDocumentAddSubmit"
      />
      <DocumentFormModal
        ref="documentCardDetailsModalRef"
        v-model="documentCardDetailsModalOpen"
        mode="details"
        title="資料詳細"
        :initial-values="documentCardDetailsInitialValues"
        :org-slug="slug"
        :categories="documentCardFormCategories"
        :loading="documentCardMetaPending"
        @submit="onDocumentCardDetailsSubmit"
      />
      <ConfirmModal
        v-model="documentCardArchiveConfirmOpen"
        title="資料のアーカイブ確認"
        :message="documentCardArchiveConfirmMessage"
        confirm-text="アーカイブ"
        variant="danger"
        :loading="documentCardArchivePending"
        @confirm="confirmDocumentCardArchive"
      />
      <FloatingMenu
        :open="Boolean(openDocumentCardMenuId && documentCardMenuPosition)"
        density="compact"
        :style="documentCardMenuStyle"
        :items="documentCardMenuItems"
        @select="onDocumentCardMenuSelect"
        @close="closeDocumentCardMenu"
      />
      <template v-if="pageReady && currentDocument">
      <FloatingMenu
        :open="Boolean(documentMenuOpen && documentMenuPosition)"
        :style="documentMenuStyle"
        :items="documentHeaderMenuItems"
        @select="onDocumentHeaderMenuSelect"
        @close="closeDocumentMenu"
      />
      <DocumentFormModal
        ref="documentDetailsModalRef"
        v-model="documentDetailsModalOpen"
        mode="details"
        title="資料詳細"
        :initial-values="documentDetailsInitialValues"
        :org-slug="slug"
        :categories="documentCategories"
        :loading="documentMetaPending"
        @submit="onDocumentDetailsSubmit"
      />
      <ConfirmModal
        v-model="documentArchiveConfirmOpen"
        title="資料のアーカイブ確認"
        :message="buildDestructiveConfirmMessage('資料', 'アーカイブ', currentDocument.name)"
        confirm-text="アーカイブ"
        variant="danger"
        :loading="archivePending"
        @confirm="confirmDocumentArchive"
      />
      <ConfirmModal
        v-model="leaveModalOpen"
        title="未保存の変更の確認"
        message="保存していない変更があります。&#10;ページを移動すると、変更内容が失われます。"
        confirm-text="変更の破棄"
        cancel-text="キャンセル"
        variant="danger"
        width="min(560px, 100%)"
        :loading="leaveDiscarding"
        @confirm="confirmDiscardAndLeave"
      />
      </template>
    </template>
  </main>
</template>
<script setup lang="ts">
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from '../../../../../../composables/shared/raceWithTimeout'
import { withAppLoadingCursor } from '../../../../../../composables/ui/useAppLoadingCursor'
import {
  useOrgDocumentsPageData,
  type OrgDocument,
  type OrgDocumentCategory,
} from '../../../../../../composables/document/useOrgDocumentsPageData'
import { useApi } from '../../../../../../composables/shared/useApi'
import type { TaskFormCategory } from '../../../../../../composables/task/useTaskFormHelpers'
import { DOCUMENT_BODY_MAX_LENGTH } from '../../../../../../constants/fieldLengthLimits'
import {
  resolveStandardColors,
} from '../../../../../../utils/shared/colorPresetResolution'
import {
  standardColorEmphasisText,
  standardColorSurfaceBackground,
} from '../../../../../../constants/colorPresets'
import { buildDestructiveConfirmMessage } from '../../../../../../utils/shared/destructiveConfirmMessage'
import FloatingMenu, { type FloatingMenuItem } from '../../../../../../components/ui/FloatingMenu.vue'
import PageSubheader from '../../../../../../components/ui/PageSubheader.vue'
import SubheaderEditActions from '../../../../../../components/ui/SubheaderEditActions.vue'
import SidebarToggleButton from '../../../../../../components/ui/SidebarToggleButton.vue'
import DetailSidebarShell from '../../../../../../components/ui/DetailSidebarShell.vue'
import CardMenuTrigger from '../../../../../../components/ui/CardMenuTrigger.vue'
import SkeletonBar from '../../../../../../components/ui/SkeletonBar.vue'
import LoadingSpinner from '../../../../../../components/ui/LoadingSpinner.vue'
import DocumentCard from '../../../../../../components/documents/DocumentCard.vue'
import DocumentListPanel from '../../../../../../components/documents/DocumentListPanel.vue'
import DocumentSkeleton from '../../../../../../components/documents/DocumentSkeleton.vue'
import { POPOVER_VIEWPORT_INSET, clampPopoverBox, resolveMeasuredFloatingMenuHeight } from '../../../../../../utils/ui/popoverScrollbar'
import DocumentCategorySelect from '../../../../../../components/documents/DocumentCategorySelect.vue'
import { FileText, NotebookPen, Ellipsis } from 'lucide-vue-next'
import DocumentFormModal from '../../../../../../components/modals/document/DocumentFormModal.vue'
import ConfirmModal from '../../../../../../components/modals/shared/ConfirmModal.vue'
import { useDropdownEscapeClose } from '../../../../../../composables/ui/useDropdownEscapeClose'
import { useUiSidebarPreference } from '../../../../../../composables/ui/useUiSidebarPreference'
import { useUnsavedChangesGuard } from '../../../../../../composables/shared/useUnsavedChangesGuard'
import {
  useWorkspaceDetailMeta,
} from '../../../../../../composables/workspace/useWorkspaceDetailMeta'
import {
  applyDocumentArchived,
  applyDocumentUpdated,
} from '../../../../../../composables/document/syncDocumentCaches'
import { useWorkspaceDocumentAdd } from '../../../../../../composables/document/useWorkspaceDocumentAdd'
import { useWorkspaceDocumentCardMenu } from '../../../../../../composables/document/useWorkspaceDocumentCardMenu'
import { useOrgSafeRedirect } from '../../../../../../composables/org/useOrgSafeRedirect'
import type { OrgWorkspaceDocumentItem } from '../../../../../../composables/workspace/useOrgWorkspaceIndexPageData'
import { workspaceDocumentPath } from '../../../../../../composables/workspace/useWorkspaceViewRoutes'
import { isAccessDeniedMessage } from '../../../../../../utils/shared/resourceAccessError'
import { getTopmostModalOverlay, isKeyboardShortcutBlockedTarget } from '../../../../../../utils/ui/uiInteraction'
import { useStickyHeaderOffsets } from '../../../../../../composables/workspace/useWorkspaceViewPageRoot'
import { isViewShortcutModifierBlocked } from '../../../../../../composables/ui/useViewKeyboardShortcuts'

/** 旧・複数ページ保存分を単一本文へ戻すための区切り */
const LEGACY_DOCUMENT_PAGE_BREAK = '\n\n<!--wm-page-break-->\n\n'

definePageMeta({
  name: 'org-slug-workspaces-id-documents-documentId',
  key: route => route.fullPath,
  keepalive: true,
})
const route = useRoute()
const router = useRouter()
const slug = computed(() => route.params.slug as string)
const workspaceId = computed(() => {
  const raw = String(route.params.id ?? '').trim()
  if (!raw || raw === 'undefined' || !Number.isFinite(Number(raw))) {
    return ''
  }
  return raw
})
const documentId = computed(() => route.params.documentId as string)
const { api } = useApi()
const { redirectToOrgWorkspaceList } = useOrgSafeRedirect()
const {
  fetchSnapshot,
  getCached,
  fetchDocument,
  prefetchDocument,
  getDocumentCached,
  invalidateDocumentCached,
} = useOrgDocumentsPageData()
const currentDocument = ref<OrgDocument | null>(null)
/** スペース文脈は URL の [id] */
const parentWorkspaceId = computed(() => workspaceId.value)
const {
  workspace: parentWorkspace,
  ensureLoaded: ensureParentWorkspaceLoaded,
} = useWorkspaceDetailMeta(() => slug.value, () => parentWorkspaceId.value)
const {
  documentAddModalOpen,
  documentAddPending,
  documentAddModalRef,
  documentFormCategories,
  openDocumentAddModal,
  onDocumentAddSubmit,
} = useWorkspaceDocumentAdd(() => slug.value, () => parentWorkspaceId.value)
const workspaceDocuments = computed(() => parentWorkspace.value?.documents ?? [])
const {
  openDocumentCardMenuId,
  documentCardMenuPosition,
  documentCardMenuStyle,
  documentCardMenuItems,
  documentDetailsModalOpen: documentCardDetailsModalOpen,
  documentArchiveConfirmOpen: documentCardArchiveConfirmOpen,
  documentMetaPending: documentCardMetaPending,
  archivePending: documentCardArchivePending,
  documentFormCategories: documentCardFormCategories,
  documentDetailsModalRef: documentCardDetailsModalRef,
  documentDetailsInitialValues: documentCardDetailsInitialValues,
  archiveConfirmMessage: documentCardArchiveConfirmMessage,
  toggleDocumentCardMenu,
  closeDocumentCardMenu,
  onDocumentCardMenuSelect,
  onDocumentDetailsSubmit: onDocumentCardDetailsSubmit,
  confirmDocumentArchive: confirmDocumentCardArchive,
  onDocumentCardContextMenu,
} = useWorkspaceDocumentCardMenu(
  () => slug.value,
  () => parentWorkspaceId.value,
  {
    documents: workspaceDocuments,
    onDocumentUpdated: (updated) => {
      if (currentDocument.value?.id === updated.id) {
        applyDocument(updated)
      }
    },
    onDocumentArchived: async (archived) => {
      if (currentDocument.value?.id === archived.id) {
        await router.push(`/org/${slug.value}/workspaces/${archived.workspaceId}`)
      }
    },
  },
)
const documentCategories = ref<OrgDocumentCategory[]>([])
const pageReady = ref(false)
const fatalLoadError = ref<string | null>(null)
const bodyShouldFadeIn = ref(false)
let bodyFadeInTimer: ReturnType<typeof setTimeout> | null = null
/** 本文取得のあと、表示結果を一度だけフェードインする */
let fadeBodyOnReady = true
function clearBodyFadeInTimer () {
  if (bodyFadeInTimer === null) return
  clearTimeout(bodyFadeInTimer)
  bodyFadeInTimer = null
}
function revealLoadedBody () {
  if (!fadeBodyOnReady || fatalLoadError.value) return
  fadeBodyOnReady = false
  clearBodyFadeInTimer()
  bodyShouldFadeIn.value = true
  bodyFadeInTimer = setTimeout(() => {
    bodyShouldFadeIn.value = false
    bodyFadeInTimer = null
  }, 260)
}
watch(pageReady, (ready) => {
  if (!ready) {
    fadeBodyOnReady = true
    bodyShouldFadeIn.value = false
    clearBodyFadeInTimer()
    return
  }
  revealLoadedBody()
})
const isDocumentShellLoading = computed(() => !pageReady.value && !fatalLoadError.value)
const pendingDocumentMeta = computed((): OrgWorkspaceDocumentItem | null => {
  const id = Number(documentId.value)
  if (!Number.isFinite(id)) {
    return null
  }
  return workspaceDocuments.value.find(item => item.id === id) ?? null
})
const shellWorkspaceId = computed(() => parentWorkspaceId.value)
const shellWorkspaceName = computed(() => (
  parentWorkspace.value?.name
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
const {
  globalHeaderOffsetPx,
  updateStickyOffsets: updateHeaderOffset,
  bindStickyOffsets,
  unbindStickyOffsets,
} = useStickyHeaderOffsets({
  autoBind: false,
  onUpdate: () => {
    if (bodyEditing.value) {
      adjustBodyHeight()
    }
  },
})
function updateStickyOffsets () {
  updateHeaderOffset()
}
const bodySaving = ref(false)
const bodyEditing = ref(false)
const bodyDraft = ref('')
const bodySaveError = ref<string | null>(null)
const bodyInputRef = ref<HTMLTextAreaElement | null>(null)
const bodyScrollerRef = ref<HTMLElement | null>(null)
const bodyCharCountNearLimit = computed(() => (
  bodyDraft.value.length >= Math.floor(DOCUMENT_BODY_MAX_LENGTH * 0.9)
))
const bodyCharCountLabel = computed(() => {
  const current = bodyDraft.value.length.toLocaleString('ja-JP')
  const max = DOCUMENT_BODY_MAX_LENGTH.toLocaleString('ja-JP')
  return `${current} / ${max}`
})
const documentMenuOpen = ref(false)
const { sidebarOpen, toggleSidebar, hydrateSidebarPreference } = useUiSidebarPreference('document')
const documentMenuPosition = ref<{ top: number; left: number } | null>(null)
const documentMenuTriggerRef = ref<HTMLButtonElement | null>(null)
const documentDetailsModalOpen = ref(false)
const documentArchiveConfirmOpen = ref(false)
const documentMetaPending = ref(false)
const archivePending = ref(false)
const documentDetailsModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const DOCUMENT_MENU_ACTIONS_WIDTH = 160
const pageCssVars = computed(() => ({
  '--global-header-offset': `${globalHeaderOffsetPx.value}px`,
} as Record<string, string>))
function normalizeDocumentBodyText (body: string | null | undefined): string {
  if (body == null || body === '') {
    return ''
  }
  return body.split(LEGACY_DOCUMENT_PAGE_BREAK).join('\n\n')
}
const displayBodyText = computed(() => {
  if (bodyEditing.value) {
    return bodyDraft.value
  }
  return normalizeDocumentBodyText(currentDocument.value?.body)
})
const hasBodyContent = computed(() => displayBodyText.value.trim() !== '')
const documentMenuStyle = computed(() => {
  if (!documentMenuPosition.value) {
    return undefined
  }
  const { top, left } = documentMenuPosition.value
  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    width: `${DOCUMENT_MENU_ACTIONS_WIDTH}px`,
    zIndex: 80,
  }
})
const documentDetailsInitialValues = computed(() => {
  const target = currentDocument.value
  if (!target) {
    return null
  }
  return {
    name: target.name,
    description: target.description ?? null,
    category: resolveDocumentCategoryOption(target.category),
  }
})
function resolveDocumentCategoryOption (category: OrgDocument['category'] | OrgWorkspaceDocumentItem['category']): TaskFormCategory | null {
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
/** 今開いている資料は無視し、別資料は先読みしてから開く */
function navigateToWorkspaceDocument (targetDocumentId: number): void {
  if (currentDocument.value?.id === targetDocumentId) {
    return
  }
  prefetchWorkspaceDocument(targetDocumentId)
  void router.push(workspaceDocumentPath(slug.value, parentWorkspaceId.value, targetDocumentId))
}
/** 説明の先頭行だけを出す */
function documentDescription (document: OrgWorkspaceDocumentItem): string | null {
  const firstLine = document.description?.split(/\r?\n/)[0]?.trim()
  return firstLine || null
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
/** アーカイブ済みなら表示せず、所属スペース（無ければスペース一覧）へ戻す */
function applyDocument (value: OrgDocument): boolean {
  if (value.archived_at) {
    applyDocumentArchived(slug.value, value)
    const wsId = parentWorkspaceId.value
    if (wsId) {
      void navigateTo(`/org/${slug.value}/workspaces/${wsId}`)
    } else {
      void navigateTo(`/org/${slug.value}/workspaces`)
    }
    return false
  }
  currentDocument.value = value
  void ensureParentWorkspaceLoaded()
  return true
}
function closeDocumentMenu () {
  documentMenuOpen.value = false
  documentMenuPosition.value = null
}
function positionDocumentMenu (anchor: HTMLElement) {
  if (!import.meta.client) {
    documentMenuPosition.value = null
    return
  }
  const rect = anchor.getBoundingClientRect()
  const pad = POPOVER_VIEWPORT_INSET
  const gap = 4
  const menuWidth = DOCUMENT_MENU_ACTIONS_WIDTH
  const menuHeight = resolveMeasuredFloatingMenuHeight(documentHeaderMenuItems.value.length)
  let left = rect.right - menuWidth
  left = Math.min(left, window.innerWidth - pad - menuWidth)
  left = Math.max(pad, left)
  documentMenuPosition.value = clampPopoverBox(rect.bottom + gap, left, menuWidth, menuHeight, pad)
}
function toggleDocumentMenu () {
  if (documentMenuOpen.value) {
    closeDocumentMenu()
    return
  }
  const anchor = documentMenuTriggerRef.value
  if (!anchor) {
    return
  }
  positionDocumentMenu(anchor)
  documentMenuOpen.value = true
  nextTick(() => {
    if (documentMenuOpen.value && documentMenuTriggerRef.value) {
      positionDocumentMenu(documentMenuTriggerRef.value)
    }
  })
}
function dismissDocumentPopovers () {
  closeDocumentMenu()
  closeDocumentCardMenu()
}
function canUseDocumentKeyboardShortcut (options?: {
  allowBodyEditing?: boolean
}): boolean {
  if (!pageReady.value || fatalLoadError.value || !currentDocument.value) {
    return false
  }
  if (getTopmostModalOverlay()) {
    return false
  }
  if (
    documentAddModalOpen.value
    || documentDetailsModalOpen.value
    || documentArchiveConfirmOpen.value
    || documentCardDetailsModalOpen.value
    || documentCardArchiveConfirmOpen.value
    || leaveModalOpen.value
    || bodySaving.value
    || (!options?.allowBodyEditing && bodyEditing.value)
  ) {
    return false
  }
  return true
}
function onDocumentPageKeydown (event: KeyboardEvent) {
  const key = event.key
  const isLetterShortcut = (
    key === 'm' || key === 'M'
    || key === 's' || key === 'S'
    || key === 'e' || key === 'E'
    || key === 'd' || key === 'D'
  )
  if (!isLetterShortcut) {
    return
  }
  if (isViewShortcutModifierBlocked(event)) {
    return
  }
  if (isKeyboardShortcutBlockedTarget(event.target)) {
    return
  }
  if (key === 'm' || key === 'M') {
    if (documentMenuOpen.value) {
      event.preventDefault()
      closeDocumentMenu()
      return
    }
    if (!canUseDocumentKeyboardShortcut({ allowBodyEditing: true })) {
      return
    }
    event.preventDefault()
    closeDocumentCardMenu()
    toggleDocumentMenu()
    return
  }
  if (key === 's' || key === 'S') {
    if (!pageReady.value || fatalLoadError.value || getTopmostModalOverlay()) {
      return
    }
    event.preventDefault()
    toggleSidebar()
    return
  }
  if (key === 'e' || key === 'E') {
    if (bodyEditing.value) {
      return
    }
    if (!canUseDocumentKeyboardShortcut()) {
      return
    }
    event.preventDefault()
    dismissDocumentPopovers()
    void startBodyEdit()
    return
  }
  if (!canUseDocumentKeyboardShortcut({ allowBodyEditing: true })) {
    return
  }
  event.preventDefault()
  dismissDocumentPopovers()
  void openDocumentAddModal()
}
const documentHeaderMenuItems = computed<FloatingMenuItem[]>(() => [
  {
    key: 'details',
    label: '資料詳細',
    disabled: documentMetaPending.value,
  },
  {
    key: 'archive',
    label: '資料のアーカイブ',
    danger: true,
    disabled: documentMetaPending.value || archivePending.value,
  },
])
function onDocumentHeaderMenuSelect (item: FloatingMenuItem) {
  if (item.key === 'details') {
    openDocumentDetailsModal()
    return
  }
  if (item.key === 'archive') {
    openDocumentArchiveConfirm()
  }
}
function openDocumentDetailsModal () {
  closeDocumentMenu()
  documentDetailsModalOpen.value = true
}
function openDocumentArchiveConfirm () {
  closeDocumentMenu()
  documentArchiveConfirmOpen.value = true
}
/** 本文は保存せず、名前・説明・カテゴリだけ更新して資料キャッシュへ反映する */
async function onDocumentDetailsSubmit (payload: {
  name: string
  description: string | null
  category: string | null
}) {
  const target = currentDocument.value
  if (!target || documentMetaPending.value) {
    return
  }
  documentMetaPending.value = true
  try {
    await withAppLoadingCursor(async () => {
      const updated = await api<OrgDocument>(
        `/orgs/${slug.value}/documents/${target.id}`,
        {
          method: 'PATCH',
          body: {
            name: payload.name,
            description: payload.description,
            category: payload.category,
          },
        },
      )
      applyDocument(updated)
      applyDocumentUpdated(slug.value, updated)
      documentDetailsModalOpen.value = false
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '資料の更新に失敗しました'
    documentDetailsModalRef.value?.setSubmitError(message)
  } finally {
    documentMetaPending.value = false
  }
}
/** 成功すると所属スペースへ戻り、失敗時は確認を開いたままにする */
async function confirmDocumentArchive () {
  const target = currentDocument.value
  if (!target || archivePending.value) {
    return
  }
  archivePending.value = true
  try {
    await withAppLoadingCursor(async () => {
      await api(`/orgs/${slug.value}/documents/${target.id}/archive`, {
        method: 'POST',
      })
      documentArchiveConfirmOpen.value = false
      applyDocumentArchived(slug.value, target)
      const wsId = parentWorkspaceId.value
      if (wsId) {
        await router.push(`/org/${slug.value}/workspaces/${wsId}`)
      } else {
        await router.push(`/org/${slug.value}/workspaces`)
      }
    })
  } catch {
  } finally {
    archivePending.value = false
  }
}
function onDocumentMenuWindowResize () {
  if (!documentMenuOpen.value) {
    return
  }
  closeDocumentMenu()
}
useDropdownEscapeClose(documentMenuOpen, closeDocumentMenu)
async function startBodyEdit () {
  if (!currentDocument.value || bodySaving.value) {
    return
  }
  bodyEditing.value = true
  bodyDraft.value = normalizeDocumentBodyText(currentDocument.value.body)
  bodySaveError.value = null
  await nextTick()
  const scroller = resolveBodyScroller()
  const lockedScrollTop = scroller?.scrollTop ?? 0
  const unlock = lockBodyScroller(scroller, lockedScrollTop)
  adjustBodyHeight()
  restoreBodyScroller(scroller, lockedScrollTop)
  const input = bodyInputRef.value
  if (input) {
    input.focus({ preventScroll: true })
    const caret = input.value.length
    input.setSelectionRange(caret, caret)
  }
  requestAnimationFrame(() => {
    restoreBodyScroller(scroller, lockedScrollTop)
    unlock()
  })
}
function onBodyInput () {
  adjustBodyHeight()
  requestAnimationFrame(() => {
    ensureBodyCaretVisible()
  })
}
function resolveBodyScroller (): HTMLElement | null {
  return bodyScrollerRef.value
}
function restoreBodyScroller (scroller: HTMLElement | null, scrollTop: number) {
  if (!scroller) {
    return
  }
  scroller.scrollTop = scrollTop
}
function lockBodyScroller (scroller: HTMLElement | null, scrollTop: number): () => void {
  if (!scroller) {
    return () => {}
  }
  const onScroll = () => {
    scroller.scrollTop = scrollTop
  }
  scroller.addEventListener('scroll', onScroll)
  return () => {
    scroller.removeEventListener('scroll', onScroll)
    scroller.scrollTop = scrollTop
  }
}
/** textarea 内キャレットの top / height（コンテンツ左上基準）を測る */
function measureTextareaCaretOffset (textarea: HTMLTextAreaElement): { top: number; height: number } {
  const style = getComputedStyle(textarea)
  const mirror = document.createElement('div')
  const marker = document.createElement('span')
  mirror.setAttribute('aria-hidden', 'true')
  Object.assign(mirror.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    boxSizing: style.boxSizing,
    width: `${textarea.clientWidth}px`,
    padding: style.padding,
    border: style.border,
    font: style.font,
    fontSize: style.fontSize,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    letterSpacing: style.letterSpacing,
    textTransform: style.textTransform,
    lineHeight: style.lineHeight,
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflowWrap: style.overflowWrap,
    tabSize: style.tabSize,
  })
  const value = textarea.value
  const caretIndex = textarea.selectionEnd
  mirror.textContent = value.slice(0, caretIndex)
  marker.textContent = value.slice(caretIndex, caretIndex + 1) || '.'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const top = marker.offsetTop
  const height = marker.offsetHeight || Number.parseFloat(style.lineHeight) || 24
  mirror.remove()
  return { top, height }
}
/** 入力中の行がビューア内に見えるようスクロールする */
function ensureBodyCaretVisible () {
  const el = bodyInputRef.value
  const scroller = resolveBodyScroller()
  if (!el || !scroller) {
    return
  }
  const { top: caretOffsetTop, height: caretHeight } = measureTextareaCaretOffset(el)
  const scrollerRect = scroller.getBoundingClientRect()
  const elRect = el.getBoundingClientRect()
  const caretTop = scroller.scrollTop + (elRect.top - scrollerRect.top) + caretOffsetTop
  const caretBottom = caretTop + caretHeight
  const marginTop = 24
  // 入力行の下に、フッター・余白・白い枠の下端＋キャンバスの一部が見える余白を確保
  const page = el.closest('.document-viewer__page') as HTMLElement | null
  const footer = page?.querySelector('.document-viewer__page-footer') as HTMLElement | null
  const textareaPadBottom = Number.parseFloat(getComputedStyle(el).paddingBottom || '0')
  const footerMarginTop = footer
    ? Number.parseFloat(getComputedStyle(footer).marginTop || '0')
    : 0
  const framePeek = 28
  const marginBottom = textareaPadBottom
    + (footer?.offsetHeight ?? 0)
    + footerMarginTop
    + framePeek
  const viewTop = scroller.scrollTop + marginTop
  const viewBottom = scroller.scrollTop + scroller.clientHeight - marginBottom
  if (caretBottom > viewBottom) {
    scroller.scrollTop += caretBottom - viewBottom
  } else if (caretTop < viewTop) {
    scroller.scrollTop = Math.max(0, scroller.scrollTop - (viewTop - caretTop))
  }
}
function adjustBodyHeight () {
  const el = bodyInputRef.value
  if (!el) {
    return
  }
  const scroller = resolveBodyScroller()
  const lockedScrollTop = scroller?.scrollTop ?? 0
  const page = el.closest('.document-viewer__page') as HTMLElement | null

  // いったん縮めて本文実高さを測る
  el.style.flex = 'none'
  el.style.height = '1px'
  const contentHeight = el.scrollHeight

  // ビューアに収まる高さ（これ以上だとスクロールバーが出る）
  let fitHeight = contentHeight
  if (scroller && page) {
    const scrollerBody = scroller.querySelector('.document-viewer__scroller-body') as HTMLElement | null
    const padSource = scrollerBody ?? scroller
    const padStyle = getComputedStyle(padSource)
    const pageStyle = getComputedStyle(page)
    const scrollerPadY = Number.parseFloat(padStyle.paddingTop || '0')
      + Number.parseFloat(padStyle.paddingBottom || '0')
    const pagePadY = Number.parseFloat(pageStyle.paddingTop || '0')
      + Number.parseFloat(pageStyle.paddingBottom || '0')
    const pageBorderY = Number.parseFloat(pageStyle.borderTopWidth || '0')
      + Number.parseFloat(pageStyle.borderBottomWidth || '0')
    const heading = page.querySelector('.document-viewer__heading') as HTMLElement | null
    const footer = page.querySelector('.document-viewer__page-footer') as HTMLElement | null
    const headingMarginBottom = heading
      ? Number.parseFloat(getComputedStyle(heading).marginBottom || '0')
      : 0
    const footerMarginTop = footer
      ? Number.parseFloat(getComputedStyle(footer).marginTop || '0')
      : 0
    const chromeY = (heading?.offsetHeight ?? 0)
      + headingMarginBottom
      + (footer?.offsetHeight ?? 0)
      + footerMarginTop
    fitHeight = Math.max(
      0,
      Math.floor(
        scroller.clientHeight - scrollerPadY - pagePadY - pageBorderY - chromeY,
      ),
    )
  }

  el.style.height = `${Math.max(contentHeight, fitHeight)}px`
  restoreBodyScroller(scroller, lockedScrollTop)
}
function cancelBodyEdit () {
  if (bodySaving.value) {
    return
  }
  bodyEditing.value = false
  bodyDraft.value = ''
  bodySaveError.value = null
}
/** 画面離脱時など: 未保存の本文編集を破棄して表示モードへ戻す */
function discardBodyEditOnLeave () {
  if (!bodyEditing.value) {
    bodyDraft.value = ''
    bodySaveError.value = null
    return
  }
  bodyEditing.value = false
  bodyDraft.value = ''
  bodySaveError.value = null
}
const bodyHasUnsavedChanges = computed(() => {
  if (!bodyEditing.value || !currentDocument.value) {
    return false
  }
  if (bodySaving.value) {
    return true
  }
  const normalized = bodyDraft.value.trim() === '' ? null : bodyDraft.value
  const previous = normalizeDocumentBodyText(currentDocument.value.body)
  const previousNormalized = previous.trim() === '' ? null : previous
  return (normalized ?? '') !== (previousNormalized ?? '')
})
/** 本文だけ保存する。未変更なら API を呼ばず編集を閉じる */
async function confirmBodyEdit (): Promise<boolean> {
  if (!currentDocument.value || bodySaving.value || !bodyEditing.value) {
    return false
  }
  const normalized = bodyDraft.value.trim() === '' ? null : bodyDraft.value
  const previous = normalizeDocumentBodyText(currentDocument.value.body)
  const previousNormalized = previous.trim() === '' ? null : previous
  if ((normalized ?? '') === (previousNormalized ?? '')) {
    cancelBodyEdit()
    return true
  }
  bodySaving.value = true
  bodySaveError.value = null
  try {
    const updated = await api<OrgDocument>(
      `/orgs/${slug.value}/documents/${currentDocument.value.id}`,
      { method: 'PATCH', body: { body: normalized } },
    )
    applyDocument(updated)
    applyDocumentUpdated(slug.value, updated)
    bodyEditing.value = false
    bodyDraft.value = ''
    return true
  } catch (e: unknown) {
    bodySaveError.value = e instanceof Error ? e.message : '資料本文の更新に失敗しました'
    return false
  } finally {
    bodySaving.value = false
  }
}
const {
  leaveModalOpen,
  leaveDiscarding,
  confirmDiscardAndLeave,
} = useUnsavedChangesGuard({
  isDirty: () => bodyHasUnsavedChanges.value,
  onDiscard: () => {
    discardBodyEditOnLeave()
  },
})
/** 資料が無いときは所属スペース（無ければスペース一覧）へ戻す */
async function redirectAwayFromMissingDocument (): Promise<void> {
  if (workspaceId.value) {
    await navigateTo(`/org/${slug.value}/workspaces/${workspaceId.value}`, { replace: true })
    return
  }
  await redirectToOrgWorkspaceList(slug.value)
}

let loadInflight: Promise<void> | null = null
/** キャッシュがあれば再取得せずそれを出す。権限が無ければ所属スペース（無ければスペース一覧）へ戻す */
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
        updateStickyOffsets()
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
  bodyEditing.value = false
  bodyDraft.value = ''
  bodySaveError.value = null
  void load()
}
onBeforeMount(() => {
  void hydrateSidebarPreference()
  const cached = getDocumentCached(slug.value, documentId.value)
  if (cached && applyDocument(cached)) {
    pageReady.value = true
  } else if (!pageReady.value) {
    void load()
  }
  void ensureCategoriesLoaded()
  void ensureParentWorkspaceLoaded()
})
onActivated(() => {
  void hydrateSidebarPreference()
  discardBodyEditOnLeave()
  const cached = getDocumentCached(slug.value, documentId.value)
  if (cached && applyDocument(cached)) {
    pageReady.value = true
  } else if (!pageReady.value) {
    void load()
  }
  void ensureCategoriesLoaded()
  void ensureParentWorkspaceLoaded()
  if (import.meta.client) {
    document.addEventListener('keydown', onDocumentPageKeydown)
    nextTick(() => {
      updateStickyOffsets()
    })
  }
})
onDeactivated(() => {
  // 他画面へ遷移するときは編集をキャンセル扱い（未保存は破棄）
  discardBodyEditOnLeave()
  closeDocumentMenu()
  documentDetailsModalOpen.value = false
  documentArchiveConfirmOpen.value = false
  if (import.meta.client) {
    document.removeEventListener('keydown', onDocumentPageKeydown)
  }
})
onMounted(() => {
  if (!pageReady.value && !fatalLoadError.value) {
    void load()
  } else {
    void ensureCategoriesLoaded()
  }
  if (!import.meta.client) {
    return
  }
  document.addEventListener('keydown', onDocumentPageKeydown)
  nextTick(() => {
    bindStickyOffsets()
    window.addEventListener('resize', onDocumentMenuWindowResize)
  })
})
onBeforeUnmount(() => {
  clearBodyFadeInTimer()
  if (!import.meta.client) {
    return
  }
  document.removeEventListener('keydown', onDocumentPageKeydown)
  window.removeEventListener('resize', onDocumentMenuWindowResize)
  unbindStickyOffsets()
})
</script>
<style lang="scss" scoped src="~/assets/styles/pages/org/slug/workspaces/id/documents/documentId.scss"></style>
