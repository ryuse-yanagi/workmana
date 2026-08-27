<template>
  <aside
    v-if="workspace"
    class="workspace-sidebar"
  >
    <div
      class="workspace-sidebar__title-field"
      :class="{ 'workspace-sidebar__title-field--editing': editingField === 'name' }"
    >
      <h1
        class="workspace-sidebar__title workspace-sidebar__title--clickable"
        :class="{ 'workspace-sidebar__title--measure': editingField === 'name' }"
        role="button"
        :tabindex="editingField === 'name' ? -1 : 0"
        :aria-label="workspace.name"
        @mousedown.prevent="onNameMouseDown($event)"
        @keydown.enter.prevent="startNameEdit"
        @keydown.space.prevent="startNameEdit"
      >
        {{ editingField === 'name' ? (nameDraft || '\u00a0') : workspace.name }}
      </h1>
      <textarea
        v-if="editingField === 'name'"
        ref="nameInputRef"
        v-model="nameDraft"
        class="workspace-sidebar__title-input"
        :maxlength="WORKSPACE_NAME_MAX_LENGTH"
        :disabled="nameSaving"
        aria-label="スペース名"
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
      class="workspace-sidebar__description-field"
      :class="{ 'workspace-sidebar__description-field--editing': editingField === 'description' }"
    >
      <p
        class="workspace-sidebar__description workspace-sidebar__description--clickable"
        :class="{
          'workspace-sidebar__description--measure': editingField === 'description',
          'workspace-sidebar__description--placeholder': editingField !== 'description' && !workspace.description,
        }"
        role="button"
        :tabindex="editingField === 'description' ? -1 : 0"
        :aria-label="workspace.description ? 'スペース説明' : 'スペース説明を追加'"
        @mousedown.prevent="onDescriptionMouseDown($event)"
        @keydown.enter.prevent="startDescriptionEdit"
        @keydown.space.prevent="startDescriptionEdit"
      >
        {{
          editingField === 'description'
            ? (descriptionDraft || '\u00a0')
            : (workspace.description || '説明を追加する')
        }}
      </p>
      <textarea
        v-if="editingField === 'description'"
        ref="descriptionInputRef"
        v-model="descriptionDraft"
        class="workspace-sidebar__description-input"
        :maxlength="TASK_DESCRIPTION_MAX_LENGTH"
        :disabled="descriptionSaving"
        aria-label="スペース説明"
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
      class="workspace-sidebar__save-error"
    >{{ fieldSaveError }}</p>
    <div class="workspace-sidebar__status">
      <WorkspaceStatusSelect
        :status="workspace.status ?? null"
        :statuses="workspaceStatuses"
        :pending="statusSaving"
        @select="updateWorkspaceStatus"
      />
    </div>
    <section class="workspace-sidebar__field-section">
      <h2 class="workspace-sidebar__related-heading">ラベル</h2>
      <div class="workspace-sidebar__labels">
        <LabelStrip
          v-for="label in workspaceLabels"
          :key="label.id"
          :label="label"
          size="md"
        />
        <DocumentLabelSelect
          :selected-ids="selectedLabelIds"
          :labels="orgLabelOptions"
          :label-categories="orgLabelCategories"
          :pending="labelSaving"
          @toggle="toggleWorkspaceLabel"
        />
      </div>
    </section>
    <section class="workspace-sidebar__field-section">
      <h2 class="workspace-sidebar__related-heading">担当者</h2>
      <div
        class="workspace-sidebar__assignees"
        data-workspace-sidebar-assignee-root
        aria-label="担当者"
      >
        <MemberAvatar
          v-for="member in workspaceAssignees"
          :key="member.id"
          :member="member"
          size="sm"
          :title="memberDisplayName(member)"
          :aria-label="memberDisplayName(member)"
          :decorative="false"
        />
        <button
          ref="assigneeAddTriggerRef"
          type="button"
          class="workspace-sidebar__add-btn"
          :aria-expanded="assigneePickerOpen"
          aria-haspopup="dialog"
          aria-label="担当者を追加"
          :disabled="assigneeSaving"
          @click.stop="toggleAssigneePicker"
        >
          <span class="workspace-sidebar__add-btn-plus" aria-hidden="true">+</span>
        </button>
      </div>
      <Teleport to="body">
        <WorkspaceMemberPickerPopover
          v-if="assigneePickerOpen"
          ref="assigneePickerRef"
          :style="assigneePickerStyle"
          :assignees="workspaceAssignees"
          :org-members="orgMembers"
          v-model:search-query="assigneeSearchQuery"
          :disabled="assigneeSaving"
          @close="closeAssigneePicker"
          @toggle-member="toggleWorkspaceAssignee"
        />
      </Teleport>
    </section>
    <section class="workspace-sidebar__field-section">
      <h2 class="workspace-sidebar__related-heading">関連スペース</h2>
      <ul
        v-if="relatedWorkspaces.length"
        class="workspace-sidebar__related-list"
      >
        <li
          v-for="item in relatedWorkspaces"
          :key="`workspace-${item.id}`"
          class="workspace-sidebar__related-item"
        >
          <NuxtLink
            :to="`/org/${orgSlug}/workspaces/${item.id}`"
            class="workspace-sidebar__related-link"
          >
            <span class="workspace-sidebar__related-link-text">{{ item.name }}</span>
          </NuxtLink>
          <button
            type="button"
            class="workspace-sidebar__related-menu-btn"
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
        class="workspace-sidebar__related-edit-btn"
        :disabled="relatedWorkspaceSaving"
        @click="openRelatedWorkspaceModal"
      >
        編集
      </button>
    </section>
    <section class="workspace-sidebar__field-section">
      <h2 class="workspace-sidebar__related-heading">関連資料</h2>
      <ul
        v-if="relatedDocuments.length"
        class="workspace-sidebar__related-list"
      >
        <li
          v-for="item in relatedDocuments"
          :key="`document-${item.id}`"
          class="workspace-sidebar__related-item"
        >
          <NuxtLink
            :to="`/org/${orgSlug}/documents/${item.id}`"
            class="workspace-sidebar__related-link"
          >
            <span class="workspace-sidebar__related-link-text">{{ item.name }}</span>
          </NuxtLink>
          <button
            type="button"
            class="workspace-sidebar__related-menu-btn"
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
        class="workspace-sidebar__related-edit-btn"
        :disabled="relatedDocumentSaving"
        @click="openRelatedDocumentModal"
      >
        編集
      </button>
    </section>
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
      :hidden-ids="relatedWorkspaceHiddenIds"
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
      :candidates-loading="documentCandidatesLoading"
      :candidates-error="documentCandidatesError"
      :loading="relatedDocumentSaving"
      @submit="onRelatedDocumentsSubmit"
    />
  </aside>
