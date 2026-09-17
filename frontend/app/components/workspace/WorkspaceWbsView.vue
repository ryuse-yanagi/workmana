<template>
  <div class="workspace-wbs-board">
    <p v-if="error" class="workspace-wbs-board__error">{{ error }}</p>
    <div
      v-else-if="loading && !hasDisplayRows"
      class="workspace-wbs-board__state"
      role="status"
      aria-busy="true"
      aria-label="読み込み中"
    >
      <LoadingSpinner />
    </div>
    <p v-else-if="!hasDisplayRows" class="workspace-wbs-board__state">
      タスクがありません
    </p>
    <div
      v-else
      ref="wbsScrollEl"
      class="workspace-wbs-board__viewport"
      :class="{
        'workspace-wbs-board__viewport--dragging': dragging,
        'workspace-wbs-board__viewport--gantt-interacting': ganttPointerActive,
      }"
      @scroll.passive="closeTaskMenu"
    >
      <div
        class="workspace-wbs-board__content"
        :style="{
          '--gantt-month-end-pad': `${ganttMonthEndPad}px`,
        }"
      >
      <div
        v-for="(section, sectionIndex) in tableSections"
        :key="section.key"
        class="workspace-wbs-board__frame"
        :class="{ 'workspace-wbs-board__frame--stacked': sectionIndex > 0 }"
      >
        <div
          class="workspace-wbs-wrap"
          :class="{
            'workspace-wbs-wrap--resizing': isResizing,
            'workspace-wbs-wrap--dragging': dragging,
          }"
        >
        <table
          class="workspace-wbs"
          :class="{
            'workspace-wbs--edit': editMode,
            'workspace-wbs--gantt': showGantt,
          }"
          :style="{
            '--wbs-width': `${fullWbsWidth}px`,
            '--gantt-day-col-width': `${GANTT_DAY_COL_WIDTH}px`,
            '--wbs-col-divider-inset': `${WBS_COL_DIVIDER_INSET}px`,
          }"
        >
        <colgroup>
          <col class="workspace-wbs__code-col">
          <col
            v-for="column in visibleColumns"
            :key="column.key"
            :style="{ width: `${columnWidths[column.key]}px` }"
          >
          <col
            v-for="day in ganttDays"
            :key="`col-${day.iso}`"
            class="workspace-wbs__day-col"
          >
        </colgroup>
        <thead v-if="sectionIndex === 0">
          <tr class="workspace-wbs__header-row workspace-wbs__header-row--primary">
            <th
              scope="col"
              class="workspace-wbs__header-cell workspace-wbs__header-cell--code"
              :rowspan="showGantt ? 2 : 1"
            >
              <span class="workspace-wbs__header-label">WBS</span>
            </th>
            <th
              v-for="column in visibleColumns"
              :key="column.key"
              scope="col"
              class="workspace-wbs__header-cell"
              :class="{
                'workspace-wbs__header-cell--edge': isLastVisibleColumn(column.key),
                'workspace-wbs__header-cell--first': isFirstVisibleColumn(column.key),
              }"
              :rowspan="showGantt ? 2 : 1"
            >
              <span class="workspace-wbs__header-label">{{ column.label }}</span>
              <span
                class="workspace-wbs__resize-handle"
                aria-hidden="true"
                @pointerdown="onResizePointerDown($event, column.key, 'right')"
                @pointermove="onResizePointerMove"
                @pointerup="onResizePointerUp"
                @pointercancel="onResizePointerCancel"
              />
            </th>
            <th
              v-if="showGantt"
              class="workspace-wbs__gantt-controls-header"
              :colspan="Math.max(ganttDays.length, 1)"
            >
              <div class="workspace-wbs__gantt-controls">
                <div class="workspace-wbs__month-nav">
                  <button
                    type="button"
                    class="workspace-wbs__month-btn workspace-wbs__month-btn--nav"
                    aria-label="前の月"
                    @click="goPrevMonth"
                  >
                    <ChevronLeft :size="18" :stroke-width="2" aria-hidden="true" />
                  </button>
                  <span class="workspace-wbs__month-label">{{ monthLabel }}</span>
                  <button
                    type="button"
                    class="workspace-wbs__month-btn workspace-wbs__month-btn--nav"
                    aria-label="次の月"
                    @click="goNextMonth"
                  >
                    <ChevronRight :size="18" :stroke-width="2" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  class="workspace-wbs__month-btn workspace-wbs__month-btn--today"
                  :disabled="isCurrentMonth"
                  @click="goCurrentMonth"
                >
                  Today
                </button>
              </div>
            </th>
          </tr>
          <tr
            v-if="showGantt"
            class="workspace-wbs__header-row workspace-wbs__header-row--days"
          >
            <th
              v-for="day in ganttDays"
              :key="`head-${day.iso}`"
              scope="col"
              class="workspace-wbs__day-header"
              :class="{
                'workspace-wbs__day-header--today': day.isToday,
                'workspace-wbs__day-header--weekend': day.isWeekend,
                'workspace-wbs__day-header--sun': day.weekdayIndex === 0,
                'workspace-wbs__day-header--sat': day.weekdayIndex === 6,
              }"
            >
              <span class="workspace-wbs__day-date">{{ day.day }}</span>
              <span class="workspace-wbs__day-weekday">{{ day.weekday }}</span>
            </th>
          </tr>
        </thead>
        <tbody :ref="el => registerSectionBody(section.key, el)">
          <template v-if="section.rows.length">
          <WbsTaskRow
            v-for="(row, rowIndex) in section.rows"
            :key="`${row.kind}-${row.task.id}`"
            :row="row"
            :row-index="rowIndex"
            :last-child="row.kind === 'child' && isLastChildInWbsGroup(section.rows, rowIndex)"
            :drag-preview="draggingTaskIds.has(row.task.id)"
            :edit-mode="editMode"
            :parent-collapsed="effectiveCollapsedParentIds.has(row.task.id)"
            :menu-open="openMenuTaskId === row.task.id"
            :assignee-picker-active="isAssigneePickerActive(row.task.id)"
            :editing-title-task-id="editingTitleTaskId"
            :title-draft="titleDraft"
            :title-saving="titleSaving"
            :gantt-days="ganttDays"
            :gantt-dragging="ganttDragging"
            :is-column-visible="isColumnVisible"
            :is-first-visible-column="isFirstVisibleColumn"
            :is-last-visible-column="isLastVisibleColumn"
            :is-popover-cell-active="isPopoverCellActive"
            :is-assignee-detail-active="isAssigneeDetailActive"
            :list-name-style="listNameStyle"
            :should-show-filled-bar="shouldShowFilledBar"
            :is-bar-start-day="isBarStartDay"
            :is-bar-end-day="isBarEndDay"
            :is-day-selection-outlined="isDaySelectionOutlined"
            :is-selection-start-day="isSelectionStartDay"
            :is-selection-end-day="isSelectionEndDay"
            :day-cell-style="dayCellStyle"
            :set-title-input-el="setTitleInputEl"
            @update:title-draft="(value) => { titleDraft = value }"
            @title-activate="onTitleFieldActivate"
            @title-mousedown="onTitleCellMouseDown"
            @title-confirm="confirmTitleEdit"
            @toggle-collapse="toggleParentCollapse"
            @drag-handle-pointerdown="(taskId, event) => onDragHandlePointerDown(section.key, taskId, event)"
            @drag-handle-click="onDragHandleClick"
            @toggle-menu="toggleTaskMenu"
            @members-click="onMembersCellClick"
            @member-detail="openMemberDetail"
            @open-labels="openLabels"
            @open-list="openList"
            @open-period="openPeriod"
            @open-effort="openEffort"
            @open-progress-rate="openProgressRate"
            @open-notes="openDescription"
            @day-pointerdown="onDayCellPointerDown"
          />
          </template>
        </tbody>
        </table>
        <div
          class="workspace-wbs__resize-overlay"
          aria-hidden="true"
        >
          <span
            v-for="(boundary, boundaryIndex) in visibleColumnResizeBoundaries"
            :key="`guide-${boundary.columnKey}`"
            class="workspace-wbs__resize-guide"
            :class="{ 'workspace-wbs__resize-guide--no-line': boundaryIndex === visibleColumnResizeBoundaries.length - 1 }"
            :style="{ left: `${boundary.offset}px` }"
          />
        </div>
      </div>
      </div>
      </div>
    </div>
    <WorkspaceGanttColorPopover
      :open="colorPopoverOpen"
      :model-value="colorPopoverValue"
      :anchor="colorPopoverAnchor"
      :saving="colorSaving"
      :can-clear="canClearGanttColor"
      @close="closeColorPopover"
      @after-leave="onColorPopoverAfterLeave"
      @select="saveGanttBarColor"
      @clear="void clearGanttBarColor()"
    />
    <TaskEditPopoverLayer
      ref="editLayerRef"
      :org-slug="orgSlug"
      :workspace-id="workspaceId"
      :org-labels="orgLabels"
      :label-categories="orgLabelCategories"
      :workspace-members="workspaceMembers"
      :workspace-lists="workspaceLists"
      :allow-member-remove="editMode"
      :readonly-description="!editMode"
      @updated="syncTaskUpdate"
      @popover-active-change="onPopoverActiveChange"
    />
    <TaskAddModal
      v-model="taskAddOpen"
      :org-slug="orgSlug"
      :workspace-id="workspaceId"
      :list-id="taskAddListId"
      :initial-parent-task-id="taskAddParentTaskId"
      :initial-parent-defaults="taskAddParentDefaults"
      :org-labels="orgLabels"
      :label-categories="orgLabelCategories"
      :workspace-members="workspaceMembers"
      :workspace-lists="workspaceLists"
      @added="onTaskAddedFromModal"
    />
    <WbsDisplayItemsModal
      v-model="displayItemsModalOpen"
      :selected-keys="visibleColumnKeys"
      @save="onDisplayItemsSave"
    />
    <TaskDetailModal
      v-model="taskDetailOpen"
      :org-slug="orgSlug"
      :workspace-id="workspaceId"
      :task-id="detailTaskId"
      :org-labels="orgLabels"
      :label-categories="orgLabelCategories"
      :workspace-members="workspaceMembers"
      :workspace-lists="workspaceLists"
      :hierarchy-tasks="detailHierarchyTasks"
      :initial-task-detail="detailInitialTask"
      :initial-parent-tasks="detailParentTasks"
      @updated="onTaskDetailUpdated"
      @navigate="onTaskDetailNavigate"
      @missing="onTaskDetailMissing"
      @add-child-task="onAddChildTaskFromDetail"
    />
    <ConfirmModal
      v-model="archiveConfirmOpen"
      title="タスクのアーカイブ確認"
      :message="archiveConfirmMessage"
      confirm-text="アーカイブ"
      variant="danger"
      :loading="archivePending"
      @confirm="confirmArchiveTask"
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
    <Teleport to="body">
      <FloatingMenu
        :open="Boolean(openMenuTaskId !== null && taskMenuPosition)"
        :instance-key="openMenuTaskId ?? 'task-menu'"
        density="compact"
        :style="taskMenuStyle"
        :items="taskMenuItems"
        @select="onTaskMenuSelect"
        @close="closeTaskMenu"
        @after-leave="onTaskMenuAfterLeave"
      />
      <Transition name="popover-fade" @after-leave="onWbsFilterAfterLeave">
                <BoardFilterPopover
          v-if="wbsFilterOpen"
          ref="wbsFilterDropdownRef"
          :style="wbsFilterStyle"
          :show-clear="hasActiveWbsFilters"
          @clear="clearWbsFilters"
          @close="closeWbsFilter"
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
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import {
  buildFullWbsDisplayRows,
  buildStandaloneWbsDisplayRows,
  buildWbsDisplayRows,
  assignWbsCodes,
  buildWbsReorderPayload,
  isLastChildInWbsGroup,
  sortWbsTasks,
  type WbsDisplayRow,
  type WbsTask,
} from '../../composables/useWbsTaskGroups'
import {
  useWbsTaskDragReorder,
  WBS_LIST_DRAG_SURFACE,
} from '../../composables/useWbsTaskDragReorder'
import {
  WBS_COLUMNS,
  defaultVisibleColumnKeys,
  parseStoredVisibleColumns,
  serializeVisibleColumns,
  useWbsColumnResize,
  type WbsColumnKey,
  type WbsDisplayItemKey,
} from '../../composables/useWbsColumnResize'
import {
  buildMonthDays,
  currentYearMonth,
  formatGanttMonthLabel,
  resolveGanttBarColor,
  resolveTaskDateRange,
  shiftVisibleMonth,
} from '../../composables/useGanttCalendar'
import { ganttBarColorAtSequenceIndex } from '../../constants/colorPresets'
import { useGanttBarInteraction } from '../../composables/useGanttBarInteraction'
import {
  type WorkspaceListOption,
  type PopoverType,
  type TaskPopoverEditable,
  resolveListColor,
} from '../../composables/useTaskPopoverEditor'
import { type TaskFormDefaultsSource, type TaskFormLabel, type TaskFormMember } from '../../composables/useTaskFormHelpers'
import {
  flattenLabelCategories,
  normalizeLabelCategories,
  resolveAndSortLabels,
  type LabelCategoryGroup,
} from '../../composables/useLabelCategories'
import { sortMembersByDisplayName } from '../../composables/useMemberDisplay'
import { useWorkspaceTaskFilters } from '../../composables/useWorkspaceTaskFilters'
import { useAnchoredFilterPopover } from '../../composables/useAnchoredFilterPopover'
import { useFloatingMenuState } from '../../composables/useFloatingMenuState'
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
import { useApi } from '../../composables/useApi'
import { useArchivedTasksCache } from '../../composables/useArchivedTasksCache'
import {
  useWorkspaceBoardPageData,
  type WorkspaceBoardTask,
} from '../../composables/useWorkspaceBoardPageData'
import { useWorkspaceWbsPageData, type WorkspaceWbsPageSnapshot } from '../../composables/useWorkspaceWbsPageData'
import { useWorkspaceTaskMemberCandidates } from '../../composables/useWorkspaceTaskMemberCandidates'
import { useOrgWorkspaceIndexPageData } from '../../composables/useOrgWorkspaceIndexPageData'
import {
  useWorkspaceRealtimeChannel,
  type RealtimeBoardTask,
  type RealtimeWbsReorderItem,
} from '../../composables/useWorkspaceRealtimeChannel'
import { resolveListColors } from '../../utils/colorPresetResolution'
import { isAccessDeniedMessage } from '../../utils/resourceAccessError'
import {
  createEmptyWorkspaceTaskFilters,
  type WorkspaceTaskFilters,
} from '../../utils/workspaceTaskFilters'
import { syncAppLoadingCursor, withAppLoadingCursor } from '../../composables/useAppLoadingCursor'
import { buildDestructiveConfirmMessage } from '../../utils/destructiveConfirmMessage'
import { useUnsavedChangesGuard } from '../../composables/useUnsavedChangesGuard'
import {
  computeWbsListColumnMinWidth,
  computeWbsTitleColumnMinWidth,
  resetWbsTitleWidthMeasureCache,
} from '../../utils/wbsTitleColumnWidth'
import { caretIndexAtClientX } from '../../utils/inputCaretFromPoint'
import { useDropdownEscapeClose } from '../../composables/useDropdownEscapeClose'
import { enrichTaskDetailHierarchy } from '../../composables/useTaskHierarchy'
import { resolveParentTaskTitle } from '../../composables/useTaskCardMeta'
import WorkspaceGanttColorPopover from './WorkspaceGanttColorPopover.vue'
import WbsTaskRow from './WbsTaskRow.vue'
import TaskEditPopoverLayer from '../task/TaskEditPopoverLayer.vue'
import TaskAddModal, { type AddedTask } from '../modals/TaskAddModal.vue'
import TaskDetailModal, { type TaskDetail } from '../modals/TaskDetailModal.vue'
import ConfirmModal from '../modals/ConfirmModal.vue'
import WbsDisplayItemsModal from '../modals/WbsDisplayItemsModal.vue'
import FloatingMenu, { type FloatingMenuItem } from '../ui/FloatingMenu.vue'
import BoardFilterPopover from '../ui/BoardFilterPopover.vue'
import BoardFilterPopoverBody from '../ui/BoardFilterPopoverBody.vue'
import BoardFilterSection from '../ui/BoardFilterSection.vue'
import LoadingSpinner from '../ui/LoadingSpinner.vue'
import { useOrgRole } from '../../composables/useOrgRole'

