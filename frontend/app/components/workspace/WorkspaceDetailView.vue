<template>
  <WorkspaceBoard
    v-if="mode === 'board'"
    ref="boardRef"
    v-model:search-query="taskSearchQuery"
    v-model:task-filters="taskFilters"
  />
  <div
    v-else
    class="workspace-project-view workspace-view-page"
    :class="`workspace-view-page--${mode}`"
    :style="pageCssVars"
  >
    <header class="page-header">
      <div class="subheader">
        <div class="subheader-start">
          <NuxtLink
            v-if="orgSlug && workspaceId"
            :to="`/org/${orgSlug}/workspaces`"
            class="subheader-title subheader-back-link"
            aria-label="スペース一覧に戻る"
          >
            スペース一覧
          </NuxtLink>
          <p
            class="subheader-workspace-name"
            :title="workspaceMetaName || undefined"
          >{{ workspaceMetaName }}</p>
          <WorkspaceViewSwitcher
            v-if="orgSlug && workspaceId"
            :org-slug="orgSlug"
            :workspace-id="workspaceId"
          />
        </div>
        <div
          v-if="mode === 'wbs'"
          class="subheader-filters"
        >
          <div class="header-search-field">
            <Search
              class="header-search-icon"
              :size="16"
              :stroke-width="2.25"
              aria-hidden="true"
            />
            <input
              v-model.trim="taskSearchQuery"
              class="header-search"
              type="search"
              placeholder="タスクを検索..."
              aria-label="タスク検索"
              :disabled="!wbsBoardRef || wbsEditSaving"
            />
          </div>
          <p
            class="subheader-count"
            aria-live="polite"
          >
            <span class="subheader-count__num">{{ wbsVisibleTaskCount }}</span>
            <span class="subheader-count__unit">件</span>
          </p>
        </div>
        <div
          v-if="mode === 'wbs'"
          class="subheader-actions"
        >
          <template v-if="!wbsEditMode">
            <div class="subheader-edit-with-divider">
              <button
                type="button"
                class="subheader-secondary-btn subheader-secondary-btn--edit"
                title="WBS編集（E）"
                :disabled="!wbsBoardRef || wbsEditSaving"
                @click="onStartWbsEditClick"
              >
                <Pencil
                  :size="18"
                  :stroke-width="2.25"
                  aria-hidden="true"
                />
                WBS編集
              </button>
              <span
                class="subheader-actions__divider"
                aria-hidden="true"
              />
            </div>
          </template>
          <template v-else>
            <div class="subheader-edit-with-divider">
              <button
                type="button"
                class="subheader-secondary-btn subheader-secondary-btn--cancel"
                :disabled="wbsEditSaving"
                @click="onCancelWbsEditClick"
              >
                キャンセル
              </button>
              <button
                type="button"
                class="subheader-secondary-btn subheader-secondary-btn--save"
                :disabled="wbsEditSaving"
                @click="onConfirmWbsEditClick"
              >
                <Save
                  :size="18"
                  :stroke-width="2.25"
                  aria-hidden="true"
                />
                保存
              </button>
              <span
                class="subheader-actions__divider"
                aria-hidden="true"
              />
            </div>
          </template>
          <button
            type="button"
            class="subheader-secondary-btn subheader-secondary-btn--add"
            title="タスク追加（N）"
            :disabled="!wbsBoardRef || wbsEditSaving"
            @click="onTaskAddClick"
          >
            <FilePlus
              :size="18"
              :stroke-width="2.25"
              aria-hidden="true"
            />
            タスク追加
          </button>
          <div class="subheader-actions__menus">
            <button
              type="button"
              class="subheader-menu-btn"
              :aria-expanded="sidebarOpen"
              :aria-label="sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'"
              title="サイドバー（S）"
              :disabled="wbsEditSaving"
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
            <button
              ref="wbsFilterTriggerRef"
              type="button"
              class="subheader-menu-btn"
              :class="{ 'subheader-menu-btn--filter-active': wbsFilterActive }"
              data-popover-trigger
              :aria-expanded="wbsFilterOpen"
              aria-haspopup="dialog"
              :aria-label="wbsFilterActive ? '絞り込み（適用中）' : '絞り込み'"
              title="フィルター（F）"
              :disabled="wbsEditSaving || !wbsBoardRef"
              @click.stop="onToggleWbsFilter"
            >
              <ListFilter :size="18" :stroke-width="2.25" aria-hidden="true" />
            </button>
            <button
              ref="subheaderMenuTriggerRef"
              type="button"
              class="subheader-menu-btn"
              data-popover-trigger
              :aria-expanded="subheaderMenuOpen"
              aria-haspopup="menu"
              aria-label="その他"
              title="その他（M）"
              :disabled="wbsEditSaving"
              @click.stop="toggleSubheaderMenu"
            >
              <Ellipsis
                :size="18"
                :stroke-width="2.25"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>
    </header>
    <Teleport to="body">
      <FloatingMenu
        :open="Boolean(subheaderMenuOpen && subheaderMenuPosition)"
        density="compact"
        :flush="false"
        :style="subheaderMenuStyle"
        :disabled="workspaceDetailsPending || workspaceArchivePending"
        :items="subheaderMenuItems"
        @select="onSubheaderMenuSelect"
        @close="closeSubheaderMenu"
      />
      <WorkspaceFormModal
        v-if="orgSlug"
        ref="workspaceDetailsModalRef"
        v-model="workspaceDetailsModalOpen"
        mode="details"
        title="スペース詳細"
        :initial-values="workspaceDetailsInitialValues"
        :org-slug="orgSlug"
        :labels="workspaceDetailsLabels"
        :label-categories="workspaceDetailsLabelCategories"
        :org-members="workspaceDetailsOrgMembers"
        :statuses="workspaceDetailsStatuses"
        :loading="workspaceDetailsPending"
        @submit="onWorkspaceDetailsSubmit"
      />
      <ArchivedTasksModal
        v-if="orgSlug && workspaceId"
        v-model="archivedModalOpen"
        :org-slug="orgSlug"
        :workspace-id="workspaceId"
        :can-manage-archive="isOrgAdmin"
        @restored="onArchivedTaskRestored"
      />
      <ArchivedNamedItemsModal
        v-if="orgSlug && workspaceId"
        v-model="archivedDocumentsOpen"
        :org-slug="orgSlug"
        resource="documents"
        item-kind="資料"
        :workspace-id="workspaceId"
        :can-manage-archive="isOrgAdmin"
        @restored="onArchivedDocumentRestored"
      />
      <ConfirmModal
        v-model="workspaceArchiveConfirmOpen"
        title="スペースのアーカイブ確認"
        :message="workspaceArchiveConfirmMessage"
        confirm-text="アーカイブ"
        variant="danger"
        :loading="workspaceArchivePending"
        @confirm="confirmWorkspaceArchive"
      />
    </Teleport>
    <div
      v-if="mode === 'wbs'"
      class="workspace-show-body"
    >
      <div
        class="workspace-sidebar-slot"
        :class="{ 'workspace-sidebar-slot--closed': !sidebarOpen }"
        :aria-hidden="!sidebarOpen"
        :inert="!sidebarOpen"
      >
        <WorkspaceDetailSidebar
          v-if="orgSlug && workspaceId"
          ref="workspaceSidebarRef"
          :org-slug="orgSlug"
          :workspace-id="workspaceId"
        />
      </div>
      <section class="workspace-view-page__body">
        <WorkspaceWbsView
          v-if="orgSlug && workspaceId"
          ref="wbsBoardRef"
          v-model:edit-mode="wbsEditMode"
          v-model:search-query="taskSearchQuery"
          v-model:task-filters="taskFilters"
          :org-slug="orgSlug"
          :workspace-id="workspaceId"
          @edit-saving-change="wbsEditSaving = $event"
          @visible-task-count-change="wbsVisibleTaskCount = $event"
        />
      </section>
    </div>
  </div>
