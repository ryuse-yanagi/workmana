<template>
  <main
    class="document-show-page"
    :style="pageCssVars"
  >
    <template v-if="fatalLoadError">
      <PageLoadFatal :message="fatalLoadError" @retry="retryLoad" />
    </template>
    <template v-else-if="pageReady && currentDocument">
      <header class="page-header">
        <div class="subheader">
          <NuxtLink
            :to="`/org/${slug}/documents`"
            class="subheader-title subheader-back-link"
          >
            Documents
          </NuxtLink>
          <p class="subheader-doc-name">{{ currentDocument.name }}</p>
          <div class="subheader-actions">
            <template v-if="!bodyEditing">
              <button
                type="button"
                class="document-header-action-btn document-header-action-btn--edit"
                title="本文編集（E）"
                @click="startBodyEdit"
              >
                <Pencil :size="16" :stroke-width="2.25" aria-hidden="true" />
                編集
              </button>
            </template>
            <template v-else>
              <span class="subheader-editing-badge" aria-live="polite">🟠 編集中</span>
              <button
                type="button"
                class="document-header-action-btn document-header-action-btn--muted"
                :disabled="bodySaving"
                @click="cancelBodyEdit"
              >
                キャンセル
              </button>
              <button
                type="button"
                class="document-header-action-btn document-header-action-btn--primary"
                :disabled="bodySaving"
                @click="confirmBodyEdit"
              >
                <Save :size="16" :stroke-width="2.25" aria-hidden="true" />
                {{ bodySaving ? '保存中...' : '保存' }}
              </button>
            </template>
            <button
              type="button"
              class="document-header-action-btn document-header-action-btn--muted"
              title="資料追加（D）"
              :disabled="documentMetaPending"
              @click="openDocumentCreateModal"
            >
              <NotebookPen :size="16" :stroke-width="2.25" aria-hidden="true" />
              資料追加
            </button>
            <button
              type="button"
              class="subheader-menu-btn"
              :aria-expanded="sidebarOpen"
              :aria-label="sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'"
              title="サイドバー（S）"
              @click="toggleSidebar"
            >
              <PanelRightClose
                v-if="sidebarOpen"
                :size="18"
                :stroke-width="2.25"
                aria-hidden="true"
              />
              <PanelRightOpen
                v-else
                :size="18"
                :stroke-width="2.25"
                aria-hidden="true"
              />
            </button>
            <div class="document-header-menu" data-document-header-menu-root>
              <button
                ref="documentMenuTriggerRef"
                type="button"
                class="subheader-menu-btn"
                aria-label="その他"
                title="その他（M）"
                :aria-expanded="documentMenuOpen"
                @click.stop="toggleDocumentMenu"
              >
                <Ellipsis :size="18" :stroke-width="2.25" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>
      <div class="page-shell-fade document-show-body">
        <div
          class="document-sidebar-slot"
          :class="{ 'document-sidebar-slot--closed': !sidebarOpen }"
          :aria-hidden="!sidebarOpen"
          :inert="!sidebarOpen"
        >
        <aside class="document-sidebar">
          <div
            class="document-sidebar__title-field"
            :class="{ 'document-sidebar__title-field--editing': editingField === 'name' }"
          >
            <h1
              class="document-sidebar__title document-sidebar__title--clickable"
              :class="{ 'document-sidebar__title--measure': editingField === 'name' }"
              role="button"
              :tabindex="editingField === 'name' ? -1 : 0"
              :aria-label="currentDocument.name"
              @mousedown.prevent="onNameMouseDown($event)"
              @keydown.enter.prevent="startNameEdit"
              @keydown.space.prevent="startNameEdit"
            >
              {{ editingField === 'name' ? (nameDraft || '\u00a0') : currentDocument.name }}
            </h1>
            <textarea
              v-if="editingField === 'name'"
              ref="nameInputRef"
              v-model="nameDraft"
              class="document-sidebar__title-input"
              :maxlength="DOCUMENT_NAME_MAX_LENGTH"
              :disabled="nameSaving"
              aria-label="資料名"
              rows="1"
              @input="onNameInput"
              @compositionstart="nameComposing = true"
              @compositionend="nameComposing = false"
              @blur="confirmNameEdit"
              @keydown.enter.prevent="onNameEnter"
              @keydown.escape.prevent.stop="cancelNameEdit"
            />
          </div>
          <div
            class="document-sidebar__description-field"
            :class="{ 'document-sidebar__description-field--editing': editingField === 'description' }"
          >
            <p
              class="document-sidebar__description document-sidebar__description--clickable"
              :class="{
                'document-sidebar__description--measure': editingField === 'description',
                'document-sidebar__description--placeholder': editingField !== 'description' && !currentDocument.description,
              }"
              role="button"
              :tabindex="editingField === 'description' ? -1 : 0"
              :aria-label="currentDocument.description ? '資料説明' : '資料説明を追加'"
              @mousedown.prevent="onDescriptionMouseDown($event)"
              @keydown.enter.prevent="startDescriptionEdit"
              @keydown.space.prevent="startDescriptionEdit"
            >
              {{
                editingField === 'description'
                  ? (descriptionDraft || '\u00a0')
                  : (currentDocument.description || '説明を追加する')
              }}
            </p>
            <textarea
              v-if="editingField === 'description'"
              ref="descriptionInputRef"
              v-model="descriptionDraft"
              class="document-sidebar__description-input"
              :maxlength="TASK_DESCRIPTION_MAX_LENGTH"
              :disabled="descriptionSaving"
              aria-label="資料説明"
              rows="1"
              spellcheck="false"
              autocomplete="off"
              autocorrect="off"
              @blur="confirmDescriptionEdit"
              @keydown.escape.prevent.stop="cancelDescriptionEdit"
            />
          </div>
          <p
            v-if="fieldSaveError"
            class="document-sidebar__save-error"
          >{{ fieldSaveError }}</p>
          <div class="document-sidebar__category">
            <DocumentCategorySelect
              :category="selectedCategoryOption"
              :categories="documentCategories"
              :pending="categorySaving"
              @select="updateDocumentCategory"
            />
          </div>
          <section class="document-sidebar__field-section">
            <h2 class="document-sidebar__section-heading">ラベル</h2>
            <div class="document-sidebar__labels">
              <LabelStrip
                v-for="label in documentLabels"
                :key="label.id"
                :label="label"
                size="md"
              />
              <DocumentLabelSelect
                :selected-ids="selectedLabelIds"
                :labels="orgDocumentLabels"
                :label-categories="orgDocumentLabelCategories"
                :pending="labelSaving"
                @toggle="toggleDocumentLabel"
              />
            </div>
          </section>
          <section class="document-sidebar__field-section">
            <h2 class="document-sidebar__section-heading">関連スペース</h2>
            <ul
              v-if="relatedWorkspaces.length"
              class="document-sidebar__related-list"
            >
              <li
                v-for="item in relatedWorkspaces"
                :key="`workspace-${item.id}`"
                class="document-sidebar__related-item"
              >
                <NuxtLink
                  :to="`/org/${slug}/workspaces/${item.id}`"
                  class="document-sidebar__related-link"
                >
                  <span class="document-sidebar__related-link-text">{{ item.name }}</span>
                </NuxtLink>
                <button
                  type="button"
                  class="document-sidebar__related-menu-btn"
                  data-related-menu-trigger
                  aria-label="関連スペースのメニュー"
                  :aria-expanded="isRelatedMenuOpen('workspace', item.id)"
                  :disabled="relatedDetachPending"
                  @click.stop="toggleRelatedMenu('workspace', item.id, $event)"
                >
                  <EllipsisVertical
                    :size="18"
                    :stroke-width="2.25"
                    aria-hidden="true"
                  />
                </button>
              </li>
            </ul>
            <button
              type="button"
              class="document-sidebar__related-edit-btn"
              :disabled="relatedWorkspaceSaving"
              @click="openRelatedWorkspaceModal"
            >
              編集
            </button>
          </section>
          <section class="document-sidebar__field-section">
            <h2 class="document-sidebar__section-heading">関連資料</h2>
            <ul
              v-if="relatedDocuments.length"
              class="document-sidebar__related-list"
            >
              <li
                v-for="item in relatedDocuments"
                :key="`document-${item.id}`"
                class="document-sidebar__related-item"
              >
                <NuxtLink
                  :to="`/org/${slug}/documents/${item.id}`"
                  class="document-sidebar__related-link"
                >
                  <span class="document-sidebar__related-link-text">{{ item.name }}</span>
                </NuxtLink>
                <button
                  type="button"
                  class="document-sidebar__related-menu-btn"
                  data-related-menu-trigger
                  aria-label="関連資料のメニュー"
                  :aria-expanded="isRelatedMenuOpen('document', item.id)"
                  :disabled="relatedDetachPending"
                  @click.stop="toggleRelatedMenu('document', item.id, $event)"
                >
                  <EllipsisVertical
                    :size="18"
                    :stroke-width="2.25"
                    aria-hidden="true"
                  />
                </button>
              </li>
            </ul>
            <button
              type="button"
              class="document-sidebar__related-edit-btn"
              :disabled="relatedDocumentSaving"
              @click="openRelatedDocumentModal"
            >
              編集
            </button>
          </section>
        </aside>
        </div>
        <section ref="bodyScrollerRef" class="document-viewer">
          <div
            class="document-viewer__page"
            :class="{ 'document-viewer__page--editing': bodyEditing }"
          >
            <div
              class="document-viewer__mode-tabs"
              role="tablist"
              aria-label="本文の表示形式"
            >
              <button
                type="button"
                class="document-viewer__mode-tab"
                :class="{ 'document-viewer__mode-tab--active': bodyViewMode === 'preview' }"
                role="tab"
                :aria-selected="bodyViewMode === 'preview'"
                @click="bodyViewMode = 'preview'"
              >
                Preview
              </button>
              <button
                type="button"
                class="document-viewer__mode-tab"
                :class="{ 'document-viewer__mode-tab--active': bodyViewMode === 'markdown' }"
                role="tab"
                :aria-selected="bodyViewMode === 'markdown'"
                @click="setBodyViewModeMarkdown"
              >
                Markdown
              </button>
            </div>
            <textarea
              v-if="bodyEditing && bodyViewMode === 'markdown'"
              ref="bodyInputRef"
              v-model="bodyDraft"
              class="document-viewer__body document-viewer__body-input"
              :maxlength="DOCUMENT_BODY_MAX_LENGTH"
              :disabled="bodySaving"
              aria-label="資料本文"
              spellcheck="false"
              autocomplete="off"
              autocorrect="off"
              @input="onBodyInput"
              @keydown.escape.prevent.stop="cancelBodyEdit"
            />
            <div
              v-else-if="bodyViewMode === 'preview' && renderedBodyHtml"
              class="document-viewer__body document-viewer__body--preview"
              v-html="renderedBodyHtml"
            />
            <p
              v-else-if="bodyViewMode === 'markdown' && displayBodyText"
              class="document-viewer__body"
            >{{ displayBodyText }}</p>
            <p
              v-else
              class="document-viewer__body document-viewer__body--empty"
            >本文がありません。</p>
            <p
              v-if="bodySaveError"
              class="document-viewer__save-error"
            >{{ bodySaveError }}</p>
          </div>
        </section>
      </div>
      <FloatingMenu
        :open="Boolean(documentMenuOpen && documentMenuPosition && documentMenuMode === 'actions')"
        :style="documentMenuStyle"
        :items="documentHeaderMenuItems"
        @select="onDocumentHeaderMenuSelect"
        @close="closeDocumentMenu"
      />
      <FloatingMenu
        :open="Boolean(documentMenuOpen && documentMenuPosition && documentMenuMode === 'share')"
        :style="documentMenuStyle"
        root-class="document-header-menu--share"
        @close="closeDocumentMenu"
      >
        <li role="none" class="document-header-share-panel-wrap">
          <div class="document-header-share-panel">
            <p class="document-header-share-panel__label">共有リンク</p>
            <input
              ref="shareUrlInputRef"
              type="text"
              class="document-header-share-panel__input"
              :value="documentShareUrl"
              readonly
              aria-label="共有リンク"
              @click="onShareUrlClick"
              @focus="onShareUrlFocus"
            />
          </div>
        </li>
      </FloatingMenu>
      <DocumentCreateModal
        ref="documentFormModalRef"
        v-model="documentFormModalOpen"
        :mode="documentFormMode"
        :title="documentFormMode === 'edit' ? '資料の編集' : '資料の作成'"
        :initial-values="documentFormInitialValues"
        :org-slug="slug"
        :labels="orgDocumentLabels"
        :label-categories="orgDocumentLabelCategories"
        :categories="documentCategories"
        :loading="documentMetaPending"
        @submit="onDocumentFormSubmit"
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
      <FloatingMenu
        :open="Boolean(relatedMenuOpen && relatedMenuPosition)"
        density="compact"
        :style="relatedMenuStyle"
        :disabled="relatedDetachPending"
        :items="relatedMenuItems"
        @select="onRelatedMenuSelect"
        @close="closeRelatedMenu"
      />
      <RelatedItemPickerModal
        ref="relatedWorkspaceModalRef"
        v-model="relatedWorkspaceModalOpen"
        title="関連スペースの編集"
        search-placeholder="スペース名を検索..."
        empty-message="該当するスペースがありません。"
        :items="workspacePickerItems"
        :initial-selected-ids="relatedWorkspaceSelectedIds"
        :candidates-loading="workspaceCandidatesLoading"
        :candidates-error="workspaceCandidatesError"
        :loading="relatedWorkspaceSaving"
        @submit="onRelatedWorkspacesSubmit"
      />
      <RelatedItemPickerModal
        ref="relatedDocumentModalRef"
        v-model="relatedDocumentModalOpen"
        title="関連資料の編集"
        search-placeholder="資料名を検索..."
        empty-message="該当する資料がありません。"
        :items="documentPickerItems"
        :initial-selected-ids="relatedDocumentSelectedIds"
        :hidden-ids="relatedDocumentHiddenIds"
        :candidates-loading="documentCandidatesLoading"
        :candidates-error="documentCandidatesError"
        :loading="relatedDocumentSaving"
        @submit="onRelatedDocumentsSubmit"
      />
    </template>
  </main>
