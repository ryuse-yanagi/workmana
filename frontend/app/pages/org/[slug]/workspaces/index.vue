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
                <FolderOpen :size="20" :stroke-width="2.25" class="subheader-title__icon" aria-hidden="true" />
                Workspaces
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
                <p class="subheader-count" aria-live="polite">{{ pageReady ? `${visibleWorkspaces.length} 件` : '' }}</p>
                <input
                  v-model.trim="searchQuery"
                  class="header-search"
                  type="search"
                  :placeholder="'スペース名を検索...'"
                  aria-label="検索"
                  :disabled="!pageReady"
                />
              </div>
              <button
                class="primary-btn"
                type="button"
                :disabled="pending || !pageReady"
                @click="openWorkspaceCreateModal"
              >
                <FolderPlus :size="20" :stroke-width="2.25" aria-hidden="true" />
                スペース作成
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
          <!-- エラー表示 -->
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
              <table class="workspace-table">
                <thead>
                  <tr>
                    <th>スペース名</th>
                    <th>説明</th>
                    <th>担当者</th>
                    <th>ステータス</th>
                    <th aria-hidden="true"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!visibleWorkspaces.length">
                    <td colspan="5" class="empty">該当するスペースがありません。</td>
                  </tr>
                  <tr
                    v-for="workspace in visibleWorkspaces"
                    :key="workspace.id"
                    :class="[
                      'clickable-row',
                      {
                        'workspace-row--fade-in': isWorkspaceJustCreated(workspace.id),
                        'workspace-row--loading': loadingWorkspaceId === workspace.id,
                      },
                    ]"
                    role="button"
                    tabindex="0"
                    :aria-busy="loadingWorkspaceId === workspace.id"
                    @pointerenter="warmWorkspaceBoard(workspace.id)"
                    @focusin="warmWorkspaceBoard(workspace.id)"
                    @pointerdown="onWorkspacePointerDown($event, workspace.id)"
                    @pointermove="onWorkspacePointerMove($event, workspace.id)"
                    @pointerup="onWorkspacePointerUp($event, workspace.id)"
                    @pointercancel="onWorkspacePointerCancel"
                    @contextmenu.prevent="onWorkspaceContextMenu(workspace.id, $event)"
                    @keydown.enter.prevent="goToWorkspace(workspace.id)"
                    @keydown.space.prevent="goToWorkspace(workspace.id)"
                  >
                    <td colspan="5" class="workspace-card-cell">
                      <div class="workspace-card">
                        <div
                          v-if="workspace.labels?.length"
                          class="workspace-card__labels"
                        >
                          <OverflowFlexRow :watch-key="workspace.labels.length">
                            <LabelStrip
                              v-for="label in workspace.labels"
                              :key="label.id"
                              :label="label"
                              size="md"
                            />
                          </OverflowFlexRow>
                        </div>
                        <div class="workspace-card__body">
                          <div class="workspace-card__name">
                            <p class="name-text">{{ workspace.name }}</p>
                          </div>
                          <div class="workspace-card__description">
                            <p v-if="workspace.description" class="description-text">
                              {{ workspace.description }}
                            </p>
                          </div>
                          <div class="workspace-card__assignees">
                            <WorkspaceAssigneeSelect
                              :assignees="workspace.assignees ?? []"
                              :org-members="orgMembers"
                              :pending="updatingAssigneesWorkspaceId === workspace.id"
                              @change="assigneeIds => updateWorkspaceAssignees(workspace, assigneeIds)"
                            />
                          </div>
                          <div class="workspace-card__status">
                            <WorkspaceStatusSelect
                              :status="workspace.status"
                              :statuses="workspaceStatuses"
                              :pending="updatingStatusWorkspaceId === workspace.id"
                              @select="status => updateWorkspaceStatus(workspace, status)"
                            />
                          </div>
                          <div class="workspace-card__actions">
                            <button
                              type="button"
                              class="workspace-card__menu-btn"
                              aria-label="スペースのメニュー"
                              :aria-expanded="openMenuWorkspaceId === workspace.id"
                              @pointerdown.stop
                              @pointerup.stop
                              @click.stop="toggleWorkspaceMenu(workspace.id, $event)"
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
            <h3 class="board-filter-section-title">担当者</h3>
            <ul class="board-filter-options">
              <li>
                <label class="board-filter-option">
                  <input
                    type="checkbox"
                    :checked="isAssigneeFilterSelected('unset')"
                    @change="setAssigneeFilter('unset', $event)"
                  >
                  <span>未設定</span>
                </label>
              </li>
              <li v-for="member in orgMembers" :key="member.id">
                <label class="board-filter-option">
                  <input
                    type="checkbox"
                    :checked="isAssigneeFilterSelected(String(member.id))"
                    @change="setAssigneeFilter(String(member.id), $event)"
                  >
                  <MemberAvatar
                    :member="member"
                    size="xs"
                    class="board-filter-option-avatar"
                  />
                  <span>{{ memberDisplayName(member) }}</span>
                </label>
              </li>
            </ul>
          </section>
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
            <h3 class="board-filter-section-title">ステータス</h3>
            <ul class="board-filter-options">
              <li>
                <label class="board-filter-option">
                  <input
                    type="checkbox"
                    :checked="isStatusFilterSelected('unset')"
                    @change="toggleStatusFilter('unset')"
                  >
                  <span>未設定</span>
                </label>
              </li>
            </ul>
            <div class="board-filter-label-group">
              <ul class="board-filter-options">
                <li v-for="status in workspaceStatuses" :key="status.name">
                  <label class="board-filter-option">
                    <input
                      type="checkbox"
                      :checked="isStatusFilterSelected(status.name)"
                      @change="toggleStatusFilter(status.name)"
                    >
                    <span
                      class="board-filter-label-bar"
                      :style="{
                        backgroundColor: status.color,
                        color: labelBarTextColor(status.color),
                      }"
                    >{{ status.name }}</span>
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
        :open="Boolean(openMenuWorkspace && workspaceMenuPosition)"
        :style="workspaceMenuStyle"
        :disabled="pending"
        :items="workspaceMenuItems"
        @select="onWorkspaceMenuSelect"
        @close="closeWorkspaceMenu"
      />
      <!-- 作成・編集モーダル（オーバーレイのためフェード対象外） -->
      <WorkspaceCreateModal
        ref="workspaceFormModalRef"
        v-model="workspaceFormModalOpen"
        :mode="workspaceFormMode"
        :title="workspaceFormMode === 'edit' ? 'スペースの編集' : 'スペースの作成'"
        :initial-values="workspaceFormInitialValues"
        :org-slug="slug"
        :labels="orgLabels"
        :label-categories="orgLabelCategories"
        :org-members="orgMembers"
        :statuses="workspaceStatuses"
        :loading="pending"
        @submit="onWorkspaceFormSubmit"
      />
      <ConfirmModal
        v-model="workspaceArchiveConfirmOpen"
        title="スペースのアーカイブ確認"
        :message="workspaceArchiveTarget
          ? buildDestructiveConfirmMessage('スペース', 'アーカイブ', workspaceArchiveTarget.name)
          : ''"
        confirm-text="アーカイブ"
        variant="danger"
        :loading="archivePending"
        @confirm="confirmWorkspaceArchive"
      />
      <ArchivedNamedItemsModal
        v-model="archivedWorkspacesOpen"
        :org-slug="slug"
        resource="workspaces"
        item-kind="スペース"
        :can-manage-archive="isOrgAdmin"
        @restored="onWorkspaceRestored"
        @deleted="onWorkspacePermanentlyDeleted"
      />
    </template>
  </main>