const GANTT_DAY_COL_WIDTH = 40
/** 月の日数差は枠外右余白で吸収するため、常に 31 日分を基準にする */
const GANTT_MONTH_SLOT_COUNT = 31
/** WBS 番号列の幅（SCSS の --wbs-code-col-width と一致） */
const WBS_CODE_COL_WIDTH = 52
/** 列区切り線の左側余白（SCSS の --wbs-col-divider-inset と一致） */
const WBS_COL_DIVIDER_INSET = 12

const props = defineProps<{
  orgSlug: string
  workspaceId: string
}>()
const emit = defineEmits<{
  'edit-saving-change': [saving: boolean]
  'visible-task-count-change': [count: number]
}>()
/** 親ヘッダーと双方向同期。ボタン操作は親が直接 true/false にする */
const editMode = defineModel<boolean>('editMode', { default: false })
const { api } = useApi()
const { isOrgAdmin } = useOrgRole(toRef(props, 'orgSlug'))
const { upsertCachedTask: upsertArchivedTask } = useArchivedTasksCache()
const {
  patchCachedTasks,
  getCached: getBoardCached,
  replaceCachedBoardState,
  warmWorkspaceBoardCache,
} = useWorkspaceBoardPageData()
const { getCached: getWbsCached, setCached: setWbsCached } = useWorkspaceWbsPageData()
const { touchCachedWorkspaceUpdatedAt } = useOrgWorkspaceIndexPageData()
const loading = ref(true)
const error = ref<string | null>(null)
const tasks = ref<WbsTask[]>([])
const orgLabels = ref<TaskFormLabel[]>([])
const orgLabelCategories = ref<LabelCategoryGroup[]>([])
const workspaceMembersSnapshot = ref<TaskFormMember[]>([])
const { workspaceMembers } = useWorkspaceTaskMemberCandidates(
  () => props.orgSlug,
  () => props.workspaceId,
  workspaceMembersSnapshot,
)
const workspaceLists = ref<WorkspaceListOption[]>([])
const collapsedParentIds = ref<Set<number>>(new Set())
const wbsFilterTriggerEl = ref<HTMLElement | null>(null)
const wbsFilterDropdownRef = ref<InstanceType<typeof BoardFilterPopover> | null>(null)
const taskFilters = defineModel<WorkspaceTaskFilters>('taskFilters', {
  default: () => createEmptyWorkspaceTaskFilters(),
})
const {
  assigneeFilterSelected,
  labelFilterSelected,
  scheduleFilterSelected,
  scheduleFilterOptions,
  assigneeFilterSearchQuery,
  labelFilterSearchQuery,
  filterSectionsOpen,
  hasActiveFilters: hasActiveWbsFilters,
  filteredAssigneeFilterMembers,
  labelFilterCategories,
  isAssigneeFilterSelected,
  setAssigneeFilter,
  isLabelFilterSelected,
  toggleLabelFilter,
  isScheduleFilterSelected,
  toggleScheduleFilter,
  clearFilters: clearWbsFilters,
  clearFilterSearchQueries,
  matchesFilters,
} = useWorkspaceTaskFilters(taskFilters, {
  members: workspaceMembers,
  labelCategories: orgLabelCategories,
})
const TASK_MENU_MIN_WIDTH = 168
const taskMenu = useFloatingMenuState<number>({
  menuMinWidth: TASK_MENU_MIN_WIDTH,
  getMenuItemCount: () => taskMenuItems.value.length,
  onBeforeOpen: () => {
    editLayerRef.value?.dismissPopover()
    closeColorPopover()
  },
})
const {
  open: wbsFilterOpen,
  style: wbsFilterStyle,
  close: closeWbsFilter,
  openPopover: openWbsFilter,
  toggle: toggleWbsFilter,
  onAfterLeave: onWbsFilterAfterLeave,
  onSectionToggle: onFilterSectionToggle,
} = useAnchoredFilterPopover({
  triggerRef: wbsFilterTriggerEl,
  dropdownRef: wbsFilterDropdownRef,
  onClose: clearFilterSearchQueries,
  onBeforeOpen: () => {
    taskMenu.close()
  },
  repositionSources: [assigneeFilterSearchQuery, labelFilterSearchQuery],
})
const searchQuery = defineModel<string>('searchQuery', { default: '' })
const hasActiveWbsSearch = computed(() => searchQuery.value.trim().length > 0)
const hasActiveWbsNarrowing = computed(() => hasActiveWbsFilters.value || hasActiveWbsSearch.value)
const editSaving = ref(false)
const taskAddOpen = ref(false)
const taskAddListId = ref<number | null>(null)
const taskAddParentTaskId = ref<number | null>(null)
const taskAddParentDefaults = ref<TaskFormDefaultsSource | null>(null)
/** 詳細→追加のフェードアウト時間（TaskDetailModal.scss の leave と揃える） */
const MODAL_FADE_OUT_MS = 120
const addChildTaskTransitionPending = ref(false)
const initialMonth = currentYearMonth()
const visibleYear = ref(initialMonth.year)
const visibleMonth = ref(initialMonth.month)
const colorPopoverOpen = ref(false)
const colorPopoverAnchor = ref<{ top: number; left: number; right: number } | null>(null)
const colorPopoverValue = ref('')
const colorPopoverTaskId = ref<number | null>(null)
const pendingGanttColorOpen = ref<{ taskId: number; clientX: number; clientY: number } | null>(null)
const colorSaving = ref(false)
const canClearGanttColor = computed(() => {
  const taskId = colorPopoverTaskId.value
  if (taskId == null) return false
  const task = tasks.value.find(row => row.id === taskId)
  return Boolean(task?.gantt_bar_color?.trim())
})
const ganttDateSaving = ref(false)
const openMenuTaskId = taskMenu.openId
const taskMenuPosition = taskMenu.position
const pendingTaskMenuOpen = taskMenu.pendingOpen
const detailTaskId = ref<number | null>(null)
const archiveConfirmTask = ref<WbsTask | null>(null)
const archivePending = ref(false)
const taskDetailOpen = computed({
  get: () => detailTaskId.value !== null,
  set: (open: boolean) => {
    if (!open) {
      detailTaskId.value = null
    }
  },
})
const archiveConfirmOpen = computed({
  get: () => archiveConfirmTask.value !== null,
  set: (open: boolean) => {
    if (!open) {
      archiveConfirmTask.value = null
    }
  },
})
const archiveConfirmMessage = computed(() => {
  const task = archiveConfirmTask.value
  if (!task) return ''
  const childCount = tasks.value.filter(row => row.parent_task_id === task.id).length
  return buildDestructiveConfirmMessage(
    'タスク',
    'アーカイブ',
    task.title,
    childCount > 0 ? `※子タスク ${childCount} 件もアーカイブされます。` : null,
  )
})
const taskMenuItems = computed<FloatingMenuItem[]>(() => {
  const items: FloatingMenuItem[] = [
    { key: 'detail', label: 'タスク詳細' },
  ]
  if (isOrgAdmin.value) {
    items.push({ key: 'archive', label: 'タスクのアーカイブ', danger: true })
  }
  return items
})
const openMenuTask = computed(() => {
  const id = openMenuTaskId.value
  if (id == null) {
    return null
  }
  return tasks.value.find(task => task.id === id) ?? null
})
function wbsTaskToTaskDetail (task: WbsTask): TaskDetail {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    list_id: task.list_id,
    sort_order: task.sort_order,
    start_date: task.start_date ?? null,
    due_date: task.due_date ?? null,
    effort_hours: task.effort_hours ?? null,
    progress_rate: task.progress_rate ?? null,
    assignees: sortMembersByDisplayName(task.assignees ?? []),
    labels: resolveAndSortLabels(task.labels, orgLabels.value),
    checklists: task.checklists ?? [],
    is_parent_task: Boolean(task.is_parent_task),
    parent_task_id: task.parent_task_id ?? null,
  }
}
const detailInitialTask = computed((): TaskDetail | null => {
  const id = detailTaskId.value
  if (id === null) {
    return null
  }
  const row = tasks.value.find(task => task.id === id)
  if (!row) {
    return null
  }
  return enrichTaskDetailHierarchy(
    wbsTaskToTaskDetail(row),
    tasks.value,
    listId => workspaceLists.value.find(list => list.id === listId)?.name ?? null,
  )
})
const detailHierarchyTasks = computed(() => tasks.value.map(task => ({
  id: task.id,
  title: task.title,
  parent_task_id: task.parent_task_id ?? null,
  parent_task_title: resolveParentTaskTitle(task, tasks.value),
  is_parent_task: Boolean(task.is_parent_task),
  start_date: task.start_date ?? null,
  due_date: task.due_date ?? null,
  effort_hours: task.effort_hours ?? null,
  progress_rate: task.progress_rate ?? null,
  labels: task.labels ?? [],
  assignees: task.assignees ?? [],
  list_id: task.list_id,
  list_name: task.list_name ?? workspaceLists.value.find(list => list.id === task.list_id)?.name ?? null,
  list_color: workspaceLists.value.find(list => list.id === task.list_id)?.color ?? null,
  sort_order: task.sort_order,
})))
const detailParentTasks = computed(() => tasks.value
  .filter(task => task.is_parent_task)
  .map(task => ({ id: task.id, title: task.title })))