</template>
<script setup lang="ts">
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from '../../../../composables/raceWithTimeout'
import { withAppLoadingCursor } from '../../../../composables/useAppLoadingCursor'
import {
  useOrgDocumentsPageData,
  type OrgDocument,
  type OrgDocumentCategory,
  type OrgDocumentRelatedItem,
} from '../../../../composables/useOrgDocumentsPageData'
import {
  useOrgWorkspaceIndexPageData,
  type OrgWorkspaceRelatedItem,
} from '../../../../composables/useOrgWorkspaceIndexPageData'
import { useApi } from '../../../../composables/useApi'
import type { TaskFormCategory, TaskFormLabel } from '../../../../composables/useTaskFormHelpers'
import type { LabelCategoryGroup } from '../../../../composables/useLabelCategories'
import {
  DOCUMENT_NAME_MAX_LENGTH,
  DOCUMENT_BODY_MAX_LENGTH,
  TASK_DESCRIPTION_MAX_LENGTH,
} from '../../../../constants/fieldLengthLimits'
import { documentNameFieldError } from '../../../../utils/formValidation'
import {
  resolveLabelColors,
  resolveStandardColors,
} from '../../../../utils/colorPresetResolution'
import { buildDestructiveConfirmMessage } from '../../../../utils/destructiveConfirmMessage'
import LabelStrip from '../../../../components/ui/LabelStrip.vue'
import FloatingMenu, { type FloatingMenuItem } from '../../../../components/ui/FloatingMenu.vue'
import DocumentCategorySelect from '../../../../components/documents/DocumentCategorySelect.vue'
import DocumentLabelSelect from '../../../../components/documents/DocumentLabelSelect.vue'
import { renderMarkdownToSafeHtml } from '../../../../utils/renderMarkdown'
import { Pencil, Save, Ellipsis, EllipsisVertical, NotebookPen, PanelRightClose, PanelRightOpen } from 'lucide-vue-next'
import DocumentCreateModal from '../../../../components/modals/DocumentCreateModal.vue'
import ConfirmModal from '../../../../components/modals/ConfirmModal.vue'
import RelatedItemPickerModal from '../../../../components/modals/RelatedItemPickerModal.vue'
import { getTopmostModalOverlay, isKeyboardShortcutBlockedTarget } from '../../../../utils/uiInteraction'
import { useDropdownEscapeClose } from '../../../../composables/useDropdownEscapeClose'
import { useUiSidebarPreference } from '../../../../composables/useUiSidebarPreference'
import {
  syncPeerCachesAfterDocumentRelatedDocumentsChange,
  syncPeerCachesAfterDocumentRelatedWorkspacesChange,
} from '../../../../composables/syncRelatedRelationCaches'