</template>
<script setup lang="ts">
import { Ellipsis, FolderOpen, FolderPlus, ListFilter } from 'lucide-vue-next'
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from '../../../../composables/raceWithTimeout'
import { withAppLoadingCursor } from '../../../../composables/useAppLoadingCursor'
import { useApi } from '../../../../composables/useApi'
import {
  useOrgWorkspaceIndexPageData,
  type OrgWorkspaceIndexPageSnapshot,
  type OrgWorkspaceStatus,
} from '../../../../composables/useOrgWorkspaceIndexPageData'
import type { TaskFormMember } from '../../../../composables/useTaskFormHelpers'
import type { LabelCategoryGroup } from '../../../../composables/useLabelCategories'
import { useWorkspaceBoardPageData } from '../../../../composables/useWorkspaceBoardPageData'
import { prefetchWorkspaceDetail, warmWorkspaceDetailCache, invalidateWorkspaceDetailMeta } from '../../../../composables/useWorkspaceDetailMeta'
import { DEFAULT_WORKSPACE_STATUS_ITEMS } from '../../../../components/settings/types'
import { resolveStandardColors } from '../../../../utils/colorPresetResolution'
import { buildDestructiveConfirmMessage } from '../../../../utils/destructiveConfirmMessage'
import {
  getTopmostModalOverlay,
  isKeyboardShortcutBlockedTarget,
} from '../../../../utils/uiInteraction'
import WorkspaceCreateModal from '../../../../components/modals/WorkspaceCreateModal.vue'
import ArchivedNamedItemsModal from '../../../../components/modals/ArchivedNamedItemsModal.vue'
import ConfirmModal from '../../../../components/modals/ConfirmModal.vue'
import WorkspaceAssigneeSelect from '../../../../components/workspace/WorkspaceAssigneeSelect.vue'
import WorkspaceStatusSelect from '../../../../components/workspace/WorkspaceStatusSelect.vue'
import FloatingMenu, { type FloatingMenuItem } from '../../../../components/ui/FloatingMenu.vue'
import { useDropdownEscapeClose } from '../../../../composables/useDropdownEscapeClose'
import { useExclusivePopover } from '../../../../composables/useExclusivePopover'
import { popoverScrollbarGutterStyle, popoverWidthExtraForGutter, resolvePopoverScrollbarGutter } from '../../../../utils/popoverScrollbar'
import { memberDisplayName } from '../../../../composables/useMemberDisplay'
import { useOrgRole } from '../../../../composables/useOrgRole'
import { labelBarTextColor } from '../../../../composables/useTaskFormHelpers'
definePageMeta({
  name: 'org-slug-workspaces',
  key: route => route.fullPath,
  keepalive: true,
})
type Label = { id: number; name: string; color: string }
type WorkspaceStatus = OrgWorkspaceStatus
type Workspace = {
  id: number
  name: string
  description?: string | null
  status?: WorkspaceStatus | null
  labels?: Label[]
  assignees?: TaskFormMember[]
  created_at?: string
  updated_at?: string
}
const route = useRoute()
const slug = computed(() => route.params.slug as string)
const { isOrgAdmin } = useOrgRole(slug)
const { api } = useApi()
const {
  fetchSnapshot: fetchOrgWorkspaceIndexSnapshot,
  getCached: getOrgWorkspaceIndexCached,
  invalidateCached: invalidateOrgWorkspaceIndexCached,
  patchCachedWorkspaceStatus,
  patchCachedWorkspaceAssignees,
} = useOrgWorkspaceIndexPageData()
const { warmWorkspaceBoardCache, prefetch, invalidateCached: invalidateWorkspaceBoardCached } = useWorkspaceBoardPageData()
const workspaces = ref<Workspace[]>([])
/** 初回取得成功まで一覧を出さない（ヘッダーは先に表示） */
const pageReady = ref(false)
/** 初回のみ：タイムアウト／API 失敗時にブロッキング表示 */
const fatalLoadError = ref<string | null>(null)
const pending = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const debouncedSearchQuery = ref('')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
const sortMode = ref<'created' | 'updated' | 'name'>('created')
const workspaceFormModalOpen = ref(false)
const workspaceFormModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const workspaceFormMode = ref<'create' | 'edit'>('create')
const workspaceEditTarget = ref<Workspace | null>(null)
const workspaceArchiveConfirmOpen = ref(false)
const workspaceArchiveTarget = ref<Workspace | null>(null)
const archivedWorkspacesOpen = ref(false)
const archivePending = ref(false)
const openMenuWorkspaceId = ref<number | null>(null)
const workspaceMenuPosition = ref<{ top: number; left: number } | null>(null)
const WORKSPACE_MENU_MIN_WIDTH = 160
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
const orgLabels = ref<Label[]>([])
const orgLabelCategories = ref<LabelCategoryGroup[]>([])
const orgMembers = ref<TaskFormMember[]>([])
const workspaceStatuses = ref<WorkspaceStatus[]>([])
const assigneeFilterSelected = ref<string[]>([])
const labelFilterSelected = ref(new Set<string>())
const statusFilterSelected = ref(new Set<string>())
const justCreatedWorkspaceIds = reactive<Record<number, true>>({})
const loadingWorkspaceId = ref<number | null>(null)
const updatingStatusWorkspaceId = ref<number | null>(null)
const updatingAssigneesWorkspaceId = ref<number | null>(null)
const CLICK_MOVE_TOLERANCE_PX = 6
const pointerPressState = ref<{
  workspaceId: number
  pointerId: number
  startX: number
  startY: number
  moved: boolean
} | null>(null)
const globalHeaderOffsetPx = ref(46)
const listPageCssVars = computed(() => {
  return {
    '--global-header-offset': `${globalHeaderOffsetPx.value}px`,
    // `app.vue` の `.app-shell__page { padding-top: 4px; }` を打ち消して、
    // 最上部スクロール時に共通ヘッダーと画面別ヘッダーの隙間をなくす
    '--app-shell-page-pad': '3.5px',
  } as Record<string, string>
})
const visibleWorkspaces = computed(() => {
  const query = debouncedSearchQuery.value.trim().toLowerCase()
  const filtered = query
    ? [...workspaces.value]
    : searchQuery.value.trim()
      ? workspaces.value.filter(workspace => workspace.name.toLowerCase().includes(searchQuery.value.trim().toLowerCase()))
      : [...workspaces.value]
  const sorted = filtered.filter(workspace => (
    matchesAssigneeFilter(workspace)
    && matchesLabelFilter(workspace)
    && matchesStatusFilter(workspace)
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
const openMenuWorkspace = computed(() => {
  const id = openMenuWorkspaceId.value
  if (id == null) return null
  return workspaces.value.find(workspace => workspace.id === id) ?? null
})
const workspaceMenuStyle = computed(() => {
  if (!workspaceMenuPosition.value) {
    return undefined
  }
  const { top, left } = workspaceMenuPosition.value
  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${WORKSPACE_MENU_MIN_WIDTH}px`,
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
  orgLabelCategories.value.filter(category => category.labels.length > 0),
)
function matchesAssigneeFilter (workspace: Workspace): boolean {
  const selected = assigneeFilterSelected.value
  if (selected.length === 0) {
    return true
  }
  const assigneeIds = (workspace.assignees ?? []).map(member => member.id)
  const selectedMemberIds = selected.filter(key => key !== 'unset')
  const includesUnset = selected.includes('unset')
  const matchesUnset = includesUnset && assigneeIds.length === 0
  const matchesMember = selectedMemberIds.length > 0
    && assigneeIds.some(id => selectedMemberIds.includes(String(id)))
  return matchesUnset || matchesMember
}
function matchesLabelFilter (workspace: Workspace): boolean {
  if (labelFilterSelected.value.size === 0) {
    return true
  }
  const labels = workspace.labels ?? []
  if (labelFilterSelected.value.has('unset') && labels.length === 0) {
    return true
  }
  return labels.some(label => labelFilterSelected.value.has(String(label.id)))
}
function matchesStatusFilter (workspace: Workspace): boolean {
  if (statusFilterSelected.value.size === 0) {
    return true
  }
  const statusName = workspace.status?.name
  if (statusFilterSelected.value.has('unset') && !statusName) {
    return true
  }
  return Boolean(statusName && statusFilterSelected.value.has(statusName))
}
function isAssigneeFilterSelected (key: string): boolean {
  return assigneeFilterSelected.value.includes(key)
}
function setAssigneeFilter (key: string, event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) {
    return
  }
  const selected = new Set(assigneeFilterSelected.value)
  if (input.checked) {
    selected.add(key)
  } else {
    selected.delete(key)
  }
  assigneeFilterSelected.value = [...selected]
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
function isStatusFilterSelected (key: string): boolean {
  return statusFilterSelected.value.has(key)
}
function toggleStatusFilter (key: string) {
  const next = new Set(statusFilterSelected.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  statusFilterSelected.value = next
}
const workspaceFormInitialValues = computed(() => {
  if (workspaceFormMode.value !== 'edit' || !workspaceEditTarget.value) {
    return null
  }
  const target = workspaceEditTarget.value
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
function isWorkspaceJustCreated (workspaceId: number): boolean {
  return !!justCreatedWorkspaceIds[workspaceId]
}
function markWorkspaceAsJustCreated (workspaceId: number) {
  justCreatedWorkspaceIds[workspaceId] = true
  setTimeout(() => {
    delete justCreatedWorkspaceIds[workspaceId]
  }, 260)
}
function closeWorkspaceMenu () {
  openMenuWorkspaceId.value = null
  workspaceMenuPosition.value = null
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
  closeWorkspaceMenu()
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
  closeWorkspaceMenu()
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
function openArchivedWorkspacesModal () {
  closeSubheaderMenu()
  closeListFilter()
  archivedWorkspacesOpen.value = true
}
function positionWorkspaceMenu (anchor: HTMLElement) {
  if (!import.meta.client) {
    workspaceMenuPosition.value = null
    return
  }
  const rect = anchor.getBoundingClientRect()
  const pad = 8
  const gap = 4
  const menuWidth = WORKSPACE_MENU_MIN_WIDTH
  let left = rect.right + gap
  if (left + menuWidth > window.innerWidth - pad) {
    left = Math.max(pad, rect.left - gap - menuWidth)
  }
  workspaceMenuPosition.value = {
    top: rect.top,
    left,
  }
}
function openWorkspaceMenu (workspaceId: number, anchor: HTMLElement) {
  if (openMenuWorkspaceId.value === workspaceId) {
    closeWorkspaceMenu()
    return
  }
  closeSubheaderMenu()
  closeListFilter()
  positionWorkspaceMenu(anchor)
  openMenuWorkspaceId.value = workspaceId
}
function toggleWorkspaceMenu (workspaceId: number, event: MouseEvent) {
  const el = event.currentTarget
  if (!(el instanceof HTMLElement)) {
    return
  }
  openWorkspaceMenu(workspaceId, el)
}
function onWorkspaceContextMenu (workspaceId: number, event: MouseEvent) {
  pointerPressState.value = null
  const row = event.currentTarget
  if (!(row instanceof HTMLElement)) {
    return
  }
  const trigger = row.querySelector('.workspace-card__menu-btn')
  if (!(trigger instanceof HTMLElement)) {
    return
  }
  openWorkspaceMenu(workspaceId, trigger)
}
function openWorkspaceCreateModal () {
  closeWorkspaceMenu()
  closeSubheaderMenu()
  closeListFilter()
  workspaceFormMode.value = 'create'
  workspaceEditTarget.value = null
  workspaceFormModalOpen.value = true
}
function canUseWorkspaceListKeyboardShortcut (): boolean {
  if (!pageReady.value || fatalLoadError.value) {
    return false
  }
  if (getTopmostModalOverlay()) {
    return false
  }
  if (
    workspaceFormModalOpen.value
    || workspaceArchiveConfirmOpen.value
    || archivedWorkspacesOpen.value
    || openMenuWorkspaceId.value !== null
    || subheaderMenuOpen.value
    || listFilterOpen.value
    || pending.value
    || archivePending.value
  ) {
    return false
  }
  return true
}
function onWorkspaceListKeydown (event: KeyboardEvent) {
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
  if (!canUseWorkspaceListKeyboardShortcut()) {
    return
  }
  if (key === 'f' || key === 'F') {
    event.preventDefault()
    openListFilter()
    return
  }
  event.preventDefault()
  openWorkspaceCreateModal()
}
function openWorkspaceEditModal (workspace: Workspace) {
  closeWorkspaceMenu()
  workspaceFormMode.value = 'edit'
  workspaceEditTarget.value = workspace
  workspaceFormModalOpen.value = true
}
function openWorkspaceArchiveConfirm (workspace: Workspace) {
  closeWorkspaceMenu()
  workspaceArchiveTarget.value = workspace
  workspaceArchiveConfirmOpen.value = true
}
const workspaceMenuItems: FloatingMenuItem[] = [
  { key: 'edit', label: 'スペースの編集' },
  { key: 'archive', label: 'スペースのアーカイブ', danger: true },
]
const subheaderMenuItems: FloatingMenuItem[] = [
  { key: 'archived', label: 'アーカイブ済みスペース' },
]
function onSubheaderMenuSelect (item: FloatingMenuItem) {
  if (item.key === 'archived') {
    openArchivedWorkspacesModal()
  }
}
function onWorkspaceMenuSelect (item: FloatingMenuItem) {
  const workspace = openMenuWorkspace.value
  if (!workspace) return
  if (item.key === 'edit') {
    openWorkspaceEditModal(workspace)
    return
  }
  if (item.key === 'archive') {
    openWorkspaceArchiveConfirm(workspace)
  }
}
function onGlobalClick (ev: Event) {
  const t = ev.target
  if (t instanceof Node) {
    const el = t instanceof Element ? t : t.parentElement
    if (el?.closest('.workspace-card__menu-btn')) {
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
  closeWorkspaceMenu()
  closeSubheaderMenu()
  closeListFilter()
}
function onWindowResize () {
  closeWorkspaceMenu()
  closeSubheaderMenu()
  closeListFilter()
}
function applyOrgWorkspaceIndexSnapshot (snapshot: OrgWorkspaceIndexPageSnapshot) {
  workspaces.value = snapshot.workspaces
  orgLabels.value = snapshot.orgLabels
  orgLabelCategories.value = snapshot.orgLabelCategories ?? []
  orgMembers.value = snapshot.orgMembers ?? []
  workspaceStatuses.value = snapshot.workspaceStatuses ?? resolveStandardColors(DEFAULT_WORKSPACE_STATUS_ITEMS)
}
function applyWorkspaceStatusLocally (workspaceId: number, status: WorkspaceStatus | null) {
  workspaces.value = workspaces.value.map(workspace => (
    workspace.id === workspaceId
      ? { ...workspace, status }
      : workspace
  ))
  patchCachedWorkspaceStatus(slug.value, workspaceId, status)
}
function applyWorkspaceAssigneesLocally (workspaceId: number, assignees: TaskFormMember[]) {
  workspaces.value = workspaces.value.map(workspace => (
    workspace.id === workspaceId
      ? { ...workspace, assignees }
      : workspace
  ))
  patchCachedWorkspaceAssignees(slug.value, workspaceId, assignees)
}
function resolveAssigneesFromIds (assigneeIds: number[]): TaskFormMember[] {
  const memberById = new Map(orgMembers.value.map(member => [member.id, member]))
  return assigneeIds
    .map(id => memberById.get(id))
    .filter((member): member is TaskFormMember => member != null)
}
async function updateWorkspaceAssignees (workspace: Workspace, assigneeIds: number[]) {
  const currentIds = (workspace.assignees ?? []).map(member => member.id)
  if (
    JSON.stringify(currentIds) === JSON.stringify(assigneeIds)
    || updatingAssigneesWorkspaceId.value !== null
  ) {
    return
  }
  const previousAssignees = workspace.assignees ?? []
  const nextAssignees = resolveAssigneesFromIds(assigneeIds)
  updatingAssigneesWorkspaceId.value = workspace.id
  error.value = null
  applyWorkspaceAssigneesLocally(workspace.id, nextAssignees)
  try {
    const updated = await api<Workspace>(`/orgs/${slug.value}/workspaces/${workspace.id}`, {
      method: 'PATCH',
      body: { assignee_ids: assigneeIds },
    })
    applyWorkspaceAssigneesLocally(workspace.id, updated.assignees ?? nextAssignees)
  } catch (e: unknown) {
    applyWorkspaceAssigneesLocally(workspace.id, previousAssignees)
    error.value = e instanceof Error ? e.message : '担当者の更新に失敗しました'
  } finally {
    if (updatingAssigneesWorkspaceId.value === workspace.id) {
      updatingAssigneesWorkspaceId.value = null
    }
  }
}
async function updateWorkspaceStatus (workspace: Workspace, status: WorkspaceStatus) {
  if (workspace.status?.name === status.name || updatingStatusWorkspaceId.value !== null) {
    return
  }
  const previousStatus = workspace.status ?? null
  updatingStatusWorkspaceId.value = workspace.id
  error.value = null
  applyWorkspaceStatusLocally(workspace.id, status)
  try {
    const updated = await api<Workspace>(`/orgs/${slug.value}/workspaces/${workspace.id}`, {
      method: 'PATCH',
      body: { status: status.name },
    })
    const nextStatus = updated.status
      ? resolveStandardColors([updated.status])[0] ?? updated.status
      : status
    applyWorkspaceStatusLocally(workspace.id, nextStatus)
  } catch (e: unknown) {
    applyWorkspaceStatusLocally(workspace.id, previousStatus)
    error.value = e instanceof Error ? e.message : 'ステータスの更新に失敗しました'
  } finally {
    if (updatingStatusWorkspaceId.value === workspace.id) {
      updatingStatusWorkspaceId.value = null
    }
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
          fatalLoadError.value = r.reason === 'timeout' ? timeoutMessage() : r.message
          return
        }
        applyOrgWorkspaceIndexSnapshot(r.value)
        pageReady.value = true
      })
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
  pageReady.value = false
  void load()
}
async function createWorkspace (payload: {
  name: string
  description: string | null
  status: string | null
  label_ids: number[]
  assignee_ids: number[]
}) {
  pending.value = true
  error.value = null
  try {
    await withAppLoadingCursor(async () => {
      const createdWorkspace = await api<Workspace>(`/orgs/${slug.value}/workspaces`, {
        method: 'POST',
        body: {
          name: payload.name,
          description: payload.description,
          status: payload.status,
          label_ids: payload.label_ids,
          assignee_ids: payload.assignee_ids,
        },
      })
      workspaceFormModalOpen.value = false
      await load({ refresh: true })
      markWorkspaceAsJustCreated(createdWorkspace.id)
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '作成に失敗しました'
    error.value = message
    workspaceFormModalRef.value?.setSubmitError(message)
  } finally {
    pending.value = false
  }
}
async function updateWorkspace (payload: {
  name: string
  description: string | null
  status: string | null
  label_ids: number[]
  assignee_ids: number[]
}) {
  const target = workspaceEditTarget.value
  if (!target) return
  pending.value = true
  error.value = null
  try {
    await withAppLoadingCursor(async () => {
      await api<Workspace>(`/orgs/${slug.value}/workspaces/${target.id}`, {
        method: 'PATCH',
        body: {
          name: payload.name,
          description: payload.description,
          status: payload.status,
          label_ids: payload.label_ids,
          assignee_ids: payload.assignee_ids,
        },
      })
      workspaceFormModalOpen.value = false
      workspaceEditTarget.value = null
      invalidateOrgWorkspaceIndexCached(slug.value)
      invalidateWorkspaceBoardCached(slug.value, String(target.id))
      await load({ refresh: true })
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '更新に失敗しました'
    error.value = message
    workspaceFormModalRef.value?.setSubmitError(message)
  } finally {
    pending.value = false
  }
}
async function onWorkspaceFormSubmit (payload: {
  name: string
  description: string | null
  status: string | null
  label_ids: number[]
  assignee_ids: number[]
}) {
  if (workspaceFormMode.value === 'edit') {
    await updateWorkspace(payload)
    return
  }
  await createWorkspace(payload)
}
async function confirmWorkspaceArchive () {
  const target = workspaceArchiveTarget.value
  if (!target || archivePending.value) return
  archivePending.value = true
  error.value = null
  try {
    await withAppLoadingCursor(async () => {
      await api(`/orgs/${slug.value}/workspaces/${target.id}/archive`, {
        method: 'POST',
      })
      workspaceArchiveConfirmOpen.value = false
      workspaceArchiveTarget.value = null
      workspaces.value = workspaces.value.filter(workspace => workspace.id !== target.id)
      invalidateOrgWorkspaceIndexCached(slug.value)
      invalidateWorkspaceBoardCached(slug.value, String(target.id))
      invalidateWorkspaceDetailMeta(slug.value, target.id)
    })
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'アーカイブに失敗しました'
  } finally {
    archivePending.value = false
  }
}

function onWorkspaceRestored () {
  invalidateOrgWorkspaceIndexCached(slug.value)
  void load({ refresh: true })
}

function onWorkspacePermanentlyDeleted (workspaceId: number) {
  invalidateOrgWorkspaceIndexCached(slug.value)
  invalidateWorkspaceBoardCached(slug.value, String(workspaceId))
  invalidateWorkspaceDetailMeta(slug.value, workspaceId)
}
function warmWorkspaceBoard (workspaceId: number) {
  void warmWorkspaceBoardCache(slug.value, String(workspaceId))
  warmWorkspaceDetailCache(slug.value, workspaceId)
}
function onWorkspacePointerDown (event: PointerEvent, workspaceId: number) {
  if (event.button !== 0 || loadingWorkspaceId.value !== null) {
    pointerPressState.value = null
    return
  }
  pointerPressState.value = {
    workspaceId,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
  }
}
function onWorkspacePointerMove (event: PointerEvent, workspaceId: number) {
  const state = pointerPressState.value
  if (!state || state.workspaceId !== workspaceId || state.pointerId !== event.pointerId) {
    return
  }
  if (state.moved) return
  const movedX = Math.abs(event.clientX - state.startX)
  const movedY = Math.abs(event.clientY - state.startY)
  if (movedX > CLICK_MOVE_TOLERANCE_PX || movedY > CLICK_MOVE_TOLERANCE_PX) {
    state.moved = true
  }
}
function onWorkspacePointerCancel () {
  pointerPressState.value = null
}
function onWorkspacePointerUp (event: PointerEvent, workspaceId: number) {
  const state = pointerPressState.value
  pointerPressState.value = null
  if (!state || state.workspaceId !== workspaceId || state.pointerId !== event.pointerId) {
    return
  }
  if (state.moved) {
    return
  }
  void goToWorkspace(workspaceId)
}
async function goToWorkspace (workspaceId: number) {
  if (loadingWorkspaceId.value !== null) {
    return
  }
  loadingWorkspaceId.value = workspaceId
  try {
    await Promise.all([
      prefetch(slug.value, String(workspaceId)),
      prefetchWorkspaceDetail(slug.value, workspaceId),
    ])
    await navigateTo(`/org/${slug.value}/workspaces/${workspaceId}`)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'スペースを開けませんでした'
  } finally {
    if (loadingWorkspaceId.value === workspaceId) {
      loadingWorkspaceId.value = null
    }
  }
}
function warmVisibleWorkspaceBoards () {
  if (!pageReady.value) {
    return
  }
  for (const workspace of visibleWorkspaces.value) {
    void warmWorkspaceBoardCache(slug.value, String(workspace.id))
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
function normalizeWorkspaceListItem (workspace: Workspace): Workspace {
  return {
    ...workspace,
    labels: workspace.labels ? resolveStandardColors(workspace.labels) : workspace.labels,
    status: workspace.status ? resolveStandardColors([workspace.status])[0] ?? workspace.status : workspace.status,
  }
}

let searchRequestSeq = 0

async function fetchWorkspacesWithSearch (query: string) {
  const requestSeq = ++searchRequestSeq
  const q = query.trim()
  const path = q
    ? `/orgs/${slug.value}/workspaces?q=${encodeURIComponent(q)}`
    : `/orgs/${slug.value}/workspaces`
  const res = await api<{ data: Workspace[] }>(path)
  if (requestSeq !== searchRequestSeq) {
    return
  }
  workspaces.value = (res.data ?? []).map(normalizeWorkspaceListItem)
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
  void fetchWorkspacesWithSearch(query).catch((e: unknown) => {
    error.value = e instanceof Error ? e.message : '検索に失敗しました'
  })
})

watch(
  () => [pageReady.value, visibleWorkspaces.value] as const,
  () => {
    warmVisibleWorkspaceBoards()
  },
  { immediate: true },
)
onBeforeMount(() => {
  const cached = getOrgWorkspaceIndexCached(slug.value)
  if (cached) {
    applyOrgWorkspaceIndexSnapshot(cached)
    pageReady.value = true
  }
})
onActivated(() => {
  const wasReady = pageReady.value
  const cached = getOrgWorkspaceIndexCached(slug.value)
  if (cached) {
    applyOrgWorkspaceIndexSnapshot(cached)
    pageReady.value = true
  }
  // Re-fetch so 更新日時順 reflects task/board activity while away from this page.
  if (wasReady) {
    void load({ refresh: true })
  }
  if (import.meta.client) {
    document.addEventListener('keydown', onWorkspaceListKeydown)
  }
})
onDeactivated(() => {
  closeWorkspaceMenu()
  closeSubheaderMenu()
  closeListFilter()
  if (import.meta.client) {
    document.removeEventListener('keydown', onWorkspaceListKeydown)
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
  document.addEventListener('keydown', onWorkspaceListKeydown)
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
  document.removeEventListener('keydown', onWorkspaceListKeydown)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('resize', updateStickyOffsets)
  globalHeaderObserver?.disconnect()
  globalHeaderObserver = null
  closeWorkspaceMenu()
  closeSubheaderMenu()
  closeListFilter()
})
</script>
<style lang="scss" scoped src="~/assets/styles/pages/org/slug/workspaces/index.scss"></style>