</template>
<script setup lang="ts">
import { Ellipsis, FilePlus, ListFilter, PanelRightClose, PanelRightOpen, Pencil, Save, Search } from 'lucide-vue-next'
import type { WorkspaceViewKey } from '../../composables/workspace/useWorkspaceViewRoutes'
import { useWorkspaceViewPageCssVars } from '../../composables/workspace/useWorkspaceViewPageRoot'
import { useWorkspaceDetailMeta, restoreDocumentToWorkspaceDetailCache } from '../../composables/workspace/useWorkspaceDetailMeta'
import { useOrgWorkspaceIndexPageData, useOrgWorkspaceIndexCacheRevision } from '../../composables/workspace/useOrgWorkspaceIndexPageData'
import { useWorkspaceMutations } from '../../composables/workspace/useWorkspaceMutations'
import { useWorkspaceBoardPageData } from '../../composables/workspace/useWorkspaceBoardPageData'
import { withAppLoadingCursor } from '../../composables/ui/useAppLoadingCursor'
import { useOrgRole } from '../../composables/org/useOrgRole'
import { resolveStandardColors } from '../../utils/shared/colorPresetResolution'
import { DEFAULT_WORKSPACE_STATUS_ITEMS } from '../../components/settings/types'
import { useUiSidebarPreference } from '../../composables/ui/useUiSidebarPreference'
import { buildDestructiveConfirmMessage } from '../../utils/shared/destructiveConfirmMessage'
import WorkspaceBoard from './WorkspaceBoard.vue'
import WorkspaceDetailSidebar from './WorkspaceDetailSidebar.vue'
import WorkspaceWbsView from './WorkspaceWbsView.vue'
import WorkspaceViewSwitcher from './WorkspaceViewSwitcher.vue'
import FloatingMenu, { type FloatingMenuItem } from '../ui/FloatingMenu.vue'
import { POPOVER_VIEWPORT_INSET, clampPopoverBox, resolveMeasuredFloatingMenuHeight } from '../../utils/ui/popoverScrollbar'
import { getTopmostModalOverlay, isKeyboardShortcutBlockedTarget } from '../../utils/ui/uiInteraction'
import WorkspaceFormModal from '../modals/workspace/WorkspaceFormModal.vue'
import ArchivedTasksModal from '../modals/archived/ArchivedTasksModal.vue'
import type { ArchivedTask } from '../../composables/archived/useArchivedTasksCache'
import ArchivedNamedItemsModal, { type ArchivedNamedItem } from '../modals/archived/ArchivedNamedItemsModal.vue'
import ConfirmModal from '../modals/shared/ConfirmModal.vue'
import {
  createEmptyWorkspaceTaskFilters,
  type WorkspaceTaskFilters,
} from '../../utils/task/workspaceTaskFilters'

