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
                class="document-header-action-btn document-header-action-btn--primary"
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
            <div class="document-header-menu" data-document-header-menu-root>
              <button
                ref="documentMenuTriggerRef"
                type="button"
                class="document-header-menu-btn"
                aria-label="資料のメニュー"
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
          <div class="document-sidebar__labels">
            <span
              v-if="!documentLabels.length"
              class="document-sidebar__label-unset"
            >ラベル未設定</span>
            <LabelStrip
              v-for="label in documentLabels"
              :key="label.id"
              :label="label"
              size="md"
            />
            <DocumentLabelSelect
              :selected-ids="selectedLabelIds"
              :labels="orgDocumentLabels"
              :pending="labelSaving"
              @toggle="toggleDocumentLabel"
            />
          </div>
        </aside>
        <section class="document-viewer">
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
      <Teleport to="body">
        <div
          v-if="documentMenuOpen && documentMenuPosition"
          class="document-header-menu-dropdown"
          :class="{ 'document-header-menu-dropdown--share': documentMenuMode === 'share' }"
          role="menu"
          :style="documentMenuStyle"
          @pointerdown.stop
          @click.stop
        >
          <template v-if="documentMenuMode === 'actions'">
            <button
              type="button"
              class="document-header-menu-item"
              role="menuitem"
              :disabled="documentMetaPending"
              @click="openDocumentEditModal"
            >
              編集
            </button>
            <button
              type="button"
              class="document-header-menu-item"
              role="menuitem"
              @click="switchDocumentMenuToShare"
            >
              共有
            </button>
            <button
              type="button"
              class="document-header-menu-item document-header-menu-item--danger"
              role="menuitem"
              :disabled="documentMetaPending || deletePending"
              @click="openDocumentDeleteModal"
            >
              削除
            </button>
          </template>
          <div
            v-else
            class="document-header-share-panel"
          >
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
        </div>
      </Teleport>
      <DocumentCreateModal
        v-model="documentFormModalOpen"
        mode="edit"
        title="資料の編集"
        :initial-values="documentFormInitialValues"
        :org-slug="slug"
        :labels="orgDocumentLabels"
        :categories="documentCategories"
        :loading="documentMetaPending"
        @submit="onDocumentFormSubmit"
      />
      <DocumentDeleteModal
        ref="documentDeleteModalRef"
        v-model="documentDeleteModalOpen"
        :document-name="currentDocument.name"
        :loading="deletePending"
        @confirm="confirmDocumentDelete"
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
} from '../../../../composables/useOrgDocumentsPageData'
import { useApi } from '../../../../composables/useApi'
import type { TaskFormCategory, TaskFormLabel } from '../../../../composables/useTaskFormHelpers'
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
import LabelStrip from '../../../../components/ui/LabelStrip.vue'
import DocumentCategorySelect from '../../../../components/documents/DocumentCategorySelect.vue'
import DocumentLabelSelect from '../../../../components/documents/DocumentLabelSelect.vue'
import { renderMarkdownToSafeHtml } from '../../../../utils/renderMarkdown'
import { Pencil, Save, Ellipsis } from 'lucide-vue-next'
import DocumentCreateModal from '../../../../components/modals/DocumentCreateModal.vue'
import DocumentDeleteModal from '../../../../components/modals/DocumentDeleteModal.vue'
import { useDropdownEscapeClose } from '../../../../composables/useDropdownEscapeClose'