</template>
<script setup lang="ts">
import { EllipsisVertical } from 'lucide-vue-next'
import { useApi } from '../../composables/useApi'
import {
  type OrgWorkspaceAssignee,
  type OrgWorkspaceItem,
  type OrgWorkspaceLabel,
  type OrgWorkspaceRelatedItem,
  type OrgWorkspaceStatus,
  useOrgWorkspaceIndexPageData,
} from '../../composables/useOrgWorkspaceIndexPageData'
import { useOrgDocumentsPageData, type OrgDocument } from '../../composables/useOrgDocumentsPageData'
import { useWorkspaceDetailMeta } from '../../composables/useWorkspaceDetailMeta'
import { useDropdownEscapeClose } from '../../composables/useDropdownEscapeClose'
import { useExclusivePopover } from '../../composables/useExclusivePopover'
import { isScrollInsideRoot } from '../../utils/uiInteraction'
import { popoverMaxHeightStyle, popoverScrollbarGutterStyle, popoverWidthExtraForGutter, resolvePopoverScrollbarGutter } from '../../utils/popoverScrollbar'
import type { TaskFormLabel, TaskFormMember } from '../../composables/useTaskFormHelpers'
import {
  TASK_DESCRIPTION_MAX_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
} from '../../constants/fieldLengthLimits'
import { workspaceNameFieldError } from '../../utils/formValidation'
import { resolveLabelColors } from '../../utils/colorPresetResolution'
import { memberDisplayName, sortMembersByDisplayName } from '../../composables/useMemberDisplay'
import LabelStrip from '../ui/LabelStrip.vue'
import MemberAvatar from '../ui/MemberAvatar.vue'
import FloatingMenu, { type FloatingMenuItem } from '../ui/FloatingMenu.vue'
import DocumentLabelSelect from '../documents/DocumentLabelSelect.vue'
import RelatedItemPickerModal from '../modals/RelatedItemPickerModal.vue'
import WorkspaceMemberPickerPopover from './WorkspaceMemberPickerPopover.vue'
import WorkspaceStatusSelect from './WorkspaceStatusSelect.vue'
import {
  syncPeerCachesAfterWorkspaceRelatedDocumentsChange,
  syncPeerCachesAfterWorkspaceRelatedWorkspacesChange,
} from '../../composables/syncRelatedRelationCaches'
import {
  applyUserProfileToMembers,
  useOnUserProfileUpdated,
} from '../../composables/userProfileUpdated'