type WbsReorderSnapshot = {
  tasks: WbsTask[]
  collapsedParentIds: Set<number>
}
const reorderSnapshot = ref<WbsReorderSnapshot | null>(null)
/** 進行中の WBS 取得を無効化するための世代番号（作成直後の古い応答で上書きしない） */
let wbsLoadGeneration = 0
/** 非サイレント load のネスト数（世代無効化でも loading を確実に戻す） */
let wbsLoadingDepth = 0
watch(editSaving, (saving) => {
  emit('edit-saving-change', saving)
}, { immediate: true })
watch(editMode, (active, wasActive) => {
  if (active && !wasActive) {
    // 親が true にしただけで startEdit を経由しない場合でもセッションを張る
    if (tasks.value.length === 0) {
      editMode.value = false
      return
    }
    if (!reorderSnapshot.value) {
      beginEditSession()
    }
    return
  }
  if (!active && wasActive) {
    dismissEditInteractions()
    // cancelEdit / confirmEdit 経由なら snapshot は既に null
    if (reorderSnapshot.value && !editSaving.value) {
      void abandonEditSession({ restoreFields: true })
    }
  }
})
const editLayerRef = ref<InstanceType<typeof TaskEditPopoverLayer> | null>(null)
type WbsPopoverCellField = 'assignees' | 'labels' | 'list' | 'period' | 'effort' | 'progressRate' | 'notes'
const popoverActiveTaskId = ref<number | null>(null)
const popoverActiveType = ref<PopoverType | null>(null)
const popoverActiveMemberId = ref<number | null>(null)
function onPopoverActiveChange (payload: {
  taskId: number | null
  popover: PopoverType | null
  memberId: number | null
}) {
  popoverActiveTaskId.value = payload.taskId
  popoverActiveType.value = payload.popover
  popoverActiveMemberId.value = payload.memberId
}
function popoverTypeToCellField (popover: PopoverType): WbsPopoverCellField | null {
  switch (popover) {
    case 'period': return 'period'
    case 'effort': return 'effort'
    case 'progress-rate': return 'progressRate'
    case 'members':
    case 'member-detail': return 'assignees'
    case 'labels': return 'labels'
    case 'list': return 'list'
    case 'description': return 'notes'
    default: return null
  }
}
function isPopoverCellActive (taskId: number, field: WbsPopoverCellField): boolean {
  if (popoverActiveTaskId.value !== taskId || !popoverActiveType.value) {
    return false
  }
  return popoverTypeToCellField(popoverActiveType.value) === field
}
function isAssigneeDetailActive (taskId: number, memberId: number): boolean {
  return popoverActiveTaskId.value === taskId
    && popoverActiveType.value === 'member-detail'
    && popoverActiveMemberId.value === memberId
}
function isAssigneePickerActive (taskId: number): boolean {
  return popoverActiveTaskId.value === taskId && popoverActiveType.value === 'members'
}
const editingTitleTaskId = ref<number | null>(null)
const titleDraft = ref('')
const titleSaving = ref(false)
/** blur が focus 直後に走って入力モードが即座に閉じるのを防ぐ */
let titleEditOpening = false
const titleInputEls = new Map<number, HTMLInputElement>()
const wbsBusy = computed(() => (
  loading.value || titleSaving.value || editSaving.value || colorSaving.value || ganttDateSaving.value
))
syncAppLoadingCursor(wbsBusy)
function setTitleInputEl (taskId: number, el: unknown) {
  if (el instanceof HTMLInputElement) {
    titleInputEls.set(taskId, el)
    return
  }
  titleInputEls.delete(taskId)
}
const wbsScrollEl = ref<HTMLElement | null>(null)
const groupedBodyEl = ref<HTMLTableSectionElement | null>(null)
const standaloneBodyEl = ref<HTMLTableSectionElement | null>(null)
const columnStorageKey = computed(() => `wbs-column-widths:${props.orgSlug}:${props.workspaceId}`)
const visibleColumnsStorageKey = computed(() => `wbs-visible-columns:${props.orgSlug}:${props.workspaceId}`)
const {
  columnWidths,
  isResizing,
  loadWidths,
  applyTitleColumnContentMinWidth,
  applyListColumnContentMinWidth,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onResizePointerCancel,
} = useWbsColumnResize(columnStorageKey, { leadingColWidth: 0 })
async function syncColumnContentMinWidths () {
  if (!import.meta.client) {
    return
  }
  if (document.fonts?.ready) {
    await document.fonts.ready
  }
  await nextTick()
  resetWbsTitleWidthMeasureCache()
  const rows = [
    ...buildFullWbsDisplayRows(tasks.value),
    ...buildStandaloneWbsDisplayRows(tasks.value),
  ]
  applyTitleColumnContentMinWidth(computeWbsTitleColumnMinWidth(rows))
  const listNames = new Set<string>()
  for (const list of workspaceLists.value) {
    if (list.name?.trim()) {
      listNames.add(list.name.trim())
    }
  }
  for (const task of tasks.value) {
    if (task.list_name?.trim()) {
      listNames.add(task.list_name.trim())
    }
  }
  applyListColumnContentMinWidth(computeWbsListColumnMinWidth([...listNames]))
}
const visibleColumnKeys = ref<WbsDisplayItemKey[]>(defaultVisibleColumnKeys())
const displayItemsModalOpen = ref(false)
const visibleColumnKeySet = computed(() => new Set(visibleColumnKeys.value))
const visibleColumns = computed(() => (
  WBS_COLUMNS.filter(column => visibleColumnKeySet.value.has(column.key))
))
const showGantt = computed(() => visibleColumnKeySet.value.has('gantt'))
const lastVisibleColumnKey = computed(() => (
  visibleColumns.value[visibleColumns.value.length - 1]?.key ?? null
))
const visibleWbsWidth = computed(() => (
  visibleColumns.value.reduce((sum, column) => sum + columnWidths.value[column.key], 0)
))
const visibleColumnResizeBoundaries = computed(() => {
  let offset = WBS_CODE_COL_WIDTH
  return visibleColumns.value.map((column) => {
    offset += columnWidths.value[column.key]
    return {
      columnKey: column.key,
      // 区切り線は列右端
      offset,
    }
  })
})
function legacyVisibleColumnsStorageKey (key: string): string {
  return key.replace(/^wbs-visible-columns:/, 'table-visible-columns:')
}
function readVisibleColumnsRaw (key: string): string | null {
  const current = localStorage.getItem(key)
  if (current != null) {
    return current
  }
  const legacyKey = legacyVisibleColumnsStorageKey(key)
  if (legacyKey === key) {
    return null
  }
  const legacy = localStorage.getItem(legacyKey)
  if (legacy == null) {
    return null
  }
  localStorage.setItem(key, legacy)
  return legacy
}
function loadVisibleColumns () {
  if (!import.meta.client) {
    visibleColumnKeys.value = defaultVisibleColumnKeys()
    return
  }
  visibleColumnKeys.value = (
    parseStoredVisibleColumns(readVisibleColumnsRaw(visibleColumnsStorageKey.value))
    ?? defaultVisibleColumnKeys()
  )
}
function persistVisibleColumns () {
  if (!import.meta.client) return
  localStorage.setItem(visibleColumnsStorageKey.value, serializeVisibleColumns(visibleColumnKeys.value))
}
function isColumnVisible (key: WbsColumnKey) {
  return visibleColumnKeySet.value.has(key)
}
function isLastVisibleColumn (key: WbsColumnKey) {
  return lastVisibleColumnKey.value === key
}
function isFirstVisibleColumn (key: WbsColumnKey) {
  return visibleColumns.value[0]?.key === key
}
function openDisplayItems () {
  displayItemsModalOpen.value = true
}
function onDisplayItemsSave (keys: WbsDisplayItemKey[]) {
  const selected = new Set(keys)
  selected.add('title')
  const ordered = defaultVisibleColumnKeys().filter(key => selected.has(key))
  if (!ordered.length) return
  visibleColumnKeys.value = ordered
  persistVisibleColumns()
}
watch(visibleColumnsStorageKey, () => {
  loadVisibleColumns()
}, { immediate: true })
const monthDays = computed(() => buildMonthDays(visibleYear.value, visibleMonth.value))
const ganttDays = computed(() => (showGantt.value ? monthDays.value : []))
/** 月の日数差は枠外右余白で吸収し、スクロール幅（＝ボタン位置）を一定に保つ */
const ganttMonthEndPad = computed(() => {
  if (!showGantt.value) {
    return 0
  }
  return Math.max(0, GANTT_MONTH_SLOT_COUNT - ganttDays.value.length) * GANTT_DAY_COL_WIDTH
})
const monthDayIsos = computed(() => monthDays.value.map(day => day.iso))
const monthLabel = computed(() => formatGanttMonthLabel(visibleYear.value, visibleMonth.value))
const fullWbsWidth = computed(() => (
  WBS_CODE_COL_WIDTH + visibleWbsWidth.value + ganttDays.value.length * GANTT_DAY_COL_WIDTH
))
const isCurrentMonth = computed(() => {
  const now = currentYearMonth()
  return visibleYear.value === now.year && visibleMonth.value === now.month
})
type WbsSectionKey = 'grouped' | 'standalone'
function taskMatchesWbsFilters (task: WbsTask): boolean {
  return matchesFilters(task)
}
function taskMatchesWbsSearch (task: WbsTask): boolean {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return true
  }
  return task.title.toLowerCase().includes(query)
}
function taskMatchesWbsNarrowing (task: WbsTask): boolean {
  return taskMatchesWbsFilters(task) && taskMatchesWbsSearch(task)
}
/** 絞り込み対象タスク＋（子がヒットしたときの親） */
const filteredTasks = computed(() => {
  if (!hasActiveWbsNarrowing.value) {
    return tasks.value
  }
  const matchingIds = new Set<number>()
  for (const task of tasks.value) {
    if (!taskMatchesWbsNarrowing(task)) {
      continue
    }
    matchingIds.add(task.id)
    if (task.parent_task_id != null) {
      matchingIds.add(task.parent_task_id)
    }
  }
  return tasks.value.filter(task => matchingIds.has(task.id))
})
const visibleTaskCount = computed(() => {
  if (!hasActiveWbsNarrowing.value) {
    return tasks.value.length
  }
  let count = 0
  for (const task of tasks.value) {
    if (taskMatchesWbsNarrowing(task)) {
      count += 1
    }
  }
  return count
})
watch(visibleTaskCount, (count) => {
  emit('visible-task-count-change', count)
}, { immediate: true })
/** 子がヒットした親は折りたたまず、所属が見えるようにする */
const effectiveCollapsedParentIds = computed(() => {
  if (!hasActiveWbsNarrowing.value) {
    return collapsedParentIds.value
  }
  const next = new Set(collapsedParentIds.value)
  for (const task of tasks.value) {
    if (task.parent_task_id == null) {
      continue
    }
    if (taskMatchesWbsNarrowing(task)) {
      next.delete(task.parent_task_id)
    }
  }
  return next
})
const groupedDrag = useWbsTaskDragReorder({
  tasks,
  wbsBodyEl: groupedBodyEl,
  collapsedParentIds: effectiveCollapsedParentIds,
  buildRows: () => buildWbsDisplayRows(filteredTasks.value, effectiveCollapsedParentIds.value),
  buildExpandedRows: () => buildFullWbsDisplayRows(filteredTasks.value),
  composeOrderedRows: rows => [...rows, ...buildStandaloneWbsDisplayRows(filteredTasks.value)],
  surface: WBS_LIST_DRAG_SURFACE,
  onCommit: commitWbsOrderFromDrag,
})
const standaloneDrag = useWbsTaskDragReorder({
  tasks,
  wbsBodyEl: standaloneBodyEl,
  collapsedParentIds: effectiveCollapsedParentIds,
  buildRows: () => buildStandaloneWbsDisplayRows(filteredTasks.value),
  buildExpandedRows: () => buildStandaloneWbsDisplayRows(filteredTasks.value),
  composeOrderedRows: rows => [...buildFullWbsDisplayRows(filteredTasks.value), ...rows],
  surface: WBS_LIST_DRAG_SURFACE,
  onCommit: commitWbsOrderFromDrag,
})
const dragging = computed(() => groupedDrag.dragging.value || standaloneDrag.dragging.value)
const draggingTaskIds = computed(() => new Set<number>([
  ...groupedDrag.draggingTaskIds.value,
  ...standaloneDrag.draggingTaskIds.value,
]))
const wbsSections = computed(() => {
  const sections: Array<{ key: WbsSectionKey; rows: WbsDisplayRow[] }> = []
  if (groupedDrag.activeRows.value.length) {
    sections.push({ key: 'grouped', rows: groupedDrag.activeRows.value })
  }
  if (standaloneDrag.activeRows.value.length) {
    sections.push({ key: 'standalone', rows: standaloneDrag.activeRows.value })
  }
  return sections
})
const hasDisplayRows = computed(() => wbsSections.value.length > 0)
const tableSections = computed(() => {
  return wbsSections.value.map(section => ({
    ...section,
    rows: section.rows.length ? assignWbsCodes(section.rows) : section.rows,
  }))
})
function registerSectionBody (key: WbsSectionKey, el: unknown) {
  const body = el instanceof HTMLTableSectionElement ? el : null
  if (key === 'grouped') {
    groupedBodyEl.value = body
  } else {
    standaloneBodyEl.value = body
  }
}
function shouldSuppressClick (): boolean {
  return groupedDrag.shouldSuppressClick() || standaloneDrag.shouldSuppressClick()
}
function onDragHandlePointerDownInner (
  sectionKey: WbsSectionKey,
  taskId: number,
  event: PointerEvent,
) {
  if (hasActiveWbsNarrowing.value) {
    return
  }
  const drag = sectionKey === 'grouped' ? groupedDrag : standaloneDrag
  drag.onDragHandlePointerDown(taskId, event)
}
/**
 * 色未保存の既存バー向け表示色。
 * 他バーの増減で再計算されないよう、タスク単位で一度決めた色を固定する。
 */