const props = defineProps<{
  mode: WorkspaceViewKey
  orgSlug?: string
  workspaceId?: string
}>()

const taskSearchQuery = defineModel<string>('taskSearchQuery', { default: '' })
const taskFilters = defineModel<WorkspaceTaskFilters>('taskFilters', {
  default: () => createEmptyWorkspaceTaskFilters(),
})

const boardRef = ref<InstanceType<typeof WorkspaceBoard> | null>(null)
const wbsBoardRef = ref<InstanceType<typeof WorkspaceWbsView> | null>(null)
const workspaceSidebarRef = ref<InstanceType<typeof WorkspaceDetailSidebar> | null>(null)
const pageCssVars = useWorkspaceViewPageCssVars()
const metaSlug = computed(() => props.orgSlug ?? '')
const metaWorkspaceId = computed(() => props.workspaceId ?? '')
const { workspace: workspaceMeta, ensureLoaded } = useWorkspaceDetailMeta(metaSlug, metaWorkspaceId)
const workspaceMetaName = computed(() => workspaceMeta.value?.name ?? '')
const wbsEditMode = ref(false)
const wbsEditSaving = ref(false)
const wbsVisibleTaskCount = ref(0)
const { sidebarOpen, toggleSidebar, hydrateSidebarPreference } = useUiSidebarPreference('workspace')
const subheaderMenuOpen = ref(false)
const subheaderMenuTriggerRef = ref<HTMLElement | null>(null)
const wbsFilterTriggerRef = ref<HTMLElement | null>(null)
const subheaderMenuPosition = ref<{ top: number; left: number } | null>(null)
const wbsFilterActive = computed(() => Boolean(wbsBoardRef.value?.hasActiveFilters))
const wbsFilterOpen = computed(() => Boolean(wbsBoardRef.value?.filterOpen))
const SUBHEADER_MENU_MIN_WIDTH = 220
const workspaceDetailsModalOpen = ref(false)
const workspaceDetailsModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const workspaceDetailsPending = ref(false)
const archivedModalOpen = ref(false)
const archivedDocumentsOpen = ref(false)
const workspaceArchiveConfirmOpen = ref(false)
const workspaceArchivePending = ref(false)
const { isOrgAdmin } = useOrgRole(metaSlug)
const workspaceArchiveConfirmMessage = computed(() =>
  buildDestructiveConfirmMessage('スペース', 'アーカイブ', workspaceMetaName.value),
)
const subheaderMenuItems = computed<FloatingMenuItem[]>(() => {
  const items: FloatingMenuItem[] = [
    { key: 'details-workspace', label: 'スペース詳細' },
    {
      key: 'display-items',
      label: '表示項目の設定',
      disabled: !wbsBoardRef.value || wbsEditSaving.value,
    },
    { key: 'archived', label: 'アーカイブ済みタスク' },
    { key: 'archived-documents', label: 'アーカイブ済み資料' },
  ]
  if (isOrgAdmin.value) {
    items.push({ key: 'archive-workspace', label: 'スペースのアーカイブ', danger: true })
  }
  return items
})
const orgWorkspaceIndexRevision = useOrgWorkspaceIndexCacheRevision()
const { getCached: getOrgWorkspaceIndexCached, fetchSnapshot: fetchOrgWorkspaceIndexSnapshot } = useOrgWorkspaceIndexPageData()
const workspaceMutations = useWorkspaceMutations(metaSlug)
const workspaceIndexSnapshot = computed(() => {
  if (!metaSlug.value) {
    return null
  }
  void orgWorkspaceIndexRevision.value
  return getOrgWorkspaceIndexCached(metaSlug.value)
})
const workspaceDetailsLabels = computed(() => workspaceIndexSnapshot.value?.orgLabels ?? [])
const workspaceDetailsLabelCategories = computed(() => workspaceIndexSnapshot.value?.orgLabelCategories ?? [])
const workspaceDetailsOrgMembers = computed(() => workspaceIndexSnapshot.value?.orgMembers ?? [])
const workspaceDetailsStatuses = computed(() => (
  workspaceIndexSnapshot.value?.workspaceStatuses
  ?? resolveStandardColors(DEFAULT_WORKSPACE_STATUS_ITEMS)
))
const workspaceDetailsInitialValues = computed(() => {
  const target = workspaceMeta.value
  if (!target) {
    return null
  }
  const status = target.status
    ? {
        name: target.status.name,
        color: target.status.color ?? '',
      }
    : null
  return {
    name: target.name,
    description: target.description ?? null,
    labels: target.labels ?? [],
    assignees: target.assignees ?? [],
    status,
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
    zIndex: 1000,
  }
})