/** 資料本文用紙の最小縦幅（入力に応じて下方向へ伸びる） */
const DOCUMENT_PAGE_MIN_HEIGHT_PX = 767
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
const documentMenuOpen = ref(false)
const documentMenuMode = ref<'actions' | 'share'>('actions')
const documentMenuPosition = ref<{ top: number; left: number } | null>(null)
const documentMenuTriggerRef = ref<HTMLButtonElement | null>(null)
const shareUrlInputRef = ref<HTMLInputElement | null>(null)
const documentFormModalOpen = ref(false)
const documentDeleteModalOpen = ref(false)
const documentDeleteModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const documentMetaPending = ref(false)
const deletePending = ref(false)
const DOCUMENT_MENU_ACTIONS_WIDTH = 160
const DOCUMENT_MENU_SHARE_WIDTH = 320
const pageCssVars = computed(() => ({
  '--global-header-offset': `${globalHeaderOffsetPx.value}px`,
  '--app-shell-page-pad': '3.5px',
  '--document-page-min-height': `${DOCUMENT_PAGE_MIN_HEIGHT_PX}px`,
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
function applyOrgLabels (labels: TaskFormLabel[]) {
  orgDocumentLabels.value = labels
}
async function ensureCategoriesLoaded () {
  const cached = getCached(slug.value)
  if (cached) {
    applyCategories(cached.documentCategories)
    applyOrgLabels(cached.documentLabels)
    return
  }
  try {
    const snapshot = await fetchSnapshot(slug.value)
    applyCategories(snapshot.documentCategories)
    applyOrgLabels(snapshot.documentLabels)
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
function openDocumentEditModal () {
  closeDocumentMenu()
  documentFormModalOpen.value = true
}
function openDocumentDeleteModal () {
  closeDocumentMenu()
  documentDeleteModalOpen.value = true
}
async function onDocumentFormSubmit (payload: {
  name: string
  description: string | null
  category: string | null
  label_ids: number[]
}) {
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
    fieldSaveError.value = e instanceof Error ? e.message : '資料の更新に失敗しました'
  } finally {
    documentMetaPending.value = false
  }
}
async function confirmDocumentDelete () {
  const target = currentDocument.value
  if (!target || deletePending.value) {
    return
  }
  deletePending.value = true
  try {
    await withAppLoadingCursor(async () => {
      await api(`/orgs/${slug.value}/documents/${target.id}`, {
        method: 'DELETE',
      })
      documentDeleteModalOpen.value = false
      removeDocumentCached(slug.value, target.id)
      await router.push(`/org/${slug.value}/documents`)
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '削除に失敗しました'
    documentDeleteModalRef.value?.setSubmitError(message)
  } finally {
    deletePending.value = false
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
  if (el?.closest('.document-header-menu-dropdown')) {
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
  adjustBodyHeight()
}
async function setBodyViewModeMarkdown () {
  bodyViewMode.value = 'markdown'
  if (!bodyEditing.value) {
    return
  }
  await nextTick()
  adjustBodyHeight()
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
  const el = bodyInputRef.value
  if (!el) {
    return null
  }
  return el.closest('.document-viewer') as HTMLElement | null
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
  // 一旦 auto にして実コンテンツ高さを測る（0 に潰すと親が勝手にスクロールしやすい）
  el.style.height = 'auto'
  const contentHeight = el.scrollHeight
  let minFill = contentHeight
  if (page) {
    const style = getComputedStyle(page)
    const padY = Number.parseFloat(style.paddingTop || '0') + Number.parseFloat(style.paddingBottom || '0')
    minFill = Math.max(contentHeight, Math.max(0, DOCUMENT_PAGE_MIN_HEIGHT_PX - padY))
  }
  el.style.height = `${minFill}px`
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
  const cached = getDocumentCached(slug.value, documentId.value)
    ?? getDocumentFromListCache(slug.value, documentId.value)
  if (cached) {
    applyDocument(cached)
    pageReady.value = true
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
  const cached = getDocumentCached(slug.value, documentId.value)
    ?? getDocumentFromListCache(slug.value, documentId.value)
  if (cached) {
    applyDocument(cached)
    pageReady.value = true
  }
  void ensureCategoriesLoaded()
})
onActivated(() => {
  discardBodyEditOnLeave()
  editingField.value = null
  const cached = getDocumentCached(slug.value, documentId.value)
    ?? getDocumentFromListCache(slug.value, documentId.value)
  if (cached) {
    applyDocument(cached)
    pageReady.value = true
  }
  void ensureCategoriesLoaded()
})
onDeactivated(() => {
  // 他画面へ遷移するときは編集をキャンセル扱い（未保存は破棄）
  discardBodyEditOnLeave()
  editingField.value = null
  closeDocumentMenu()
  documentFormModalOpen.value = false
  documentDeleteModalOpen.value = false
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
  window.removeEventListener('resize', updateStickyOffsets)
  document.removeEventListener('click', onDocumentMenuGlobalClick)
  window.removeEventListener('resize', onDocumentMenuWindowResize)
  globalHeaderObserver?.disconnect()
  globalHeaderObserver = null
})
</script>
<style lang="scss" scoped>
.document-show-page {
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - var(--global-header-offset, 56px));
  height: calc(100dvh - var(--global-header-offset, 56px));
  max-height: calc(100dvh - var(--global-header-offset, 56px));
  padding: 0 14px 0;
  margin-top: calc(-1 * var(--app-shell-page-pad, 3.5px));
  padding-top: 0;
  box-sizing: border-box;
  overflow: hidden;
}
.page-header {
  position: relative;
  z-index: 40;
  flex-shrink: 0;
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
  gap: 12px;
  height: 100%;
  min-width: 0;
}
.subheader-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-left: auto;
  flex-shrink: 0;
}
.subheader-editing-badge {
  margin: 0;
  margin-right: 8px;
  font-size: 16px;
  line-height: 1;
  white-space: nowrap;
  user-select: none;
}
.document-header-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  margin: 0;
  height: 32px;
  padding: 0 12px;
  border: 1px solid mixin.$main;
  border-radius: 6px;
  background: #fff;
  color: mixin.$main;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  :deep(svg) {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
}
.document-header-action-btn:not(.document-header-action-btn--muted) {
  width: 96px;
}
.document-header-action-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.document-header-action-btn:focus-visible {
  outline: 2px solid mixin.$main;
  outline-offset: 2px;
}
.document-header-action-btn--muted {
  border-color: transparent;
  background: #e5e7eb;
  color: #475569;
}
.document-header-action-btn--primary {
  background: mixin.$main;
  color: #fff;
}
.document-header-menu {
  position: relative;
  flex-shrink: 0;
}
.document-header-menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 32px;
  height: 32px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: #f0f0f0;
  color: #64748b;
  cursor: pointer;
}
.document-header-menu-btn:focus-visible {
  outline: 2px solid mixin.$main;
  outline-offset: 2px;
}
.document-header-menu-btn :deep(svg) {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.subheader-title {
  @include mixin.page-header-title;
}
.subheader-back-link {
  display: inline-flex;
  align-items: center;
  gap: 4.2px;
  padding: 8px 0;
  margin: -8px 0;
  text-decoration: none;
  color: mixin.$main;
  letter-spacing: 0.05em;
  line-height: 1.1;
  transition: opacity 0.16s ease;
  flex-shrink: 0;
  &::before {
    content: '';
    flex-shrink: 0;
    display: block;
    width: 0.65em;
    height: 0.85em;
    background-color: currentColor;
    -webkit-mask-image: url('~/assets/images/chevron-left.svg');
    mask-image: url('~/assets/images/chevron-left.svg');
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
  }
}
.subheader-doc-name {
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  letter-spacing: 0.02em;
}
.document-show-body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  width: calc(100% + 28px);
  margin-left: -14px;
  margin-right: -14px;
  overflow: hidden;
}
.document-sidebar {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 400px;
  flex-shrink: 0;
  box-sizing: border-box;
  padding: 20px;
  background: #fff;
  box-shadow: 2px 0 10px rgba(15, 23, 42, 0.08);
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #0f172a1a transparent;
}
.document-sidebar::-webkit-scrollbar {
  width: 3px;
}
.document-sidebar::-webkit-scrollbar-track {
  background: transparent;
}
.document-sidebar::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.08);
  border-radius: 999px;
}
.document-sidebar__category {
  align-self: flex-start;
  max-width: 100%;
  min-width: 0;
}
.document-sidebar__title-field {
  position: relative;
  width: 100%;
  min-width: 0;
}
.document-sidebar__title,
.document-sidebar__title-input {
  margin: 0;
  width: 100%;
  box-sizing: border-box;
  font-size: 22px;
  font-weight: 700;
  font-family: inherit;
  line-height: 1.35;
  color: #0f172a;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 8px;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.document-sidebar__title {
  display: block;
}
.document-sidebar__title--clickable {
  cursor: pointer;
}
.document-sidebar__title--clickable:focus-visible {
  outline: 2px solid mixin.$main;
  outline-offset: 2px;
}
.document-sidebar__title--measure {
  visibility: hidden;
}
.document-sidebar__title-field--editing .document-sidebar__title {
  pointer-events: none;
}
.document-sidebar__title-input {
  position: absolute;
  inset: 0;
  display: block;
  background: transparent;
  caret-color: #0f172a;
  appearance: none;
  -webkit-appearance: none;
  resize: none;
  overflow: hidden;
  white-space: pre-wrap;
}
.document-sidebar__title-input:focus {
  outline: none;
  border-color: mixin.$main;
}
.document-sidebar__title-field--editing {
  cursor: auto;
  user-select: text;
}
.document-sidebar__labels {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.document-sidebar__label-unset,
.document-sidebar__labels :deep(.label-strip) {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  max-width: 100%;
  height: 28px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
}
.document-sidebar__label-unset {
  color: mixin.$text-muted;
  background: mixin.$surface-muted;
}
.document-sidebar__labels :deep(.label-strip__text) {
  width: auto;
}
.document-sidebar__description-field {
  position: relative;
  width: 100%;
  min-width: 0;
  margin: 0 0 8px;
}
.document-sidebar__description,
.document-sidebar__description-input {
  display: block;
  margin: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: mixin.$surface-canvas;
  font-size: 16px;
  font-family: inherit;
  font-weight: 400;
  /* 小数 line-height だと Chromium の選択ハイライトに隙間が出るため整数 px にする */
  line-height: 28px;
  color: #334155;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.document-sidebar__description--clickable {
  cursor: pointer;
}
.document-sidebar__description--clickable:focus-visible {
  outline: 2px solid mixin.$main;
  outline-offset: 2px;
}
.document-sidebar__description--measure {
  visibility: hidden;
  pointer-events: none;
}
.document-sidebar__description--placeholder {
  color: #94a3b8;
}
.document-sidebar__description-field--editing .document-sidebar__description {
  pointer-events: none;
}
/* app.vue の textarea / :focus 共通スタイルを上書きし、表示⇔編集で寸法が変わらないようにする */
.document-sidebar textarea.document-sidebar__description-input {
  position: absolute;
  inset: 0;
  height: 100%;
  caret-color: #334155;
  appearance: none;
  -webkit-appearance: none;
  resize: none;
  overflow: hidden;
  text-decoration: none;
  border: 1px solid transparent;
  box-shadow: none;
  outline: none;
}
.document-sidebar textarea.document-sidebar__description-input:focus,
.document-sidebar textarea.document-sidebar__description-input:focus-visible {
  outline: none;
  border: 1px solid mixin.$main;
  box-shadow: none;
}
.document-sidebar__description-field--editing {
  cursor: auto;
  user-select: text;
}
.document-sidebar__save-error {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: mixin.$danger;
}
.document-viewer {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 20px;
  box-sizing: border-box;
  background: mixin.$surface-canvas;
  overflow: auto;
  overflow-anchor: none;
}
.document-viewer__page {
  position: relative;
  width: min(100%, 1000px);
  min-height: var(--document-page-min-height, 767px);
  box-sizing: border-box;
  padding: 56px 48px 56px;
  border: 1px solid transparent;
  background: #fff;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.1), 0 1px 3px rgba(15, 23, 42, 0.06);
}
.document-viewer__page--editing {
  border-color: mixin.$edit-border;
}
.document-viewer__mode-tabs {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 16px;
}
.document-viewer__mode-tab {
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: mixin.$text-muted;
  font-size: 16px;
  font-weight: 700;
  font-family: inherit;
  line-height: 1.2;
  cursor: pointer;
}
.document-viewer__mode-tab--active {
  color: mixin.$main;
}
.document-viewer__mode-tab:focus-visible {
  outline: 2px solid mixin.$main;
  outline-offset: 2px;
  border-radius: 2px;
}
.document-viewer__body {
  margin: 0;
  font-size: 14px;
  line-height: 1.8;
  color: #1e293b;
  white-space: pre-wrap;
  word-break: break-word;
}
.document-viewer__body--preview {
  white-space: normal;
  font-size: 14px;
  /* 斜体フォントが無い場合でも browser 合成で italic を表示する */
  font-synthesis: style weight;
  :deep(> :first-child) {
    margin-top: 0;
  }
  :deep(> :last-child) {
    margin-bottom: 0;
  }
  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin: 1.2em 0 0.5em;
    font-weight: 700;
    line-height: 1.35;
    color: #0f172a;
  }
  :deep(h1) { font-size: 24px; }
  :deep(h2) { font-size: 22px; }
  :deep(h3) { font-size: 20px; }
  :deep(h4) { font-size: 18px; }
  :deep(h5) { font-size: 16px; }
  :deep(h6) { font-size: 14px; }
  :deep(p),
  :deep(ul),
  :deep(ol),
  :deep(li),
  :deep(blockquote),
  :deep(td),
  :deep(th),
  :deep(a) {
    font-size: 14px;
  }
  :deep(em),
  :deep(i) {
    font-style: italic;
  }
  :deep(strong),
  :deep(b) {
    font-weight: 700;
  }
  :deep(em strong),
  :deep(strong em),
  :deep(i b),
  :deep(b i) {
    font-style: italic;
    font-weight: 700;
  }
  :deep(p) {
    margin: 0 0 0.9em;
  }
  :deep(ul),
  :deep(ol) {
    margin: 0 0 0.9em;
    padding-left: 1.5em;
  }
  :deep(li + li) {
    margin-top: 0.25em;
  }
  :deep(ul.contains-task-list) {
    list-style: none;
    padding-left: 0;
  }
  :deep(li.task-list-item) {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    list-style: none;
  }
  :deep(li.task-list-item > p) {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0;
    flex: 1;
    min-width: 0;
  }
  :deep(input.task-list-item-checkbox) {
    flex-shrink: 0;
    box-sizing: border-box;
    width: 14px;
    height: 14px;
    margin: 0.35em 0 0;
    padding: 0;
    appearance: none;
    -webkit-appearance: none;
    border: 1.5px solid #94a3b8;
    border-radius: 3px;
    background: #fff;
    color: #fff;
    cursor: default;
    pointer-events: none;
    vertical-align: middle;
  }
  :deep(input.task-list-item-checkbox:checked) {
    border-color: mixin.$main;
    background-color: mixin.$main;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23fff' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' d='M3.5 8.5l3 3 6-7'/%3E%3C/svg%3E");
    background-position: center;
    background-repeat: no-repeat;
    background-size: 12px 12px;
  }
  :deep(input.task-list-item-checkbox:disabled) {
    opacity: 1;
  }
  :deep(blockquote) {
    margin: 0 0 0.9em;
    padding: 0.2em 0 0.2em 0.9em;
    border-left: 3px solid #cbd5e1;
    color: #475569;
  }
  :deep(blockquote > :first-child) {
    margin-top: 0;
  }
  :deep(blockquote > :last-child) {
    margin-bottom: 0;
  }
  :deep(blockquote p) {
    margin: 0;
  }
  :deep(pre) {
    margin: 0 0 0.9em;
    padding: 12px 14px;
    overflow-x: auto;
    border-radius: 8px;
    background: #f1f5f9;
    font-size: 14px;
    line-height: 1.55;
  }
  :deep(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 14px;
  }
  :deep(:not(pre) > code) {
    padding: 0.1em 0.35em;
    border-radius: 4px;
    background: #f1f5f9;
  }
  :deep(a) {
    color: mixin.$main;
    text-decoration: underline;
  }
  :deep(hr) {
    margin: 1.4em 0;
    border: none;
    border-top: 1px solid #e2e8f0;
  }
  :deep(table) {
    width: 100%;
    margin: 0 0 0.9em;
    border-collapse: collapse;
  }
  :deep(th),
  :deep(td) {
    padding: 6px 10px;
    border: 1px solid #e2e8f0;
  }
  :deep(th[align='left']),
  :deep(td[align='left']) {
    text-align: left;
  }
  :deep(th[align='center']),
  :deep(td[align='center']) {
    text-align: center;
  }
  :deep(th[align='right']),
  :deep(td[align='right']) {
    text-align: right;
  }
  :deep(th:not([align])),
  :deep(td:not([align])) {
    text-align: left;
  }
  :deep(th) {
    background: #f8fafc;
    font-weight: 700;
  }
}
.document-viewer__body--empty {
  color: #94a3b8;
}
.document-viewer textarea.document-viewer__body-input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  color: #1e293b;
  font-size: 14px;
  font-family: inherit;
  font-weight: 400;
  line-height: 1.8;
  resize: none;
  overflow: hidden;
  appearance: none;
  -webkit-appearance: none;
  box-shadow: none;
  outline: none;
}
.document-viewer textarea.document-viewer__body-input:focus,
.document-viewer textarea.document-viewer__body-input:focus-visible {
  outline: none;
  border: none;
  box-shadow: none;
}
.document-viewer__save-error {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: mixin.$danger;
}
@media (max-width: 768px) {
  .document-show-page {
    height: auto;
    max-height: none;
    overflow: visible;
    padding-bottom: 14px;
  }
  .document-show-body {
    flex-direction: column;
    overflow: visible;
  }
  .document-sidebar {
    width: 100%;
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.08);
  }
  .document-viewer {
    min-height: 50vh;
  }
  .document-viewer__page {
    width: 100%;
    padding: 48px 20px 52px;
  }
  .document-viewer__mode-tabs {
    top: 12px;
    right: 12px;
    gap: 12px;
  }
}
.document-header-menu-dropdown {
  box-sizing: border-box;
  margin: 0;
  padding: 4.9px 0;
  list-style: none;
  background: #fff;
  border: 1px solid mixin.$border;
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14);
  display: flex;
  flex-direction: column;
}
.document-header-menu-dropdown--share {
  padding: 10px 12px;
}
.document-header-menu-item {
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
}
.document-header-menu-item:disabled {
  opacity: 0.55;
  cursor: default;
}
.document-header-menu-item--danger {
  color: mixin.$danger;
}
.document-header-share-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.document-header-share-panel__label {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: mixin.$text-muted;
  line-height: 1.2;
}
.document-header-share-panel__input {
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 8px 10px;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  background: #f8fafc;
  color: mixin.$text;
  font: inherit;
  font-size: 13px;
  line-height: 1.35;
  cursor: text;
}
.document-header-share-panel__input:focus {
  outline: none;
  border-color: mixin.$main;
  box-shadow: 0 0 0 1px mixin.$main;
}
</style>
