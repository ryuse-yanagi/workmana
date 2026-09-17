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
            <PageSubheader
              actions-root-attr
              :wrap-start="false"
            >
              <template #start>
                <p class="subheader-title">
                  <FolderOpen :size="20" :stroke-width="2.25" class="subheader-title__icon" aria-hidden="true" />
                  Workspaces
                </p>
              </template>
              <template #filters>
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
                <HeaderSearchField
                  v-model.trim="searchQuery"
                  placeholder="スペースを検索..."
                  aria-label="スペース検索"
                  :disabled="!pageReady"
                />
                <SubheaderCount
                  :count="visibleWorkspaces.length"
                  :ready="pageReady"
                />
              </template>
              <template #actions>
                <button
                  type="button"
                  class="subheader-secondary-btn subheader-secondary-btn--add"
                  title="スペース作成（N）"
                  :disabled="pending || !pageReady"
                  @click="openWorkspaceCreateModal"
                >
                  <FolderPlus :size="18" :stroke-width="2.25" aria-hidden="true" />
                  スペース作成
                </button>
                <div class="subheader-actions__menus">
                  <FilterTriggerButton
                    :ref="setListFilterTriggerRef"
                    :active="hasActiveListFilters"
                    data-popover-trigger
                    :aria-expanded="listFilterOpen"
                    aria-haspopup="dialog"
                    :aria-label="hasActiveListFilters ? '絞り込み（適用中）' : '絞り込み'"
                    title="フィルター（F）"
                    :disabled="pending || !pageReady"
                    @click="toggleListFilter"
                  />
                  <button
                    ref="subheaderMenuTriggerRef"
                    type="button"
                    class="subheader-menu-btn"
                    data-popover-trigger
                    :aria-expanded="subheaderMenuOpen"
                    aria-haspopup="menu"
                    aria-label="その他"
                    title="その他（M）"
                    :disabled="pending || !pageReady"
                    @click.stop="toggleSubheaderMenu"
                  >
                    <Ellipsis :size="18" :stroke-width="2.25" aria-hidden="true" />
                  </button>
                </div>
              </template>
            </PageSubheader>
      </header>
      <div class="list-page__body">
      <div class="page-shell-fade">
        <div class="page-shell-fade__content">
          <!-- エラー表示 -->
          <p v-if="error" class="err">{{ error }}</p>
          <section class="table-card">
            <div
              v-if="!pageReady"
              class="page-await-spacer"
              aria-busy="true"
              aria-label="読み込み中"
            >
              <LoadingSpinner />
            </div>
            <div
              v-else
              :class="['table-wrap', { 'table-wrap--fade-in': listWrapShouldFadeIn }]"
            >
              <table class="workspace-table">
                <thead>
                  <tr>
                    <th colspan="5" class="workspace-header-cell">
                      <div class="workspace-table-header">
                        <div class="workspace-card__name">
                          <span class="workspace-card__pin-slot" aria-hidden="true" />
                          スペース名
                        </div>
                        <div class="workspace-card__description">説明</div>
                        <div class="workspace-card__assignees">メンバー</div>
                        <div class="workspace-card__status">ステータス</div>
                        <div class="workspace-card__actions" aria-hidden="true" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!workspaces.length">
                    <td colspan="5" class="workspace-card-cell">
                      <div class="workspace-card workspace-card--empty" role="status">
                        <p class="workspace-list-empty__message">スペースが存在しません</p>
                      </div>
                    </td>
                  </tr>
                  <template v-else>
                    <tr v-if="!visibleWorkspaces.length">
                      <td colspan="5" class="workspace-card-cell">
                        <div class="workspace-card workspace-card--empty" role="status">
                          <p class="workspace-list-empty__message">該当するスペースがありません</p>
                        </div>
                      </td>
                    </tr>
                    <tr
                      v-for="workspace in visibleWorkspaces"
                    :key="workspace.id"
                    :class="[
                      'clickable-row',
                      {
                        'workspace-row--fade-in': isWorkspaceJustCreated(workspace.id),
                      },
                    ]"
                    role="button"
                    tabindex="0"
                    @pointerenter="warmWorkspaceBoard(workspace.id)"
                    @focusin="warmWorkspaceBoard(workspace.id)"
                    @pointerdown="onWorkspacePointerDown($event, workspace.id)"
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
                            <span class="workspace-card__pin-slot" aria-hidden="true">
                              <Pin
                                v-if="workspace.pinned"
                                class="workspace-card__pin"
                                :size="20"
                                :stroke-width="2.25"
                              />
                            </span>
                            <p class="name-text">{{ workspace.name }}</p>
                          </div>
                          <div class="workspace-card__description">
                            <p v-if="workspace.description" class="description-text">
                              {{ workspaceListDescription(workspace.description) }}
                            </p>
                          </div>
                          <div class="workspace-card__assignees">
                            <WorkspaceAssigneeSelect
                              readonly
                              :assignees="workspace.assignees ?? []"
                              :org-members="orgMembers"
                            />
                          </div>
                          <div class="workspace-card__status">
                            <WorkspaceStatusSelect
                              readonly
                              :status="workspace.status"
                              :statuses="workspaceStatuses"
                            />
                          </div>
                          <div class="workspace-card__actions">
                            <CardMenuTrigger
                              :wrap="false"
                              trigger-class="subheader-menu-btn workspace-card__menu-btn"
                              :open="openMenuWorkspaceId === workspace.id"
                              aria-label="スペースのメニュー"
                              :icon-size="18"
                              stop-click
                              stop-pointer
                              @click="toggleWorkspaceMenu(workspace.id, $event)"
                            />
                          </div>
                        </div>
                        <p
                          v-if="workspace.updated_at"
                          class="workspace-card__updated"
                        >更新 {{ formatDateDisplay(workspace.updated_at) }}</p>
                      </div>
                    </td>
                  </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
      </div>
      <Teleport to="body">
        <Transition name="popover-fade" @after-leave="onListFilterAfterLeave">
                    <BoardFilterPopover
            v-if="listFilterOpen"
            ref="listFilterDropdownRef"
            :style="listFilterStyle"
            :show-clear="hasActiveListFilters"
            @clear="clearListFilters"
            @close="closeListFilter"
          >
            <BoardFilterPopoverBody
              :sections-open="filterSectionsOpen"
              @update:sections-open="(v) => Object.assign(filterSectionsOpen, v)"
              v-model:assignee-search="assigneeFilterSearchQuery"
              v-model:label-search="labelFilterSearchQuery"
              assignee-title="メンバー"
              assignee-search-placeholder="メンバーを検索..."
              assignee-empty-text="該当するメンバーがありません"
              :members="filteredAssigneeFilterMembers"
              :label-categories="labelFilterCategories"
              :is-assignee-selected="isAssigneeFilterSelected"
              :is-label-selected="isLabelFilterSelected"
              tertiary="status"
              :statuses="workspaceStatuses"
              :is-status-selected="isStatusFilterSelected"
              @assignee-change="setAssigneeFilter"
              @label-toggle="toggleLabelFilter"
              @status-toggle="toggleStatusFilter"
              @section-toggle="onFilterSectionToggle"
            />
          </BoardFilterPopover>
        </Transition>
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
        :instance-key="openMenuWorkspaceId ?? 'workspace-menu'"
        :style="workspaceMenuStyle"
        :disabled="pending"
        :items="workspaceMenuItems"
        @select="onWorkspaceMenuSelect"
        @close="closeWorkspaceMenu"
        @after-leave="onWorkspaceMenuAfterLeave"
      />
      <!-- 作成・詳細モーダル（オーバーレイのためフェード対象外） -->
      <WorkspaceFormModal
        ref="workspaceFormModalRef"
        v-model="workspaceFormModalOpen"
        :mode="workspaceFormMode"
        :title="workspaceFormMode === 'details' ? 'スペース詳細' : 'スペースの作成'"
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
import { Ellipsis, FolderOpen, FolderPlus, Pin } from 'lucide-vue-next'
import PageSubheader from '../../../../components/ui/PageSubheader.vue'
import HeaderSearchField from '../../../../components/ui/HeaderSearchField.vue'
import SubheaderCount from '../../../../components/ui/SubheaderCount.vue'
import FilterTriggerButton from '../../../../components/ui/FilterTriggerButton.vue'
import BoardFilterPopover from '../../../../components/ui/BoardFilterPopover.vue'
import BoardFilterPopoverBody from '../../../../components/ui/BoardFilterPopoverBody.vue'
import LoadingSpinner from '../../../../components/ui/LoadingSpinner.vue'
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from '../../../../composables/raceWithTimeout'
import { withAppLoadingCursor } from '../../../../composables/useAppLoadingCursor'
import {
  useOrgWorkspaceIndexPageData,
  useOrgWorkspaceIndexCacheRevision,
  hydrateOrgWorkspaceIndexSnapshot,
  type OrgWorkspaceIndexPageSnapshot,
  type OrgWorkspaceStatus,
} from '../../../../composables/useOrgWorkspaceIndexPageData'
import { useWorkspaceMutations } from '../../../../composables/useWorkspaceMutations'
import { formatDateDisplay, type TaskFormMember } from '../../../../composables/useTaskFormHelpers'
import { memberMatchesSearchQuery } from '../../../../composables/useMemberDisplay'
import { filterLabelCategories } from '../../../../composables/useLabelCategories'
import { useAnchoredFilterPopover } from '../../../../composables/useAnchoredFilterPopover'
import { useFloatingMenuState } from '../../../../composables/useFloatingMenuState'
import { useTransientIdFlash } from '../../../../composables/useTransientIdFlash'
import { useStickyHeaderOffsets } from '../../../../composables/useWorkspaceViewPageRoot'
import { isViewShortcutModifierBlocked } from '../../../../composables/useViewKeyboardShortcuts'
import { useWorkspaceBoardPageData } from '../../../../composables/useWorkspaceBoardPageData'
import { useOrgSafeRedirect } from '../../../../composables/useOrgSafeRedirect'
import { DEFAULT_WORKSPACE_STATUS_ITEMS } from '../../../../components/settings/types'
import { resolveStandardColors } from '../../../../utils/colorPresetResolution'
import { isAccessDeniedMessage } from '../../../../utils/resourceAccessError'
import { buildDestructiveConfirmMessage } from '../../../../utils/destructiveConfirmMessage'
import {
  getTopmostModalOverlay,
  isKeyboardShortcutBlockedTarget,
} from '../../../../utils/uiInteraction'
import WorkspaceFormModal from '../../../../components/modals/WorkspaceFormModal.vue'
import ArchivedNamedItemsModal from '../../../../components/modals/ArchivedNamedItemsModal.vue'
import ConfirmModal from '../../../../components/modals/ConfirmModal.vue'
import WorkspaceAssigneeSelect from '../../../../components/workspace/WorkspaceAssigneeSelect.vue'
import WorkspaceStatusSelect from '../../../../components/workspace/WorkspaceStatusSelect.vue'
import FloatingMenu, { type FloatingMenuItem } from '../../../../components/ui/FloatingMenu.vue'
import CardMenuTrigger from '../../../../components/ui/CardMenuTrigger.vue'
import { useOrgRole } from '../../../../composables/useOrgRole'
import { useWorkspaceViewPageRoot } from '../../../../composables/useWorkspaceViewPageRoot'
definePageMeta({
  name: 'org-slug-workspaces',
  key: route => route.fullPath,
  keepalive: false,
})
useWorkspaceViewPageRoot()
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
  pinned?: boolean
  pinned_at?: string | null
}
const route = useRoute()
const router = useRouter()
const slug = computed(() => route.params.slug as string)
const { isOrgAdmin } = useOrgRole(slug)
const { redirectToMemberHome } = useOrgSafeRedirect()
const {
  fetchSnapshot: fetchOrgWorkspaceIndexSnapshot,
  getCached: getOrgWorkspaceIndexCached,
  invalidateCached: invalidateOrgWorkspaceIndexCached,
  fetchAndUpsertWorkspace,
  warmWorkspaceCache,
  refreshSnapshotInBackground,
  removeCachedWorkspace,
  revalidateWorkspaceInBackground,
} = useOrgWorkspaceIndexPageData()
const cacheRevision = useOrgWorkspaceIndexCacheRevision()
const workspaceMutations = useWorkspaceMutations(slug)
const { warmWorkspaceBoardCache, prefetch } = useWorkspaceBoardPageData()