const unsavedGanttBarColorByTaskId = new Map<number, string>()

function countSavedGanttBarColors (excludeTaskId?: number): number {
  let barCount = 0
  for (const task of tasks.value) {
    if (excludeTaskId != null && task.id === excludeTaskId) {
      continue
    }
    if (task.gantt_bar_color?.trim()) {
      barCount += 1
    }
  }
  return barCount
}

/** 既存の保存色＋固定済み未保存色の数から、次に自動割当する色を決める */
function nextAutoGanttBarColor (excludeTaskId?: number): string {
  let barCount = countSavedGanttBarColors(excludeTaskId)
  for (const [taskId] of unsavedGanttBarColorByTaskId) {
    if (excludeTaskId != null && taskId === excludeTaskId) {
      continue
    }
    if (tasks.value.some(task => task.id === taskId && task.gantt_bar_color?.trim())) {
      continue
    }
    barCount += 1
  }
  return ganttBarColorAtSequenceIndex(barCount)
}

function clearUnsavedGanttBarColor (taskId: number) {
  unsavedGanttBarColorByTaskId.delete(taskId)
}

function resolveGanttColorForDateChange (
  task: WbsTask,
  nextStart: string | null,
  nextDue: string | null,
): { nextColor: string | null; colorChanged: boolean } {
  const prevColor = task.gantt_bar_color ?? null
  const shouldAssignColor = Boolean(nextStart && nextDue) && !task.gantt_bar_color?.trim()
  const shouldClearColor = !nextStart && !nextDue && Boolean(
    task.gantt_bar_color?.trim() || unsavedGanttBarColorByTaskId.has(task.id),
  )
  if (shouldAssignColor) {
    const nextColor = unsavedGanttBarColorByTaskId.get(task.id) ?? nextAutoGanttBarColor(task.id)
    clearUnsavedGanttBarColor(task.id)
    return { nextColor, colorChanged: true }
  }
  if (shouldClearColor) {
    clearUnsavedGanttBarColor(task.id)
    return { nextColor: null, colorChanged: Boolean(prevColor?.trim()) }
  }
  return { nextColor: prevColor, colorChanged: false }
}

function resolveTaskGanttBarColor (task: WbsTask): string {
  if (task.gantt_bar_color?.trim()) {
    clearUnsavedGanttBarColor(task.id)
    return resolveGanttBarColor(task)
  }
  // 新規作成プレビュー（日付なし）: 次の自動割当色（編集中バー自身のプレビューのみ）
  if (!resolveTaskDateRange(task)) {
    clearUnsavedGanttBarColor(task.id)
    return nextAutoGanttBarColor(task.id)
  }
  // 日付あり・色未保存: 初回に固定し、他バー編集では絶対に変えない
  const frozen = unsavedGanttBarColorByTaskId.get(task.id)
  if (frozen) {
    return frozen
  }
  const color = nextAutoGanttBarColor(task.id)
  unsavedGanttBarColorByTaskId.set(task.id, color)
  return color
}