/** 旧・複数ページ保存分を単一本文へ戻すための区切り */
const LEGACY_DOCUMENT_PAGE_BREAK = '\n\n<!--wm-page-break-->\n\n'

type BodyViewMode = 'preview' | 'markdown'
definePageMeta({
  name: 'org-slug-documents-id',
  key: route => route.fullPath,
  keepalive: true,
})
const route = useRoute()
const router = useRouter()
const slug = computed(() => route.params.slug as string)
const documentId = computed(() => route.params.id as string)
const { api } = useApi()
const {
  fetchSnapshot,
  getCached,
  fetchDocument,
  getDocumentCached,
  getDocumentFromListCache,
  invalidateCached,
  invalidateDocumentCached,
  removeDocumentCached,
  upsertDocumentCached,
} = useOrgDocumentsPageData()
const currentDocument = ref<OrgDocument | null>(null)
const documentCategories = ref<OrgDocumentCategory[]>([])
const orgDocumentLabels = ref<TaskFormLabel[]>([])
const orgDocumentLabelCategories = ref<LabelCategoryGroup[]>([])
const pageReady = ref(false)
const fatalLoadError = ref<string | null>(null)
const globalHeaderOffsetPx = ref(46)
const editingField = ref<'name' | 'description' | null>(null)
const nameDraft = ref('')
const descriptionDraft = ref('')
const nameSaving = ref(false)
const descriptionSaving = ref(false)
const bodySaving = ref(false)
const categorySaving = ref(false)
const labelSaving = ref(false)
const nameComposing = ref(false)
const bodyEditing = ref(false)
const bodyDraft = ref('')
const bodyViewMode = ref<BodyViewMode>('preview')
const fieldSaveError = ref<string | null>(null)
const bodySaveError = ref<string | null>(null)
const nameInputRef = ref<HTMLTextAreaElement | null>(null)
const descriptionInputRef = ref<HTMLTextAreaElement | null>(null)
const bodyInputRef = ref<HTMLTextAreaElement | null>(null)
const bodyScrollerRef = ref<HTMLElement | null>(null)
const documentMenuOpen = ref(false)
const { sidebarOpen, toggleSidebar, hydrateSidebarPreference } = useUiSidebarPreference('document')
const documentMenuMode = ref<'actions' | 'share'>('actions')
const documentMenuPosition = ref<{ top: number; left: number } | null>(null)
const documentMenuTriggerRef = ref<HTMLButtonElement | null>(null)
const shareUrlInputRef = ref<HTMLInputElement | null>(null)
const documentFormModalOpen = ref(false)
const documentFormMode = ref<'create' | 'edit'>('edit')
const documentArchiveConfirmOpen = ref(false)
const documentMetaPending = ref(false)
const archivePending = ref(false)
const relatedWorkspaceModalOpen = ref(false)
const relatedDocumentModalOpen = ref(false)
const relatedWorkspaceSaving = ref(false)
const relatedDocumentSaving = ref(false)
const relatedDetachPending = ref(false)
const relatedWorkspaceModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const relatedDocumentModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const documentFormModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const workspaceCandidates = ref<OrgWorkspaceRelatedItem[]>([])
const documentCandidates = ref<OrgDocumentRelatedItem[]>([])
const workspaceCandidatesLoading = ref(false)
const documentCandidatesLoading = ref(false)
const workspaceCandidatesError = ref<string | null>(null)
const documentCandidatesError = ref<string | null>(null)
type RelatedMenuKind = 'workspace' | 'document'
const relatedMenuOpen = ref(false)
const relatedMenuKind = ref<RelatedMenuKind | null>(null)
const relatedMenuItemId = ref<number | null>(null)
const relatedMenuPosition = ref<{ top: number; left: number } | null>(null)
const RELATED_MENU_WIDTH = 160
const {
  getCached: getWorkspaceIndexCached,
  fetchSnapshot: fetchWorkspaceIndexSnapshot,
} = useOrgWorkspaceIndexPageData()
const DOCUMENT_MENU_ACTIONS_WIDTH = 160
const DOCUMENT_MENU_SHARE_WIDTH = 320
const pageCssVars = computed(() => ({
  '--global-header-offset': `${globalHeaderOffsetPx.value}px`,
  '--app-shell-page-pad': '3.5px',
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
const renderedBodyHtml = computed(() => renderMarkdownToSafeHtml(displayBodyText.value))
const documentShareUrl = computed(() => {
  if (!import.meta.client || !currentDocument.value) {
    return ''
  }
  return `${window.location.origin}/org/${slug.value}/documents/${currentDocument.value.id}`
})
const documentMenuStyle = computed(() => {
  if (!documentMenuPosition.value) {
    return undefined
  }
  const { top, left } = documentMenuPosition.value
  const width = documentMenuMode.value === 'share'
    ? DOCUMENT_MENU_SHARE_WIDTH
    : DOCUMENT_MENU_ACTIONS_WIDTH
  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    zIndex: 80,
  }
})
const documentFormInitialValues = computed(() => {
  const target = currentDocument.value
  if (!target) {
    return null
  }
  const labels = (target.labels ?? []).map((label) => {
    const fromOrg = orgDocumentLabels.value.find(item => item.id === label.id)
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
const documentLabels = computed(() => {
  const labels = currentDocument.value?.labels
  if (!labels?.length) {
    return []
  }
  return resolveLabelColors(labels)
})
const selectedLabelIds = computed(() => documentLabels.value.map(label => label.id))
const relatedWorkspaces = computed(() => currentDocument.value?.related_workspaces ?? [])
const relatedDocuments = computed(() => currentDocument.value?.related_documents ?? [])
const relatedWorkspaceSelectedIds = computed(() => relatedWorkspaces.value.map(item => item.id))
const relatedDocumentSelectedIds = computed(() => relatedDocuments.value.map(item => item.id))
const relatedDocumentHiddenIds = computed(() => {
  const currentId = Number(documentId.value)
  return Number.isFinite(currentId) ? [currentId] : []
})
const relatedMenuStyle = computed(() => {
  if (!relatedMenuPosition.value) {
    return undefined
  }
  const { top, left } = relatedMenuPosition.value
  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    width: `${RELATED_MENU_WIDTH}px`,
    zIndex: 90,
  }
})
function mergePickerItems<T extends { id: number }> (candidates: T[], related: T[]): T[] {
  const map = new Map<number, T>()
  for (const item of candidates) {
    map.set(item.id, item)
  }
  for (const item of related) {
    if (!map.has(item.id)) {
      map.set(item.id, item)
    }
  }
  return [...map.values()]
}
const workspacePickerItems = computed(() => mergePickerItems(
  workspaceCandidates.value,
  relatedWorkspaces.value,
))
const documentPickerItems = computed(() => mergePickerItems(
  documentCandidates.value,
  relatedDocuments.value,
))
function isRelatedMenuOpen (kind: RelatedMenuKind, id: number) {
  return relatedMenuOpen.value
    && relatedMenuKind.value === kind
    && relatedMenuItemId.value === id
}
function closeRelatedMenu () {
  relatedMenuOpen.value = false
  relatedMenuKind.value = null
  relatedMenuItemId.value = null
  relatedMenuPosition.value = null
}
function positionRelatedMenu (anchor: HTMLElement) {
  if (!import.meta.client) {
    relatedMenuPosition.value = null
    return
  }
  const rect = anchor.getBoundingClientRect()
  const pad = 8
  const gap = 4
  let left = rect.right - RELATED_MENU_WIDTH
  left = Math.min(left, window.innerWidth - pad - RELATED_MENU_WIDTH)
  left = Math.max(pad, left)
  relatedMenuPosition.value = {
    top: rect.bottom + gap,
    left,
  }
}
function toggleRelatedMenu (kind: RelatedMenuKind, id: number, event: MouseEvent) {
  if (relatedDetachPending.value) {
    return
  }
  if (isRelatedMenuOpen(kind, id)) {
    closeRelatedMenu()
    return
  }
  const anchor = event.currentTarget
  if (!(anchor instanceof HTMLElement)) {
    return
  }
  relatedMenuKind.value = kind
  relatedMenuItemId.value = id
  positionRelatedMenu(anchor)
  relatedMenuOpen.value = true
}
function onRelatedMenuGlobalPointerDown (event: Event) {
  if (!relatedMenuOpen.value) {
    return
  }
  const target = event.target
  if (!(target instanceof Node)) {
    closeRelatedMenu()
    return
  }
  const el = target instanceof Element ? target : target.parentElement
  if (el?.closest('[data-related-menu-trigger]')) {
    return
  }
  if (el?.closest('[data-floating-menu]')) {
    return
  }
  closeRelatedMenu()
}
function onRelatedMenuWindowResize () {
  if (!relatedMenuOpen.value) {
    return
  }
  closeRelatedMenu()
}
useDropdownEscapeClose(relatedMenuOpen, closeRelatedMenu)
watch(relatedMenuOpen, (open) => {
  if (!import.meta.client) {
    return
  }
  if (open) {
    document.addEventListener('pointerdown', onRelatedMenuGlobalPointerDown, true)
    window.addEventListener('resize', onRelatedMenuWindowResize)
    return
  }
  document.removeEventListener('pointerdown', onRelatedMenuGlobalPointerDown, true)
  window.removeEventListener('resize', onRelatedMenuWindowResize)
})
async function loadWorkspaceCandidates () {
  workspaceCandidatesLoading.value = true
  workspaceCandidatesError.value = null
  try {
    const cached = getWorkspaceIndexCached(slug.value)
    const snapshot = cached ?? await fetchWorkspaceIndexSnapshot(slug.value)
    workspaceCandidates.value = snapshot.workspaces.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description ?? null,
    }))
  } catch (e: unknown) {
    workspaceCandidates.value = []
    workspaceCandidatesError.value = e instanceof Error ? e.message : 'スペース一覧の取得に失敗しました'
  } finally {
    workspaceCandidatesLoading.value = false
  }
}
async function loadDocumentCandidates () {
  documentCandidatesLoading.value = true
  documentCandidatesError.value = null
  try {
    const cached = getCached(slug.value)
    const snapshot = cached ?? await fetchSnapshot(slug.value)
    documentCandidates.value = snapshot.documents.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description ?? null,
    }))
  } catch (e: unknown) {
    documentCandidates.value = []
    documentCandidatesError.value = e instanceof Error ? e.message : '資料一覧の取得に失敗しました'
  } finally {
    documentCandidatesLoading.value = false
  }
}
async function openRelatedWorkspaceModal () {
  relatedWorkspaceModalOpen.value = true
  await loadWorkspaceCandidates()
}
async function openRelatedDocumentModal () {
  relatedDocumentModalOpen.value = true
  await loadDocumentCandidates()
}
async function onRelatedWorkspacesSubmit (ids: number[]) {
  const current = currentDocument.value
  if (!current || relatedWorkspaceSaving.value) {
    return
  }
  relatedWorkspaceSaving.value = true
  try {
    const previous = current.related_workspaces ?? []
    const res = await api<{ data: OrgDocumentRelatedItem[] }>(
      `/orgs/${slug.value}/documents/${current.id}/related-workspaces`,
      { method: 'PUT', body: { workspace_ids: ids } },
    )
    const nextDocument = {
      ...current,
      related_workspaces: res.data,
    }
    applyDocument(nextDocument)
    upsertDocumentCached(slug.value, nextDocument)
    syncPeerCachesAfterDocumentRelatedWorkspacesChange(
      slug.value,
      current,
      previous,
      res.data,
    )
    relatedWorkspaceModalOpen.value = false
  } catch (e: unknown) {
    relatedWorkspaceModalRef.value?.setSubmitError(
      e instanceof Error ? e.message : '関連スペースの保存に失敗しました',
    )
  } finally {
    relatedWorkspaceSaving.value = false
  }
}
async function onRelatedDocumentsSubmit (ids: number[]) {
  const current = currentDocument.value
  if (!current || relatedDocumentSaving.value) {
    return
  }
  relatedDocumentSaving.value = true
  try {
    const previous = current.related_documents ?? []
    const res = await api<{ data: OrgDocumentRelatedItem[] }>(
      `/orgs/${slug.value}/documents/${current.id}/related-documents`,
      { method: 'PUT', body: { document_ids: ids } },
    )
    const nextDocument = {
      ...current,
      related_documents: res.data,
    }
    applyDocument(nextDocument)
    upsertDocumentCached(slug.value, nextDocument)
    syncPeerCachesAfterDocumentRelatedDocumentsChange(
      slug.value,
      current,
      previous,
      res.data,
    )
    relatedDocumentModalOpen.value = false
  } catch (e: unknown) {
    relatedDocumentModalRef.value?.setSubmitError(
      e instanceof Error ? e.message : '関連資料の保存に失敗しました',
    )
  } finally {
    relatedDocumentSaving.value = false
  }
}
const relatedMenuItems: FloatingMenuItem[] = [
  { key: 'detach', label: '関連から除外', danger: true },
]
function onRelatedMenuSelect (item: FloatingMenuItem) {
  if (item.key === 'detach') {
    void detachRelatedItem()
  }
}
async function detachRelatedItem () {
  const current = currentDocument.value
  const kind = relatedMenuKind.value
  const itemId = relatedMenuItemId.value
  if (!current || !kind || itemId == null || relatedDetachPending.value) {
    return
  }
  relatedDetachPending.value = true
  fieldSaveError.value = null
  try {
    if (kind === 'workspace') {
      const previous = current.related_workspaces ?? []
      const res = await api<{ data: OrgDocumentRelatedItem[] }>(
        `/orgs/${slug.value}/documents/${current.id}/related-workspaces/${itemId}`,
        { method: 'DELETE' },
      )
      const nextDocument = {
        ...current,
        related_workspaces: res.data,
      }
      applyDocument(nextDocument)
      upsertDocumentCached(slug.value, nextDocument)
      syncPeerCachesAfterDocumentRelatedWorkspacesChange(
        slug.value,
        current,
        previous,
        res.data,
      )
    } else {
      const previous = current.related_documents ?? []
      const res = await api<{ data: OrgDocumentRelatedItem[] }>(
        `/orgs/${slug.value}/documents/${current.id}/related-documents/${itemId}`,
        { method: 'DELETE' },
      )
      const nextDocument = {
        ...current,
        related_documents: res.data,
      }
      applyDocument(nextDocument)
      upsertDocumentCached(slug.value, nextDocument)
      syncPeerCachesAfterDocumentRelatedDocumentsChange(
        slug.value,
        current,
        previous,
        res.data,
      )
    }
    closeRelatedMenu()
  } catch (e: unknown) {
    fieldSaveError.value = e instanceof Error
      ? e.message
      : (kind === 'workspace' ? '関連スペースの除外に失敗しました' : '関連資料の除外に失敗しました')
    closeRelatedMenu()
  } finally {
    relatedDetachPending.value = false
  }
}
const selectedCategoryOption = computed((): TaskFormCategory | null => {
  return resolveDocumentCategoryOption(currentDocument.value?.category ?? null)
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
function applyCategories (categories: OrgDocumentCategory[]) {
  documentCategories.value = categories
}
function applyOrgLabels (labels: TaskFormLabel[], categories: LabelCategoryGroup[] = []) {
  orgDocumentLabels.value = labels
  orgDocumentLabelCategories.value = categories
}
async function ensureCategoriesLoaded () {
  const cached = getCached(slug.value)
  if (cached) {
    applyCategories(cached.documentCategories)
    applyOrgLabels(cached.documentLabels, cached.documentLabelCategories)
    return
  }
  try {
    const snapshot = await fetchSnapshot(slug.value)
    applyCategories(snapshot.documentCategories)
    applyOrgLabels(snapshot.documentLabels, snapshot.documentLabelCategories)
  } catch {
    // カテゴリ/ラベル取得失敗時はプルダウンを空のままにする
  }
}
async function updateDocumentCategory (category: TaskFormCategory) {
  const current = currentDocument.value
  if (!current || categorySaving.value) {
    return
  }
  if (current.category?.name === category.name) {
    return
  }
  const previousCategory = current.category ?? null
  const nextCategory = {
    name: category.name,
    color_index: documentCategories.value.find(item => item.name === category.name)?.color_index ?? 0,
  }
  categorySaving.value = true
  fieldSaveError.value = null
  applyDocument({ ...current, category: nextCategory })
  try {
    const updated = await api<OrgDocument>(
      `/orgs/${slug.value}/documents/${current.id}`,
      { method: 'PATCH', body: { category: category.name } },
    )
    applyDocument(updated)
    upsertDocumentCached(slug.value, updated)
  } catch (e: unknown) {
    applyDocument({ ...current, category: previousCategory })
    fieldSaveError.value = e instanceof Error ? e.message : 'カテゴリの更新に失敗しました'
  } finally {
    categorySaving.value = false
  }
}
async function toggleDocumentLabel (label: TaskFormLabel) {
  const current = currentDocument.value
  if (!current || labelSaving.value) {
    return
  }
  const previousLabels = [...(current.labels ?? [])]
  const isSelected = previousLabels.some(item => item.id === label.id)
  const nextLabelIds = isSelected
    ? previousLabels.filter(item => item.id !== label.id).map(item => item.id)
    : [...previousLabels.map(item => item.id), label.id]
  const optimisticLabels = isSelected
    ? previousLabels.filter(item => item.id !== label.id)
    : [
        ...previousLabels,
        {
          id: label.id,
          category_id: 0,
          name: label.name,
          color_index: 0,
          color: label.color,
        },
      ]
  labelSaving.value = true
  fieldSaveError.value = null
  applyDocument({ ...current, labels: optimisticLabels })
  try {
    const updated = await api<OrgDocument>(
      `/orgs/${slug.value}/documents/${current.id}`,
      { method: 'PATCH', body: { label_ids: nextLabelIds } },
    )
    applyDocument(updated)
    upsertDocumentCached(slug.value, updated)
  } catch (e: unknown) {
    applyDocument({ ...current, labels: previousLabels })
    fieldSaveError.value = e instanceof Error ? e.message : 'ラベルの更新に失敗しました'
  } finally {
    labelSaving.value = false
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
  if (bodyEditing.value) {
    adjustBodyHeight()
  }
}
function applyDocument (value: OrgDocument) {
  if (value.archived_at) {
    removeDocumentCached(slug.value, value.id)
    invalidateCached(slug.value)
    void navigateTo(`/org/${slug.value}/documents`)
    return
  }
  currentDocument.value = value
}
function closeDocumentMenu () {
  documentMenuOpen.value = false
  documentMenuMode.value = 'actions'
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
  const menuWidth = documentMenuMode.value === 'share'
    ? DOCUMENT_MENU_SHARE_WIDTH
    : DOCUMENT_MENU_ACTIONS_WIDTH
  let left = rect.right - menuWidth
  left = Math.min(left, window.innerWidth - pad - menuWidth)
  left = Math.max(pad, left)
  documentMenuPosition.value = {
    top: rect.bottom + gap,
    left,
  }
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
  documentMenuMode.value = 'actions'
  positionDocumentMenu(anchor)
  documentMenuOpen.value = true
}
async function switchDocumentMenuToShare () {
  documentMenuMode.value = 'share'
  const anchor = documentMenuTriggerRef.value
  if (anchor) {
    positionDocumentMenu(anchor)
  }
  await nextTick()
  const input = shareUrlInputRef.value
  if (input) {
    input.focus()
    input.select()
  }
}
function onShareUrlClick (event: MouseEvent) {
  const el = event.currentTarget
  if (el instanceof HTMLInputElement) {
    el.select()
  }
}
function onShareUrlFocus (event: FocusEvent) {
  const el = event.currentTarget
  if (el instanceof HTMLInputElement) {
    el.select()
  }
}
const documentHeaderMenuItems = computed<FloatingMenuItem[]>(() => [
  { key: 'edit', label: '資料の編集', disabled: documentMetaPending.value },
  { key: 'share', label: '資料の共有' },
  {
    key: 'archive',
    label: '資料のアーカイブ',
    danger: true,
    disabled: documentMetaPending.value || archivePending.value,
  },
])
function onDocumentHeaderMenuSelect (item: FloatingMenuItem) {
  if (item.key === 'edit') {
    openDocumentEditModal()
    return
  }
  if (item.key === 'share') {
    void switchDocumentMenuToShare()
    return
  }
  if (item.key === 'archive') {
    openDocumentArchiveConfirm()
  }
}
function openDocumentEditModal () {
  closeDocumentMenu()
  documentFormMode.value = 'edit'
  documentFormModalOpen.value = true
}
function openDocumentCreateModal () {
  closeDocumentMenu()
  documentFormMode.value = 'create'
  documentFormModalOpen.value = true
}
function dismissDocumentPopovers () {
  closeDocumentMenu()
  closeRelatedMenu()
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
    documentFormModalOpen.value
    || documentArchiveConfirmOpen.value
    || relatedWorkspaceModalOpen.value
    || relatedDocumentModalOpen.value
    || documentMetaPending.value
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
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
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
    closeRelatedMenu()
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
  openDocumentCreateModal()
}
let documentPageKeydownBound = false
function bindDocumentPageKeydown () {
  if (!import.meta.client || documentPageKeydownBound) {
    return
  }
  document.addEventListener('keydown', onDocumentPageKeydown)
  documentPageKeydownBound = true
}
function unbindDocumentPageKeydown () {
  if (!import.meta.client || !documentPageKeydownBound) {
    return
  }
  document.removeEventListener('keydown', onDocumentPageKeydown)
  documentPageKeydownBound = false
}
function openDocumentArchiveConfirm () {
  closeDocumentMenu()
  documentArchiveConfirmOpen.value = true
}
async function createDocumentFromDetail (payload: {
  name: string
  description: string | null
  category: string | null
  label_ids: number[]
}) {
  if (documentMetaPending.value) {
    return
  }
  documentMetaPending.value = true
  fieldSaveError.value = null
  try {
    await withAppLoadingCursor(async () => {
      const created = await api<OrgDocument>(`/orgs/${slug.value}/documents`, {
        method: 'POST',
        body: {
          name: payload.name,
          description: payload.description,
          category: payload.category,
          label_ids: payload.label_ids,
        },
      })
      upsertDocumentCached(slug.value, created)
      invalidateCached(slug.value)
      documentFormModalOpen.value = false
      await router.push(`/org/${slug.value}/documents/${created.id}`)
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '資料の作成に失敗しました'
    fieldSaveError.value = message
    documentFormModalRef.value?.setSubmitError(message)
  } finally {
    documentMetaPending.value = false
  }
}
async function onDocumentFormSubmit (payload: {
  name: string
  description: string | null
  category: string | null
  label_ids: number[]
}) {
  if (documentFormMode.value === 'create') {
    await createDocumentFromDetail(payload)
    return
  }
  const target = currentDocument.value
  if (!target || documentMetaPending.value) {
    return
  }
  documentMetaPending.value = true
  fieldSaveError.value = null
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
            label_ids: payload.label_ids,
          },
        },
      )
      applyDocument(updated)
      upsertDocumentCached(slug.value, updated)
      invalidateCached(slug.value)
      documentFormModalOpen.value = false
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '資料の更新に失敗しました'
    fieldSaveError.value = message
    documentFormModalRef.value?.setSubmitError(message)
  } finally {
    documentMetaPending.value = false
  }
}
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
      removeDocumentCached(slug.value, target.id)
      await router.push(`/org/${slug.value}/documents`)
    })
  } catch (e: unknown) {
    fieldSaveError.value = e instanceof Error ? e.message : 'アーカイブに失敗しました'
  } finally {
    archivePending.value = false
  }
}
function onDocumentMenuGlobalClick (event: Event) {
  if (!documentMenuOpen.value) {
    return
  }
  const target = event.target
  if (!(target instanceof Node)) {
    closeDocumentMenu()
    return
  }
  const el = target instanceof Element ? target : target.parentElement
  if (el?.closest('[data-document-header-menu-root]')) {
    return
  }
  if (el?.closest('[data-floating-menu]')) {
    return
  }
  closeDocumentMenu()
}
function onDocumentMenuWindowResize () {
  if (!documentMenuOpen.value) {
    return
  }
  closeDocumentMenu()
}
useDropdownEscapeClose(documentMenuOpen, closeDocumentMenu)
function stripManualLineBreaks (value: string): string {
  return value.replace(/\r?\n/g, '')
}
function adjustNameHeight () {
  const el = nameInputRef.value
  if (!el) {
    return
  }
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function setTextareaCaretFromClientPoint (el: HTMLTextAreaElement, clientX: number, clientY: number): boolean {
  // Try browser-native caret positioning first (works in modern Chromium/Firefox).
  try {
    const docAny = document as unknown as {
      caretPositionFromPoint?: (x: number, y: number) => { offset?: number } | null
      caretRangeFromPoint?: (x: number, y: number) => { startOffset?: number } | null
    }
    if (typeof docAny.caretPositionFromPoint === 'function') {
      const pos = docAny.caretPositionFromPoint(clientX, clientY)
      if (pos && typeof pos.offset === 'number') {
        const len = el.value.length
        const offset = Math.min(Math.max(0, pos.offset), len)
        el.setSelectionRange(offset, offset)
        return true
      }
    }
    if (typeof docAny.caretRangeFromPoint === 'function') {
      const range = docAny.caretRangeFromPoint(clientX, clientY)
      const offset = range?.startOffset
      if (typeof offset === 'number') {
        const len = el.value.length
        const clamped = Math.min(Math.max(0, offset), len)
        el.setSelectionRange(clamped, clamped)
        return true
      }
    }
  } catch {
    // Ignore and fallback below.
  }

  // Fallback for single-line-like text: estimate caret using canvas measure.
  // This is best-effort; multi-line caret by point needs browser-native support.
  try {
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left + el.scrollLeft
    const style = window.getComputedStyle(el)
    const paddingLeft = parseFloat(style.paddingLeft || '0')
    const fontSize = style.fontSize || '16px'
    const fontWeight = style.fontWeight || '400'
    const fontFamily = style.fontFamily || 'inherit'
    const letterSpacing = style.letterSpacing || 'normal'
    const normalizedLetterSpacing = letterSpacing.endsWith('px') ? parseFloat(letterSpacing) : 0

    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return false
    ctx.font = `${fontWeight} ${fontSize} ${fontFamily}`

    const text = el.value ?? ''
    const usableX = Math.max(0, x - paddingLeft)

    // Binary search for nearest offset by measured width.
    let lo = 0
    let hi = text.length
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2)
      const sample = text.slice(0, mid)
      const width = ctx.measureText(sample).width + Math.max(0, mid - 1) * normalizedLetterSpacing
      if (width < usableX) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }
    const offset = Math.min(Math.max(0, lo - 1), text.length)
    el.setSelectionRange(offset, offset)
    return true
  } catch {
    return false
  }
}