const { data: initialSnapshot, error: initialSnapshotError } = await useAsyncData(
  () => `org-workspace-index:${slug.value}`,
  async () => {
    const currentSlug = slug.value?.trim()
    if (!currentSlug) {
      return null
    }
    return fetchOrgWorkspaceIndexSnapshot(currentSlug)
  },
)

if (initialSnapshot.value) {
  hydrateOrgWorkspaceIndexSnapshot(slug.value, initialSnapshot.value)
}

/** 初回取得成功まで一覧を出さない（ヘッダーは先に表示） */
const pageReady = ref(initialSnapshot.value != null)
/** 初回のみ：タイムアウト／API 失敗時にブロッキング表示 */
const fatalLoadError = ref<string | null>(
  initialSnapshot.value || !initialSnapshotError.value
    ? null
    : (initialSnapshotError.value instanceof Error
      ? initialSnapshotError.value.message
      : '読み込みに失敗しました'),
)
const pending = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const sortMode = ref<'created' | 'updated' | 'name'>('created')
const workspaceFormModalOpen = ref(false)
const workspaceFormModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const workspaceFormMode = ref<'create' | 'details'>('create')
const workspaceDetailsTarget = ref<Workspace | null>(null)
const workspaceArchiveConfirmOpen = ref(false)
const workspaceArchiveTarget = ref<Workspace | null>(null)
const archivedWorkspacesOpen = ref(false)
const archivePending = ref(false)
const WORKSPACE_MENU_MIN_WIDTH = 160
const workspaceMenu = useFloatingMenuState<number>({
  menuMinWidth: WORKSPACE_MENU_MIN_WIDTH,
  getMenuItemCount: () => workspaceMenuItems.value.length,
  gap: 4,
})
const openMenuWorkspaceId = workspaceMenu.openId
const workspaceMenuPosition = workspaceMenu.position
const pendingWorkspaceMenuOpen = workspaceMenu.pendingOpen
let workspaceMenuAnchorEl: HTMLElement | null = null
const subheaderMenuTriggerRef = ref<HTMLElement | null>(null)
const SUBHEADER_MENU_MIN_WIDTH = 220
const subheaderMenu = useFloatingMenuState<'subheader'>({
  menuMinWidth: SUBHEADER_MENU_MIN_WIDTH,
  getMenuItemCount: () => subheaderMenuItems.length,
  placement: 'below-end',
})
const subheaderMenuOpen = computed({
  get: () => subheaderMenu.openId.value !== null,
  set: (open: boolean) => {
    if (!open) subheaderMenu.close()
  },
})
const subheaderMenuPosition = subheaderMenu.position
const listFilterTriggerRef = ref<HTMLElement | null>(null)
function setListFilterTriggerRef (comp: { el?: HTMLElement | null } | null) {
  listFilterTriggerRef.value = comp?.el ?? null
}
const listFilterDropdownRef = ref<InstanceType<typeof BoardFilterPopover> | null>(null)
const assigneeFilterSelected = ref<string[]>([])
const labelFilterSelected = ref(new Set<string>())
const statusFilterSelected = ref(new Set<string>())
const assigneeFilterSearchQuery = ref('')
const labelFilterSearchQuery = ref('')
type ListFilterSectionKey = 'assignee' | 'label' | 'status'
const filterSectionsOpen = reactive<Record<ListFilterSectionKey, boolean>>({
  assignee: true,
  label: true,
  status: true,
})
const hasActiveListFilters = computed(() => (
  assigneeFilterSelected.value.length > 0
  || labelFilterSelected.value.size > 0
  || statusFilterSelected.value.size > 0
))
function clearListFilterSearchQueries () {
  assigneeFilterSearchQuery.value = ''
  labelFilterSearchQuery.value = ''
}
const {
  open: listFilterOpen,
  style: listFilterStyle,
  close: closeListFilter,
  openPopover: openListFilter,
  onAfterLeave: onListFilterAfterLeave,
  onSectionToggle: onFilterSectionToggle,
} = useAnchoredFilterPopover({
  triggerRef: listFilterTriggerRef,
  dropdownRef: listFilterDropdownRef,
  onClose: clearListFilterSearchQueries,
  onBeforeOpen: () => {
    workspaceMenu.close()
    subheaderMenu.close()
  },
  repositionSources: [assigneeFilterSearchQuery, labelFilterSearchQuery],
})
const justCreatedWorkspaces = useTransientIdFlash<number>()
const justCreatedWorkspaceIds = justCreatedWorkspaces.ids
const listWrapShouldFadeIn = ref(false)
let workspaceListInitialRevealDone = false
const loadingWorkspaceId = ref<number | null>(null)
const {
  pageCssVars: listPageCssVars,
  updateStickyOffsets,
  bindStickyOffsets,
  unbindStickyOffsets,
} = useStickyHeaderOffsets({ autoBind: false })