async function commitGanttDateRange (taskId: number, start: string | null, end: string | null) {
  closeColorPopover()
  const idx = tasks.value.findIndex(task => task.id === taskId)
  if (idx < 0) {
    return
  }
  const current = tasks.value[idx]!
  const prevStart = current.start_date ?? null
  const prevDue = current.due_date ?? null
  const prevColor = current.gantt_bar_color ?? null
  const nextStart = start
  const nextDue = end
  if (
    normalizeDateOnly(prevStart) === nextStart
    && normalizeDateOnly(prevDue) === nextDue
  ) {
    return
  }
  const { nextColor, colorChanged } = resolveGanttColorForDateChange(current, nextStart, nextDue)
  // 編集対象タスク以外は tasks / cache / API のいずれも更新しない
  tasks.value[idx] = {
    ...current,
    start_date: nextStart,
    due_date: nextDue,
    ...(colorChanged ? { gantt_bar_color: nextColor } : {}),
  }
  patchCachedTasks(props.orgSlug, props.workspaceId, [{
    id: taskId,
    start_date: nextStart,
    due_date: nextDue,
    ...(colorChanged ? { gantt_bar_color: nextColor } : {}),
  }])
  persistWbsCache()
  ganttDateSaving.value = true
  error.value = null
  try {
    await api(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${taskId}`,
      {
        method: 'PATCH',
        body: {
          start_date: nextStart,
          due_date: nextDue,
          ...(colorChanged ? { gantt_bar_color: nextColor } : {}),
        },
      },
    )
  } catch (e: unknown) {
    tasks.value[idx] = {
      ...tasks.value[idx]!,
      start_date: prevStart,
      due_date: prevDue,
      gantt_bar_color: prevColor,
    }
    patchCachedTasks(props.orgSlug, props.workspaceId, [{
      id: taskId,
      start_date: prevStart,
      due_date: prevDue,
      gantt_bar_color: prevColor,
    }])
    persistWbsCache()
    error.value = e instanceof Error ? e.message : 'ガントバーの日付更新に失敗しました'
  } finally {
    ganttDateSaving.value = false
  }
}
function normalizeDateOnly (value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] ?? null
}
const {
  dragging: ganttDragging,
  pointerActive: ganttPointerActive,
  isDaySelectionOutlined,
  isSelectionStartDay,
  isSelectionEndDay,
  shouldShowFilledBar,
  isBarStartDay,
  isBarEndDay,
  onDayCellPointerDown,
} = useGanttBarInteraction({
  isInteractiveTask: (taskId) => {
    const task = tasks.value.find(row => row.id === taskId)
    return Boolean(
      editMode.value
      && task
      && !ganttDateSaving.value
      && !colorSaving.value,
    )
  },
  getTask: (taskId) => tasks.value.find(row => row.id === taskId) ?? null,
  onCommitRange: commitGanttDateRange,
  onFilledBarClick: (taskId, clientX, clientY) => {
    openGanttColorPopover(taskId, clientX, clientY)
  },
  dayIsoList: () => monthDayIsos.value,
  scrollContainer: wbsScrollEl,
})
function cloneWbsTasks (source: WbsTask[]): WbsTask[] {
  try {
    return structuredClone(toRaw(source)) as WbsTask[]
  } catch {
    // Proxy などが混ざると structuredClone が失敗することがある
    return JSON.parse(JSON.stringify(toRaw(source))) as WbsTask[]
  }
}
function onDragHandlePointerDown (
  sectionKey: WbsSectionKey,
  taskId: number,
  event: PointerEvent,
) {
  if (!editMode.value || editSaving.value) {
    return
  }
  onDragHandlePointerDownInner(sectionKey, taskId, event)
}
function onDragHandleClick () {
  if (shouldSuppressClick()) {
    return
  }
}
async function commitWbsOrderFromDrag (updatedTasks: WbsTask[]) {
  if (!editMode.value) {
    await saveWbsOrder(updatedTasks)
  }
  // 編集中の並び替えはローカル反映のみ。差分はスナップショット比較で判定する。
}
async function saveWbsOrder (updatedTasks: WbsTask[]): Promise<boolean> {
  try {
    await api<{ data: { ok: boolean } }>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/wbs/reorder`,
      {
        method: 'PATCH',
        body: { tasks: buildWbsReorderPayload(updatedTasks) },
      },
    )
    persistWbsCache()
    patchCachedTasks(
      props.orgSlug,
      props.workspaceId,
      updatedTasks.map(task => ({
        id: task.id,
        sort_order: task.sort_order,
        parent_task_id: task.parent_task_id ?? null,
        is_parent_task: task.is_parent_task,
      })),
    )
    return true
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'タスクの並び順の保存に失敗しました'
    await loadWbsTasks()
    return false
  }
}
function dismissEditInteractions () {
  cancelTitleEdit()
  closeTaskMenu()
  closeWbsFilter()
  // 保存待ちの非同期 close ではなく、同期で閉じる（編集モード遷移を阻害しない）
  editLayerRef.value?.dismissPopover()
  closeColorPopover()
}
function defaultTaskAddListId (): number | null {
  return workspaceLists.value[0]?.id ?? null
}
function openTaskAdd () {
  if (loading.value || editSaving.value) {
    return
  }
  dismissEditInteractions()
  taskAddListId.value = defaultTaskAddListId()
  taskAddParentTaskId.value = null
  taskAddParentDefaults.value = null
  taskAddOpen.value = true
}
async function onAddChildTaskFromDetail (payload: { parentTaskId: number; listId: number | null }) {
  if (loading.value || editSaving.value || addChildTaskTransitionPending.value) {
    return
  }
  const listId = payload.listId ?? defaultTaskAddListId()
  if (listId === null) {
    return
  }
  addChildTaskTransitionPending.value = true
  dismissEditInteractions()
  taskDetailOpen.value = false
  const fadeOutDone = new Promise<void>((resolve) => {
    window.setTimeout(resolve, MODAL_FADE_OUT_MS)
  })
  let defaults: TaskFormDefaultsSource | null = null
  try {
    const [detail] = await Promise.all([
      api<TaskFormDefaultsSource>(
        `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${payload.parentTaskId}`,
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
function addedTaskToWbsTask (added: AddedTask): WbsTask {
  const listId = added.list_id ?? null
  return {
    id: added.id,
    title: added.title,
    description: added.description ?? null,
    created_at: added.created_at ?? null,
    list_id: listId,
    list_name: workspaceLists.value.find(list => list.id === listId)?.name ?? null,
    start_date: added.start_date ?? null,
    due_date: added.due_date ?? null,
    effort_hours: added.effort_hours ?? null,
    progress_rate: added.progress_rate ?? null,
    assignees: sortMembersByDisplayName(added.assignees ?? []),
    labels: added.labels ? resolveAndSortLabels(added.labels, orgLabels.value) : [],
    sort_order: added.sort_order,
    is_parent_task: added.is_parent_task,
    parent_task_id: added.parent_task_id ?? null,
  }
}
function addedTaskToBoardTask (added: AddedTask): WorkspaceBoardTask {
  return {
    id: added.id,
    title: added.title,
    description: added.description ?? null,
    list_id: added.list_id ?? null,
    is_parent_task: added.is_parent_task,
    parent_task_id: added.parent_task_id ?? null,
    sort_order: added.sort_order,
    start_date: added.start_date ?? null,
    due_date: added.due_date ?? null,
    effort_hours: added.effort_hours ?? null,
    progress_rate: added.progress_rate ?? null,
    assignees: sortMembersByDisplayName(added.assignees ?? []),
    labels: added.labels ? resolveAndSortLabels(added.labels, orgLabels.value) : [],
  }
}
function syncBoardCacheAfterAdd (added: AddedTask) {
  const cached = getBoardCached(props.orgSlug, props.workspaceId)
  if (!cached) {
    return
  }
  const boardTask = addedTaskToBoardTask(added)
  replaceCachedBoardState(props.orgSlug, props.workspaceId, {
    tasks: [...cached.tasks, boardTask],
    parentTasks: added.is_parent_task
      ? [...cached.parentTasks, { id: added.id, title: added.title }]
      : cached.parentTasks,
  })
}
function onTaskAddedFromModal (added: AddedTask) {
  // 作成前に開始した silent reload が古い一覧で上書きしないように無効化する
  wbsLoadGeneration += 1
  const wbsTask = addedTaskToWbsTask(added)
  const exists = tasks.value.some(task => task.id === wbsTask.id)
  if (!exists) {
    tasks.value = [...tasks.value, wbsTask]
  }
  if (reorderSnapshot.value) {
    const snapExists = reorderSnapshot.value.tasks.some(task => task.id === wbsTask.id)
    if (!snapExists) {
      reorderSnapshot.value = {
        ...reorderSnapshot.value,
        tasks: [...reorderSnapshot.value.tasks, cloneWbsTasks([wbsTask])[0]!],
      }
    }
  }
  persistWbsCache()
  syncBoardCacheAfterAdd(added)
}
async function persistAndDismissEditInteractions () {
  cancelTitleEdit()
  await editLayerRef.value?.closePopover()
  closeColorPopover()
}
function beginEditSession () {
  dismissEditInteractions()
  if (!reorderSnapshot.value) {
    try {
      reorderSnapshot.value = {
        tasks: cloneWbsTasks(tasks.value),
        collapsedParentIds: new Set(collapsedParentIds.value),
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '編集の開始に失敗しました'
      reorderSnapshot.value = {
        tasks: tasks.value.map(task => ({ ...task })),
        collapsedParentIds: new Set(collapsedParentIds.value),
      }
    }
  }
  collapsedParentIds.value = new Set()
}
function startEdit (): boolean {
  if (tasks.value.length === 0) {
    editMode.value = false
    return false
  }
  // ヘッダー表示と実編集状態を同時に立てる（watch だけに依存しない）
  if (!editMode.value || !reorderSnapshot.value) {
    beginEditSession()
  }
  editMode.value = true
  return true
}
function sameIdList (a: number[], b: number[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}
function buildFieldRevertPatch (
  current: WbsTask,
  snapshot: WbsTask,
): Record<string, unknown> | null {
  const body: Record<string, unknown> = {}
  if (current.title !== snapshot.title) {
    body.title = snapshot.title
  }
  if ((current.description ?? null) !== (snapshot.description ?? null)) {
    body.description = snapshot.description ?? null
  }
  if ((current.list_id ?? null) !== (snapshot.list_id ?? null) && snapshot.list_id != null) {
    body.list_id = snapshot.list_id
  }
  if (normalizeDateOnly(current.start_date) !== normalizeDateOnly(snapshot.start_date)) {
    body.start_date = snapshot.start_date ?? null
  }
  if (normalizeDateOnly(current.due_date) !== normalizeDateOnly(snapshot.due_date)) {
    body.due_date = snapshot.due_date ?? null
  }
  if ((current.effort_hours ?? null) !== (snapshot.effort_hours ?? null)) {
    body.effort_hours = snapshot.effort_hours ?? null
  }
  if ((current.progress_rate ?? null) !== (snapshot.progress_rate ?? null)) {
    body.progress_rate = snapshot.progress_rate ?? null
  }
  const currentColor = current.gantt_bar_color?.trim() || null
  const snapshotColor = snapshot.gantt_bar_color?.trim() || null
  if (currentColor !== snapshotColor) {
    body.gantt_bar_color = snapshot.gantt_bar_color ?? null
  }
  const currentAssigneeIds = (current.assignees ?? []).map(member => member.id).sort((a, b) => a - b)
  const snapshotAssigneeIds = (snapshot.assignees ?? []).map(member => member.id).sort((a, b) => a - b)
  if (!sameIdList(currentAssigneeIds, snapshotAssigneeIds)) {
    body.assignee_ids = snapshotAssigneeIds
  }
  const currentLabelIds = (current.labels ?? []).map(label => label.id).sort((a, b) => a - b)
  const snapshotLabelIds = (snapshot.labels ?? []).map(label => label.id).sort((a, b) => a - b)
  if (!sameIdList(currentLabelIds, snapshotLabelIds)) {
    body.label_ids = snapshotLabelIds
  }
  if ((current.parent_task_id ?? null) !== (snapshot.parent_task_id ?? null)) {
    body.parent_task_id = snapshot.parent_task_id ?? null
  }
  if (Boolean(current.is_parent_task) !== Boolean(snapshot.is_parent_task)) {
    body.is_parent_task = Boolean(snapshot.is_parent_task)
  }
  return Object.keys(body).length > 0 ? body : null
}
/** 編集中に即時 PATCH した項目を、セッション開始時の内容へサーバー側でも戻す */
async function revertSessionFieldChangesToSnapshot (
  currentTasks: WbsTask[],
  snapshotTasks: WbsTask[],
): Promise<void> {
  const snapById = new Map(snapshotTasks.map(task => [task.id, task]))
  const requests: Promise<unknown>[] = []
  for (const current of currentTasks) {
    const snapshot = snapById.get(current.id)
    if (!snapshot) {
      continue
    }
    const body = buildFieldRevertPatch(current, snapshot)
    if (!body) {
      continue
    }
    requests.push(
      api(
        `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${current.id}`,
        { method: 'PATCH', body },
      ),
    )
  }
  if (requests.length === 0) {
    return
  }
  await Promise.all(requests)
}
async function abandonEditSession (opts?: { restoreFields?: boolean }): Promise<boolean> {
  const snapshot = reorderSnapshot.value
  if (!snapshot) {
    editMode.value = false
    return true
  }
  const currentTasks = cloneWbsTasks(tasks.value)
  const restoreFields = opts?.restoreFields !== false
  editSaving.value = true
  error.value = null
  try {
    if (restoreFields) {
      await revertSessionFieldChangesToSnapshot(currentTasks, snapshot.tasks)
    }
    tasks.value = cloneWbsTasks(snapshot.tasks)
    collapsedParentIds.value = new Set(snapshot.collapsedParentIds)
    patchCachedTasks(
      props.orgSlug,
      props.workspaceId,
      snapshot.tasks.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description ?? null,
        list_id: task.list_id ?? null,
        sort_order: task.sort_order,
        parent_task_id: task.parent_task_id ?? null,
        is_parent_task: Boolean(task.is_parent_task),
        start_date: task.start_date ?? null,
        due_date: task.due_date ?? null,
        gantt_bar_color: task.gantt_bar_color ?? null,
        effort_hours: task.effort_hours ?? null,
        progress_rate: task.progress_rate ?? null,
        labels: task.labels,
        assignees: task.assignees,
      })),
    )
    persistWbsCache()
    reorderSnapshot.value = null
    editMode.value = false
    return true
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '変更の破棄に失敗しました'
    return false
  } finally {
    editSaving.value = false
  }
}
async function cancelEdit (): Promise<boolean> {
  if (!editMode.value || editSaving.value) {
    return false
  }
  dismissEditInteractions()
  return abandonEditSession({ restoreFields: true })
}
async function confirmEdit (): Promise<boolean> {
  if (!editMode.value || editSaving.value) {
    return false
  }
  await persistAndDismissEditInteractions()
  editSaving.value = true
  error.value = null
  try {
    const ok = await saveWbsOrder(tasks.value)
    if (!ok) {
      reorderSnapshot.value = null
      editMode.value = false
      return false
    }
    const snapshot = reorderSnapshot.value
    if (snapshot) {
      collapsedParentIds.value = new Set(snapshot.collapsedParentIds)
    }
    reorderSnapshot.value = null
    editMode.value = false
    return true
  } finally {
    editSaving.value = false
  }
}
function normalizeEffortForDiff (value: WbsTask['effort_hours']): number | null {
  if (value == null || value === '') {
    return null
  }
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}
function normalizeProgressRateForDiff (value: WbsTask['progress_rate']): number | null {
  if (value == null || value === '') {
    return null
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 100) {
    return null
  }
  return n
}
function serializeTaskForSessionDiff (task: WbsTask) {
  const description = (task.description ?? '').trim()
  return {
    id: task.id,
    title: (task.title ?? '').trim(),
    description: description === '' ? null : description,
    list_id: task.list_id ?? null,
    start_date: normalizeDateOnly(task.start_date),
    due_date: normalizeDateOnly(task.due_date),
    effort_hours: normalizeEffortForDiff(task.effort_hours),
    progress_rate: normalizeProgressRateForDiff(task.progress_rate),
    gantt_bar_color: task.gantt_bar_color?.trim().toLowerCase() || null,
    sort_order: task.sort_order ?? 0,
    parent_task_id: task.parent_task_id ?? null,
    is_parent_task: Boolean(task.is_parent_task),
    assignee_ids: (task.assignees ?? []).map(member => member.id).sort((a, b) => a - b),
    label_ids: (task.labels ?? []).map(label => label.id).sort((a, b) => a - b),
  }
}
function hasSessionDiffFromSnapshot (): boolean {
  if (!reorderSnapshot.value) {
    return false
  }
  const current = tasks.value
    .map(serializeTaskForSessionDiff)
    .sort((a, b) => a.id - b.id)
  const snapshot = reorderSnapshot.value.tasks
    .map(serializeTaskForSessionDiff)
    .sort((a, b) => a.id - b.id)
  if (current.length !== snapshot.length) {
    return true
  }
  return JSON.stringify(current) !== JSON.stringify(snapshot)
}
function isTitleDraftDirty (): boolean {
  if (editingTitleTaskId.value == null) {
    return false
  }
  const task = tasks.value.find(row => row.id === editingTitleTaskId.value)
  if (!task) {
    return false
  }
  return titleDraft.value.trim() !== task.title
}
/**
 * 編集開始時スナップショットと実データが違うときだけ未保存。
 * 一度変えても元に戻せば false（確認モーダルなし）。
 */
const hasUnsavedChanges = computed(() => {
  if (!editMode.value) {
    return false
  }
  if (editSaving.value) {
    return true
  }
  if (isTitleDraftDirty()) {
    return true
  }
  return hasSessionDiffFromSnapshot()
})
const {
  leaveModalOpen,
  leaveDiscarding,
  confirmDiscardAndLeave,
} = useUnsavedChangesGuard({
  isDirty: () => hasUnsavedChanges.value,
  onDiscard: async () => {
    const ok = await cancelEdit()
    if (!ok) {
      throw new Error('変更の破棄に失敗しました')
    }
  },
})
onDeactivated(() => {
  if (editSaving.value) {
    return
  }
  if (!editMode.value) {
    return
  }
  // ガード通過後の安全策（未保存なら破棄）
  void cancelEdit()
})
function toggleParentCollapse (parentId: number) {
  if (editMode.value) {
    return
  }
  closeTaskMenu()
  const next = new Set(collapsedParentIds.value)
  if (next.has(parentId)) {
    next.delete(parentId)
  } else {
    next.add(parentId)
  }
  collapsedParentIds.value = next
}
const closeTaskMenu = taskMenu.close
const onTaskMenuAfterLeave = taskMenu.onAfterLeave
const taskMenuStyle = taskMenu.style
function toggleTaskMenu (task: WbsTask, event: MouseEvent) {
  event.stopPropagation()
  event.preventDefault()
  taskMenu.toggle(task.id, event)
}
const taskMenuOpen = computed({
  get: () => openMenuTaskId.value !== null,
  set: (open: boolean) => {
    if (!open) {
      closeTaskMenu()
    }
  },
})
useDropdownEscapeClose(taskMenuOpen, closeTaskMenu)
function onTaskMenuSelect (item: FloatingMenuItem) {
  const task = openMenuTask.value
  if (!task) {
    return
  }
  if (item.key === 'detail') {
    openTaskDetail(task)
    return
  }
  if (item.key === 'archive') {
    openArchiveConfirm(task)
  }
}
function openTaskDetail (task: WbsTask) {
  closeTaskMenu()
  detailTaskId.value = task.id
}
function onTaskDetailNavigate (taskId: number) {
  if (detailTaskId.value === taskId) {
    return
  }
  detailTaskId.value = taskId
}
function onTaskDetailMissing () {
  detailTaskId.value = null
  void navigateTo(`/org/${props.orgSlug}/workspaces`, { replace: true })
}
function onTaskDetailUpdated (detail: TaskDetail) {
  const listName = workspaceLists.value.find(list => list.id === detail.list_id)?.name ?? null
  syncTaskUpdate({
    id: detail.id,
    title: detail.title,
    description: detail.description ?? null,
    list_id: detail.list_id,
    list_name: listName,
    start_date: detail.start_date ?? null,
    due_date: detail.due_date ?? null,
    effort_hours: detail.effort_hours ?? null,
    progress_rate: detail.progress_rate ?? null,
    labels: detail.labels ?? [],
    assignees: detail.assignees ?? [],
  })
  const idx = tasks.value.findIndex(task => task.id === detail.id)
  if (idx < 0) {
    return
  }
  const current = tasks.value[idx]!
  const nextParentId = 'parent_task_id' in detail ? detail.parent_task_id ?? null : current.parent_task_id
  const nextIsParent = 'is_parent_task' in detail ? detail.is_parent_task ?? false : current.is_parent_task
  tasks.value[idx] = {
    ...current,
    parent_task_id: nextParentId,
    is_parent_task: nextIsParent,
    checklists: detail.checklists ?? current.checklists,
  }
  persistWbsCache()
}
function openArchiveConfirm (task: WbsTask) {
  closeTaskMenu()
  archiveConfirmTask.value = task
}
async function confirmArchiveTask () {
  const task = archiveConfirmTask.value
  if (!task || archivePending.value) {
    return
  }
  archivePending.value = true
  error.value = null
  const childSnapshots = tasks.value.filter(row => row.parent_task_id === task.id)
  try {
    await withAppLoadingCursor(async () => {
      await api(`/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.id}/archive`, {
        method: 'POST',
      })
      archiveConfirmTask.value = null
      if (detailTaskId.value === task.id) {
        detailTaskId.value = null
      }
      const removeIds = new Set<number>([task.id, ...childSnapshots.map(child => child.id)])
      tasks.value = tasks.value.filter(row => !removeIds.has(row.id))
      for (const childId of removeIds) {
        removeRealtimeWbsTask(childId)
      }
      upsertArchivedTask(props.orgSlug, props.workspaceId, {
        id: task.id,
        title: task.title,
        list_id: task.list_id,
        archived_at: new Date().toISOString(),
        labels: task.labels ?? [],
        assignees: task.assignees ?? [],
        start_date: task.start_date ?? null,
        due_date: task.due_date ?? null,
        effort_hours: task.effort_hours ?? null,
        progress_rate: task.progress_rate ?? null,
        is_parent_task: Boolean(task.is_parent_task),
        parent_task_id: task.parent_task_id ?? null,
        parent_task_title: resolveParentTaskTitle(task, [...childSnapshots, task]),
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
          parent_task_id: task.id,
          parent_task_title: task.title,
          archived_child_count: 0,
          archived_children: [],
        })),
      })
      const boardCached = getBoardCached(props.orgSlug, props.workspaceId)
      if (boardCached?.tasks) {
        replaceCachedBoardState(props.orgSlug, props.workspaceId, {
          ...boardCached,
          tasks: boardCached.tasks.filter(row => !removeIds.has(row.id)),
        })
      }
    })
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'アーカイブに失敗しました'
  } finally {
    archivePending.value = false
  }
}
function syncTaskUpdate (updated: TaskPopoverEditable) {
  const idx = tasks.value.findIndex(task => task.id === updated.id)
  if (idx < 0) return
  const current = tasks.value[idx]!
  // 並び順はドラッグ操作のみで変更する
  const nextSortOrder = current.sort_order
  const nextStart = updated.start_date ?? null
  const nextDue = updated.due_date ?? null
  const datesChanged = normalizeDateOnly(current.start_date) !== normalizeDateOnly(nextStart)
    || normalizeDateOnly(current.due_date) !== normalizeDateOnly(nextDue)
  const { nextColor, colorChanged } = datesChanged
    ? resolveGanttColorForDateChange(current, nextStart, nextDue)
    : { nextColor: current.gantt_bar_color ?? null, colorChanged: false }
  // 更新は当該タスクのみ。他バーの色・日付は触らない
  tasks.value[idx] = {
    ...current,
    title: updated.title,
    description: updated.description,
    list_id: updated.list_id ?? current.list_id,
    list_name: updated.list_name ?? current.list_name,
    sort_order: nextSortOrder,
    start_date: nextStart,
    due_date: nextDue,
    ...(colorChanged ? { gantt_bar_color: nextColor } : {}),
    effort_hours: updated.effort_hours,
    progress_rate: updated.progress_rate,
    assignees: updated.assignees,
    labels: updated.labels,
  }
  patchCachedTasks(props.orgSlug, props.workspaceId, [{
    id: updated.id,
    title: updated.title,
    description: updated.description,
    list_id: updated.list_id ?? current.list_id,
    sort_order: nextSortOrder,
    start_date: nextStart,
    due_date: nextDue,
    ...(colorChanged ? { gantt_bar_color: nextColor } : {}),
    effort_hours: updated.effort_hours,
    progress_rate: updated.progress_rate,
    assignees: updated.assignees,
    labels: updated.labels,
  }])
  persistWbsCache()
  if (colorChanged) {
    void api(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${updated.id}`,
      { method: 'PATCH', body: { gantt_bar_color: nextColor } },
    ).catch(() => {
      // 日付は保存済み。色の追従失敗時は再表示でフォールバック色を使う
    })
  }
}
function dayCellStyle (task: WbsTask, dayIso: string) {
  const barColor = resolveTaskGanttBarColor(task)
  const style: Record<string, string> = {
    '--gantt-selection-color': barColor,
  }
  if (shouldShowFilledBar(task, dayIso)) {
    // セル背景は行色のまま。バー本体だけ ::before に色を載せる
    style['--gantt-bar-color'] = barColor
  }
  return style
}
async function applyVisibleMonth (year: number, month: number) {
  const scroller = wbsScrollEl.value
  const scrollLeft = scroller?.scrollLeft ?? 0
  const scrollTop = scroller?.scrollTop ?? 0
  visibleYear.value = year
  visibleMonth.value = month
  await nextTick()
  if (!scroller) {
    return
  }
  scroller.scrollLeft = scrollLeft
  scroller.scrollTop = scrollTop
}
function goPrevMonth () {
  const next = shiftVisibleMonth(visibleYear.value, visibleMonth.value, -1)
  void applyVisibleMonth(next.year, next.month)
}
function goNextMonth () {
  const next = shiftVisibleMonth(visibleYear.value, visibleMonth.value, 1)
  void applyVisibleMonth(next.year, next.month)
}
function goCurrentMonth () {
  const now = currentYearMonth()
  void applyVisibleMonth(now.year, now.month)
}
function openGanttColorPopover (taskId: number, clientX: number, clientY: number) {
  const task = tasks.value.find(row => row.id === taskId)
  if (!task || !resolveTaskDateRange(task)) {
    return
  }
  if (colorPopoverOpen.value && colorPopoverTaskId.value === taskId) {
    pendingGanttColorOpen.value = null
    closeColorPopover()
    return
  }
  if (colorPopoverOpen.value) {
    pendingGanttColorOpen.value = { taskId, clientX, clientY }
    colorPopoverOpen.value = false
    return
  }
  applyGanttColorPopoverOpen(taskId, clientX, clientY)
}
function applyGanttColorPopoverOpen (taskId: number, clientX: number, clientY: number) {
  const task = tasks.value.find(row => row.id === taskId)
  if (!task || !resolveTaskDateRange(task)) {
    return
  }
  colorPopoverTaskId.value = taskId
  colorPopoverValue.value = resolveTaskGanttBarColor(task)
  colorPopoverAnchor.value = {
    top: clientY,
    left: clientX,
    right: clientX,
  }
  colorPopoverOpen.value = true
}
function closeColorPopover () {
  pendingGanttColorOpen.value = null
  colorPopoverOpen.value = false
}
function onColorPopoverAfterLeave () {
  if (!colorPopoverOpen.value) {
    colorPopoverAnchor.value = null
    colorPopoverTaskId.value = null
  }
  const pending = pendingGanttColorOpen.value
  if (!pending) {
    return
  }
  pendingGanttColorOpen.value = null
  applyGanttColorPopoverOpen(pending.taskId, pending.clientX, pending.clientY)
}
function syncTaskGanttColor (taskId: number, color: string) {
  const idx = tasks.value.findIndex(task => task.id === taskId)
  if (idx < 0) {
    return
  }
  clearUnsavedGanttBarColor(taskId)
  // 色ピッカー対象の1タスクのみ更新する
  tasks.value[idx] = {
    ...tasks.value[idx]!,
    gantt_bar_color: color,
  }
  patchCachedTasks(props.orgSlug, props.workspaceId, [{
    id: taskId,
    gantt_bar_color: color,
  }])
  persistWbsCache()
}
async function saveGanttBarColor (color: string) {
  const taskId = colorPopoverTaskId.value
  if (taskId == null || colorSaving.value) {
    return
  }
  colorPopoverValue.value = color
  colorSaving.value = true
  error.value = null
  try {
    await api(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${taskId}`,
      { method: 'PATCH', body: { gantt_bar_color: color } },
    )
    syncTaskGanttColor(taskId, color)
    closeColorPopover()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'ガントバーの色の更新に失敗しました'
  } finally {
    colorSaving.value = false
  }
}
async function clearGanttBarColor () {
  const taskId = colorPopoverTaskId.value
  if (taskId == null || colorSaving.value) {
    return
  }
  const task = tasks.value.find(row => row.id === taskId)
  if (!task?.gantt_bar_color?.trim()) {
    return
  }
  colorSaving.value = true
  error.value = null
  try {
    await api(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${taskId}`,
      { method: 'PATCH', body: { gantt_bar_color: null } },
    )
    clearUnsavedGanttBarColor(taskId)
    const idx = tasks.value.findIndex(row => row.id === taskId)
    if (idx >= 0) {
      tasks.value[idx] = {
        ...tasks.value[idx]!,
        gantt_bar_color: null,
      }
      patchCachedTasks(props.orgSlug, props.workspaceId, [{
        id: taskId,
        gantt_bar_color: null,
      }])
      persistWbsCache()
      colorPopoverValue.value = resolveTaskGanttBarColor(tasks.value[idx]!)
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'ガントバーの色の更新に失敗しました'
  } finally {
    colorSaving.value = false
  }
}
function applyWbsSnapshot (snapshot: WorkspaceWbsPageSnapshot) {
  unsavedGanttBarColorByTaskId.clear()
  tasks.value = snapshot.tasks
  orgLabels.value = snapshot.orgLabels
  orgLabelCategories.value = snapshot.orgLabelCategories ?? []
  workspaceMembersSnapshot.value = snapshot.workspaceMembers
  workspaceLists.value = snapshot.workspaceLists
}
function buildWbsSnapshot (): WorkspaceWbsPageSnapshot {
  return {
    tasks: tasks.value,
    orgLabels: orgLabels.value,
    orgLabelCategories: orgLabelCategories.value,
    workspaceMembers: workspaceMembers.value,
    workspaceLists: workspaceLists.value,
  }
}
function persistWbsCache () {
  if (tasks.value.length === 0 && loading.value) {
    return
  }
  setWbsCached(props.orgSlug, props.workspaceId, buildWbsSnapshot())
  touchCachedWorkspaceUpdatedAt(props.orgSlug, Number(props.workspaceId))
}
async function bindAndOpen (
  task: WbsTask,
  opener: (event?: Event) => void,
  event: Event,
) {
  if (!editMode.value) {
    return
  }
  await editLayerRef.value?.bindTask(task)
  opener(event)
}
function openPeriod (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openDatePicker(e), event)
}
function openEffort (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openEffortPicker(e), event)
}
function openProgressRate (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openProgressRatePicker(e), event)
}
function openMembers (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openMemberPicker(e), event)
}
function onMembersCellClick (task: WbsTask, event: MouseEvent) {
  if (!editMode.value) {
    return
  }
  openMembers(task, event)
}
async function openMemberDetail (task: WbsTask, member: TaskFormMember, event: Event) {
  await editLayerRef.value?.bindTask(task)
  editLayerRef.value?.openMemberDetail(member, event)
}
function openLabels (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openLabelPicker(e), event)
}
async function openDescription (task: WbsTask, event: Event) {
  if (!editMode.value && !task.description?.trim()) {
    return
  }
  await editLayerRef.value?.bindTask(task)
  editLayerRef.value?.openDescriptionPicker(event)
}
function openList (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openListPicker(e), event)
}
function listNameStyle (listId: number | null | undefined) {
  const color = resolveListColor(listId, workspaceLists.value)
  return color ? { color } : undefined
}
async function startTitleEdit (task: WbsTask, opts?: { clientX?: number }) {
  closeTaskMenu()
  titleEditOpening = true
  editingTitleTaskId.value = task.id
  titleDraft.value = task.title
  await nextTick()
  const el = titleInputEls.get(task.id)
  if (el) {
    el.focus({ preventScroll: true })
    if (opts?.clientX != null) {
      const index = caretIndexAtClientX(el, opts.clientX)
      el.setSelectionRange(index, index)
    } else {
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
  }
  requestAnimationFrame(() => {
    titleEditOpening = false
  })
}
function onTitleFieldActivate (task: WbsTask, event?: Event) {
  if (!editMode.value || editingTitleTaskId.value === task.id) {
    return
  }
  if (event instanceof MouseEvent && event.button !== 0) {
    return
  }
  if (event?.target instanceof Element && event.target.closest('.workspace-wbs__toggle, .workspace-wbs__drag-handle, .workspace-wbs__task-menu')) {
    return
  }
  // click（ドラッグなし）でのみ入力開始。pointerdown だと画面ドラッグスクロールできない
  const clientX = event instanceof MouseEvent ? event.clientX : undefined
  void startTitleEdit(task, { clientX })
}
function onTitleCellMouseDown (task: WbsTask, event: MouseEvent) {
  if (editingTitleTaskId.value !== task.id) return
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('.workspace-wbs__title-input')) return
  if (target.closest('.workspace-wbs__toggle, .workspace-wbs__drag-handle, .workspace-wbs__task-menu')) return
  event.preventDefault()
}
function cancelTitleEdit () {
  titleEditOpening = false
  editingTitleTaskId.value = null
  titleDraft.value = ''
}
async function confirmTitleEdit (task: WbsTask) {
  if (titleEditOpening || titleSaving.value || editingTitleTaskId.value !== task.id) return
  const title = titleDraft.value.trim()
  if (!title || title === task.title) {
    cancelTitleEdit()
    return
  }
  titleSaving.value = true
  try {
    await api<{ title: string }>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.id}`,
      { method: 'PATCH', body: { title } },
    )
    syncTaskUpdate({ ...task, title })
    cancelTitleEdit()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'タスク名の更新に失敗しました'
  } finally {
    titleSaving.value = false
  }
}
async function loadWbsTasks (opts?: { silent?: boolean }) {
  const generation = ++wbsLoadGeneration
  const showLoading = !opts?.silent
  if (showLoading) {
    wbsLoadingDepth += 1
    loading.value = true
  }
  error.value = null
  try {
    const [tasksRes, labelCategoriesRes, listsRes] = await Promise.all([
      api<{ data: WbsTask[] }>(
        `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/wbs`,
      ),
      api<{ data: LabelCategoryGroup[] }>(
        `/orgs/${props.orgSlug}/task-label-categories`,
      ),
      api<{ data: WorkspaceListOption[] }>(
        `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/lists`,
      ),
    ])
    const orgLabelCategoriesNext = normalizeLabelCategories(labelCategoriesRes.data ?? [])
    if (generation !== wbsLoadGeneration) {
      return
    }
    // サイレント再取得中に編集が始まった場合はタスク並びを上書きしない
    if (opts?.silent && editMode.value) {
      orgLabels.value = flattenLabelCategories(orgLabelCategoriesNext)
      orgLabelCategories.value = orgLabelCategoriesNext
      workspaceLists.value = resolveListColors([...(listsRes.data ?? [])]).sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      )
      persistWbsCache()
      return
    }
    const catalogLabels = flattenLabelCategories(orgLabelCategoriesNext)
    tasks.value = (tasksRes.data ?? []).map(task => ({
      ...task,
      assignees: sortMembersByDisplayName(task.assignees ?? []),
      labels: task.labels ? resolveAndSortLabels(task.labels, catalogLabels) : task.labels,
    }))
    orgLabels.value = catalogLabels
    orgLabelCategories.value = orgLabelCategoriesNext
    workspaceLists.value = resolveListColors([...(listsRes.data ?? [])]).sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )
    persistWbsCache()
  } catch (e: unknown) {
    if (generation !== wbsLoadGeneration) {
      return
    }
    if (!opts?.silent) {
      const message = e instanceof Error ? e.message : 'WBSの読み込みに失敗しました'
      if (isAccessDeniedMessage(message)) {
        await navigateTo(`/org/${props.orgSlug}/workspaces`, { replace: true })
        return
      }
      error.value = message
      tasks.value = []
      orgLabels.value = []
      orgLabelCategories.value = []
      workspaceMembersSnapshot.value = []
      workspaceLists.value = []
    }
  } finally {
    if (showLoading) {
      wbsLoadingDepth = Math.max(0, wbsLoadingDepth - 1)
      if (wbsLoadingDepth === 0) {
        loading.value = false
      }
    }
  }
}
watch(
  () => [props.orgSlug, props.workspaceId] as const,
  () => {
    editMode.value = false
    editSaving.value = false
    reorderSnapshot.value = null
    collapsedParentIds.value = new Set()
    dismissEditInteractions()
    // ボード切替時に枠組待ちを短くするため、裏でボードキャッシュを温める
    void warmWorkspaceBoardCache(props.orgSlug, props.workspaceId)
    const cached = getWbsCached(props.orgSlug, props.workspaceId)
    if (cached) {
      applyWbsSnapshot(cached)
      loading.value = false
      void loadWbsTasks({ silent: true })
      return
    }
    void loadWbsTasks()
  },
  { immediate: true },
)
function refreshOnViewSwitch (): Promise<void> {
  // 編集セッション中はローカル並びを壊さない
  if (editMode.value) {
    return Promise.resolve()
  }
  // keep-alive 済みで既に表示データがあるときはキャッシュ再適用でちらつかせない
  if (tasks.value.length === 0) {
    const cached = getWbsCached(props.orgSlug, props.workspaceId)
    if (cached) {
      applyWbsSnapshot(cached)
    }
  }
  return loadWbsTasks({ silent: tasks.value.length > 0 })
}

