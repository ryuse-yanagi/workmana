<template>
  <div
    class="workspace-board board-page"
    :style="boardPageCssVars"
  >
    <template v-if="fatalLoadError">
      <PageLoadFatal :message="fatalLoadError" @retry="retryBoardLoad" />
    </template>
    <template v-else>
      <header class="page-header">
        <PageSubheader actions-root-attr>
          <template #start>
            <NuxtLink
              :to="`/org/${slug}/workspaces`"
              class="subheader-title subheader-back-link"
              aria-label="スペース一覧に戻る"
            >
              スペース一覧
            </NuxtLink>
            <p
              class="subheader-workspace-name"
              :title="workspaceMetaName || undefined"
            >{{ workspaceMetaName }}</p>
            <WorkspaceViewSwitcher :org-slug="slug" :workspace-id="workspaceId" />
          </template>
          <template #filters>
            <HeaderSearchField
              v-model.trim="searchQuery"
              placeholder="タスクを検索..."
              aria-label="タスク検索"
              :disabled="!pageReady"
            />
            <SubheaderCount
              :count="visibleTaskCount"
              :ready="pageReady"
            />
          </template>
          <template #actions>
            <button
              type="button"
              class="subheader-secondary-btn subheader-secondary-btn--add"
              title="タスク追加（N）"
              :disabled="!canAddTaskFromHeader"
              @click="openTaskAddFromHeader"
            >
              <FilePlus
                :size="18"
                :stroke-width="2.25"
                aria-hidden="true"
              />
              タスク追加
            </button>
            <div class="subheader-actions__menus">
              <SidebarToggleButton
                :open="sidebarOpen"
                :disabled="!pageReady"
                @toggle="toggleSidebar"
              />
              <FilterTriggerButton
                :ref="setBoardFilterTriggerRef"
                :active="hasActiveBoardFilters"
                data-popover-trigger
                :aria-expanded="boardFilterOpen"
                aria-haspopup="dialog"
                :aria-label="hasActiveBoardFilters ? '絞り込み（適用中）' : '絞り込み'"
                title="フィルター（F）"
                :disabled="!pageReady"
                @click="toggleBoardFilter"
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
                :disabled="!pageReady"
                @click.stop="toggleSubheaderMenu"
              >
                <Ellipsis :size="18" :stroke-width="2.25" aria-hidden="true" />
              </button>
            </div>
          </template>
        </PageSubheader>
      </header>
      <div class="workspace-show-body">
        <div
          class="workspace-sidebar-slot"
          :class="{ 'workspace-sidebar-slot--closed': !sidebarOpen }"
          :aria-hidden="!sidebarOpen"
          :inert="!sidebarOpen"
        >
          <WorkspaceDetailSidebar
            ref="workspaceSidebarRef"
            :org-slug="slug"
            :workspace-id="workspaceId"
          />
        </div>
        <div class="page-shell-fade">
          <p v-if="error" class="err">{{ error }}</p>
          <div
            v-if="!pageReady"
            class="board board--loading"
            role="status"
            aria-busy="true"
            aria-label="読み込み中"
          >
            <LoadingSpinner />
          </div>
            <section
            v-else
            class="board"
            :class="{
              'board--fade-in': boardShouldFadeIn,
              'board-dragging': boardDragging,
              'board-drag-cross-list': boardDragCrossList,
              'board-dragging--tail-zone': boardDragPreviewMode === 'tail',
              'board-list-dragging': listColumnDragging,
            }"
          >
            <div class="board-columns">
            <draggable
              :key="listSortableEpoch"
              v-model="lists"
              item-key="key"
              class="board-lists-sortable"
              group="board-lists"
              direction="horizontal"
              draggable=".list-column"
              :animation="180"
              :delay="0"
              :delay-on-touch-only="false"
              :touch-start-threshold="0"
              :disabled="listReorderPending || editingListKey !== null"
              handle=".list-header"
              ghost-class="drag-ghost"
              chosen-class="drag-chosen"
              drag-class="drag-active"
              filter=".list-drop-zone, .composer, .no-list-drag, .list-header--editing, .list-title-input, input, textarea, button, a"
              :prevent-on-filter="true"
              :force-fallback="true"
              :fallback-on-body="true"
              :fallback-tolerance="5"
              fallback-class="sortable-fallback"
              :move="onListColumnDragMove"
              @change="onListColumnSortableChange"
              @start="onListColumnDragStart"
              @end="onListColumnDragEnd"
            >
              <template #item="{ element: list }">
                <BoardListColumn
                  :list="list"
                  :tasks="tasksByList[list.key]"
                  :fade-in="isListJustCreated(list.key)"
                  :empty="isListColumnEmpty(list.key)"
                  :drag-source="
                    boardDragging
                    && boardDragCrossList
                    && boardDragStartListKey === list.key
                  "
                  :tail-target="boardDragging && boardDragPreviewListKey === list.key"
                  :is-editing-title="editingListKey === list.key"
                  :title-draft="listEditDrafts[list.key] ?? ''"
                  :list-rename-pending="listRenamePending"
                  :list-menu-open="openListMenuKey === list.key"
                  :visible-count="visibleCount(list.key)"
                  :scrollable-drop-zone="Boolean(scrollableDropZoneListKeys[list.key])"
                  :show-tail-preview="
                    boardDragging
                    && boardDragPreviewMode === 'tail'
                    && boardDragPreviewListKey === list.key
                  "
                  :editing-task-id="editingTaskId"
                  :task-title-draft="taskTitleDraft"
                  :task-rename-pending="taskRenamePending"
                  :open-card-menu-task-id="openCardMenuTaskId"
                  :parent-tasks="tasks ?? []"
                  :is-task-visible="(taskId) => visibleTaskIdSet.has(taskId)"
                  :is-task-just-created="isTaskJustCreated"
                  :on-board-drag-move="onBoardDragMove"
                  :on-board-drag-choose="onBoardDragChoose"
                  :on-board-drag-start="onBoardDragStart"
                  :on-board-drag-end="onBoardDragEnd"
                  @update:title-draft="(value) => { listEditDrafts[list.key] = value }"
                  @update:task-title-draft="(value) => { taskTitleDraft = value }"
                  @title-click="onListTitleClick(list)"
                  @title-edit-start="startListEdit(list)"
                  @title-confirm="confirmListTitle(list)"
                  @title-cancel="cancelListEdit"
                  @toggle-menu="toggleListMenu(list.key, $event)"
                  @drop-zone-scroll="onDropZoneScroll"
                  @open-task="openTaskDetail"
                  @task-contextmenu="onTaskCardContextMenu"
                  @save-task-title="saveTaskTitle"
                  @cancel-task-edit="cancelTaskEdit"
                  @toggle-card-menu="toggleCardMenu"
                  @add-task="openTaskAddModal"
                />
              </template>
            </draggable>
            </div>
          </section>
        </div>
      </div>
      <template v-if="pageReady">
        <ArchivedTasksModal
          ref="archivedModalRef"
          v-model="archivedModalOpen"
          :org-slug="slug"
          :workspace-id="workspaceId"
          :can-manage-archive="isOrgAdmin"
          @restored="onArchivedTaskRestored"
        />
        <ArchivedNamedItemsModal
          v-model="archivedDocumentsOpen"
          :org-slug="slug"
          resource="documents"
          item-kind="資料"
          :workspace-id="workspaceId"
          :can-manage-archive="isOrgAdmin"
          @restored="onArchivedDocumentRestored"
        />
        <ConfirmModal
          v-model="archiveConfirmTaskOpen"
          title="タスクカードのアーカイブ確認"
          :message="archiveConfirmTaskMessage"
          confirm-text="アーカイブ"
          variant="danger"
          @confirm="confirmArchiveFromModal"
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
        <ListFormModal
          ref="listFormModalRef"
          v-model="listFormOpen"
          :mode="listModalMode"
          :initial-values="listModalInitialValues"
          :loading="listFormLoading"
          @submit="onListFormSubmit"
        />
        <NamedItemDeleteModal
          ref="listDeleteModalRef"
          v-model="listDeleteOpen"
          title="リストの削除"
          item-kind="リスト"
          :item-name="listDeleteTarget?.title ?? ''"
          :loading="listDeleteLoading"
          @confirm="confirmListDelete"
        />
        <TaskAddModal
          v-model="taskAddOpen"
          :org-slug="slug"
          :workspace-id="workspaceId"
          :list-id="taskAddListId"
          :initial-parent-task-id="taskAddParentTaskId"
          :initial-parent-defaults="taskAddParentDefaults"
          :org-labels="orgLabels"
          :label-categories="orgLabelCategories"
          :workspace-members="workspaceMembers"
          :workspace-lists="detailWorkspaceLists"
          @added="onTaskAddedFromModal"
        />
        <TaskDetailModal
          v-model="taskDetailOpen"
          :org-slug="slug"
          :workspace-id="workspaceId"
          :task-id="detailTaskId"
          :org-labels="orgLabels"
          :label-categories="orgLabelCategories"
          :workspace-members="workspaceMembers"
          :workspace-lists="detailWorkspaceLists"
          :initial-task-detail="detailInitialTask"
          :initial-parent-tasks="boardParentTasks"
          :hierarchy-tasks="detailHierarchyTasks"
          :initial-attachments="detailInitialAttachments"
          :remote-update="detailModalRemotePatch"
          :remote-update-rev="detailModalRemoteRev"
          @updated="onTaskDetailUpdated"
          @attachments-updated="onTaskAttachmentsUpdated"
          @navigate="onTaskDetailNavigate"
          @missing="onTaskDetailMissing"
          @add-child-task="onAddChildTaskFromDetail"
        />
      </template>
    </template>
    <Teleport to="body">
      <Transition name="popover-fade" @after-leave="onBoardFilterAfterLeave">
        <BoardFilterPopover
          v-if="boardFilterOpen"
          ref="boardFilterDropdownRef"
          :style="boardFilterStyle"
          :show-clear="hasActiveBoardFilters"
          @clear="clearBoardFilters"
          @close="closeBoardFilter"
        >
          <BoardFilterPopoverBody
            :sections-open="filterSectionsOpen"
            @update:sections-open="(v) => Object.assign(filterSectionsOpen, v)"
            v-model:assignee-search="assigneeFilterSearchQuery"
            v-model:label-search="labelFilterSearchQuery"
            :members="filteredAssigneeFilterMembers"
            :label-categories="labelFilterCategories"
            :is-assignee-selected="isAssigneeFilterSelected"
            :is-label-selected="isLabelFilterSelected"
            tertiary="schedule"
            :schedule-options="scheduleFilterOptions"
            :is-schedule-selected="isScheduleFilterSelected"
            @assignee-change="setAssigneeFilter"
            @label-toggle="toggleLabelFilter"
            @schedule-toggle="toggleScheduleFilter"
            @section-toggle="onFilterSectionToggle"
          />
        </BoardFilterPopover>
      </Transition>
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
        :open="Boolean(openMenuTask && cardMenuPosition)"
        :instance-key="openCardMenuTaskId ?? 'card-menu'"
        density="compact"
        :style="cardMenuStyle"
        :items="cardMenuItems"
        @select="onCardMenuSelect"
        @close="closeCardMenu"
        @after-leave="onCardMenuAfterLeave"
      />
      <FloatingMenu
        :open="Boolean(openListMenuList && listMenuPosition)"
        :instance-key="openListMenuKey ?? 'list-menu'"
        density="compact"
        :style="listMenuStyle"
        :disabled="pending"
        :items="listMenuItems"
        @select="onListMenuSelect"
        @close="closeListMenu"
        @after-leave="onListMenuAfterLeave"
      />
      <WorkspaceFormModal
        ref="workspaceDetailsModalRef"
        v-model="workspaceDetailsModalOpen"
        mode="details"
        title="スペース詳細"
        :initial-values="workspaceDetailsInitialValues"
        :org-slug="slug"
        :labels="workspaceDetailsLabels"
        :label-categories="workspaceDetailsLabelCategories"
        :org-members="workspaceDetailsOrgMembers"
        :statuses="workspaceDetailsStatuses"
        :loading="workspaceDetailsPending"
        @submit="onWorkspaceDetailsSubmit"
      />
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import { Ellipsis, FilePlus } from 'lucide-vue-next'
import draggable from 'vuedraggable'
import PageSubheader from '../ui/PageSubheader.vue'
import HeaderSearchField from '../ui/HeaderSearchField.vue'
import SubheaderCount from '../ui/SubheaderCount.vue'
import SidebarToggleButton from '../ui/SidebarToggleButton.vue'
import FilterTriggerButton from '../ui/FilterTriggerButton.vue'
import BoardFilterPopover from '../ui/BoardFilterPopover.vue'
import BoardFilterPopoverBody from '../ui/BoardFilterPopoverBody.vue'
import LoadingSpinner from '../ui/LoadingSpinner.vue'
import ArchivedTasksModal, { type ArchivedTask } from '../modals/ArchivedTasksModal.vue'
import ArchivedNamedItemsModal, { type ArchivedNamedItem } from '../modals/ArchivedNamedItemsModal.vue'
import ListFormModal from '../modals/ListFormModal.vue'
import NamedItemDeleteModal from '../modals/NamedItemDeleteModal.vue'
import WorkspaceFormModal from '../modals/WorkspaceFormModal.vue'
import ConfirmModal from '../modals/ConfirmModal.vue'
import FloatingMenu, { type FloatingMenuItem } from '../ui/FloatingMenu.vue'
import { useDropdownEscapeClose } from '../../composables/useDropdownEscapeClose'
import { useWorkspaceTaskFilters } from '../../composables/useWorkspaceTaskFilters'
import { useAnchoredFilterPopover } from '../../composables/useAnchoredFilterPopover'
import { useFloatingMenuState } from '../../composables/useFloatingMenuState'
import { useTransientIdFlash } from '../../composables/useTransientIdFlash'
import { useStickyHeaderOffsets } from '../../composables/useWorkspaceViewPageRoot'
import {
  isViewShortcutModifierBlocked,
} from '../../composables/useViewKeyboardShortcuts'
import WorkspaceViewSwitcher from './WorkspaceViewSwitcher.vue'
import WorkspaceDetailSidebar from './WorkspaceDetailSidebar.vue'
import BoardListColumn from './BoardListColumn.vue'
import TaskDetailModal, { type TaskDetail, type TaskDetailMember } from '../modals/TaskDetailModal.vue'
import type { WorkspaceListOption } from '../../composables/useTaskPopoverEditor'
import type { TaskChecklist } from '../task/TaskDetailChecklistBlock.vue'
import type { TaskAttachmentsByTaskId, TaskAttachmentItem } from '../task/taskAttachmentTypes'
import { raceWithTimeout, timeoutMessage, TM_PAGE_LOAD_TIMEOUT_MS } from '../../composables/raceWithTimeout'
import { syncAppLoadingCursor, withAppLoadingCursor } from '../../composables/useAppLoadingCursor'
import { useApi } from '../../composables/useApi'
import {
  boardTaskToTaskDetail,
  useWorkspaceBoardPageData,
  type WorkspaceBoardLabel,
  type WorkspaceBoardLabelCategory,
  type WorkspaceBoardPageSnapshot,
  type WorkspaceBoardTask,
} from '../../composables/useWorkspaceBoardPageData'
import { enrichTaskDetailHierarchy } from '../../composables/useTaskHierarchy'
import { sortMembersByDisplayName } from '../../composables/useMemberDisplay'
import { resolveAndSortLabels } from '../../composables/useLabelCategories'
import { type TaskFormDefaultsSource } from '../../composables/useTaskFormHelpers'
import {
  applyUserProfileToTasks,
  useOnUserProfileUpdated,
} from '../../composables/userProfileUpdated'
import {
  removeMembersFromTaskAssignees,
  useOnWorkspaceMembersUpdated,
  workspaceMembersUpdateMatchesView,
  dispatchWorkspaceMembersUpdated,
} from '../../composables/workspaceMembersUpdated'
import { useUiSidebarPreference } from '../../composables/useUiSidebarPreference'
import {
  createEmptyWorkspaceTaskFilters,
  type WorkspaceTaskFilters,
} from '../../utils/workspaceTaskFilters'
import {
  resolveParentTaskTitle,
} from '../../composables/useTaskCardMeta'
import { useOrgRole } from '../../composables/useOrgRole'
import { useWorkspaceRealtimeChannel } from '../../composables/useWorkspaceRealtimeChannel'
import { useWorkspaceDetailMeta, restoreDocumentToWorkspaceDetailCache } from '../../composables/useWorkspaceDetailMeta'
import { useWorkspaceTaskMemberCandidates } from '../../composables/useWorkspaceTaskMemberCandidates'
import { useWorkspaceMutations } from '../../composables/useWorkspaceMutations'
import { useOrgWorkspaceIndexPageData, useOrgWorkspaceIndexCacheRevision } from '../../composables/useOrgWorkspaceIndexPageData'
import { useWorkspaceWbsPageData } from '../../composables/useWorkspaceWbsPageData'
import { withResolvedListColor, resolveStandardColors } from '../../utils/colorPresetResolution'
import { isAccessDeniedMessage } from '../../utils/resourceAccessError'
import { DEFAULT_WORKSPACE_STATUS_ITEMS } from '../../components/settings/types'
import { buildDestructiveConfirmMessage } from '../../utils/destructiveConfirmMessage'
import { toWorkspaceFormInitialValues } from '../../utils/workspaceFormInitialValues'
import {
  getTopmostModalOverlay,
  isKeyboardShortcutBlockedTarget,
} from '../../utils/uiInteraction'
const route = useRoute()
const router = useRouter()
const slug = computed(() => route.params.slug as string)
const { isOrgAdmin } = useOrgRole(slug)
const workspaceId = computed(() => route.params.id as string)
const { workspace: workspaceMeta } = useWorkspaceDetailMeta(slug, workspaceId)
const workspaceMetaName = computed(() => workspaceMeta.value?.name ?? '')
const workspaceSidebarRef = ref<InstanceType<typeof WorkspaceDetailSidebar> | null>(null)
const { api } = useApi()
const {
  fetchSnapshot: fetchBoardSnapshot,
  getCached: getBoardCached,
  invalidateCached: invalidateBoardCached,
  isCachedStale: isBoardCacheStale,
  clearCachedStale: clearBoardCacheStale,
  replaceCachedBoardState,
} = useWorkspaceBoardPageData()
const { touchCachedWorkspaceUpdatedAt, getCached: getOrgWorkspaceIndexCached, fetchSnapshot: fetchOrgWorkspaceIndexSnapshot } = useOrgWorkspaceIndexPageData()
const orgWorkspaceIndexRevision = useOrgWorkspaceIndexCacheRevision()
const workspaceMutations = useWorkspaceMutations(slug)
const workspaceDetailsModalOpen = ref(false)
const workspaceDetailsModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const workspaceDetailsPending = ref(false)
const workspaceIndexSnapshot = computed(() => {
  void orgWorkspaceIndexRevision.value
  return getOrgWorkspaceIndexCached(slug.value)
})
const workspaceDetailsLabels = computed(() => workspaceIndexSnapshot.value?.orgLabels ?? [])
const workspaceDetailsLabelCategories = computed(() => workspaceIndexSnapshot.value?.orgLabelCategories ?? [])
const workspaceDetailsOrgMembers = computed(() => workspaceIndexSnapshot.value?.orgMembers ?? [])
const workspaceDetailsStatuses = computed(() => (
  workspaceIndexSnapshot.value?.workspaceStatuses
  ?? resolveStandardColors(DEFAULT_WORKSPACE_STATUS_ITEMS)
))
const workspaceDetailsInitialValues = computed(() => toWorkspaceFormInitialValues(workspaceMeta.value))
type Label = WorkspaceBoardLabel
type Task = WorkspaceBoardTask
type ListDef = {
  key: string
  title: string
  listId: number
  color: string
  color_index: number
}
const tasks = ref<Task[] | null>(null)
const tasksByList = reactive<Record<string, Task[]>>({})
const error = ref<string | null>(null)
const pending = ref(false)
const pageReady = ref(false)
const boardShouldFadeIn = ref(false)
const fatalLoadError = ref<string | null>(null)
let boardInitialRevealDone = false
let boardFadeInTimer: ReturnType<typeof setTimeout> | null = null
const searchQuery = defineModel<string>('searchQuery', { default: '' })
const { sidebarOpen, toggleSidebar, hydrateSidebarPreference } = useUiSidebarPreference('workspace')
const archivedModalOpen = ref(false)
const archivedDocumentsOpen = ref(false)
const archivedModalRef = ref<InstanceType<typeof ArchivedTasksModal> | null>(null)
const subheaderMenuTriggerRef = ref<HTMLElement | null>(null)
const boardFilterTriggerRef = ref<HTMLElement | null>(null)
function setBoardFilterTriggerRef (comp: { el?: HTMLElement | null } | null) {
  boardFilterTriggerRef.value = comp?.el ?? null
}
const boardFilterDropdownRef = ref<InstanceType<typeof BoardFilterPopover> | null>(null)
const SUBHEADER_MENU_MIN_WIDTH = 200
const taskFilters = defineModel<WorkspaceTaskFilters>('taskFilters', {
  default: () => createEmptyWorkspaceTaskFilters(),
})
const listFormOpen = ref(false)
const listFormLoading = ref(false)
const listModalMode = ref<'add' | 'edit'>('add')
const listEditTarget = ref<ListDef | null>(null)
const listFormModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const listDeleteOpen = ref(false)
const listDeleteLoading = ref(false)
const listDeleteTarget = ref<ListDef | null>(null)
const listDeleteModalRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
const LIST_HEADER_MENU_MIN_WIDTH = 168
const listMenu = useFloatingMenuState<string>({
  menuMinWidth: LIST_HEADER_MENU_MIN_WIDTH,
  getMenuItemCount: () => listMenuItems.value.length,
})
const openListMenuKey = listMenu.openId
const listMenuPosition = listMenu.position
const pendingListMenuOpen = listMenu.pendingOpen
const taskAddOpen = ref(false)
const taskAddListId = ref<number | null>(null)
const taskAddParentTaskId = ref<number | null>(null)
const taskAddParentDefaults = ref<TaskFormDefaultsSource | null>(null)
/** 詳細→追加のフェードアウト時間（TaskDetailModal.scss の leave と揃える） */
const MODAL_FADE_OUT_MS = 120
const addChildTaskTransitionPending = ref(false)
const lists = ref<ListDef[]>([])
const orgLabels = ref<Label[]>([])
const orgLabelCategories = ref<WorkspaceBoardLabelCategory[]>([])
const workspaceMembersSnapshot = ref<TaskDetailMember[]>([])
const { workspaceMembers } = useWorkspaceTaskMemberCandidates(
  slug,
  workspaceId,
  workspaceMembersSnapshot,
)
const {
  assigneeFilterSelected,
  labelFilterSelected,
  scheduleFilterSelected,
  scheduleFilterOptions,
  assigneeFilterSearchQuery,
  labelFilterSearchQuery,
  filterSectionsOpen,
  hasActiveFilters: hasActiveBoardFilters,
  filteredAssigneeFilterMembers,
  labelFilterCategories,
  isAssigneeFilterSelected,
  setAssigneeFilter,
  isLabelFilterSelected,
  toggleLabelFilter,
  isScheduleFilterSelected,
  toggleScheduleFilter,
  clearFilters: clearBoardFilters,
  clearFilterSearchQueries,
  matchesFilters,
} = useWorkspaceTaskFilters(taskFilters, {
  members: workspaceMembers,
  labelCategories: orgLabelCategories,
})
const subheaderMenu = useFloatingMenuState<'subheader'>({
  menuMinWidth: SUBHEADER_MENU_MIN_WIDTH,
  getMenuItemCount: () => subheaderMenuItems.value.length,
  placement: 'below-end',
})
const subheaderMenuOpen = computed({
  get: () => subheaderMenu.openId.value !== null,
  set: (open: boolean) => {
    if (!open) {
      subheaderMenu.close()
    }
  },
})
const subheaderMenuPosition = subheaderMenu.position
const {
  open: boardFilterOpen,
  style: boardFilterStyle,
  close: closeBoardFilter,
  openPopover: openBoardFilterBase,
  onAfterLeave: onBoardFilterAfterLeave,
  onSectionToggle: onFilterSectionToggle,
  isTriggerAvailable: isBoardFilterTriggerAvailable,
} = useAnchoredFilterPopover({
  triggerRef: boardFilterTriggerRef,
  dropdownRef: boardFilterDropdownRef,
  useEscapeClose: false,
  onClose: clearFilterSearchQueries,
  onBeforeOpen: () => {
    subheaderMenu.close()
  },
  repositionSources: [assigneeFilterSearchQuery, labelFilterSearchQuery],
})
const boardParentTasks = ref<Array<{ id: number; title: string }>>([])
const taskAttachmentsByTaskId = ref<TaskAttachmentsByTaskId>({})
const editingListKey = ref<string | null>(null)
const listEditDrafts = reactive<Record<string, string>>({})
const listRenamePending = ref(false)
const listReorderPending = ref(false)
const listColumnDragging = ref(false)
/** Sortable DOM と lists のズレ解消用（ドラッグ完了後にインクリメント） */
const listSortableEpoch = ref(0)
/** リストヘッダーのドラッグ直後にタイトル click で編集が開くのを防ぐ */
const suppressListTitleClick = ref(false)
/** カードドラッグ直後に click で詳細が開くのを防ぐ */
const suppressTaskCardClick = ref(false)
let listOrderSnapshot: ListDef[] | null = null
/** リスト列ドラッグ中のポインタ X（列判定は Y 非依存） */
let listColumnDragPointerX = 0
/** ドラッグ中のリスト列 key */
let listColumnDragSourceKey: string | null = null
/** ドラッグ中に最後にプレビュー反映した並び */
let listColumnDragPreviewOrder: ListDef[] | null = null
/** ドロップ確定〜Sortable 後処理までの正しい並び（プレビューと同一） */
let listColumnDragFinalOrder: ListDef[] | null = null
let listColumnDragCommitting = false
let listColumnDragPreviewRaf = 0
const editingTaskId = ref<number | null>(null)
const taskTitleDraft = ref('')
const taskRenamePending = ref(false)
const boardMutationPending = computed(() => (
  listRenamePending.value
  || listReorderPending.value
  || taskRenamePending.value
))
syncAppLoadingCursor(boardMutationPending)
const justCreatedTasks = useTransientIdFlash<number>()
const justCreatedLists = useTransientIdFlash<string>()
const justCreatedTaskIds = justCreatedTasks.ids
const justCreatedListKeys = justCreatedLists.ids
const boardDragging = ref(false)
const scrollableDropZoneListKeys = reactive<Record<string, boolean>>({})
let boardDragPointerX = 0
let boardDragPointerY = 0
let boardDragTaskId: number | null = null
/** ドラッグ中カードの表示サイズ（リスト内プレースホルダ用） */
let boardDragCardWidthPx = 0
let boardDragCardHeightPx = 0
/** Sortable が確定した移動先リスト */
let boardDragLastToListKey: string | null = null
/** ドラッグ開始時のリスト key */
const boardDragStartListKey = ref<string | null>(null)
/** 他リスト上にホバー中（ソース列のプレースホルダ抑止） */
const boardDragCrossList = ref(false)
/** プレビュー表示先リスト（常に1列のみ） */
const boardDragPreviewListKey = ref<string | null>(null)
/** sortable＝カード間、tail＝一覧最下部（composer より下） */
const boardDragPreviewMode = ref<'sortable' | 'tail' | null>(null)
/** ドラッグ終了時フォールバック用の最終プレビュー列 */
let boardDragStickyColumnKey: string | null = null
/** キーボードショートカット用の最新ポインタ位置 */
let boardPointerX = 0
let boardPointerY = 0
const {
  pageCssVars: boardPageCssVars,
  updateStickyOffsets,
  bindStickyOffsets,
  unbindStickyOffsets,
} = useStickyHeaderOffsets({ autoBind: false })
const CARD_MENU_MIN_WIDTH = 168
const cardMenu = useFloatingMenuState<number>({
  menuMinWidth: CARD_MENU_MIN_WIDTH,
  getMenuItemCount: () => cardMenuItems.value.length,
})
const openCardMenuTaskId = cardMenu.openId
const cardMenuPosition = cardMenu.position
const pendingCardMenuOpen = cardMenu.pendingOpen
const archiveConfirmTask = ref<Task | null>(null)
const archiveConfirmTaskOpen = computed({
  get: () => archiveConfirmTask.value !== null,
  set: (open: boolean) => {
    if (!open) archiveConfirmTask.value = null
  },
})
const archiveConfirmTaskMessage = computed(() => {
  const task = archiveConfirmTask.value
  if (!task) return ''
  const childCount = (tasks.value ?? []).filter(row => row.parent_task_id === task.id).length
  return buildDestructiveConfirmMessage(
    'タスク',
    'アーカイブ',
    task.title,
    childCount > 0 ? `※子タスク ${childCount} 件もアーカイブされます。` : null,
  )
})
const workspaceArchiveConfirmOpen = ref(false)
const workspaceArchivePending = ref(false)
const workspaceArchiveConfirmMessage = computed(() =>
  buildDestructiveConfirmMessage('スペース', 'アーカイブ', workspaceMetaName.value),
)
const detailTaskId = ref<number | null>(null)
const detailModalRemotePatch = ref<TaskDetail | null>(null)
const detailModalRemoteRev = ref(0)
const detailInitialTask = computed((): TaskDetail | null => {
  const id = detailTaskId.value
  if (id === null || !tasks.value) {
    return null
  }
  const row = tasks.value.find(task => task.id === id)
  if (!row) {
    return null
  }
  const baseDetail: TaskDetail = boardTaskToTaskDetail(row, orgLabels.value)
  return enrichTaskDetailHierarchy(
    baseDetail,
    tasks.value,
    listId => lists.value.find(list => list.listId === listId)?.title ?? null,
  )
})
const detailHierarchyTasks = computed(() => {
  if (!tasks.value) {
    return null
  }
  return tasks.value.map(task => ({
    id: task.id,
    title: task.title,
    is_parent_task: task.is_parent_task,
    parent_task_id: task.parent_task_id ?? null,
    parent_task_title: resolveParentTaskTitle(task, tasks.value ?? []),
    start_date: task.start_date ?? null,
    due_date: task.due_date ?? null,
    effort_hours: task.effort_hours ?? null,
    progress_rate: task.progress_rate ?? null,
    labels: task.labels ?? [],
    assignees: task.assignees ?? [],
    list_id: task.list_id,
    list_name: lists.value.find(list => list.listId === task.list_id)?.title ?? null,
    list_color: lists.value.find(list => list.listId === task.list_id)?.color ?? null,
    sort_order: task.sort_order,
  }))
})
const detailWorkspaceLists = computed((): WorkspaceListOption[] => {
  return lists.value.map(list => ({
    id: list.listId,
    name: list.title,
    color: list.color,
    color_index: list.color_index,
  }))
})
const detailInitialAttachments = computed((): TaskAttachmentItem[] | null => {
  const id = detailTaskId.value
  if (id === null) {
    return null
  }
  return taskAttachmentsByTaskId.value[String(id)] ?? []
})
const taskDetailOpen = computed({
  get: () => detailTaskId.value !== null,
  set: (open: boolean) => {
    if (!open) {
      detailTaskId.value = null
      clearTaskQueryParam()
    }
  },
})
const cardMenuStyle = cardMenu.style
const openMenuTask = computed(() => {
  const id = openCardMenuTaskId.value
  if (id == null || !tasks.value) {
    return null
  }
  return tasks.value.find(t => t.id === id) ?? null
})
const subheaderMenuStyle = subheaderMenu.style
const openListMenuList = computed(() => {
  const key = openListMenuKey.value
  if (!key) {
    return null
  }
  return lists.value.find(list => list.key === key) ?? null
})
const listMenuStyle = listMenu.style
const listModalInitialValues = computed(() => {
  if (listModalMode.value !== 'edit' || !listEditTarget.value) {
    return null
  }
  return {
    name: listEditTarget.value.title,
    color_index: listEditTarget.value.color_index,
  }
})
const filteredTaskIds = computed<Set<number> | null>(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return null
  const ids = new Set<number>()
  for (const task of tasks.value ?? []) {
    if (task.title.toLowerCase().includes(query)) ids.add(task.id)
  }
  return ids
})
function isTaskVisible (task: Task) {
  const ids = filteredTaskIds.value
  const byQuery = !ids || ids.has(task.id)
  if (!byQuery) {
    return false
  }
  return matchesFilters(task)
}
const visibleTaskIdSet = computed(() => {
  const ids = new Set<number>()
  for (const task of tasks.value ?? []) {
    if (isTaskVisible(task)) {
      ids.add(task.id)
    }
  }
  return ids
})
function visibleCount (listKey: string) {
  const cards = tasksByList[listKey] ?? []
  return cards.filter(task => visibleTaskIdSet.value.has(task.id)).length
}
/** 空リスト用の余白スタイル（ドラッグ中のソース列の見かけの空きも含む） */
function isListColumnEmpty (listKey: string): boolean {
  const count = visibleCount(listKey)
  if (!boardDragging.value) {
    return count === 0
  }
  // プレビューがこの列 → カードが戻ってきた扱いで通常余白
  if (boardDragPreviewListKey.value === listKey) {
    return false
  }
  // ソース列から他列へプレビュー移動中（最後の1枚を運んでいるとき）
  if (
    boardDragStartListKey.value === listKey
    && boardDragCrossList.value
  ) {
    if (count === 0) {
      return true
    }
    if (count === 1 && boardDragTaskId != null) {
      return (tasksByList[listKey] ?? []).some(
        t => t.id === boardDragTaskId && isTaskVisible(t),
      )
    }
  }
  return count === 0
}
const visibleTaskCount = computed(() => visibleTaskIdSet.value.size)
const anyBoardDropdownOpen = computed(() => (
  boardFilterOpen.value
  || subheaderMenuOpen.value
  || openCardMenuTaskId.value !== null
  || openListMenuKey.value !== null
))
function closeAnyBoardDropdown () {
  closeBoardFilter()
  closeSubheaderMenu()
  closeCardMenu()
  closeListMenu()
}
useDropdownEscapeClose(anyBoardDropdownOpen, closeAnyBoardDropdown)
function rebuildBoardFromTasks () {
  for (const key of Object.keys(tasksByList)) {
    delete tasksByList[key]
  }
  for (const list of lists.value) {
    tasksByList[list.key] = []
  }
  for (const task of tasks.value ?? []) {
    const key = task.list_id === null ? '' : `list_${task.list_id}`
    if (!key || !tasksByList[key]) continue
    tasksByList[key].push(task)
  }
  for (const list of lists.value) {
    const arr = tasksByList[list.key]
    if (!arr?.length) continue
    arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id)
  }
}
function isTaskJustCreated (taskId: number): boolean {
  return justCreatedTasks.has(taskId)
}
function markTaskAsJustCreated (taskId: number) {
  justCreatedTasks.mark(taskId)
}
function isListJustCreated (listKey: string): boolean {
  return justCreatedLists.has(listKey)
}
function markListAsJustCreated (listKey: string) {
  justCreatedLists.mark(listKey)
}
function openListAddModal () {
  closeSubheaderMenu()
  closeBoardFilter()
  closeListMenu()
  listModalMode.value = 'add'
  listEditTarget.value = null
  listFormOpen.value = true
}
function openListEditModal (list: ListDef) {
  closeListMenu()
  listModalMode.value = 'edit'
  listEditTarget.value = list
  listFormOpen.value = true
}
function openListDeleteModal (list: ListDef) {
  closeListMenu()
  listDeleteTarget.value = list
  listDeleteOpen.value = true
}
const subheaderMenuItems = computed<FloatingMenuItem[]>(() => {
  const items: FloatingMenuItem[] = [
    { key: 'details-workspace', label: 'スペース詳細' },
    { key: 'add-list', label: 'リストの追加' },
    { key: 'archived', label: 'アーカイブ済みタスク' },
    { key: 'archived-documents', label: 'アーカイブ済み資料' },
  ]
  if (isOrgAdmin.value) {
    items.push({ key: 'archive-workspace', label: 'スペースのアーカイブ', danger: true })
  }
  return items
})
const cardMenuItems = computed<FloatingMenuItem[]>(() => {
  const items: FloatingMenuItem[] = [
    { key: 'detail', label: 'タスク詳細' },
  ]
  if (isOrgAdmin.value) {
    items.push({ key: 'archive', label: 'タスクのアーカイブ', danger: true })
  }
  return items
})
const listMenuItems = computed<FloatingMenuItem[]>(() => {
  const items: FloatingMenuItem[] = [
    { key: 'edit', label: 'リストの編集' },
  ]
  if (lists.value.length > 1) {
    items.push({ key: 'delete', label: 'リストの削除', danger: true })
  }
  return items
})
function onSubheaderMenuSelect (item: FloatingMenuItem) {
  if (item.key === 'details-workspace') {
    void openWorkspaceDetailsModal()
    return
  }
  if (item.key === 'add-list') {
    openListAddModal()
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
function openWorkspaceArchiveConfirm () {
  closeSubheaderMenu()
  workspaceArchiveConfirmOpen.value = true
}
async function openWorkspaceDetailsModal () {
  closeSubheaderMenu()
  if (!getOrgWorkspaceIndexCached(slug.value)) {
    await fetchOrgWorkspaceIndexSnapshot(slug.value).catch(() => null)
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
      workspaceDetailsModalOpen.value = false
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '更新に失敗しました'
    error.value = message
    workspaceDetailsModalRef.value?.setSubmitError(message)
  } finally {
    workspaceDetailsPending.value = false
  }
}
async function confirmWorkspaceArchive () {
  if (workspaceArchivePending.value) {
    return
  }
  workspaceArchivePending.value = true
  error.value = null
  try {
    await withAppLoadingCursor(async () => {
      await workspaceMutations.archiveWorkspace(Number(workspaceId.value))
      workspaceArchiveConfirmOpen.value = false
      await navigateTo(`/org/${slug.value}/workspaces`)
    })
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'アーカイブに失敗しました'
  } finally {
    workspaceArchivePending.value = false
  }
}
function onCardMenuSelect (item: FloatingMenuItem) {
  const task = openMenuTask.value
  if (!task) return
  if (item.key === 'detail') {
    openTaskDetail(task)
    return
  }
  if (item.key === 'archive') {
    openArchiveConfirm(task)
  }
}
function onListMenuSelect (item: FloatingMenuItem) {
  const list = openListMenuList.value
  if (!list) return
  if (item.key === 'edit') {
    openListEditModal(list)
    return
  }
  if (item.key === 'delete') {
    openListDeleteModal(list)
  }
}
const closeListMenu = listMenu.close
const onListMenuAfterLeave = listMenu.onAfterLeave
function toggleListMenu (listKey: string, event: MouseEvent) {
  event.stopPropagation()
  listMenu.toggle(listKey, event)
}
function closeSubheaderMenu () {
  subheaderMenu.close()
}
function toggleSubheaderMenu () {
  if (subheaderMenuOpen.value) {
    closeSubheaderMenu()
    return
  }
  closeBoardFilter()
  const anchor = subheaderMenuTriggerRef.value
  if (!anchor) {
    return
  }
  subheaderMenu.open('subheader', anchor)
}
function openBoardFilter () {
  openBoardFilterBase()
}
function toggleBoardFilter () {
  if (boardFilterOpen.value) {
    closeBoardFilter()
    return
  }
  openBoardFilter()
}
const closeCardMenu = cardMenu.close
const onCardMenuAfterLeave = cardMenu.onAfterLeave
function onDropZoneScroll () {
  closeCardMenu()
  closeListMenu()
}
function openCardMenu (taskId: number, anchor: HTMLElement) {
  cardMenu.open(taskId, anchor)
}
function toggleCardMenu (taskId: number, ev: MouseEvent) {
  ev.stopPropagation()
  cardMenu.toggle(taskId, ev)
}
function onTaskCardContextMenu (task: Task, ev: MouseEvent) {
  if (editingTaskId.value === task.id) return
  cardMenu.openFromContextMenu(task.id, ev)
}
function onWindowResize () {
  closeCardMenu()
  closeSubheaderMenu()
  closeBoardFilter()
  closeListMenu()
  updateStickyOffsets()
  updateDropZoneScrollableState()
}
function updateDropZoneScrollableState () {
  if (!import.meta.client) {
    return
  }
  nextTick(() => {
    const nextScrollable: Record<string, boolean> = {}
    const columns = document.querySelectorAll<HTMLElement>('.list-column[data-list-key]')
    columns.forEach((column) => {
      const listKey = column.dataset.listKey
      if (!listKey) {
        return
      }
      const dropZone = column.querySelector<HTMLElement>('.list-drop-zone')
      if (!dropZone) {
        nextScrollable[listKey] = false
        return
      }
      nextScrollable[listKey] = dropZone.scrollHeight > dropZone.clientHeight + 1
    })
    for (const key of Object.keys(scrollableDropZoneListKeys)) {
      delete scrollableDropZoneListKeys[key]
    }
    for (const [key, scrollable] of Object.entries(nextScrollable)) {
      scrollableDropZoneListKeys[key] = scrollable
    }
  })
}
function openArchiveConfirm (task: Task) {
  closeCardMenu()
  editingTaskId.value = null
  archiveConfirmTask.value = task
}
function openTaskDetail (task: Task) {
  if (editingTaskId.value === task.id || suppressTaskCardClick.value) return
  closeCardMenu()
  openTaskDetailById(task.id)
}
function openTaskDetailById (taskId: number) {
  detailTaskId.value = taskId
  syncTaskQueryParam(taskId)
}
function parseTaskQueryId (): number | null {
  const raw = route.query.task
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}
function syncTaskQueryParam (taskId: number) {
  if (!import.meta.client) return
  const current = parseTaskQueryId()
  if (current === taskId) return
  void router.replace({
    query: {
      ...route.query,
      task: String(taskId),
    },
  })
}
function clearTaskQueryParam () {
  if (!import.meta.client) return
  if (parseTaskQueryId() === null) return
  const nextQuery = { ...route.query }
  delete nextQuery.task
  void router.replace({ query: nextQuery })
}
function applyTaskQueryFromRoute () {
  if (!pageReady.value) return
  const raw = route.query.task
  if (raw != null && raw !== '') {
    const taskId = parseTaskQueryId()
    if (taskId === null) {
      void navigateTo(`/org/${slug.value}/workspaces`, { replace: true })
      return
    }
    if (detailTaskId.value !== taskId) {
      detailTaskId.value = taskId
    }
    return
  }
}
function onTaskDetailMissing () {
  detailTaskId.value = null
  void navigateTo(`/org/${slug.value}/workspaces`, { replace: true })
}
function onTaskDetailNavigate (taskId: number) {
  if (detailTaskId.value === taskId) {
    return
  }
  openTaskDetailById(taskId)
}
function pushDetailModalRemote (detail: TaskDetail) {
  if (detailTaskId.value !== detail.id) {
    return
  }
  detailModalRemotePatch.value = detail
  detailModalRemoteRev.value += 1
}
function onTaskAttachmentsUpdated (payload: { taskId: number; attachments: TaskAttachmentItem[] }) {
  taskAttachmentsByTaskId.value = {
    ...taskAttachmentsByTaskId.value,
    [String(payload.taskId)]: payload.attachments,
  }
}
function onTaskDetailUpdated (detail: TaskDetail) {
  if (!tasks.value) return
  const idx = tasks.value.findIndex(t => t.id === detail.id)
  if (idx < 0) return
  const existing = tasks.value[idx]
  if (!existing) return
  const updated: Task = {
    ...existing,
    title: detail.title,
    description: detail.description ?? null,
    list_id: detail.list_id,
    sort_order: detail.sort_order ?? existing.sort_order,
    start_date: 'start_date' in detail ? detail.start_date : existing.start_date,
    due_date: 'due_date' in detail ? detail.due_date : existing.due_date,
    effort_hours: 'effort_hours' in detail ? detail.effort_hours : existing.effort_hours,
    progress_rate: 'progress_rate' in detail ? detail.progress_rate : existing.progress_rate,
    labels: detail.labels,
    assignees: detail.assignees,
    checklists: 'checklists' in detail ? (detail.checklists ?? []) : (existing.checklists ?? []),
    parent_task_id: 'parent_task_id' in detail ? detail.parent_task_id ?? null : existing.parent_task_id,
    is_parent_task: 'is_parent_task' in detail ? detail.is_parent_task ?? false : existing.is_parent_task,
  }
  const boardLayoutChanged = (
    updated.title !== existing.title
    || (updated.description ?? null) !== (existing.description ?? null)
    || updated.list_id !== existing.list_id
    || (updated.sort_order ?? null) !== (existing.sort_order ?? null)
    || (updated.start_date ?? null) !== (existing.start_date ?? null)
    || (updated.due_date ?? null) !== (existing.due_date ?? null)
    || (updated.effort_hours ?? null) !== (existing.effort_hours ?? null)
    || (updated.progress_rate ?? null) !== (existing.progress_rate ?? null)
    || (updated.parent_task_id ?? null) !== (existing.parent_task_id ?? null)
    || Boolean(updated.is_parent_task) !== Boolean(existing.is_parent_task)
    || JSON.stringify(updated.labels ?? []) !== JSON.stringify(existing.labels ?? [])
    || JSON.stringify(updated.assignees ?? []) !== JSON.stringify(existing.assignees ?? [])
  )
  tasks.value.splice(idx, 1, updated)
  if (boardLayoutChanged) {
    rebuildBoardFromTasks()
  }
  syncBoardPageCache()
}
function removeTaskFromBoard (taskId: number, options?: { removeChildTasks?: boolean }) {
  if (!tasks.value) return
  const removeChildTasks = options?.removeChildTasks ?? false
  const removeIds = new Set<number>([taskId])
  if (removeChildTasks) {
    for (const task of tasks.value) {
      if (task.parent_task_id === taskId) {
        removeIds.add(task.id)
      }
    }
  }
  tasks.value = tasks.value.filter(task => !removeIds.has(task.id))
  rebuildBoardFromTasks()
  syncBoardPageCache()
}
function onArchivedTaskRestored (task: Task, cascadedChildren: ArchivedTask[] = []) {
  if (!tasks.value?.some(t => t.id === task.id)) {
    addTaskToBoard(task)
  }
  for (const child of cascadedChildren) {
    if (tasks.value?.some(t => t.id === child.id)) {
      continue
    }
    addTaskToBoard({
      id: child.id,
      title: child.title,
      list_id: child.list_id,
      sort_order: 0,
      is_parent_task: false,
      parent_task_id: task.id,
      parent_task_title: task.title,
      start_date: child.start_date ?? null,
      due_date: child.due_date ?? null,
      effort_hours: child.effort_hours ?? null,
      progress_rate: child.progress_rate ?? null,
      labels: child.labels ?? [],
      assignees: child.assignees ?? [],
    } as Task)
  }
}
function addTaskToBoard (task: Task) {
  if (!tasks.value) {
    tasks.value = []
  }
  tasks.value.push(task)
  rebuildBoardFromTasks()
  syncBoardPageCache()
}
function applyTasksReordered (listId: number, taskIds: number[]) {
  if (!tasks.value) {
    return
  }
  taskIds.forEach((id, index) => {
    const task = tasks.value?.find(t => t.id === id)
    if (task) {
      task.sort_order = index
    }
  })
  rebuildBoardFromTasks()
  syncBoardPageCache()
}
function applyListsReordered (listIds: number[]) {
  const orderMap = new Map(listIds.map((id, index) => [id, index]))
  lists.value.sort((a, b) => {
    const aOrder = orderMap.get(a.listId) ?? Number.MAX_SAFE_INTEGER
    const bOrder = orderMap.get(b.listId) ?? Number.MAX_SAFE_INTEGER
    return aOrder - bOrder
  })
}
async function confirmArchiveFromModal () {
  const task = archiveConfirmTask.value
  if (!task) return
  archiveConfirmTask.value = null
  const boardTasks = tasks.value ?? []
  const snapshot = { ...task }
  const parentTaskTitle = snapshot.parent_task_title
    ?? resolveParentTaskTitle(snapshot, boardTasks)
  const childSnapshots = boardTasks.filter(row => row.parent_task_id === task.id)
  removeTaskFromBoard(task.id, { removeChildTasks: true })
  error.value = null
  try {
    await api(`/orgs/${slug.value}/workspaces/${workspaceId.value}/tasks/${task.id}/archive`, {
      method: 'POST',
    })
    archivedModalRef.value?.addTaskFromRealtime({
      id: snapshot.id,
      title: snapshot.title,
      list_id: snapshot.list_id,
      archived_at: new Date().toISOString(),
      labels: snapshot.labels ?? [],
      assignees: snapshot.assignees ?? [],
      start_date: snapshot.start_date ?? null,
      due_date: snapshot.due_date ?? null,
      effort_hours: snapshot.effort_hours ?? null,
      progress_rate: snapshot.progress_rate ?? null,
      is_parent_task: snapshot.is_parent_task ?? false,
      parent_task_id: snapshot.parent_task_id ?? null,
      parent_task_title: parentTaskTitle,
      archived_child_count: childSnapshots.length,
      archived_children: childSnapshots.map(child => ({
        id: child.id,
        title: child.title,
        list_id: child.list_id,
        archived_at: new Date().toISOString(),
        labels: child.labels ?? [],
        assignees: child.assignees ?? [],
        start_date: child.start_date ?? null,
        due_date: child.due_date ?? null,
        effort_hours: child.effort_hours ?? null,
        progress_rate: child.progress_rate ?? null,
        is_parent_task: false,
        parent_task_id: snapshot.id,
        parent_task_title: snapshot.title,
        archived_child_count: 0,
        archived_children: [],
      })),
    })
  } catch (e: unknown) {
    addTaskToBoard(snapshot)
    for (const child of childSnapshots) {
      addTaskToBoard(child)
    }
    error.value = e instanceof Error ? e.message : 'アーカイブに失敗しました'
  }
}
async function updateTaskList (taskId: number, listId: number) {
  return await api<Task>(`/orgs/${slug.value}/workspaces/${workspaceId.value}/tasks/${taskId}`, {
    method: 'PATCH',
    body: { list_id: listId },
  })
}
async function persistListTaskOrder (listKey: string) {
  const list = lists.value.find(l => l.key === listKey)
  if (!list) {
    return
  }
  const taskIds = (tasksByList[listKey] ?? []).map(t => t.id)
  await api<{ data: { ok: boolean } }>(
    `/orgs/${slug.value}/workspaces/${workspaceId.value}/lists/${list.listId}/tasks/reorder`,
    {
      method: 'PATCH',
      body: { task_ids: taskIds },
    },
  )
  taskIds.forEach((id, index) => {
    const task = tasks.value?.find(t => t.id === id)
    if (task) {
      task.sort_order = index
    }
  })
}
function getTaskIdFromDragEl (el: HTMLElement): number | null {
  const raw = el.dataset.taskId
    ?? el.closest('.task-card')?.getAttribute('data-task-id')
  if (!raw) {
    return null
  }
  const id = Number(raw)
  return Number.isFinite(id) ? id : null
}
function getBoardListColumns (): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('.board-lists-sortable .list-column[data-list-key]'),
  )
}
function getListColumnDragElement (): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    '.list-column.drag-active, .list-column.sortable-fallback',
  )
}
/** ドラッグ中リストの水平位置（浮遊要素の中心 X を優先） */
function resolveListColumnDragProbeX (): number {
  const dragEl = getListColumnDragElement()
  if (dragEl) {
    const rect = dragEl.getBoundingClientRect()
    return rect.left + rect.width / 2
  }
  return listColumnDragPointerX
}
function isListColumnHitTestTarget (col: HTMLElement): boolean {
  return !col.classList.contains('drag-active')
    && !col.classList.contains('sortable-fallback')
}
function findListColumnByKey (listKey: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.list-column[data-list-key="${listKey}"]`)
}
/** ポインタ直下の表示中タスク（カード上にカーソルがあるとき） */
function resolvePointerTask (): Task | null {
  if (!import.meta.client || !tasks.value) {
    return null
  }
  const hitEl = document.elementFromPoint(boardPointerX, boardPointerY)
  if (!(hitEl instanceof Element)) {
    return null
  }
  const cardEl = hitEl.closest('.task-card[data-task-id]')
  if (!(cardEl instanceof HTMLElement)) {
    return null
  }
  const taskId = getTaskIdFromDragEl(cardEl)
  if (taskId === null) {
    return null
  }
  const task = tasks.value.find(row => row.id === taskId) ?? null
  if (!task || !isTaskVisible(task)) {
    return null
  }
  return task
}
/** ポインタ位置が属するリスト ID（列内・列下の余白も含む） */
function resolvePointerListId (): number | null {
  if (!import.meta.client) {
    return null
  }
  const clientX = boardPointerX
  const clientY = boardPointerY
  const hitEl = document.elementFromPoint(clientX, clientY)
  const columnFromHit = hitEl?.closest('.list-column[data-list-key]')
  if (columnFromHit instanceof HTMLElement) {
    const listKey = columnFromHit.dataset.listKey
    if (listKey) {
      return lists.value.find(list => list.key === listKey)?.listId ?? null
    }
  }
  const listKey = getListKeyAtClientX(clientX)
  if (!listKey) {
    return null
  }
  const column = findListColumnByKey(listKey)
  if (!column) {
    return null
  }
  const columns = getBoardListColumns()
  const columnIndex = columns.findIndex(col => col.dataset.listKey === listKey)
  const bounds = columnIndex >= 0 ? getListColumnHitBounds(columns, columnIndex) : null
  if (!bounds) {
    return null
  }
  const colTop = column.getBoundingClientRect().top
  if (clientX >= bounds.left && clientX <= bounds.right && clientY >= colTop) {
    return lists.value.find(list => list.key === listKey)?.listId ?? null
  }
  return null
}
function syncBoardPointer (event: MouseEvent | PointerEvent) {
  boardPointerX = event.clientX
  boardPointerY = event.clientY
}
function onBoardPointerMove (event: MouseEvent | PointerEvent) {
  syncBoardPointer(event)
}
function dismissBoardPopovers () {
  closeSubheaderMenu()
  closeBoardFilter()
  closeCardMenu()
  closeListMenu()
}
function canUseBoardKeyboardShortcut (): boolean {
  if (!pageReady.value || fatalLoadError.value) {
    return false
  }
  if (
    taskAddOpen.value
    || taskDetailOpen.value
    || addChildTaskTransitionPending.value
    || archivedModalOpen.value
    || archivedDocumentsOpen.value
    || workspaceSidebarRef.value?.documentAddModalOpen
    || listFormOpen.value
    || listDeleteOpen.value
    || archiveConfirmTaskOpen.value
    || workspaceArchiveConfirmOpen.value
    || editingListKey.value
    || editingTaskId.value
    || boardDragging.value
    || listColumnDragging.value
    || pending.value
  ) {
    return false
  }
  return !getTopmostModalOverlay()
}
function onBoardKeydown (event: KeyboardEvent) {
  const key = event.key
  if (key === 'Enter') {
    if (isViewShortcutModifierBlocked(event)) {
      return
    }
    if (isKeyboardShortcutBlockedTarget(event.target)) {
      return
    }
    if (!canUseBoardKeyboardShortcut()) {
      return
    }
    const task = resolvePointerTask()
    if (!task) {
      return
    }
    event.preventDefault()
    dismissBoardPopovers()
    openTaskDetail(task)
    return
  }
  const isLetterShortcut = (
    key === 'n' || key === 'N'
    || key === 'f' || key === 'F'
    || key === 'm' || key === 'M'
    || key === 's' || key === 'S'
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
    if (subheaderMenuOpen.value) {
      event.preventDefault()
      closeSubheaderMenu()
      return
    }
    if (!canUseBoardKeyboardShortcut()) {
      return
    }
    event.preventDefault()
    closeCardMenu()
    closeListMenu()
    toggleSubheaderMenu()
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
  if (key === 'd' || key === 'D') {
    if (!canUseBoardKeyboardShortcut()) {
      return
    }
    const openAdd = workspaceSidebarRef.value?.openDocumentAddModal
    if (!openAdd) {
      return
    }
    event.preventDefault()
    dismissBoardPopovers()
    void openAdd()
    return
  }
  if (key === 'f' || key === 'F') {
    if (!isBoardFilterTriggerAvailable()) {
      return
    }
    if (!canUseBoardKeyboardShortcut()) {
      return
    }
    event.preventDefault()
    if (boardFilterOpen.value) {
      closeBoardFilter()
      return
    }
    dismissBoardPopovers()
    openBoardFilter()
    return
  }
  if (!canUseBoardKeyboardShortcut()) {
    return
  }
  event.preventDefault()
  dismissBoardPopovers()
  const listId = resolvePointerListId()
  if (listId !== null) {
    openTaskAddModal(listId)
    return
  }
  openTaskAddFromHeader()
}
/**
 * 隣接列の境界中点で列を決める（nearest / empty-insert による左右のちらつきを防ぐ）。
 * 列間ギャップも必ずどちらか一方の列に属する。
 */
function getListKeyAtClientX (clientX: number): string | null {
  const columns = getBoardListColumns()
  if (!columns.length) {
    return null
  }
  for (let i = 0; i < columns.length - 1; i++) {
    const leftCol = columns[i]
    const rightCol = columns[i + 1]
    if (!leftCol || !rightCol) {
      continue
    }
    const leftRect = leftCol.getBoundingClientRect()
    const rightRect = rightCol.getBoundingClientRect()
    const boundary = (leftRect.right + rightRect.left) / 2
    if (clientX < boundary) {
      return leftCol.dataset.listKey ?? null
    }
  }
  const lastCol = columns[columns.length - 1]
  return lastCol?.dataset.listKey ?? null
}
/** 列の水平ヒット範囲（列幅＋隣接ギャップの半分） */
function getListColumnHitBounds (
  columns: HTMLElement[],
  index: number,
): { left: number, right: number } | null {
  const col = columns[index]
  if (!col) {
    return null
  }
  const rect = col.getBoundingClientRect()
  let left = rect.left
  let right = rect.right
  const prev = columns[index - 1]
  if (prev) {
    const prevRect = prev.getBoundingClientRect()
    left = (prevRect.right + rect.left) / 2
  }
  const next = columns[index + 1]
  if (next) {
    const nextRect = next.getBoundingClientRect()
    right = (rect.right + nextRect.left) / 2
  }
  return { left, right }
}
/**
 * リスト列ドラッグ用: ポインタ X が属する画面上の列スロット index。
 * 列の実幅内を優先し、列間ギャップは隣接列の中点で帰属する。
 */
function getListColumnVisualIndexAtClientX (clientX: number): number | null {
  const columns = getBoardListColumns()
  if (!columns.length) {
    return null
  }
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    if (!col || !isListColumnHitTestTarget(col)) {
      continue
    }
    const rect = col.getBoundingClientRect()
    if (clientX >= rect.left && clientX <= rect.right) {
      return i
    }
  }
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    if (!col || !isListColumnHitTestTarget(col)) {
      continue
    }
    const bounds = getListColumnHitBounds(columns, i)
    if (bounds && clientX >= bounds.left && clientX <= bounds.right) {
      return i
    }
  }
  const fallbackKey = getListKeyAtClientX(clientX)
  if (!fallbackKey) {
    return null
  }
  const idx = columns.findIndex(
    col => isListColumnHitTestTarget(col) && col.dataset.listKey === fallbackKey,
  )
  return idx === -1 ? null : idx
}
function getDropZoneListKey (dropZone: HTMLElement): string | null {
  return dropZone.closest('.list-column[data-list-key]')?.getAttribute('data-list-key') ?? null
}
function syncBoardDragPointer (originalEvent?: Event) {
  if (originalEvent instanceof MouseEvent || originalEvent instanceof PointerEvent) {
    boardDragPointerX = originalEvent.clientX
    boardDragPointerY = originalEvent.clientY
  }
  if (boardDragging.value) {
    syncBoardPreviewState()
  }
}
/** ドラッグ中ポインタが属するリスト（列間ギャップ含め中点で一意に決定） */
function getHoverListKey (originalEvent?: Event): string | null {
  syncBoardDragPointer(originalEvent)
  return getListKeyAtClientX(boardDragPointerX)
}
/** composer より下、または列の白枠より下＝末尾ドロップ帯 */
function isPointerInListTailZone (listColumn: HTMLElement): boolean {
  const colBottom = listColumn.getBoundingClientRect().bottom
  const composer = listColumn.querySelector('.composer')
  if (composer instanceof HTMLElement) {
    const composerBottom = composer.getBoundingClientRect().bottom
    if (boardDragPointerY >= composerBottom - 8) {
      return true
    }
  }
  return boardDragPointerY >= colBottom - 8
}
/** ドラッグ中プレビューを1つに統一（sortable か末尾スロットか） */
function syncBoardPreviewState () {
  if (!boardDragging.value) {
    boardDragPreviewListKey.value = null
    boardDragPreviewMode.value = null
    return
  }
  const clientX = boardDragPointerX
  const listKey = getListKeyAtClientX(clientX)
    ?? boardDragStickyColumnKey
    ?? boardDragStartListKey.value
  if (!listKey) {
    boardDragPreviewListKey.value = null
    boardDragPreviewMode.value = null
    return
  }
  const listColumn = findListColumnByKey(listKey)
  if (!listColumn) {
    boardDragPreviewListKey.value = null
    boardDragPreviewMode.value = null
    return
  }
  boardDragLastToListKey = listKey
  boardDragStickyColumnKey = listKey
  // 空リストは Sortable ゴーストが隣列と奪い合うため常に末尾スロットのみ
  const useTailPreview = isListColumnEmpty(listKey)
    || isPointerInListTailZone(listColumn)
  if (useTailPreview) {
    boardDragPreviewListKey.value = listKey
    boardDragPreviewMode.value = 'tail'
    if (boardDragStartListKey.value && listKey !== boardDragStartListKey.value) {
      boardDragCrossList.value = true
    } else if (boardDragStartListKey.value && listKey === boardDragStartListKey.value) {
      boardDragCrossList.value = false
    }
    removeStraySortableGhosts()
    scheduleSyncDragPlaceholderSize()
    return
  }
  boardDragPreviewMode.value = 'sortable'
  boardDragPreviewListKey.value = listKey
  if (boardDragStartListKey.value && listKey !== boardDragStartListKey.value) {
    boardDragCrossList.value = true
  } else if (boardDragStartListKey.value && listKey === boardDragStartListKey.value) {
    boardDragCrossList.value = false
  }
  scheduleSyncDragPlaceholderSize()
}
/** プレビュー先以外・空リストの Sortable ゴーストを除去（二重・左右ちらつき防止） */
function removeStraySortableGhosts () {
  if (!import.meta.client || !boardDragging.value) {
    return
  }
  const canonical = boardDragPreviewListKey.value ?? getListKeyAtClientX(boardDragPointerX)
  const tailMode = boardDragPreviewMode.value === 'tail'
  document.querySelectorAll('.list-drop-zone > .sortable-ghost').forEach((el) => {
    if (el.classList.contains('drag-ghost--tail-preview')) {
      return
    }
    const listKey = el.closest('.list-column[data-list-key]')?.getAttribute('data-list-key')
    const stray = tailMode
      || !canonical
      || !listKey
      || listKey !== canonical
      || isListColumnEmpty(listKey)
    if (stray) {
      el.remove()
    }
  })
}
function updateBoardDragPointer (clientX: number, clientY: number) {
  boardDragPointerX = clientX
  boardDragPointerY = clientY
  syncBoardPreviewState()
}
function onBoardDragPointerMove (event: PointerEvent | MouseEvent) {
  updateBoardDragPointer(event.clientX, event.clientY)
  removeStraySortableGhosts()
  syncDragElementSizes()
}
function onBoardNativeDragOver (event: DragEvent) {
  updateBoardDragPointer(event.clientX, event.clientY)
  event.preventDefault()
}
function onDocumentSelectStart (event: Event) {
  if (boardDragging.value || listColumnDragging.value) {
    event.preventDefault()
  }
}
function findUniqueListKeyForTask (taskId: number): string | null {
  let found: string | null = null
  for (const list of lists.value) {
    if (tasksByList[list.key]?.some(t => t.id === taskId)) {
      if (found !== null) {
        return null
      }
      found = list.key
    }
  }
  return found
}
function reconcileTaskPlacement (taskId: number, canonicalListKey: string) {
  for (const list of lists.value) {
    if (list.key === canonicalListKey) {
      continue
    }
    const arr = tasksByList[list.key]
    if (!arr?.length) {
      continue
    }
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i]?.id === taskId) {
        arr.splice(i, 1)
      }
    }
  }
  const task = tasks.value?.find(t => t.id === taskId)
  const canonical = tasksByList[canonicalListKey]
  if (task && canonical && !canonical.some(t => t.id === taskId)) {
    canonical.push(task)
  }
}
async function persistTaskListChange (taskId: number, listKey: string) {
  const list = lists.value.find(l => l.key === listKey)
  const task = tasks.value?.find(t => t.id === taskId)
  if (!list || !task || task.list_id === list.listId) {
    return
  }
  const prevListId = task.list_id
  task.list_id = list.listId
  try {
    await updateTaskList(taskId, list.listId)
  } catch (e: unknown) {
    task.list_id = prevListId
    rebuildBoardFromTasks()
    error.value = e instanceof Error ? e.message : '移動の保存に失敗しました'
    throw e
  }
}
async function finalizeBoardDrag (
  taskId: number,
  canonicalListKey: string | null,
  startListKey: string | null,
  appendToEnd = false,
) {
  await nextTick()
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  const task = tasks.value?.find(t => t.id === taskId)
  if (!task) {
    return
  }
  const listKey = canonicalListKey ?? findUniqueListKeyForTask(taskId)
  if (!listKey) {
    return
  }
  if (appendToEnd) {
    for (const list of lists.value) {
      const arr = tasksByList[list.key]
      if (!arr?.length) {
        continue
      }
      const idx = arr.findIndex(t => t.id === taskId)
      if (idx > -1) {
        arr.splice(idx, 1)
      }
    }
    if (!tasksByList[listKey]) {
      tasksByList[listKey] = []
    }
    tasksByList[listKey].push(task)
  }
  try {
    await persistTaskListChange(taskId, listKey)
  } catch {
    return
  }
  reconcileTaskPlacement(taskId, listKey)
  const listKeysToPersist = new Set<string>([listKey])
  if (startListKey && startListKey !== listKey) {
    listKeysToPersist.add(startListKey)
  }
  for (const key of listKeysToPersist) {
    try {
      await persistListTaskOrder(key)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '並び順の保存に失敗しました'
      await load({ refresh: true })
      return
    }
  }
  syncBoardPageCache()
}
/**
 * プレビューは常に1つ: 末尾帯はカスタムスロットのみ、それ以外は Sortable に任せる。
 */
function onBoardDragMove (
  evt: { to: HTMLElement, from: HTMLElement },
  originalEvent?: Event,
): boolean {
  syncBoardDragPointer(originalEvent)
  if (boardDragPreviewMode.value === 'tail') {
    removeStraySortableGhosts()
    return false
  }
  const canonicalListKey = boardDragPreviewListKey.value ?? getListKeyAtClientX(boardDragPointerX)
  const toListKey = getDropZoneListKey(evt.to)
  if (
    !canonicalListKey
    || !toListKey
    || toListKey !== canonicalListKey
    || isListColumnEmpty(toListKey)
  ) {
    removeStraySortableGhosts()
    return false
  }
  const startListKey = boardDragStartListKey.value
  if (startListKey && toListKey === startListKey && boardDragCrossList.value) {
    return false
  }
  return true
}
function measureDragCardSize (el: HTMLElement) {
  // offset* はレイアウト上の整数 px。rect の切り上げは 1px だけ縮む原因になるため使わない
  return {
    width: el.offsetWidth,
    height: el.offsetHeight,
  }
}
function captureBoardDragCardSize (sourceEl: HTMLElement) {
  const measured = measureDragCardSize(sourceEl)
  boardDragCardWidthPx = Math.max(boardDragCardWidthPx, measured.width)
  boardDragCardHeightPx = Math.max(boardDragCardHeightPx, measured.height)
}
const DRAG_SIZE_LOCK_PROPS = [
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'boxSizing',
  'overflow',
  'flexShrink',
] as const
function applyComputedStyleSubset (from: Element, to: HTMLElement) {
  const cs = getComputedStyle(from)
  const props = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
    'lineHeight', 'letterSpacing', 'wordSpacing',
    'textTransform', 'fontVariant',
    'overflowWrap', 'wordBreak', 'whiteSpace',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'color',
  ] as const
  for (const prop of props) {
    const value = cs[prop]
    if (typeof value === 'string' && value) {
      to.style.setProperty(prop.replace(/[A-Z]/g, s => `-${s.toLowerCase()}`), value)
    }
  }
}
function ensureFallbackVisible (fallback: HTMLElement) {
  fallback.classList.remove('drag-ghost')
  fallback.style.setProperty('opacity', '1', 'important')
  fallback.style.setProperty('visibility', 'visible', 'important')
  fallback.querySelectorAll<HTMLElement>('*').forEach((el) => {
    el.style.setProperty('visibility', 'visible', 'important')
    el.style.setProperty('opacity', '1', 'important')
  })
}
/** body 上の fallback は scoped CSS の継承外になるため、元カードの typography を複製する */
function syncFallbackFromSource (fallback: HTMLElement) {
  if (boardDragTaskId == null) {
    return
  }
  const source = document.querySelector<HTMLElement>(`.task-card[data-task-id="${boardDragTaskId}"]`)
  if (!source) {
    ensureFallbackVisible(fallback)
    lockDragElementSize(fallback)
    return
  }
  fallback.classList.remove('drag-ghost')
  const nestedPairs = [
    '.task-card-body',
    '.task-parent-title',
    '.task-title',
    '.task-card-meta',
    '.task-card-meta__row',
    '.task-label-list',
    '.task-label-list__strip',
    '.label-strip',
    '.task-card-footer',
    '.task-card-members',
  ] as const
  for (const selector of nestedPairs) {
    const fromEl = source.querySelector<HTMLElement>(selector)
    const toEl = fallback.querySelector<HTMLElement>(selector)
    if (fromEl && toEl) {
      applyComputedStyleSubset(fromEl, toEl)
    }
  }
  fallback.querySelectorAll<HTMLElement>('.card-menu-wrap').forEach((el) => {
    el.style.display = 'none'
  })
  lockDragElementSize(fallback)
  ensureFallbackVisible(fallback)
}
/** ドラッグ開始時の実寸を width/height/min/max すべてに固定し、リサイズを防ぐ */
function lockDragElementSize (el: HTMLElement) {
  const w = boardDragCardWidthPx
  const h = boardDragCardHeightPx
  if (w <= 0 || h <= 0) {
    return
  }
  const pxW = `${w}px`
  const pxH = `${h}px`
  const important = 'important'
  el.style.setProperty('box-sizing', 'border-box', important)
  el.style.setProperty('width', pxW, important)
  el.style.setProperty('height', pxH, important)
  el.style.setProperty('min-width', pxW, important)
  el.style.setProperty('min-height', pxH, important)
  el.style.setProperty('max-width', pxW, important)
  el.style.setProperty('max-height', pxH, important)
  el.style.setProperty('flex-shrink', '0', important)
}
function syncDragElementSizes () {
  if (!import.meta.client || !boardDragging.value) {
    return
  }
  document.querySelectorAll<HTMLElement>(
    '.drag-ghost--tail-preview, .list-drop-zone .sortable-ghost',
  ).forEach(lockDragElementSize)
  document.querySelectorAll<HTMLElement>('.task-card.sortable-fallback').forEach((fallback) => {
    syncFallbackFromSource(fallback)
  })
}
function scheduleSyncDragPlaceholderSize () {
  if (!import.meta.client || !boardDragging.value) {
    return
  }
  const apply = () => syncDragElementSizes()
  nextTick(apply)
  requestAnimationFrame(apply)
  requestAnimationFrame(() => requestAnimationFrame(apply))
}
function clearDragPlaceholderSize () {
  if (!import.meta.client) {
    return
  }
  document.querySelectorAll<HTMLElement>(
    '.drag-ghost--tail-preview, .list-drop-zone .sortable-ghost, .task-card.sortable-fallback',
  ).forEach((el) => {
    for (const prop of DRAG_SIZE_LOCK_PROPS) {
      el.style[prop] = ''
    }
  })
  boardDragCardWidthPx = 0
  boardDragCardHeightPx = 0
}
function syncFloatingDragCardLayout () {
  scheduleSyncDragPlaceholderSize()
}
/** Sortable がゴースト生成前の素のカード寸法を記録する */
function onBoardDragChoose (evt: { item: HTMLElement }) {
  boardDragCardWidthPx = 0
  boardDragCardHeightPx = 0
  captureBoardDragCardSize(evt.item)
}
function onBoardDragStart (evt: { item: HTMLElement, originalEvent?: Event }) {
  updateDropZoneScrollableState()
  boardDragTaskId = getTaskIdFromDragEl(evt.item)
  const task = tasks.value?.find(t => t.id === boardDragTaskId)
  boardDragStartListKey.value = task?.list_id != null ? `list_${task.list_id}` : null
  boardDragCrossList.value = false
  boardDragPreviewListKey.value = null
  boardDragPreviewMode.value = null
  boardDragLastToListKey = boardDragStartListKey.value
  syncBoardDragPointer(evt.originalEvent)
  captureBoardDragCardSize(evt.item)
  boardDragging.value = true
  boardDragStickyColumnKey = boardDragStartListKey.value
  closeCardMenu()
  closeListMenu()
  syncFloatingDragCardLayout()
  nextTick(() => {
    captureBoardDragCardSize(evt.item)
    syncDragElementSizes()
  })
  requestAnimationFrame(() => {
    captureBoardDragCardSize(evt.item)
    syncDragElementSizes()
  })
  if (import.meta.client) {
    document.addEventListener('pointermove', onBoardDragPointerMove, { passive: true })
    document.addEventListener('mousemove', onBoardDragPointerMove, { passive: true })
    document.addEventListener('dragover', onBoardNativeDragOver)
  }
}
/** ドラッグ終了時に表示位置と list_id を揃えて API 保存する */
function onBoardDragEnd (evt?: { originalEvent?: Event }) {
  syncBoardDragPointer(evt?.originalEvent)
  syncBoardPreviewState()
  const taskId = boardDragTaskId
  const startListKey = boardDragStartListKey.value
  const previewMode = boardDragPreviewMode.value
  const toListKey = boardDragPreviewListKey.value
    ?? boardDragLastToListKey
    ?? getHoverListKey(evt?.originalEvent)
    ?? boardDragStickyColumnKey
    ?? findUniqueListKeyForTask(taskId ?? -1)
  const appendToEnd = previewMode === 'tail'
  boardDragging.value = false
  suppressTaskCardClick.value = true
  window.setTimeout(() => {
    suppressTaskCardClick.value = false
  }, 100)
  clearDragPlaceholderSize()
  boardDragTaskId = null
  boardDragCrossList.value = false
  boardDragPreviewListKey.value = null
  boardDragPreviewMode.value = null
  removeStraySortableGhosts()
  updateDropZoneScrollableState()
  boardDragLastToListKey = null
  boardDragStartListKey.value = null
  boardDragStickyColumnKey = null
  if (import.meta.client) {
    document.removeEventListener('pointermove', onBoardDragPointerMove)
    document.removeEventListener('mousemove', onBoardDragPointerMove)
    document.removeEventListener('dragover', onBoardNativeDragOver)
  }
  if (taskId == null || !toListKey) {
    return
  }
  void finalizeBoardDrag(taskId, toListKey, startListKey, appendToEnd)
}
async function fetchBoardPayload () {
  return fetchBoardSnapshot(slug.value, workspaceId.value)
}
function applyBoardSnapshot (snapshot: WorkspaceBoardPageSnapshot) {
  const sortedLists = [...snapshot.lists].sort((a, b) => a.sort_order - b.sort_order)
  lists.value = sortedLists.map((row) => {
    const resolved = withResolvedListColor(row)
    return {
      key: `list_${row.id}`,
      title: row.name,
      listId: row.id,
      color: resolved.color,
      color_index: resolved.color_index,
    }
  })
  for (const list of lists.value) {
    if (!(list.key in tasksByList)) tasksByList[list.key] = []
  }
  const catalogLabels = resolveAndSortLabels(snapshot.orgLabels, snapshot.orgLabels)
  tasks.value = snapshot.tasks.map(task => ({
    ...task,
    assignees: sortMembersByDisplayName(task.assignees ?? []),
    labels: task.labels ? resolveAndSortLabels(task.labels, catalogLabels) : task.labels,
  }))
  orgLabels.value = catalogLabels
  orgLabelCategories.value = snapshot.orgLabelCategories ?? []
  workspaceMembersSnapshot.value = snapshot.workspaceMembers
  boardParentTasks.value = snapshot.parentTasks
  taskAttachmentsByTaskId.value = snapshot.taskAttachmentsByTaskId ?? {}
  rebuildBoardFromTasks()
}
function syncBoardPageCache () {
  if (!pageReady.value || !tasks.value) {
    return
  }
  replaceCachedBoardState(slug.value, workspaceId.value, {
    tasks: tasks.value,
    parentTasks: boardParentTasks.value,
  })
  touchCachedWorkspaceUpdatedAt(slug.value, Number(workspaceId.value))
  // ボードと WBS のタスク正本は分けているため、ボード側更新後は WBS を破棄して再取得させる
  const { invalidateCached: invalidateWbs } = useWorkspaceWbsPageData()
  invalidateWbs(slug.value, workspaceId.value)
}
function applyBoardPayload (data: Awaited<ReturnType<typeof fetchBoardPayload>>) {
  applyBoardSnapshot(data)
}
function isBoardLocalEditActive (): boolean {
  return editingTaskId.value != null || editingListKey.value != null
}
function clearBoardFadeInTimer () {
  if (boardFadeInTimer === null) return
  clearTimeout(boardFadeInTimer)
  boardFadeInTimer = null
}
function revealLoadedBoard () {
  if (boardInitialRevealDone) return
  boardInitialRevealDone = true
  clearBoardFadeInTimer()
  boardShouldFadeIn.value = true
  boardFadeInTimer = setTimeout(() => {
    boardShouldFadeIn.value = false
    boardFadeInTimer = null
  }, 260)
}
function resetBoardReveal () {
  boardInitialRevealDone = false
  boardShouldFadeIn.value = false
  clearBoardFadeInTimer()
}
function markBoardReady () {
  const wasReady = pageReady.value
  pageReady.value = true
  if (!wasReady) {
    revealLoadedBoard()
  }
}
async function load (opts?: { refresh?: boolean; silent?: boolean }) {
  const refresh = opts?.refresh ?? false
  const silent = opts?.silent ?? false
  error.value = null
  if (!refresh) {
    fatalLoadError.value = null
  }
  const applyFreshPayload = async () => {
    const data = await fetchBoardPayload()
    if (isBoardLocalEditActive()) {
      return
    }
    applyBoardPayload(data)
    markBoardReady()
    clearBoardCacheStale(slug.value, workspaceId.value)
  }
  try {
    if (!pageReady.value && !refresh) {
      const cached = getBoardCached(slug.value, workspaceId.value)
      if (cached) {
        applyBoardSnapshot(cached)
        markBoardReady()
        return
      }
      // 初回は中央スピナーで待つ（AppLoadingCursor は使わない）
      const r = await raceWithTimeout(() => fetchBoardPayload(), TM_PAGE_LOAD_TIMEOUT_MS)
      if (!r.ok) {
        if (r.reason === 'timeout') {
          fatalLoadError.value = timeoutMessage()
          return
        }
        if (isAccessDeniedMessage(r.message)) {
          await navigateTo(`/org/${slug.value}/workspaces`, { replace: true })
          return
        }
        fatalLoadError.value = r.message
        return
      }
      applyBoardPayload(r.value)
      markBoardReady()
    } else if (silent && pageReady.value) {
      await applyFreshPayload()
    } else if (!pageReady.value) {
      // pageReady 前の refresh も中央スピナーのまま待つ
      await applyFreshPayload()
    } else {
      await withAppLoadingCursor(applyFreshPayload)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '読み込みに失敗しました'
    if (!pageReady.value && !refresh) {
      if (isAccessDeniedMessage(msg)) {
        await navigateTo(`/org/${slug.value}/workspaces`, { replace: true })
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
      updateDropZoneScrollableState()
    }
  }
}
function refreshOnViewSwitch (): Promise<void> {
  if (!pageReady.value) {
    return load()
  }
  if (isBoardLocalEditActive()) {
    return Promise.resolve()
  }
  // keep-alive 済みの表示をキャッシュ再適用で上書きしない（API で最新化）
  return load({ refresh: true, silent: true })
}
defineExpose({
  refreshOnViewSwitch,
})
function retryBoardLoad () {
  fatalLoadError.value = null
  invalidateBoardCached(slug.value, workspaceId.value)
  resetBoardReveal()
  pageReady.value = false
  void load()
}
function stripManualLineBreaks (value: string) {
  return value.replace(/\r?\n/g, '')
}
function defaultTaskAddListId (): number | null {
  return lists.value[0]?.listId ?? null
}
const canAddTaskFromHeader = computed(() => pageReady.value && defaultTaskAddListId() !== null)
function openTaskAddFromHeader () {
  const listId = defaultTaskAddListId()
  if (listId === null) {
    return
  }
  openTaskAddModal(listId)
}
function openTaskAddModal (listId: number, parentTaskId: number | null = null) {
  taskAddListId.value = listId
  taskAddParentTaskId.value = parentTaskId
  taskAddParentDefaults.value = null
  taskAddOpen.value = true
}
async function onAddChildTaskFromDetail (payload: { parentTaskId: number; listId: number | null }) {
  if (addChildTaskTransitionPending.value) {
    return
  }
  const listId = payload.listId ?? defaultTaskAddListId()
  if (listId === null) {
    return
  }
  addChildTaskTransitionPending.value = true
  taskDetailOpen.value = false
  const fadeOutDone = new Promise<void>((resolve) => {
    window.setTimeout(resolve, MODAL_FADE_OUT_MS)
  })
  let defaults: TaskFormDefaultsSource | null = null
  try {
    const [detail] = await Promise.all([
      api<TaskFormDefaultsSource>(
        `/orgs/${slug.value}/workspaces/${workspaceId.value}/tasks/${payload.parentTaskId}`,
      ),
      fadeOutDone,
    ])
    defaults = detail
  } catch {
    await fadeOutDone
    defaults = null
  }
  taskAddListId.value = listId
  taskAddParentTaskId.value = payload.parentTaskId
  taskAddParentDefaults.value = defaults
  taskAddOpen.value = true
  addChildTaskTransitionPending.value = false
}
function onTaskAddedFromModal (added: Task) {
  if (!tasks.value) {
    tasks.value = []
  }
  tasks.value.push(added)
  rebuildBoardFromTasks()
  markTaskAsJustCreated(added.id)
  syncBoardPageCache()
}
async function onListFormSubmit ({
  name,
  color_index,
}: {
  name: string
  color_index: number
}) {
  if (listFormLoading.value) return
  listFormLoading.value = true
  try {
    if (listModalMode.value === 'add') {
      const created = await api<{ id: number; name: string; color_index: number; sort_order: number }>(
        `/orgs/${slug.value}/workspaces/${workspaceId.value}/lists`,
        {
          method: 'POST',
          body: { name, color_index, sort_order: lists.value.length },
        },
      )
      listFormOpen.value = false
      await load({ refresh: true })
      markListAsJustCreated(`list_${created.id}`)
      return
    }
    const target = listEditTarget.value
    if (!target) {
      return
    }
    const updated = await api<{
      id: number
      name: string
      color_index: number
      sort_order: number
    }>(
      `/orgs/${slug.value}/workspaces/${workspaceId.value}/lists/${target.listId}`,
      {
        method: 'PATCH',
        body: { name, color_index },
      },
    )
    const row = lists.value.find(item => item.listId === target.listId)
    if (row) {
      const resolved = withResolvedListColor(updated)
      row.title = updated.name
      row.color = resolved.color
      row.color_index = resolved.color_index
    }
    listFormOpen.value = false
    listEditTarget.value = null
    listModalMode.value = 'add'
  } catch (e: unknown) {
    listFormModalRef.value?.setSubmitError(
      e instanceof Error ? e.message : (
        listModalMode.value === 'edit'
          ? 'リスト更新に失敗しました'
          : 'リスト追加に失敗しました'
      ),
    )
  } finally {
    listFormLoading.value = false
  }
}
async function confirmListDelete () {
  const target = listDeleteTarget.value
  if (!target || listDeleteLoading.value) {
    return
  }
  listDeleteLoading.value = true
  try {
    await api(
      `/orgs/${slug.value}/workspaces/${workspaceId.value}/lists/${target.listId}`,
      { method: 'DELETE' },
    )
    listDeleteOpen.value = false
    listDeleteTarget.value = null
    await load({ refresh: true })
  } catch (e: unknown) {
    listDeleteModalRef.value?.setSubmitError(
      e instanceof Error ? e.message : 'リスト削除に失敗しました',
    )
  } finally {
    listDeleteLoading.value = false
  }
}
function onListTitleClick (list: ListDef) {
  if (suppressListTitleClick.value) {
    return
  }
  void startListEdit(list)
}
async function startListEdit (list: ListDef) {
  editingTaskId.value = null
  editingListKey.value = list.key
  listEditDrafts[list.key] = list.title
}
function cancelListEdit () {
  editingListKey.value = null
}
async function confirmListTitle (list: ListDef) {
  if (listRenamePending.value || editingListKey.value !== list.key) {
    return
  }
  const name = (listEditDrafts[list.key] || '').trim()
  if (!name || name === list.title) {
    cancelListEdit()
    return
  }
  await saveListTitle(list)
}
function lockListColumnWidthsForDrag () {
  if (!import.meta.client) {
    return
  }
  document.querySelectorAll('.board-lists-sortable .list-column').forEach((col) => {
    if (!(col instanceof HTMLElement)) {
      return
    }
    const w = col.getBoundingClientRect().width
    col.style.width = `${w}px`
    col.style.minWidth = `${w}px`
    col.style.maxWidth = `${w}px`
  })
}
function clearListColumnWidthLocks () {
  if (!import.meta.client) {
    return
  }
  document.querySelectorAll('.board-lists-sortable .list-column').forEach((col) => {
    if (!(col instanceof HTMLElement)) {
      return
    }
    col.style.width = ''
    col.style.minWidth = ''
    col.style.maxWidth = ''
  })
}
function moveListDefToIndex (items: ListDef[], sourceIdx: number, targetIdx: number): ListDef[] {
  if (sourceIdx === targetIdx || sourceIdx < 0 || targetIdx < 0 || sourceIdx >= items.length) {
    return items
  }
  const next = [...items]
  const [moved] = next.splice(sourceIdx, 1)
  if (!moved) {
    return items
  }
  next.splice(targetIdx, 0, moved)
  return next
}
function commitListColumnVisualOrder (order: ListDef[]) {
  lists.value = order.map(l => ({ ...l }))
  listSortableEpoch.value++
}
function listsShareOrder (a: ListDef[], b: ListDef[]): boolean {
  return a.length === b.length && a.every((l, i) => l.listId === b[i]?.listId)
}
function getListColumnAuthoritativeOrder (): ListDef[] | null {
  return listColumnDragFinalOrder ?? listColumnDragPreviewOrder
}
/** Sortable が独自に splice した場合、プレビューと同じ並びへ戻す */
function enforceListColumnAuthoritativeOrder () {
  const authoritative = getListColumnAuthoritativeOrder()
  if (!authoritative || listsShareOrder(lists.value, authoritative)) {
    return
  }
  lists.value = authoritative.map(l => ({ ...l }))
}
function onListColumnSortableChange () {
  if (listColumnDragging.value || listColumnDragCommitting) {
    enforceListColumnAuthoritativeOrder()
  }
}
function syncListColumnDragPointer (originalEvent?: Event) {
  if (originalEvent instanceof MouseEvent || originalEvent instanceof PointerEvent) {
    listColumnDragPointerX = originalEvent.clientX
  }
}
/** ドラッグ要素の水平位置でリスト列の配置プレビューを同期 */
function syncListColumnDragPreview () {
  if (!listColumnDragging.value || !listColumnDragSourceKey) {
    return
  }
  const probeX = resolveListColumnDragProbeX()
  const visualInsertIdx = getListColumnVisualIndexAtClientX(probeX)
  if (visualInsertIdx === null) {
    return
  }
  const current = lists.value
  const sourceIdx = current.findIndex(l => l.key === listColumnDragSourceKey)
  if (sourceIdx === -1) {
    return
  }
  if (sourceIdx !== visualInsertIdx) {
    const next = moveListDefToIndex(current, sourceIdx, visualInsertIdx)
    if (next !== current) {
      lists.value = next
    }
  }
  listColumnDragPreviewOrder = lists.value.map(l => ({ ...l }))
}
function scheduleListColumnDragPreview () {
  if (!import.meta.client || listColumnDragPreviewRaf) {
    return
  }
  listColumnDragPreviewRaf = window.requestAnimationFrame(() => {
    listColumnDragPreviewRaf = 0
    syncListColumnDragPreview()
  })
}
function onListColumnDragPointerMove (event: PointerEvent | MouseEvent) {
  listColumnDragPointerX = event.clientX
  scheduleListColumnDragPreview()
}
function onListColumnNativeDragOver (event: DragEvent) {
  listColumnDragPointerX = event.clientX
  scheduleListColumnDragPreview()
  event.preventDefault()
}
function detachListColumnDragListeners () {
  if (!import.meta.client) {
    return
  }
  document.removeEventListener('pointermove', onListColumnDragPointerMove)
  document.removeEventListener('mousemove', onListColumnDragPointerMove)
  document.removeEventListener('dragover', onListColumnNativeDragOver)
  if (listColumnDragPreviewRaf) {
    window.cancelAnimationFrame(listColumnDragPreviewRaf)
    listColumnDragPreviewRaf = 0
  }
}
function onListColumnDragMove (
  _evt: { related: HTMLElement },
  originalEvent?: Event,
): boolean {
  syncListColumnDragPointer(originalEvent)
  scheduleListColumnDragPreview()
  return false
}
function onListColumnDragStart (evt: { item: HTMLElement, originalEvent?: Event }) {
  if (boardDragging.value) {
    return
  }
  suppressListTitleClick.value = false
  listColumnDragging.value = true
  listColumnDragSourceKey = evt.item.dataset.listKey ?? null
  listColumnDragFinalOrder = null
  listColumnDragCommitting = false
  syncListColumnDragPointer(evt.originalEvent)
  closeCardMenu()
  closeListMenu()
  listOrderSnapshot = lists.value.map(l => ({ ...l }))
  listColumnDragPreviewOrder = lists.value.map(l => ({ ...l }))
  lockListColumnWidthsForDrag()
  nextTick(() => lockListColumnWidthsForDrag())
  if (import.meta.client) {
    document.addEventListener('pointermove', onListColumnDragPointerMove, { passive: true })
    document.addEventListener('mousemove', onListColumnDragPointerMove, { passive: true })
    document.addEventListener('dragover', onListColumnNativeDragOver)
  }
  scheduleListColumnDragPreview()
}
async function onListColumnDragEnd () {
  if (listColumnDragPreviewRaf) {
    window.cancelAnimationFrame(listColumnDragPreviewRaf)
    listColumnDragPreviewRaf = 0
  }
  // ドロップ時は DOM が遷移するため再同期しない。直前のプレビュー並びをそのまま確定する。
  const finalOrder = (listColumnDragPreviewOrder ?? lists.value).map(l => ({ ...l }))
  const snapshot = listOrderSnapshot
  listColumnDragFinalOrder = finalOrder.map(l => ({ ...l }))
  listColumnDragCommitting = true
  enforceListColumnAuthoritativeOrder()
  detachListColumnDragListeners()
  listColumnDragPreviewOrder = null
  listColumnDragSourceKey = null
  listColumnDragging.value = false
  listOrderSnapshot = null
  clearListColumnWidthLocks()
  updateDropZoneScrollableState()
  commitListColumnVisualOrder(finalOrder)
  await nextTick()
  enforceListColumnAuthoritativeOrder()
  commitListColumnVisualOrder(finalOrder)
  listColumnDragFinalOrder = null
  listColumnDragCommitting = false
  if (!snapshot) {
    return
  }
  const unchanged = snapshot.length === finalOrder.length
    && snapshot.every((l, i) => l.listId === finalOrder[i]?.listId)
  if (unchanged) {
    return
  }
  suppressListTitleClick.value = true
  window.setTimeout(() => {
    suppressListTitleClick.value = false
  }, 100)
  await persistListOrder(snapshot, finalOrder)
}
async function persistListOrder (rollback: ListDef[], committedOrder: ListDef[]) {
  listReorderPending.value = true
  error.value = null
  const listIds = committedOrder.map(l => l.listId)
  try {
    await api<{ data: { ok: boolean } }>(
      `/orgs/${slug.value}/workspaces/${workspaceId.value}/lists/reorder`,
      { method: 'PATCH', body: { list_ids: listIds } },
    )
    lists.value = committedOrder.map(l => ({ ...l }))
  } catch (e: unknown) {
    commitListColumnVisualOrder(rollback)
    error.value = e instanceof Error ? e.message : 'リストの並び替えに失敗しました'
  } finally {
    listReorderPending.value = false
  }
}
async function saveListTitle (list: ListDef) {
  const name = (listEditDrafts[list.key] || '').trim()
  if (!name) return
  listRenamePending.value = true
  error.value = null
  try {
    await api<{ id: number; name: string; sort_order: number }>(
      `/orgs/${slug.value}/workspaces/${workspaceId.value}/lists/${list.listId}`,
      { method: 'PATCH', body: { name } },
    )
    const row = lists.value.find(item => item.key === list.key)
    if (row) row.title = name
    editingListKey.value = null
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'リスト名の更新に失敗しました'
  } finally {
    listRenamePending.value = false
  }
}
function cancelTaskEdit () {
  editingTaskId.value = null
  taskTitleDraft.value = ''
}
async function saveTaskTitle (task: Task) {
  const title = stripManualLineBreaks(taskTitleDraft.value).trim()
  if (!title) return
  taskRenamePending.value = true
  error.value = null
  try {
    await api<{ title: string }>(
      `/orgs/${slug.value}/workspaces/${workspaceId.value}/tasks/${task.id}`,
      { method: 'PATCH', body: { title } },
    )
    task.title = title
    editingTaskId.value = null
    taskTitleDraft.value = ''
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'タスク名の更新に失敗しました'
  } finally {
    taskRenamePending.value = false
  }
}
watch(listFormOpen, (open) => {
  if (open) {
    return
  }
  if (listModalMode.value === 'edit') {
    listModalMode.value = 'add'
    listEditTarget.value = null
  }
})
watch(listDeleteOpen, (open) => {
  if (!open) {
    listDeleteTarget.value = null
  }
})
useWorkspaceRealtimeChannel(workspaceId, {
  onTaskCreated (task) {
    addTaskToBoard(task)
    markTaskAsJustCreated(task.id)
  },
  onTaskUpdated (task) {
    const detail = task as TaskDetail
    onTaskDetailUpdated(detail)
    pushDetailModalRemote(detail)
  },
  onTaskArchived ({ id, task, cascaded_task_ids }) {
    const removeIds = [id, ...(cascaded_task_ids ?? [])]
    for (const taskId of removeIds) {
      removeTaskFromBoard(taskId, { removeChildTasks: false })
    }
    if (task) {
      archivedModalRef.value?.addTaskFromRealtime(task)
    }
  },
  onTaskRestored (task) {
    archivedModalRef.value?.removeTaskFromRealtime(task.id)
    const detail = task as TaskDetail
    if (tasks.value?.some(t => t.id === task.id)) {
      onTaskDetailUpdated(detail)
      pushDetailModalRemote(detail)
      return
    }
    addTaskToBoard(task)
  },
  onTaskDeleted (taskId) {
    removeTaskFromBoard(taskId)
    archivedModalRef.value?.removeTaskFromRealtime(taskId)
  },
  onTasksReordered ({ list_id, task_ids }) {
    applyTasksReordered(list_id, task_ids)
  },
  onListCreated () {
    void load({ refresh: true })
  },
  onListUpdated (list) {
    const row = lists.value.find(l => l.listId === list.id)
    if (row) {
      row.title = list.name
      const resolved = withResolvedListColor(list)
      row.color = resolved.color
      row.color_index = resolved.color_index
    } else {
      void load({ refresh: true })
    }
  },
  onListDeleted () {
    void load({ refresh: true })
  },
  onListsReordered ({ list_ids }) {
    applyListsReordered(list_ids)
  },
  onWorkspaceMembersUpdated ({ members, removed_member_ids }) {
    dispatchWorkspaceMembersUpdated({
      orgSlug: slug.value,
      workspaceId: workspaceId.value,
      members,
      removedMemberIds: removed_member_ids,
    })
  },
})
onBeforeMount(() => {
  void hydrateSidebarPreference()
  if (isBoardCacheStale(slug.value, workspaceId.value)) {
    return
  }
  const cached = getBoardCached(slug.value, workspaceId.value)
  if (cached) {
    applyBoardSnapshot(cached)
    markBoardReady()
  }
})
onActivated(() => {
  void hydrateSidebarPreference()
  if (import.meta.client) {
    document.addEventListener('keydown', onBoardKeydown)
  }
})
onDeactivated(() => {
  if (import.meta.client) {
    document.removeEventListener('keydown', onBoardKeydown)
  }
  closeBoardFilter()
  closeSubheaderMenu()
})
useOnUserProfileUpdated((detail) => {
  if (!tasks.value && workspaceMembers.value.length === 0) {
    return
  }
  if (tasks.value) {
    const nextTasks = applyUserProfileToTasks(tasks.value, detail)
    if (nextTasks !== tasks.value) {
      tasks.value = nextTasks
      rebuildBoardFromTasks()
    }
  }
  syncBoardPageCache()
  if (detailTaskId.value != null) {
    const row = tasks.value?.find(task => task.id === detailTaskId.value)
    if (row) {
      pushDetailModalRemote(boardTaskToTaskDetail(row, orgLabels.value))
    }
  }
})
useOnWorkspaceMembersUpdated((detail) => {
  if (!workspaceMembersUpdateMatchesView(detail, slug.value, workspaceId.value)) {
    return
  }
  if (!tasks.value || detail.removedMemberIds.length === 0) {
    return
  }
  const nextTasks = removeMembersFromTaskAssignees(tasks.value, detail.removedMemberIds)
  if (nextTasks === tasks.value) {
    return
  }
  tasks.value = nextTasks
  rebuildBoardFromTasks()
  syncBoardPageCache()
  if (detailTaskId.value != null) {
    const row = tasks.value.find(task => task.id === detailTaskId.value)
    if (row) {
      pushDetailModalRemote(boardTaskToTaskDetail(row, orgLabels.value))
    }
  }
})
onMounted(async () => {
  if (isBoardCacheStale(slug.value, workspaceId.value) || !pageReady.value) {
    await load({ refresh: isBoardCacheStale(slug.value, workspaceId.value) || pageReady.value })
  }
  applyTaskQueryFromRoute()
  if (!import.meta.client) {
    return
  }
  window.addEventListener('resize', onWindowResize)
  document.addEventListener('selectstart', onDocumentSelectStart)
  document.addEventListener('pointermove', onBoardPointerMove, { passive: true })
  document.addEventListener('mousemove', onBoardPointerMove, { passive: true })
  document.addEventListener('keydown', onBoardKeydown)
  nextTick(() => {
    bindStickyOffsets()
  })
})
watch(
  () => [pageReady.value, route.query.task] as const,
  () => {
    applyTaskQueryFromRoute()
  },
)
onBeforeUnmount(() => {
  syncBoardPageCache()
  if (import.meta.client) {
    window.removeEventListener('resize', onWindowResize)
    document.removeEventListener('selectstart', onDocumentSelectStart)
    document.removeEventListener('pointermove', onBoardPointerMove)
    document.removeEventListener('mousemove', onBoardPointerMove)
    document.removeEventListener('keydown', onBoardKeydown)
    document.removeEventListener('pointermove', onBoardDragPointerMove)
    document.removeEventListener('mousemove', onBoardDragPointerMove)
    document.removeEventListener('dragover', onBoardNativeDragOver)
    detachListColumnDragListeners()
    clearListColumnWidthLocks()
  }
  unbindStickyOffsets()
  clearBoardFadeInTimer()
})
</script>
<style lang="scss" scoped src="~/assets/styles/components/workspace/WorkspaceBoard.scss"></style>
<!-- body へ移動する sortable-fallback は scoped の継承外になるため、typography をグローバルで固定 -->
<style lang="scss" src="~/assets/styles/components/workspace/WorkspaceBoard.global.scss"></style>