let nameClickClientPoint: { clientX: number; clientY: number } | null = null
let descriptionClickClientPoint: { clientX: number; clientY: number } | null = null

function onNameMouseDown (e: MouseEvent) {
  if (e.button !== 0) {
    return
  }
  if (editingField.value === 'name' || nameSaving.value) {
    return
  }
  nameClickClientPoint = { clientX: e.clientX, clientY: e.clientY }
  void startNameEdit()
}
async function startNameEdit () {
  if (!currentDocument.value || nameSaving.value) {
    return
  }
  fieldSaveError.value = null
  editingField.value = 'name'
  nameDraft.value = currentDocument.value.name
  await nextTick()
  adjustNameHeight()
  const el = nameInputRef.value
  if (el) {
    el.focus()
    const p = nameClickClientPoint
    if (p) {
      setTextareaCaretFromClientPoint(el, p.clientX, p.clientY)
    } else {
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
  }
  nameClickClientPoint = null
}
function cancelNameEdit () {
  if (nameSaving.value) {
    return
  }
  editingField.value = null
  nameDraft.value = ''
  fieldSaveError.value = null
}
function onNameInput () {
  const cleaned = stripManualLineBreaks(nameDraft.value)
  if (cleaned !== nameDraft.value) {
    nameDraft.value = cleaned
  }
  adjustNameHeight()
}
function onNameEnter () {
  if (nameComposing.value) {
    return
  }
  nameDraft.value = stripManualLineBreaks(nameDraft.value).trim()
  nameInputRef.value?.blur()
}
function clearNameEditIfActive () {
  if (editingField.value === 'name') {
    editingField.value = null
    nameDraft.value = ''
  }
}
async function confirmNameEdit () {
  if (!currentDocument.value || nameSaving.value || editingField.value !== 'name') {
    return
  }
  const name = stripManualLineBreaks(nameDraft.value).trim()
  if (name === currentDocument.value.name) {
    clearNameEditIfActive()
    return
  }
  const validationError = documentNameFieldError(name)
  if (validationError) {
    nameDraft.value = currentDocument.value.name
    clearNameEditIfActive()
    return
  }
  nameSaving.value = true
  fieldSaveError.value = null
  try {
    const updated = await api<OrgDocument>(
      `/orgs/${slug.value}/documents/${currentDocument.value.id}`,
      { method: 'PATCH', body: { name } },
    )
    applyDocument(updated)
    upsertDocumentCached(slug.value, updated)
    clearNameEditIfActive()
  } catch (e: unknown) {
    fieldSaveError.value = e instanceof Error ? e.message : '資料名の更新に失敗しました'
    nameDraft.value = currentDocument.value.name
    clearNameEditIfActive()
  } finally {
    nameSaving.value = false
  }
}
function onDescriptionMouseDown (e: MouseEvent) {
  if (e.button !== 0) {
    return
  }
  if (editingField.value === 'description' || descriptionSaving.value) {
    return
  }
  descriptionClickClientPoint = { clientX: e.clientX, clientY: e.clientY }
  void startDescriptionEdit()
}
async function startDescriptionEdit () {
  if (!currentDocument.value || descriptionSaving.value) {
    return
  }
  fieldSaveError.value = null
  editingField.value = 'description'
  descriptionDraft.value = currentDocument.value.description ?? ''
  await nextTick()
  const el = descriptionInputRef.value
  if (el) {
    el.focus()
    const p = descriptionClickClientPoint
    if (p) {
      setTextareaCaretFromClientPoint(el, p.clientX, p.clientY)
    } else {
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
  }
  descriptionClickClientPoint = null
}
function cancelDescriptionEdit () {
  if (descriptionSaving.value) {
    return
  }
  editingField.value = null
  descriptionDraft.value = ''
  fieldSaveError.value = null
}
function clearDescriptionEditIfActive () {
  if (editingField.value === 'description') {
    editingField.value = null
    descriptionDraft.value = ''
  }
}
async function confirmDescriptionEdit () {
  if (!currentDocument.value || descriptionSaving.value || editingField.value !== 'description') {
    return
  }
  const description = descriptionDraft.value
  const normalized = description.trim() === '' ? null : description
  if ((normalized ?? '') === (currentDocument.value.description ?? '')) {
    clearDescriptionEditIfActive()
    return
  }
  descriptionSaving.value = true
  fieldSaveError.value = null
  try {
    const updated = await api<OrgDocument>(
      `/orgs/${slug.value}/documents/${currentDocument.value.id}`,
      { method: 'PATCH', body: { description: normalized } },
    )
    applyDocument(updated)
    upsertDocumentCached(slug.value, updated)
    clearDescriptionEditIfActive()
  } catch (e: unknown) {
    fieldSaveError.value = e instanceof Error ? e.message : '資料説明の更新に失敗しました'
    descriptionDraft.value = currentDocument.value.description ?? ''
    clearDescriptionEditIfActive()
  } finally {
    descriptionSaving.value = false
  }
}
async function startBodyEdit () {
  if (!currentDocument.value || bodySaving.value) {
    return
  }
  bodyEditing.value = true
  bodyDraft.value = normalizeDocumentBodyText(currentDocument.value.body)
  bodySaveError.value = null
  if (bodyViewMode.value !== 'markdown') {
    bodyViewMode.value = 'markdown'
  }
  await nextTick()
  const scroller = resolveBodyScroller()
  const lockedScrollTop = scroller?.scrollTop ?? 0
  const unlock = lockBodyScroller(scroller, lockedScrollTop)
  adjustBodyHeight()
  restoreBodyScroller(scroller, lockedScrollTop)
  requestAnimationFrame(() => {
    restoreBodyScroller(scroller, lockedScrollTop)
    unlock()
  })
}
async function setBodyViewModeMarkdown () {
  bodyViewMode.value = 'markdown'
  if (!bodyEditing.value) {
    return
  }
  await nextTick()
  const scroller = resolveBodyScroller()
  const lockedScrollTop = scroller?.scrollTop ?? 0
  const unlock = lockBodyScroller(scroller, lockedScrollTop)
  adjustBodyHeight()
  restoreBodyScroller(scroller, lockedScrollTop)
  requestAnimationFrame(() => {
    restoreBodyScroller(scroller, lockedScrollTop)
    unlock()
  })
}
function onBodyInput () {
  const scroller = resolveBodyScroller()
  const lockedScrollTop = scroller?.scrollTop ?? 0
  const unlock = lockBodyScroller(scroller, lockedScrollTop)
  adjustBodyHeight()
  restoreBodyScroller(scroller, lockedScrollTop)
  requestAnimationFrame(() => {
    restoreBodyScroller(scroller, lockedScrollTop)
    unlock()
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
    const scrollerStyle = getComputedStyle(scroller)
    const pageStyle = getComputedStyle(page)
    const scrollerPadY = Number.parseFloat(scrollerStyle.paddingTop || '0')
      + Number.parseFloat(scrollerStyle.paddingBottom || '0')
    const pagePadY = Number.parseFloat(pageStyle.paddingTop || '0')
      + Number.parseFloat(pageStyle.paddingBottom || '0')
    const pageBorderY = Number.parseFloat(pageStyle.borderTopWidth || '0')
      + Number.parseFloat(pageStyle.borderBottomWidth || '0')
    fitHeight = Math.max(
      0,
      Math.floor(scroller.clientHeight - scrollerPadY - pagePadY - pageBorderY),
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
  bodyViewMode.value = 'preview'
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
  bodyViewMode.value = 'preview'
}
async function confirmBodyEdit () {
  if (!currentDocument.value || bodySaving.value || !bodyEditing.value) {
    return
  }
  const normalized = bodyDraft.value.trim() === '' ? null : bodyDraft.value
  const previous = normalizeDocumentBodyText(currentDocument.value.body)
  const previousNormalized = previous.trim() === '' ? null : previous
  if ((normalized ?? '') === (previousNormalized ?? '')) {
    cancelBodyEdit()
    return
  }
  bodySaving.value = true
  bodySaveError.value = null
  try {
    const updated = await api<OrgDocument>(
      `/orgs/${slug.value}/documents/${currentDocument.value.id}`,
      { method: 'PATCH', body: { body: normalized } },
    )
    applyDocument(updated)
    upsertDocumentCached(slug.value, updated)
    bodyEditing.value = false
    bodyDraft.value = ''
  } catch (e: unknown) {
    bodySaveError.value = e instanceof Error ? e.message : '資料本文の更新に失敗しました'
  } finally {
    bodySaving.value = false
  }
}
async function load () {
  fatalLoadError.value = null
  void ensureCategoriesLoaded()
  const detailCached = getDocumentCached(slug.value, documentId.value)
  const listCached = getDocumentFromListCache(slug.value, documentId.value)
  const cached = detailCached ?? listCached
  if (cached) {
    applyDocument(cached)
    pageReady.value = true
    if (!detailCached || cached.related_workspaces === undefined || cached.related_documents === undefined) {
      void fetchDocument(slug.value, documentId.value)
        .then((document) => {
          applyDocument(document)
        })
        .catch(() => {
          // 関連情報の再取得失敗時はキャッシュ表示のままにする
        })
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
        fatalLoadError.value = result.reason === 'timeout' ? timeoutMessage() : result.message
        return
      }
      applyDocument(result.value)
      pageReady.value = true
    })
  } catch (e: unknown) {
    fatalLoadError.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  } finally {
    if (import.meta.client) {
      await nextTick()
      updateStickyOffsets()
    }
  }
}
function retryLoad () {
  invalidateDocumentCached(slug.value, documentId.value)
  pageReady.value = false
  currentDocument.value = null
  editingField.value = null
  fieldSaveError.value = null
  bodyEditing.value = false
  bodyDraft.value = ''
  bodySaveError.value = null
  void load()
}
onBeforeMount(() => {
  void hydrateSidebarPreference()
  const cached = getDocumentCached(slug.value, documentId.value)
    ?? getDocumentFromListCache(slug.value, documentId.value)
  if (cached) {
    applyDocument(cached)
    pageReady.value = true
  }
  void ensureCategoriesLoaded()
})
onActivated(() => {
  void hydrateSidebarPreference()
  discardBodyEditOnLeave()
  editingField.value = null
  const cached = getDocumentCached(slug.value, documentId.value)
    ?? getDocumentFromListCache(slug.value, documentId.value)
  if (cached) {
    applyDocument(cached)
    pageReady.value = true
  }
  void ensureCategoriesLoaded()
  if (import.meta.client) {
    bindDocumentPageKeydown()
    nextTick(() => {
      updateStickyOffsets()
    })
  }
})
onDeactivated(() => {
  // 他画面へ遷移するときは編集をキャンセル扱い（未保存は破棄）
  discardBodyEditOnLeave()
  editingField.value = null
  closeDocumentMenu()
  closeRelatedMenu()
  documentFormModalOpen.value = false
  documentArchiveConfirmOpen.value = false
  relatedWorkspaceModalOpen.value = false
  relatedDocumentModalOpen.value = false
  unbindDocumentPageKeydown()
})
onMounted(() => {
  if (!pageReady.value) {
    void load()
  } else {
    void ensureCategoriesLoaded()
  }
  if (!import.meta.client) {
    return
  }
  bindDocumentPageKeydown()
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
    document.addEventListener('click', onDocumentMenuGlobalClick)
    window.addEventListener('resize', onDocumentMenuWindowResize)
  })
})
onBeforeUnmount(() => {
  if (!import.meta.client) {
    return
  }
  unbindDocumentPageKeydown()
  window.removeEventListener('resize', updateStickyOffsets)
  document.removeEventListener('click', onDocumentMenuGlobalClick)
  window.removeEventListener('resize', onDocumentMenuWindowResize)
  document.removeEventListener('pointerdown', onRelatedMenuGlobalPointerDown, true)
  window.removeEventListener('resize', onRelatedMenuWindowResize)
  globalHeaderObserver?.disconnect()
  globalHeaderObserver = null
})
</script>
<style lang="scss" scoped src="~/assets/styles/pages/org/slug/documents/id.scss"></style>

<style lang="scss" src="~/assets/styles/pages/org/slug/documents/id.global.scss"></style>