function realtimeTaskToWbsTask (task: RealtimeBoardTask): WbsTask {
  const listId = task.list_id ?? null
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    list_id: listId,
    list_name: workspaceLists.value.find(list => list.id === listId)?.name ?? null,
    start_date: task.start_date ?? null,
    due_date: task.due_date ?? null,
    gantt_bar_color: task.gantt_bar_color ?? null,
    effort_hours: task.effort_hours ?? null,
    progress_rate: task.progress_rate ?? null,
    labels: task.labels ? resolveAndSortLabels(task.labels, orgLabels.value) : [],
    assignees: sortMembersByDisplayName(task.assignees ?? []),
    sort_order: task.sort_order,
    is_parent_task: task.is_parent_task,
    parent_task_id: task.parent_task_id ?? null,
  }
}

function upsertRealtimeWbsTask (task: RealtimeBoardTask) {
  const next = realtimeTaskToWbsTask(task)
  const idx = tasks.value.findIndex(row => row.id === next.id)
  const inEditSession = editMode.value && reorderSnapshot.value !== null

  if (idx >= 0) {
    // 編集セッション中はローカルの項目・並びを優先し、既存タスクの realtime 上書きで
    // 開始時スナップショットとの差分判定を壊さない
    if (inEditSession) {
      return
    }
    const current = tasks.value[idx]!
    tasks.value[idx] = {
      ...current,
      ...next,
      description: next.description ?? current.description ?? null,
      list_name: next.list_name ?? current.list_name ?? null,
      checklists: current.checklists,
    }
  } else {
    tasks.value = sortWbsTasks([...tasks.value, next])
  }
  if (reorderSnapshot.value) {
    const snapExists = reorderSnapshot.value.tasks.some(row => row.id === next.id)
    if (!snapExists) {
      // 編集中に新規追加されたタスクだけ基準へ含める（既存タスクの基準は書き換えない）
      reorderSnapshot.value = {
        ...reorderSnapshot.value,
        tasks: [...reorderSnapshot.value.tasks, cloneWbsTasks([next])[0]!],
      }
    }
  }
  persistWbsCache()
}