const indexSnapshot = computed(() => {
  void cacheRevision.value
  return getOrgWorkspaceIndexCached(slug.value)
})
const workspaces = computed<Workspace[]>(() => {
  return (indexSnapshot.value?.workspaces ?? []) as Workspace[]
})
const orgLabels = computed(() => (indexSnapshot.value?.orgLabels ?? []) as Label[])
const orgLabelCategories = computed(() => indexSnapshot.value?.orgLabelCategories ?? [])
const orgMembers = computed(() => indexSnapshot.value?.orgMembers ?? [])
const workspaceStatuses = computed(() => (
  indexSnapshot.value?.workspaceStatuses
  ?? resolveStandardColors(DEFAULT_WORKSPACE_STATUS_ITEMS)
))

const visibleWorkspaces = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const filtered = query
    ? workspaces.value.filter(workspace => workspace.name.toLowerCase().includes(query))
    : [...workspaces.value]
  const matched = filtered.filter(workspace => (
    matchesAssigneeFilter(workspace)
    && matchesLabelFilter(workspace)
    && matchesStatusFilter(workspace)
  ))
  const compareBySortMode = (a: Workspace, b: Workspace): number => {
    if (sortMode.value === 'name') {
      return a.name.localeCompare(b.name, 'ja') || b.id - a.id
    }
    if (sortMode.value === 'updated') {
      return compareTimestampDesc(a.updated_at, b.updated_at) || b.id - a.id
    }
    return compareTimestampDesc(a.created_at, b.created_at) || b.id - a.id
  }
  return matched.sort((a, b) => {
    const aPinned = Boolean(a.pinned)
    const bPinned = Boolean(b.pinned)
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1
    }
    return compareBySortMode(a, b)
  })
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
const workspaceMenuStyle = workspaceMenu.style
const subheaderMenuStyle = subheaderMenu.style
const filteredAssigneeFilterMembers = computed(() =>
  orgMembers.value.filter(member =>
    memberMatchesSearchQuery(member, assigneeFilterSearchQuery.value),
  ),
)
const labelFilterCategories = computed(() =>
  filterLabelCategories(orgLabelCategories.value, labelFilterSearchQuery.value),
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
  if (workspaceFormMode.value !== 'details' || !workspaceDetailsTarget.value) {
    return null
  }
  const target = workspaceDetailsTarget.value
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
  return justCreatedWorkspaces.has(workspaceId)
}
function workspaceListDescription (description: string | null | undefined): string {
  if (!description) {
    return ''
  }
  return description.split(/\r?\n/)[0] ?? ''
}
function markWorkspaceAsJustCreated (workspaceId: number) {
  justCreatedWorkspaces.mark(workspaceId)
}
function revealLoadedWorkspaces () {
  if (workspaceListInitialRevealDone) {
    return
  }
  workspaceListInitialRevealDone = true
  if (visibleWorkspaces.value.length > 0) {
    for (const workspace of visibleWorkspaces.value) {
      markWorkspaceAsJustCreated(workspace.id)
    }
    return
  }
  listWrapShouldFadeIn.value = true
  setTimeout(() => {
    listWrapShouldFadeIn.value = false
  }, 260)
}
function resetWorkspaceListReveal () {
  workspaceListInitialRevealDone = false
  listWrapShouldFadeIn.value = false
}
const closeWorkspaceMenu = workspaceMenu.close
function onWorkspaceMenuAfterLeave () {
  const pending = pendingWorkspaceMenuOpen.value
  if (!pending) {
    workspaceMenuAnchorEl = null
  } else {
    workspaceMenuAnchorEl = pending.anchor
  }
  workspaceMenu.onAfterLeave()
}
function closeSubheaderMenu () {
  subheaderMenu.close()
}
function toggleSubheaderMenu () {
  if (subheaderMenuOpen.value) {
    closeSubheaderMenu()
    return
  }
  closeWorkspaceMenu()
  closeListFilter()
  const anchor = subheaderMenuTriggerRef.value
  if (!anchor) {
    return
  }
  subheaderMenu.open('subheader', anchor)
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
function openWorkspaceMenu (workspaceId: number, anchor: HTMLElement) {
  closeSubheaderMenu()
  closeListFilter()
  workspaceMenuAnchorEl = anchor
  workspaceMenu.open(workspaceId, anchor)
}
function toggleWorkspaceMenu (workspaceId: number, event: MouseEvent) {
  const el = event.currentTarget
  if (!(el instanceof HTMLElement)) {
    return
  }
  openWorkspaceMenu(workspaceId, el)
}
function onWorkspaceContextMenu (workspaceId: number, event: MouseEvent) {
  workspaceMenu.openFromContextMenu(workspaceId, event, '.workspace-card__menu-btn')
}
function openWorkspaceCreateModal () {
  closeWorkspaceMenu()
  closeSubheaderMenu()
  closeListFilter()
  workspaceFormMode.value = 'create'
  workspaceDetailsTarget.value = null
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
    || pending.value
    || archivePending.value
  ) {
    return false
  }
  return true
}
function onWorkspaceListKeydown (event: KeyboardEvent) {
  const key = event.key
  if (
    key !== 'n' && key !== 'N'
    && key !== 'f' && key !== 'F'
    && key !== 'm' && key !== 'M'
  ) {
    return
  }
  if (isViewShortcutModifierBlocked(event)) {
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
    if (!canUseWorkspaceListKeyboardShortcut()) {
      return
    }
    event.preventDefault()
    toggleSubheaderMenu()
    return
  }
  if (!canUseWorkspaceListKeyboardShortcut()) {
    return
  }
  if (key === 'f' || key === 'F') {
    const anchor = listFilterTriggerRef.value
    if (!anchor || !anchor.isConnected) {
      return
    }
    event.preventDefault()
    toggleListFilter()
    return
  }
  event.preventDefault()
  openWorkspaceCreateModal()
}
function openWorkspaceDetailsModal (workspace: Workspace) {
  closeWorkspaceMenu()
  workspaceFormMode.value = 'details'
  workspaceDetailsTarget.value = workspace
  workspaceFormModalOpen.value = true
}
function openWorkspaceArchiveConfirm (workspace: Workspace) {
  closeWorkspaceMenu()
  workspaceArchiveTarget.value = workspace
  workspaceArchiveConfirmOpen.value = true
}
const workspaceMenuItems = computed<FloatingMenuItem[]>(() => {
  const pinned = Boolean(openMenuWorkspace.value?.pinned)
  const items: FloatingMenuItem[] = [
    { key: 'details', label: 'スペース詳細' },
    {
      key: pinned ? 'unpin' : 'pin',
      label: pinned ? 'ピン留めの解除' : 'ピン留めの登録',
    },
  ]
  if (isOrgAdmin.value) {
    items.push({ key: 'archive', label: 'スペースのアーカイブ', danger: true })
  }
  return items
})
const subheaderMenuItems: FloatingMenuItem[] = [
  { key: 'archived', label: 'アーカイブ済みスペース' },
]
function onSubheaderMenuSelect (item: FloatingMenuItem) {
  if (item.key === 'archived') {
    openArchivedWorkspacesModal()
  }
}
async function onWorkspaceMenuSelect (item: FloatingMenuItem) {
  const workspace = openMenuWorkspace.value
  if (!workspace) return
  if (item.key === 'pin') {
    closeWorkspaceMenu()
    try {
      await workspaceMutations.pinWorkspace(workspace.id)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'ピン留めに失敗しました'
    }
    return
  }
  if (item.key === 'unpin') {
    closeWorkspaceMenu()
    try {
      await workspaceMutations.unpinWorkspace(workspace.id)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'ピン留めの解除に失敗しました'
    }
    return
  }
  if (item.key === 'details') {
    openWorkspaceDetailsModal(workspace)
    return
  }
  if (item.key === 'archive') {
    openWorkspaceArchiveConfirm(workspace)
  }
}
function onWindowResize () {
  closeWorkspaceMenu()
  closeSubheaderMenu()
  closeListFilter()
}
function applyOrgWorkspaceIndexSnapshot (_snapshot?: OrgWorkspaceIndexPageSnapshot) {
  // 正本はモジュールキャッシュ。画面は cacheRevision 経由で読む。
}
let loadInFlight: Promise<void> | null = null