watch(
  () => [metaSlug.value, metaWorkspaceId.value] as const,
  ([slug, id]) => {
    if (slug && id) {
      void ensureLoaded()
    }
  },
  { immediate: true },
)
watch(
  () => props.mode,
  () => {
    wbsEditMode.value = false
    wbsEditSaving.value = false
    wbsBoardRef.value?.closeFilter?.()
  },
)

/** 子の startEdit がセッション開始まで完了してからヘッダーを切り替える */
function onStartWbsEditClick () {
  if (wbsEditSaving.value || !wbsBoardRef.value) {
    return
  }
  wbsEditMode.value = wbsBoardRef.value.startEdit()
}

function onCancelWbsEditClick () {
  if (wbsEditSaving.value || !wbsBoardRef.value) {
    return
  }
  // cancelEdit 内で v-model の editMode を下ろす（先に false にするとスナップショットが消える）
  void wbsBoardRef.value.cancelEdit?.()
}

function onConfirmWbsEditClick () {
  if (wbsEditSaving.value) {
    return
  }
  void wbsBoardRef.value?.confirmEdit?.()
}

function onTaskAddClick () {
  if (wbsEditSaving.value) {
    return
  }
  wbsBoardRef.value?.closeFilter?.()
  wbsBoardRef.value?.openTaskAdd?.()
}

function onDisplayItemsClick () {
  if (wbsEditSaving.value) {
    return
  }
  wbsBoardRef.value?.closeFilter?.()
  wbsBoardRef.value?.openDisplayItems?.()
}

function closeSubheaderMenu () {
  subheaderMenuOpen.value = false
  subheaderMenuPosition.value = null
}

function positionSubheaderMenu () {
  const anchor = subheaderMenuTriggerRef.value
  if (!anchor || !import.meta.client) {
    subheaderMenuPosition.value = null
    return
  }
  const rect = anchor.getBoundingClientRect()
  const pad = POPOVER_VIEWPORT_INSET
  const gap = 6
  const menuWidth = SUBHEADER_MENU_MIN_WIDTH
  const menuHeight = resolveMeasuredFloatingMenuHeight(subheaderMenuItems.value.length)
  let left = rect.right - menuWidth
  left = Math.max(pad, Math.min(left, window.innerWidth - menuWidth - pad))
  subheaderMenuPosition.value = clampPopoverBox(rect.bottom + gap, left, menuWidth, menuHeight, pad)
}