const props = defineProps<{
  orgSlug: string
  workspaceId: string | number
}>()

const { api } = useApi()
const {
  workspace,
  orgLabels,
  orgLabelCategories,
  workspaceStatuses,
  ensureLoaded,
  applyWorkspace,
} = useWorkspaceDetailMeta(() => props.orgSlug, () => props.workspaceId)
const {
  getCached: getWorkspaceIndexCached,
  fetchSnapshot: fetchWorkspaceIndexSnapshot,
  patchCachedWorkspaceAssignees,
} = useOrgWorkspaceIndexPageData()
const {
  getCached: getDocumentsCached,
  fetchSnapshot: fetchDocumentsSnapshot,
} = useOrgDocumentsPageData()

const editingField = ref<'name' | 'description' | null>(null)
const nameDraft = ref('')
const descriptionDraft = ref('')
const nameSaving = ref(false)
const descriptionSaving = ref(false)
const statusSaving = ref(false)
const labelSaving = ref(false)
const assigneeSaving = ref(false)
const nameComposing = ref(false)
const fieldSaveError = ref<string | null>(null)
const nameInputRef = ref<HTMLTextAreaElement | null>(null)
const descriptionInputRef = ref<HTMLTextAreaElement | null>(null)
const orgMembers = ref<OrgWorkspaceAssignee[]>([])

const assigneePickerOpen = ref(false)
const assigneeSearchQuery = ref('')
const assigneeAddTriggerRef = ref<HTMLElement | null>(null)
const assigneePickerRef = ref<{ rootRef: HTMLElement | null } | null>(null)
const assigneePickerPosition = ref<{ top: number; left: number; maxHeight: number; scrollbarGutter: number } | null>(null)
const ASSIGNEE_PICKER_GAP = 6
const ASSIGNEE_PICKER_VIEWPORT_PAD = 8
const ASSIGNEE_PICKER_VERTICAL_PADDING = 12
const ASSIGNEE_PICKER_WIDTH = 273
const ASSIGNEE_PICKER_MIN_HEIGHT = 120

const assigneePickerStyle = computed(() => {
  if (!assigneePickerPosition.value) {
    return {
      visibility: 'hidden',
    } as Record<string, string>
  }
  const { top, left, maxHeight, scrollbarGutter } = assigneePickerPosition.value
  return {
    top: `${top}px`,
    left: `${left}px`,
    visibility: 'visible',
    ...popoverMaxHeightStyle(maxHeight, scrollbarGutter),
    ...popoverScrollbarGutterStyle(scrollbarGutter),
  }
})