async function load (opts?: { refresh?: boolean }) {
  const refresh = opts?.refresh ?? false
  if (loadInFlight && !refresh) {
    return loadInFlight
  }
  const run = (async () => {
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
        const r = await raceWithTimeout(
          () => fetchOrgWorkspaceIndexSnapshot(slug.value),
          TM_PAGE_LOAD_TIMEOUT_MS,
        )
        if (!r.ok) {
          if (r.reason === 'timeout') {
            fatalLoadError.value = timeoutMessage()
            return
          }
          if (isAccessDeniedMessage(r.message)) {
            await redirectToMemberHome()
            return
          }
          fatalLoadError.value = r.message
          return
        }
        applyOrgWorkspaceIndexSnapshot(r.value)
        pageReady.value = true
      } else if (refresh && pageReady.value) {
        await refreshSnapshotInBackground(slug.value)
        applyOrgWorkspaceIndexSnapshot()
      } else {
        const snapshot = await fetchOrgWorkspaceIndexSnapshot(slug.value)
        applyOrgWorkspaceIndexSnapshot(snapshot)
        pageReady.value = true
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '読み込みに失敗しました'
      if (!pageReady.value && !refresh) {
        if (isAccessDeniedMessage(msg)) {
          await redirectToMemberHome()
          return
        }
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
  })()
  if (!refresh) {
    loadInFlight = run
  }
  try {
    await run
  } finally {
    if (loadInFlight === run) {
      loadInFlight = null
    }
  }
}

function kickoffWorkspaceIndexLoad () {
  if (getOrgWorkspaceIndexCached(slug.value)) {
    pageReady.value = true
    void load({ refresh: true })
    return
  }
  void load()
}
function retryInitialLoad () {
  fatalLoadError.value = null
  invalidateOrgWorkspaceIndexCached(slug.value)
  resetWorkspaceListReveal()
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
      const createdWorkspace = await workspaceMutations.createWorkspace({
        name: payload.name,
        description: payload.description,
        status: payload.status,
        label_ids: payload.label_ids,
        assignee_ids: payload.assignee_ids,
      })
      workspaceFormModalOpen.value = false
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
  const target = workspaceDetailsTarget.value
  if (!target) return
  pending.value = true
  error.value = null
  try {
    await withAppLoadingCursor(async () => {
      await workspaceMutations.updateWorkspace(target.id, {
        name: payload.name,
        description: payload.description,
        status: payload.status,
        label_ids: payload.label_ids,
        assignee_ids: payload.assignee_ids,
      })
      workspaceFormModalOpen.value = false
      workspaceDetailsTarget.value = null
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
  if (workspaceFormMode.value === 'details') {
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
      await workspaceMutations.archiveWorkspace(target.id)
      workspaceArchiveConfirmOpen.value = false
      workspaceArchiveTarget.value = null
    })
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'アーカイブに失敗しました'
  } finally {
    archivePending.value = false
  }
}

function onWorkspaceRestored (restored: { id: number }) {
  void fetchAndUpsertWorkspace(slug.value, restored.id, { force: true })
}

function onWorkspacePermanentlyDeleted (workspaceId: number) {
  removeCachedWorkspace(slug.value, workspaceId)
  workspaceMutations.invalidateWorkspaceViews(workspaceId)
}
function workspaceDetailPath (workspaceId: number) {
  return `/org/${slug.value}/workspaces/${workspaceId}`
}
function warmWorkspaceBoard (workspaceId: number) {
  if (!import.meta.client) {
    return
  }
  const path = workspaceDetailPath(workspaceId)
  // ルート chunk 先読み（クリック後の遷移待ちの主因を温める）
  void preloadRouteComponents(path).catch(() => {})
  void warmWorkspaceBoardCache(slug.value, String(workspaceId))
  warmWorkspaceCache(slug.value, workspaceId)
}
function onWorkspacePointerDown (event: PointerEvent, workspaceId: number) {
  if (event.button !== 0 || loadingWorkspaceId.value !== null) {
    return
  }
  goToWorkspace(workspaceId)
}
function goToWorkspace (workspaceId: number) {
  if (loadingWorkspaceId.value !== null) {
    return
  }
  loadingWorkspaceId.value = workspaceId
  const path = workspaceDetailPath(workspaceId)
  void preloadRouteComponents(path).catch(() => {})
  void prefetch(slug.value, String(workspaceId))
  revalidateWorkspaceInBackground(slug.value, workspaceId)
  void router.push(path)
    .catch((e: unknown) => {
      error.value = e instanceof Error ? e.message : 'スペースを開けませんでした'
    })
    .finally(() => {
      if (loadingWorkspaceId.value === workspaceId) {
        loadingWorkspaceId.value = null
      }
    })
}
function warmVisibleWorkspaceBoards () {
  if (!pageReady.value || !import.meta.client) {
    return
  }
  for (const workspace of visibleWorkspaces.value) {
    warmWorkspaceBoard(workspace.id)
  }
}
watch(
  () => pageReady.value,
  (ready) => {
    if (ready) {
      warmVisibleWorkspaceBoards()
    }
  },
  { immediate: true },
)
watch(pageReady, async (ready) => {
  if (!ready) {
    return
  }
  await nextTick()
  revealLoadedWorkspaces()
}, { immediate: true })
onBeforeMount(() => {
  if (getOrgWorkspaceIndexCached(slug.value)) {
    pageReady.value = true
  }
})
onActivated(() => {
  kickoffWorkspaceIndexLoad()
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
  kickoffWorkspaceIndexLoad()
  if (!import.meta.client) {
    return
  }
  document.addEventListener('keydown', onWorkspaceListKeydown)
  window.addEventListener('resize', onWindowResize)
  nextTick(() => {
    bindStickyOffsets()
  })
})
if (import.meta.client) {
  kickoffWorkspaceIndexLoad()
  window.setTimeout(() => {
    if (!pageReady.value && !fatalLoadError.value) {
      fatalLoadError.value = timeoutMessage()
    }
  }, TM_PAGE_LOAD_TIMEOUT_MS + 1000)
}
onBeforeUnmount(() => {
  if (!import.meta.client) {
    return
  }
  document.removeEventListener('keydown', onWorkspaceListKeydown)
  window.removeEventListener('resize', onWindowResize)
  unbindStickyOffsets()
  closeWorkspaceMenu()
  closeSubheaderMenu()
  closeListFilter()
})
</script>
<style lang="scss" scoped src="~/assets/styles/pages/org/slug/workspaces/index.scss"></style>