function onToggleWbsFilter () {
  if (wbsEditSaving.value || !wbsBoardRef.value) {
    return
  }
  wbsBoardRef.value.toggleFilter?.(wbsFilterTriggerRef.value)
}
/** ヘッダーに絞り込みボタンがある WBS 表示中だけ F を有効化 */
function isWbsFilterTriggerAvailable (): boolean {
  if (props.mode !== 'wbs') {
    return false
  }
  const el = wbsFilterTriggerRef.value
  if (!el || !el.isConnected || !import.meta.client) {
    return false
  }
  if ((el instanceof HTMLButtonElement && el.disabled) || wbsEditSaving.value || !wbsBoardRef.value) {
    return false
  }
  const style = getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false
  }
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}
function dismissWbsPopovers () {
  closeSubheaderMenu()
  wbsBoardRef.value?.closeFilter?.()
}
function canUseWbsKeyboardShortcut (options?: {
  allowEditMode?: boolean
}): boolean {
  if (props.mode !== 'wbs') {
    return false
  }
  if (getTopmostModalOverlay()) {
    return false
  }
  if (
    workspaceDetailsModalOpen.value
    || archivedModalOpen.value
    || archivedDocumentsOpen.value
    || workspaceArchiveConfirmOpen.value
    || workspaceSidebarRef.value?.documentAddModalOpen
    || wbsEditSaving.value
    || (!options?.allowEditMode && wbsEditMode.value)
  ) {
    return false
  }
  return true
}
/** スペース詳細の WBS 向け文字ショートカット。入力欄・モーダル中は無効 */
function onProjectViewKeydown (event: KeyboardEvent) {
  const key = event.key
  const isLetterShortcut = (
    key === 'f' || key === 'F'
    || key === 'm' || key === 'M'
    || key === 's' || key === 'S'
    || key === 'e' || key === 'E'
    || key === 'd' || key === 'D'
    || key === 'n' || key === 'N'
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
    if (subheaderMenuOpen.value) {
      event.preventDefault()
      closeSubheaderMenu()
      return
    }
    if (!canUseWbsKeyboardShortcut({ allowEditMode: true })) {
      return
    }
    event.preventDefault()
    toggleSubheaderMenu()
    return
  }
  if (key === 's' || key === 'S') {
    if (props.mode !== 'wbs' || wbsEditSaving.value || getTopmostModalOverlay()) {
      return
    }
    event.preventDefault()
    toggleSidebar()
    return
  }
  if (key === 'e' || key === 'E') {
    if (wbsEditMode.value) {
      return
    }
    if (!canUseWbsKeyboardShortcut()) {
      return
    }
    event.preventDefault()
    dismissWbsPopovers()
    onStartWbsEditClick()
    return
  }
  if (key === 'd' || key === 'D') {
    if (!canUseWbsKeyboardShortcut({ allowEditMode: true })) {
      return
    }
    const openAdd = workspaceSidebarRef.value?.openDocumentAddModal
    if (!openAdd) {
      return
    }
    event.preventDefault()
    dismissWbsPopovers()
    void openAdd()
    return
  }
  if (key === 'n' || key === 'N') {
    if (!canUseWbsKeyboardShortcut({ allowEditMode: true })) {
      return
    }
    event.preventDefault()
    dismissWbsPopovers()
    onTaskAddClick()
    return
  }
  if (key === 'f' || key === 'F') {
    if (!isWbsFilterTriggerAvailable()) {
      return
    }
    if (!canUseWbsKeyboardShortcut({ allowEditMode: true })) {
      return
    }
    event.preventDefault()
    onToggleWbsFilter()
    return
  }
}
function toggleSubheaderMenu () {
  if (subheaderMenuOpen.value) {
    closeSubheaderMenu()
    return
  }
  subheaderMenuOpen.value = true
  nextTick(() => {
    positionSubheaderMenu()
    requestAnimationFrame(() => positionSubheaderMenu())
  })
}

function onSubheaderMenuSelect (item: FloatingMenuItem) {
  if (item.key === 'display-items') {
    closeSubheaderMenu()
    onDisplayItemsClick()
    return
  }
  if (item.key === 'details-workspace') {
    void openWorkspaceDetailsModal()
    return
  }
  if (item.key === 'archived') {
    openArchivedModal()
    return
  }
  if (item.key === 'archived-documents') {
    openArchivedDocumentsModal()
    return
  }
  if (item.key === 'archive-workspace') {
    openWorkspaceArchiveConfirm()
  }
}