function removeRealtimeWbsTask (taskId: number) {
  if (!tasks.value.some(task => task.id === taskId)) {
    return
  }
  tasks.value = tasks.value.filter(task => task.id !== taskId)
  if (reorderSnapshot.value) {
    reorderSnapshot.value = {
      ...reorderSnapshot.value,
      tasks: reorderSnapshot.value.tasks.filter(task => task.id !== taskId),
    }
  }
  if (editingTitleTaskId.value === taskId) {
    cancelTitleEdit()
  }
  persistWbsCache()
}

function applyRealtimeWbsReorder (items: RealtimeWbsReorderItem[]) {
  if (editMode.value) {
    return
  }
  const byId = new Map(items.map(item => [item.id, item]))
  let changed = false
  const nextTasks = tasks.value.map((task) => {
    const item = byId.get(task.id)
    if (!item) {
      return task
    }
    if (
      task.sort_order === item.sort_order
      && (task.parent_task_id ?? null) === item.parent_task_id
    ) {
      return task
    }
    changed = true
    return {
      ...task,
      sort_order: item.sort_order,
      parent_task_id: item.parent_task_id,
    }
  })
  if (!changed) {
    return
  }
  tasks.value = sortWbsTasks(nextTasks)
  persistWbsCache()
}

const workspaceIdRef = computed(() => props.workspaceId)
useWorkspaceRealtimeChannel(workspaceIdRef, {
  onTaskCreated (task) {
    upsertRealtimeWbsTask(task)
  },
  onTaskUpdated (task) {
    upsertRealtimeWbsTask(task)
  },
  onTaskArchived ({ id, cascaded_task_ids }) {
    const removeIds = [id, ...(cascaded_task_ids ?? [])]
    for (const taskId of removeIds) {
      removeRealtimeWbsTask(taskId)
    }
  },
  onTaskRestored (task) {
    upsertRealtimeWbsTask(task)
  },
  onTaskDeleted (taskId) {
    removeRealtimeWbsTask(taskId)
  },
  onTasksReordered () {
    // ボード側の list 並び替えも sort_order を共有するため再取得
    if (editMode.value) {
      return
    }
    void loadWbsTasks({ silent: true })
  },
  onWbsTasksReordered (items) {
    applyRealtimeWbsReorder(items)
  },
  onListUpdated (list) {
    const resolved = resolveListColors([{
      id: list.id,
      name: list.name,
      color_index: list.color_index,
      sort_order: list.sort_order,
    }])[0]
    const idx = workspaceLists.value.findIndex(row => row.id === list.id)
    if (idx >= 0) {
      workspaceLists.value[idx] = {
        ...workspaceLists.value[idx]!,
        name: list.name,
        color_index: list.color_index,
        sort_order: list.sort_order,
        color: resolved?.color ?? workspaceLists.value[idx]!.color,
      }
    }
    tasks.value = tasks.value.map((task) => (
      task.list_id === list.id
        ? { ...task, list_name: list.name }
        : task
    ))
    persistWbsCache()
  },
  onListDeleted () {
    void loadWbsTasks({ silent: true })
  },
  onWorkspaceMembersUpdated ({ members, removed_member_ids }) {
    dispatchWorkspaceMembersUpdated({
      orgSlug: props.orgSlug,
      workspaceId: props.workspaceId,
      members,
      removedMemberIds: removed_member_ids,
    })
  },
})