const relatedWorkspaceModalOpen = ref(false)
const relatedDocumentModalOpen = ref(false)
const relatedWorkspaceSaving = ref(false)
const relatedDocumentSaving = ref(false)
const relatedDetachPending = ref(false)
const relatedWorkspaceModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const relatedDocumentModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const workspaceCandidates = ref<OrgWorkspaceRelatedItem[]>([])
const documentCandidates = ref<OrgWorkspaceRelatedItem[]>([])
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

onBeforeUnmount(() => {
  if (!import.meta.client) {
    return
  }
  document.removeEventListener('pointerdown', onRelatedMenuGlobalPointerDown, true)
  window.removeEventListener('resize', onRelatedMenuWindowResize)
  document.removeEventListener('pointerup', onAssigneePickerPointerUp, true)
  window.removeEventListener('resize', onAssigneePickerWindowResize)
  window.removeEventListener('scroll', onAssigneePickerWindowScroll, true)
})

const relatedMenuItems: FloatingMenuItem[] = [
  { key: 'detach', label: '関連から除外', danger: true },
]
function onRelatedMenuSelect (item: FloatingMenuItem) {
  if (item.key === 'detach') {
    void detachRelatedItem()
  }
}

async function detachRelatedItem () {
  const current = workspace.value
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
      const res = await api<{ data: OrgWorkspaceRelatedItem[] }>(
        `/orgs/${props.orgSlug}/workspaces/${current.id}/related-workspaces/${itemId}`,
        { method: 'DELETE' },
      )
      applyWorkspace({
        ...current,
        related_workspaces: res.data,
      })
      syncPeerCachesAfterWorkspaceRelatedWorkspacesChange(
        props.orgSlug,
        current,
        previous,
        res.data,
      )
    } else {
      const previous = current.related_documents ?? []
      const res = await api<{ data: OrgWorkspaceRelatedItem[] }>(
        `/orgs/${props.orgSlug}/workspaces/${current.id}/related-documents/${itemId}`,
        { method: 'DELETE' },
      )
      applyWorkspace({
        ...current,
        related_documents: res.data,
      })
      syncPeerCachesAfterWorkspaceRelatedDocumentsChange(
        props.orgSlug,
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

let nameClickClientPoint: { clientX: number; clientY: number } | null = null
let descriptionClickClientPoint: { clientX: number; clientY: number } | null = null

const workspaceLabels = computed(() => {
  const labels = workspace.value?.labels
  if (!labels?.length) {
    return [] as OrgWorkspaceLabel[]
  }
  return resolveLabelColors(labels)
})

const selectedLabelIds = computed(() => workspaceLabels.value.map(label => label.id))

const workspaceAssignees = computed(() => workspace.value?.assignees ?? [])

const orgLabelOptions = computed((): TaskFormLabel[] => {
  return orgLabels.value.map(label => ({
    id: label.id,
    name: label.name,
    color: label.color,
  }))
})

const relatedWorkspaces = computed(() => workspace.value?.related_workspaces ?? [])
const relatedDocuments = computed(() => workspace.value?.related_documents ?? [])

const relatedWorkspaceSelectedIds = computed(() => relatedWorkspaces.value.map(item => item.id))
const relatedDocumentSelectedIds = computed(() => relatedDocuments.value.map(item => item.id))

const relatedWorkspaceHiddenIds = computed(() => {
  const currentId = Number(props.workspaceId)
  return Number.isFinite(currentId) ? [currentId] : []
})

function mergePickerItems (
  candidates: OrgWorkspaceRelatedItem[],
  related: OrgWorkspaceRelatedItem[],
): OrgWorkspaceRelatedItem[] {
  const map = new Map<number, OrgWorkspaceRelatedItem>()
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

watch(
  () => [props.orgSlug, props.workspaceId] as const,
  () => {
    void ensureLoaded()
    void ensureOrgMembersLoaded()
  },
  { immediate: true },
)

async function ensureOrgMembersLoaded () {
  const cached = getWorkspaceIndexCached(props.orgSlug)
  if (cached) {
    orgMembers.value = cached.orgMembers
    return
  }
  try {
    const snapshot = await fetchWorkspaceIndexSnapshot(props.orgSlug)
    orgMembers.value = snapshot.orgMembers
  } catch {
    // 担当者ピッカーは空のままにする
  }
}

async function loadWorkspaceCandidates () {
  workspaceCandidatesLoading.value = true
  workspaceCandidatesError.value = null
  try {
    const cached = getWorkspaceIndexCached(props.orgSlug)
    const snapshot = cached ?? await fetchWorkspaceIndexSnapshot(props.orgSlug)
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
    const cached = getDocumentsCached(props.orgSlug)
    const snapshot = cached ?? await fetchDocumentsSnapshot(props.orgSlug)
    documentCandidates.value = snapshot.documents.map((item: OrgDocument) => ({
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
  const current = workspace.value
  if (!current || relatedWorkspaceSaving.value) {
    return
  }
  relatedWorkspaceSaving.value = true
  try {
    const previous = current.related_workspaces ?? []
    const res = await api<{ data: OrgWorkspaceRelatedItem[] }>(
      `/orgs/${props.orgSlug}/workspaces/${current.id}/related-workspaces`,
      { method: 'PUT', body: { workspace_ids: ids } },
    )
    applyWorkspace({
      ...current,
      related_workspaces: res.data,
    })
    syncPeerCachesAfterWorkspaceRelatedWorkspacesChange(
      props.orgSlug,
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
  const current = workspace.value
  if (!current || relatedDocumentSaving.value) {
    return
  }
  relatedDocumentSaving.value = true
  try {
    const previous = current.related_documents ?? []
    const res = await api<{ data: OrgWorkspaceRelatedItem[] }>(
      `/orgs/${props.orgSlug}/workspaces/${current.id}/related-documents`,
      { method: 'PUT', body: { document_ids: ids } },
    )
    applyWorkspace({
      ...current,
      related_documents: res.data,
    })
    syncPeerCachesAfterWorkspaceRelatedDocumentsChange(
      props.orgSlug,
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
  if (!workspace.value || nameSaving.value) {
    return
  }
  fieldSaveError.value = null
  editingField.value = 'name'
  nameDraft.value = workspace.value.name
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
  if (!workspace.value || nameSaving.value || editingField.value !== 'name') {
    return
  }
  const name = stripManualLineBreaks(nameDraft.value).trim()
  if (name === workspace.value.name) {
    clearNameEditIfActive()
    return
  }
  const validationError = workspaceNameFieldError(name)
  if (validationError) {
    nameDraft.value = workspace.value.name
    clearNameEditIfActive()
    return
  }
  nameSaving.value = true
  fieldSaveError.value = null
  try {
    const updated = await api<OrgWorkspaceItem>(
      `/orgs/${props.orgSlug}/workspaces/${workspace.value.id}`,
      { method: 'PATCH', body: { name } },
    )
    applyWorkspace(updated)
    clearNameEditIfActive()
  } catch (e: unknown) {
    fieldSaveError.value = e instanceof Error ? e.message : 'スペース名の更新に失敗しました'
    nameDraft.value = workspace.value.name
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
  if (!workspace.value || descriptionSaving.value) {
    return
  }
  fieldSaveError.value = null
  editingField.value = 'description'
  descriptionDraft.value = workspace.value.description ?? ''
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
  if (!workspace.value || descriptionSaving.value || editingField.value !== 'description') {
    return
  }
  const description = descriptionDraft.value
  const normalized = description.trim() === '' ? null : description
  if ((normalized ?? '') === (workspace.value.description ?? '')) {
    clearDescriptionEditIfActive()
    return
  }
  descriptionSaving.value = true
  fieldSaveError.value = null
  try {
    const updated = await api<OrgWorkspaceItem>(
      `/orgs/${props.orgSlug}/workspaces/${workspace.value.id}`,
      { method: 'PATCH', body: { description: normalized } },
    )
    applyWorkspace(updated)
    clearDescriptionEditIfActive()
  } catch (e: unknown) {
    fieldSaveError.value = e instanceof Error ? e.message : 'スペース説明の更新に失敗しました'
    descriptionDraft.value = workspace.value.description ?? ''
    clearDescriptionEditIfActive()
  } finally {
    descriptionSaving.value = false
  }
}

async function updateWorkspaceStatus (status: OrgWorkspaceStatus) {
  const current = workspace.value
  if (!current || statusSaving.value) {
    return
  }
  if (current.status?.name === status.name) {
    return
  }
  const previousStatus = current.status ?? null
  statusSaving.value = true
  fieldSaveError.value = null
  applyWorkspace({ ...current, status })
  try {
    const updated = await api<OrgWorkspaceItem>(
      `/orgs/${props.orgSlug}/workspaces/${current.id}`,
      { method: 'PATCH', body: { status: status.name } },
    )
    applyWorkspace(updated)
  } catch (e: unknown) {
    applyWorkspace({ ...current, status: previousStatus })
    fieldSaveError.value = e instanceof Error ? e.message : 'ステータスの更新に失敗しました'
  } finally {
    statusSaving.value = false
  }
}

async function toggleWorkspaceLabel (label: TaskFormLabel) {
  const current = workspace.value
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
          name: label.name,
          color: label.color,
        },
      ]
  labelSaving.value = true
  fieldSaveError.value = null
  applyWorkspace({ ...current, labels: optimisticLabels })
  try {
    const updated = await api<OrgWorkspaceItem>(
      `/orgs/${props.orgSlug}/workspaces/${current.id}`,
      { method: 'PATCH', body: { label_ids: nextLabelIds } },
    )
    applyWorkspace(updated)
  } catch (e: unknown) {
    applyWorkspace({ ...current, labels: previousLabels })
    fieldSaveError.value = e instanceof Error ? e.message : 'ラベルの更新に失敗しました'
  } finally {
    labelSaving.value = false
  }
}

function closeAssigneePicker () {
  assigneePickerOpen.value = false
  assigneePickerPosition.value = null
  assigneeSearchQuery.value = ''
}
useExclusivePopover(assigneePickerOpen, closeAssigneePicker)

function positionAssigneePicker () {
  const trigger = assigneeAddTriggerRef.value
  if (!trigger || !import.meta.client) {
    assigneePickerPosition.value = null
    return
  }
  const rect = trigger.getBoundingClientRect()
  const popover = assigneePickerRef.value?.rootRef ?? null
  const top = Math.max(ASSIGNEE_PICKER_VIEWPORT_PAD, rect.top)
  const maxHeight = Math.max(
    ASSIGNEE_PICKER_MIN_HEIGHT,
    window.innerHeight - ASSIGNEE_PICKER_VIEWPORT_PAD - top - ASSIGNEE_PICKER_VERTICAL_PADDING,
  )
  const scrollbarGutter = popover
    ? resolvePopoverScrollbarGutter(popover, maxHeight)
    : 0
  const dropdownWidth = (popover?.offsetWidth ?? ASSIGNEE_PICKER_WIDTH) + popoverWidthExtraForGutter(scrollbarGutter)
  let left = rect.right + ASSIGNEE_PICKER_GAP
  if (left + dropdownWidth > window.innerWidth - ASSIGNEE_PICKER_VIEWPORT_PAD) {
    left = rect.left - dropdownWidth - ASSIGNEE_PICKER_GAP
  }
  left = Math.max(
    ASSIGNEE_PICKER_VIEWPORT_PAD,
    Math.min(left, window.innerWidth - dropdownWidth - ASSIGNEE_PICKER_VIEWPORT_PAD),
  )
  assigneePickerPosition.value = { top, left, maxHeight, scrollbarGutter }
}

async function openAssigneePicker () {
  if (assigneeSaving.value) {
    return
  }
  await ensureOrgMembersLoaded()
  assigneeSearchQuery.value = ''
  assigneePickerOpen.value = true
  await nextTick()
  positionAssigneePicker()
  requestAnimationFrame(() => positionAssigneePicker())
}

function toggleAssigneePicker () {
  if (assigneePickerOpen.value) {
    closeAssigneePicker()
    return
  }
  void openAssigneePicker()
}

function onAssigneePickerPointerUp (event: PointerEvent) {
  if (!assigneePickerOpen.value || event.button !== 0) {
    return
  }
  const target = event.target
  if (!(target instanceof Node)) {
    closeAssigneePicker()
    return
  }
  if (assigneeAddTriggerRef.value?.contains(target)) {
    return
  }
  if (assigneePickerRef.value?.rootRef?.contains(target)) {
    return
  }
  closeAssigneePicker()
}

function onAssigneePickerWindowResize () {
  if (!assigneePickerOpen.value) {
    return
  }
  positionAssigneePicker()
}

function onAssigneePickerWindowScroll (event: Event) {
  if (!assigneePickerOpen.value) {
    return
  }
  if (isScrollInsideRoot(event, assigneePickerRef.value?.rootRef)) {
    return
  }
  const trigger = assigneeAddTriggerRef.value
  if (!trigger || trigger.getClientRects().length === 0) {
    closeAssigneePicker()
    return
  }
  positionAssigneePicker()
}

watch(assigneePickerOpen, (open) => {
  if (!import.meta.client) {
    return
  }
  if (open) {
    document.addEventListener('pointerup', onAssigneePickerPointerUp, true)
    window.addEventListener('resize', onAssigneePickerWindowResize)
    window.addEventListener('scroll', onAssigneePickerWindowScroll, true)
    return
  }
  document.removeEventListener('pointerup', onAssigneePickerPointerUp, true)
  window.removeEventListener('resize', onAssigneePickerWindowResize)
  window.removeEventListener('scroll', onAssigneePickerWindowScroll, true)
})

useDropdownEscapeClose(assigneePickerOpen, closeAssigneePicker)

async function toggleWorkspaceAssignee (member: TaskFormMember) {
  const current = workspace.value
  if (!current || assigneeSaving.value) {
    return
  }
  const previousAssignees = [...(current.assignees ?? [])]
  const exists = previousAssignees.some(item => item.id === member.id)
  const nextAssignees = sortMembersByDisplayName(
    exists
      ? previousAssignees.filter(item => item.id !== member.id)
      : [...previousAssignees, member],
  )
  const nextIds = nextAssignees.map(item => item.id)
  assigneeSaving.value = true
  fieldSaveError.value = null
  applyWorkspace({ ...current, assignees: nextAssignees })
  patchCachedWorkspaceAssignees(props.orgSlug, current.id, nextAssignees)
  try {
    const updated = await api<OrgWorkspaceItem>(
      `/orgs/${props.orgSlug}/workspaces/${current.id}`,
      { method: 'PATCH', body: { assignee_ids: nextIds } },
    )
    applyWorkspace(updated)
    patchCachedWorkspaceAssignees(props.orgSlug, current.id, updated.assignees ?? nextAssignees)
  } catch (e: unknown) {
    applyWorkspace({ ...current, assignees: previousAssignees })
    patchCachedWorkspaceAssignees(props.orgSlug, current.id, previousAssignees)
    fieldSaveError.value = e instanceof Error ? e.message : '担当者の更新に失敗しました'
  } finally {
    assigneeSaving.value = false
  }
}

useOnUserProfileUpdated((detail) => {
  orgMembers.value = applyUserProfileToMembers(orgMembers.value, detail)
})
</script>
<style lang="scss" scoped src="~/assets/styles/components/workspace/WorkspaceDetailSidebar.scss"></style>