function openArchivedModal () {
  closeSubheaderMenu()
  wbsBoardRef.value?.closeFilter?.()
  archivedModalOpen.value = true
}

function openArchivedDocumentsModal () {
  closeSubheaderMenu()
  wbsBoardRef.value?.closeFilter?.()
  archivedDocumentsOpen.value = true
}

function openWorkspaceArchiveConfirm () {
  closeSubheaderMenu()
  wbsBoardRef.value?.closeFilter?.()
  workspaceArchiveConfirmOpen.value = true
}

/** ボードキャッシュを捨て、WBS に行を足してから最新化する */
function onArchivedTaskRestored (task: ArchivedTask, children: ArchivedTask[] = []) {
  const { invalidateCached: invalidateBoard } = useWorkspaceBoardPageData()
  invalidateBoard(props.orgSlug, String(props.workspaceId))
  wbsBoardRef.value?.applyRestoredTasks(task, children)
  void wbsBoardRef.value?.refreshOnViewSwitch()
}

/** サイドバーの資料一覧キャッシュへ戻す */
function onArchivedDocumentRestored (item: ArchivedNamedItem) {
  if (!props.orgSlug || !props.workspaceId) {
    return
  }
  restoreDocumentToWorkspaceDetailCache(props.orgSlug, props.workspaceId, {
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    category: item.category ?? null,
    workspace_id: item.workspace_id,
    workspace_name: item.workspace_name ?? null,
    body: item.body ?? null,
    archived_at: item.archived_at ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  })
}

/** 成功するとスペース一覧へ戻し、失敗時は確認を開いたままにする */
async function confirmWorkspaceArchive () {
  if (!props.orgSlug || !props.workspaceId || workspaceArchivePending.value) {
    return
  }
  workspaceArchivePending.value = true
  try {
    await withAppLoadingCursor(async () => {
      await workspaceMutations.archiveWorkspace(Number(props.workspaceId))
      workspaceArchiveConfirmOpen.value = false
      await navigateTo(`/org/${props.orgSlug}/workspaces`)
    })
  } catch {
  } finally {
    workspaceArchivePending.value = false
  }
}

async function openWorkspaceDetailsModal () {
  closeSubheaderMenu()
  wbsBoardRef.value?.closeFilter?.()
  if (metaSlug.value && !getOrgWorkspaceIndexCached(metaSlug.value)) {
    await fetchOrgWorkspaceIndexSnapshot(metaSlug.value).catch(() => null)
  }
  workspaceDetailsModalOpen.value = true
}

async function onWorkspaceDetailsSubmit (payload: {
  name: string
  description: string | null
  status: string | null
  label_ids: number[]
  assignee_ids: number[]
}) {
  const target = workspaceMeta.value
  if (!target || workspaceDetailsPending.value) {
    return
  }
  workspaceDetailsPending.value = true
  try {
    await withAppLoadingCursor(async () => {
      await workspaceMutations.updateWorkspace(target.id, {
        name: payload.name,
        description: payload.description,
        status: payload.status,
        label_ids: payload.label_ids,
        assignee_ids: payload.assignee_ids,
      })
      workspaceDetailsModalOpen.value = false
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '更新に失敗しました'
    workspaceDetailsModalRef.value?.setSubmitError(message)
  } finally {
    workspaceDetailsPending.value = false
  }
}

function refreshOnViewSwitch (): Promise<void> {
  if (props.mode === 'board') {
    return boardRef.value?.refreshOnViewSwitch() ?? Promise.resolve()
  }
  return wbsBoardRef.value?.refreshOnViewSwitch() ?? Promise.resolve()
}

defineExpose({
  refreshOnViewSwitch,
})

onBeforeMount(() => {
  void hydrateSidebarPreference()
})

onMounted(() => {
  if (import.meta.client) {
    document.addEventListener('keydown', onProjectViewKeydown)
  }
})

onActivated(() => {
  void hydrateSidebarPreference()
  if (import.meta.client) {
    document.addEventListener('keydown', onProjectViewKeydown)
  }
})

onDeactivated(() => {
  if (import.meta.client) {
    document.removeEventListener('keydown', onProjectViewKeydown)
  }
  closeSubheaderMenu()
  wbsBoardRef.value?.closeFilter?.()
})

onBeforeUnmount(() => {
  if (import.meta.client) {
    document.removeEventListener('keydown', onProjectViewKeydown)
  }
})
</script>
<style lang="scss" scoped src="~/assets/styles/components/workspace/WorkspaceDetailView.scss"></style>