defineExpose({
  refreshOnViewSwitch,
  editMode,
  editSaving,
  startEdit,
  cancelEdit,
  confirmEdit,
  openTaskAdd,
  openDisplayItems,
  hasActiveFilters: hasActiveWbsFilters,
  filterOpen: wbsFilterOpen,
  toggleFilter: toggleWbsFilter,
  closeFilter: closeWbsFilter,
  visibleTaskCount,
})
useOnUserProfileUpdated((detail) => {
  const nextTasks = applyUserProfileToTasks(tasks.value, detail)
  if (nextTasks !== tasks.value) {
    tasks.value = nextTasks
  }
  persistWbsCache()
})
useOnWorkspaceMembersUpdated((detail) => {
  if (!workspaceMembersUpdateMatchesView(detail, props.orgSlug, props.workspaceId)) {
    return
  }
  if (detail.removedMemberIds.length === 0) {
    return
  }
  const nextTasks = removeMembersFromTaskAssignees(tasks.value, detail.removedMemberIds)
  if (nextTasks !== tasks.value) {
    tasks.value = nextTasks
  }
  persistWbsCache()
})
watch(loading, async () => {
  await nextTick()
  const containerWidth = wbsScrollEl.value?.clientWidth
  if (!containerWidth) return
  if (
    !import.meta.client
    || (
      !localStorage.getItem(columnStorageKey.value)
      && !localStorage.getItem(`table-column-widths:${props.orgSlug}:${props.workspaceId}`)
    )
  ) {
    // 説明列の右側に約2週間分のガント日列が見えるよう余白を残す
    loadWidths(Math.max(480, containerWidth - GANTT_DAY_COL_WIDTH * 14))
  }
  void syncColumnContentMinWidths()
})
watch(
  () => tasks.value.map(task => `${task.id}:${task.title}`).join('\n'),
  () => {
    void syncColumnContentMinWidths()
  },
)
watch(
  () => [
    tasks.value.map(task => `${task.id}:${task.list_id}:${task.list_name ?? ''}`).join('\n'),
    workspaceLists.value.map(list => `${list.id}:${list.name}`).join('\n'),
  ].join('\n'),
  () => {
    void syncColumnContentMinWidths()
  },
)
</script>
<style lang="scss" scoped src="~/assets/styles/components/workspace/WorkspaceWbsView.scss"></style>
<style lang="scss" src="~/assets/styles/components/workspace/WorkspaceWbsView.global.scss"></style>
