<template>
  <div class="workspace-table-board">
    <div class="workspace-table-board__toolbar">
      <div class="workspace-table-board__month-nav">
        <button
          type="button"
          class="workspace-table-board__nav-btn"
          aria-label="前の月"
          @click="goPrevMonth"
        >
          ‹
        </button>
        <button
          type="button"
          class="workspace-table-board__nav-btn"
          aria-label="次の月"
          @click="goNextMonth"
        >
          ›
        </button>
      </div>
      <button
        type="button"
        class="workspace-table-board__today-btn"
        :disabled="isCurrentMonth"
        @click="goCurrentMonth"
      >
        今月
      </button>
    </div>
    <div v-if="loading" class="workspace-table-board__state">
      読み込み中...
    </div>
    <p v-else-if="error" class="workspace-table-board__error">{{ error }}</p>
    <p v-else-if="!displayRows.length" class="workspace-table-board__state">
      表示できるタスクがありません。
    </p>
    <div
      v-else
      ref="tableScrollEl"
      class="workspace-table-board__viewport"
      :class="{
        'workspace-table-board__viewport--dragging': dragging,
        'workspace-table-board__viewport--gantt-interacting': ganttPointerActive,
      }"
    >
      <div
        class="workspace-table-board__month-strip"
        :style="{ width: `${fullTableWidth}px` }"
      >
        <div
          class="workspace-table-board__month-strip-spacer"
          :style="{ width: `${tableWidth}px` }"
        />
        <span class="workspace-table-board__month-strip-label">{{ monthLabel }}</span>
      </div>
      <div class="workspace-table-board__frame">
        <div
          class="workspace-table-wrap"
          :class="{
            'workspace-table-wrap--resizing': isResizing,
            'workspace-table-wrap--dragging': dragging,
          }"
        >
        <table
          class="workspace-table"
          :class="{ 'workspace-table--edit': editMode }"
          :style="{
            '--table-width': `${fullTableWidth}px`,
            '--gantt-day-col-width': `${GANTT_DAY_COL_WIDTH}px`,
          }"
        >
        <colgroup>
          <col
            v-for="column in TABLE_COLUMNS"
            :key="column.key"
            :style="{ width: `${columnWidths[column.key]}px` }"
          >
          <col
            v-for="day in monthDays"
            :key="`col-${day.iso}`"
            class="workspace-table__day-col"
          >
        </colgroup>
        <thead>
          <tr>
            <th
              v-for="(column, columnIndex) in TABLE_COLUMNS"
              :key="column.key"
              scope="col"
              class="workspace-table__header-cell workspace-table__header-cell--sticky"
              :class="{
                'workspace-table__header-cell--sticky-edge': columnIndex === TABLE_COLUMNS.length - 1,
              }"
              :style="stickyDescStyle(columnIndex, true)"
            >
              <span class="workspace-table__header-label">{{ column.label }}</span>
              <span
                class="workspace-table__resize-handle"
                aria-hidden="true"
                @pointerdown="onResizePointerDown($event, column.key, 'right')"
                @pointermove="onResizePointerMove"
                @pointerup="onResizePointerUp"
                @pointercancel="onResizePointerCancel"
              />
            </th>
            <th
              v-for="day in monthDays"
              :key="`head-${day.iso}`"
              scope="col"
              class="workspace-table__day-header"
              :class="{
                'workspace-table__day-header--today': day.isToday,
                'workspace-table__day-header--weekend': day.isWeekend,
              }"
            >
              <span class="workspace-table__day-date">{{ day.day }}</span>
              <span class="workspace-table__day-weekday">{{ day.weekday }}</span>
            </th>
          </tr>
        </thead>
        <tbody ref="tableBodyEl">
          <tr
            v-for="(row, rowIndex) in displayRows"
            :key="`${row.kind}-${row.task.id}`"
            class="workspace-table__task-row"
            :class="{
              'workspace-table__task-row--parent': row.kind === 'parent',
              'workspace-table__task-row--child': row.kind === 'child',
              'workspace-table__task-row--drag-preview': draggingTaskIds.has(row.task.id),
            }"
            :data-table-row-index="rowIndex"
            :data-table-task-id="row.task.id"
          >
            <td
              class="workspace-table__task-title workspace-table__desc-cell"
              :style="stickyDescStyle(0)"
            >
              <div
                class="workspace-table__title-cell"
                :class="{
                  'workspace-table__title-cell--child': row.kind === 'child' && !editMode,
                  'workspace-table__title-cell--editable': editMode && editingTitleTaskId !== row.task.id,
                }"
                :tabindex="editMode && editingTitleTaskId !== row.task.id ? 0 : undefined"
                @click="onTitleFieldActivate(row.task, $event)"
                @mousedown="onTitleCellMouseDown(row.task, $event)"
                @keydown.enter.prevent="onTitleFieldActivate(row.task)"
              >
                <button
                  v-if="row.kind === 'parent' && !editMode"
                  type="button"
                  class="workspace-table__toggle"
                  :aria-expanded="!collapsedParentIds.has(row.task.id)"
                  :aria-label="collapsedParentIds.has(row.task.id) ? '子タスクを展開' : '子タスクを折りたたむ'"
                  @click.stop="toggleParentCollapse(row.task.id)"
                >
                  <ChevronDown
                    v-if="!collapsedParentIds.has(row.task.id)"
                    :size="16"
                    :stroke-width="2.25"
                    aria-hidden="true"
                  />
                  <ChevronRight
                    v-else
                    :size="16"
                    :stroke-width="2.25"
                    aria-hidden="true"
                  />
                </button>
                <button
                  v-else-if="editMode"
                  type="button"
                  class="workspace-table__drag-handle"
                  aria-label="ドラッグしてタスクの並び順を変更"
                  @pointerdown="onDragHandlePointerDown(row.task.id, $event)"
                  @click.prevent="onDragHandleClick"
                >
                  <Equal
                    :size="14"
                    :stroke-width="2.25"
                    aria-hidden="true"
                  />
                </button>
                <div
                  class="workspace-table__title-field"
                  :class="{ 'workspace-table__title-field--after-toggle': row.kind === 'parent' }"
                >
                  <span
                    v-if="editingTitleTaskId !== row.task.id"
                    class="workspace-table__title-text"
                    :title="row.task.title"
                  >{{ row.task.title }}</span>
                  <input
                    v-else
                    ref="titleInputEl"
                    v-model="titleDraft"
                    type="text"
                    class="workspace-table__title-input"
                    :maxlength="TASK_TITLE_MAX_LENGTH"
                    :disabled="titleSaving"
                    @click.stop
                    @blur="confirmTitleEdit(row.task)"
                    @keydown.enter.prevent="confirmTitleEdit(row.task)"
                  />
                </div>
              </div>
            </td>
            <td
              class="workspace-table__desc-cell"
              :style="stickyDescStyle(1)"
            >
              <div
                v-if="!isTableOrphanParentTask(row.task)"
                class="workspace-table__members-cell"
                :class="{
                  'workspace-table__members-cell--edit': editMode,
                  'workspace-table__members-cell--picker-open': isAssigneePickerActive(row.task.id),
                }"
                @click="onMembersCellClick(row.task, $event)"
              >
                <template v-if="row.task.assignees?.length">
                  <button
                    v-for="member in row.task.assignees"
                    :key="member.id"
                    type="button"
                    class="workspace-table__avatar-btn workspace-table__avatar-pill"
                    :class="{
                      'workspace-table__avatar-btn--active':
                        isAssigneeDetailActive(row.task.id, member.id),
                    }"
                    :aria-label="`${memberDisplayName(member)}の詳細`"
                    @click.stop="openMemberDetail(row.task, member, $event)"
                  >
                    <MemberAvatar
                      :member="member"
                      size="xs"
                      decorative
                    />
                  </button>
                </template>
                <button
                  v-if="editMode"
                  type="button"
                  class="workspace-table__avatar-btn workspace-table__avatar-btn--add"
                  :class="{ 'workspace-table__avatar-btn--active': isAssigneePickerActive(row.task.id) }"
                  aria-label="担当者を追加"
                  @click.stop="openMembers(row.task, $event)"
                >
                  <span class="workspace-table__avatar-btn-plus" aria-hidden="true">+</span>
                </button>
                <span
                  v-else-if="!row.task.assignees?.length"
                  class="workspace-table__placeholder"
                />
              </div>
              <span v-else class="workspace-table__placeholder" />
            </td>
            <td
              class="workspace-table__desc-cell"
              :style="stickyDescStyle(2)"
            >
              <div
                v-if="row.task.labels?.length && !isTableOrphanParentTask(row.task) && !editMode"
                class="workspace-table__labels-wrap"
              >
                <div class="workspace-table__labels workspace-table__labels--readonly">
                  <LabelStrip
                    v-for="label in row.task.labels"
                    :key="label.id"
                    :label="label"
                    size="sm"
                  />
                </div>
              </div>
              <button
                v-else-if="row.task.labels?.length && !isTableOrphanParentTask(row.task)"
                type="button"
                class="workspace-table__cell-btn"
                :class="{
                  'workspace-table__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'labels'),
                }"
                @click="openLabels(row.task, $event)"
              >
                <div class="workspace-table__labels">
                  <LabelStrip
                    v-for="label in row.task.labels"
                    :key="label.id"
                    :label="label"
                    size="sm"
                  />
                </div>
              </button>
              <button
                v-else-if="editMode && !isTableOrphanParentTask(row.task)"
                type="button"
                class="workspace-table__cell-btn"
                :class="{
                  'workspace-table__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'labels'),
                }"
                aria-label="ラベルを追加"
                @click="openLabels(row.task, $event)"
              >
                <div class="workspace-table__labels">
                  <span class="workspace-table__label-add-chip" aria-hidden="true">
                    <span class="workspace-table__label-add-plus" aria-hidden="true">+</span>
                  </span>
                </div>
              </button>
              <span v-else class="workspace-table__placeholder" />
            </td>
            <td
              class="workspace-table__desc-cell"
              :style="stickyDescStyle(3)"
            >
              <button
                v-if="!isTableOrphanParentTask(row.task)"
                type="button"
                class="workspace-table__cell-btn workspace-table__cell-btn--text"
                :class="{
                  'workspace-table__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'list'),
                  'workspace-table__cell-btn--readonly': !editMode,
                }"
                :tabindex="editMode ? undefined : -1"
                @click="openList(row.task, $event)"
              >
                <span
                  v-if="row.task.list_name"
                  class="workspace-table__ellipsis workspace-table__list-name"
                  :title="row.task.list_name"
                  :style="listNameStyle(row.task.list_id)"
                >{{ row.task.list_name }}</span>
                <span v-else class="workspace-table__placeholder" />
              </button>
              <span v-else class="workspace-table__placeholder" />
            </td>
            <td
              class="workspace-table__desc-cell"
              :style="stickyDescStyle(4)"
            >
              <button
                v-if="!isTableOrphanParentTask(row.task)"
                type="button"
                class="workspace-table__cell-btn workspace-table__cell-btn--text"
                :class="{
                  'workspace-table__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'startDate'),
                  'workspace-table__cell-btn--readonly': !editMode,
                }"
                :tabindex="editMode ? undefined : -1"
                @click="openStartDate(row.task, $event)"
              >
                <span v-if="formatTableDate(row.task.start_date)">{{ formatTableDate(row.task.start_date) }}</span>
                <span v-else class="workspace-table__placeholder" />
              </button>
              <span v-else class="workspace-table__placeholder" />
            </td>
            <td
              class="workspace-table__desc-cell"
              :style="stickyDescStyle(5)"
            >
              <button
                v-if="!isTableOrphanParentTask(row.task)"
                type="button"
                class="workspace-table__cell-btn workspace-table__cell-btn--text"
                :class="{
                  'workspace-table__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'dueDate'),
                  'workspace-table__cell-btn--readonly': !editMode,
                }"
                :tabindex="editMode ? undefined : -1"
                @click="openDueDate(row.task, $event)"
              >
                <span v-if="formatTableDate(row.task.due_date)">{{ formatTableDate(row.task.due_date) }}</span>
                <span v-else class="workspace-table__placeholder" />
              </button>
              <span v-else class="workspace-table__placeholder" />
            </td>
            <td
              class="workspace-table__desc-cell"
              :style="stickyDescStyle(6)"
            >
              <button
                v-if="!isTableOrphanParentTask(row.task)"
                type="button"
                class="workspace-table__cell-btn workspace-table__cell-btn--text"
                :class="{
                  'workspace-table__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'effort'),
                  'workspace-table__cell-btn--readonly': !editMode,
                }"
                :tabindex="editMode ? undefined : -1"
                @click="openEffort(row.task, $event)"
              >
                <span v-if="formatTableEffort(row.task, orgEffortUnit)">{{ formatTableEffort(row.task, orgEffortUnit) }}</span>
                <span v-else class="workspace-table__placeholder" />
              </button>
              <span v-else class="workspace-table__placeholder" />
            </td>
            <td
              class="workspace-table__desc-cell workspace-table__desc-cell--edge"
              :style="stickyDescStyle(7)"
            >
              <button
                v-if="!isTableOrphanParentTask(row.task)"
                type="button"
                class="workspace-table__cell-btn workspace-table__cell-btn--text workspace-table__cell-btn--notes"
                :class="{
                  'workspace-table__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'notes'),
                  'workspace-table__cell-btn--readonly': !editMode,
                }"
                :tabindex="editMode ? undefined : -1"
                @click="openDescription(row.task, $event)"
              >
                <span
                  v-if="formatTableDescription(row.task.description)"
                  class="workspace-table__notes workspace-table__ellipsis"
                  :title="formatTableDescription(row.task.description)"
                >{{ formatTableDescription(row.task.description) }}</span>
                <span v-else class="workspace-table__placeholder" />
              </button>
              <span v-else class="workspace-table__placeholder" />
            </td>
            <td
              v-for="day in monthDays"
              :key="`${row.task.id}-${day.iso}`"
              class="workspace-table__day-cell"
              :class="{
                'workspace-table__day-cell--weekend': day.isWeekend,
                'workspace-table__day-cell--today': day.isToday,
                'workspace-table__day-cell--filled': shouldShowFilledBar(row.task, day.iso),
                'workspace-table__day-cell--selected': isSelectedFilledBarDay(row.task, day.iso),
                'workspace-table__day-cell--create-preview': isDaySelectionOutlined(row.task, day.iso),
                'workspace-table__day-cell--create-preview-start': isSelectionStartDay(row.task, day.iso),
                'workspace-table__day-cell--create-preview-end': isSelectionEndDay(row.task, day.iso),
                'workspace-table__day-cell--interactive': editMode && !isTableOrphanParentTask(row.task),
                'workspace-table__day-cell--dragging': ganttDragging,
              }"
              :style="dayCellStyle(row.task, day.iso)"
              @pointerdown="onDayCellPointerDown(row.task.id, day.iso, $event)"
              @contextmenu.prevent
            >
              <button
                v-if="editMode && !isTableOrphanParentTask(row.task) && isBarStartDay(row.task, day.iso)"
                type="button"
                class="workspace-table__gantt-edge workspace-table__gantt-edge--start"
                aria-label="開始日を変更"
                @pointerdown.stop="onDayCellPointerDown(row.task.id, day.iso, $event, 'start-edge')"
              />
              <button
                v-if="editMode && !isTableOrphanParentTask(row.task) && isBarEndDay(row.task, day.iso)"
                type="button"
                class="workspace-table__gantt-edge workspace-table__gantt-edge--end"
                aria-label="終了日を変更"
                @pointerdown.stop="onDayCellPointerDown(row.task.id, day.iso, $event, 'end-edge')"
              />
            </td>
          </tr>
        </tbody>
        </table>
        <div
          class="workspace-table__resize-overlay"
          aria-hidden="true"
        >
          <span
            v-for="(boundary, boundaryIndex) in columnResizeBoundaries"
            :key="`guide-${boundary.columnKey}`"
            class="workspace-table__resize-guide"
            :class="{ 'workspace-table__resize-guide--no-line': boundaryIndex === columnResizeBoundaries.length - 1 }"
            :style="{ left: `${boundary.offset}px` }"
          />
        </div>
      </div>
      </div>
    </div>
    <WorkspaceGanttColorPopover
      :open="colorPopoverOpen"
      :model-value="colorPopoverValue"
      :anchor="colorPopoverAnchor"
      :saving="colorSaving"
      @close="closeColorPopover"
      @select="saveGanttBarColor"
    />
    <TaskEditPopoverLayer
      ref="editLayerRef"
      :org-slug="orgSlug"
      :workspace-id="workspaceId"
      :org-labels="orgLabels"
      :workspace-members="workspaceMembers"
      :workspace-lists="workspaceLists"
      :allow-member-remove="editMode"
      @updated="syncTaskUpdate"
      @popover-active-change="onPopoverActiveChange"
    />
  </div>
</template>
<script setup lang="ts">
import { ChevronDown, ChevronRight, Equal } from 'lucide-vue-next'
import {
  buildTableDisplayRows,
  buildTableReorderPayload,
  formatTableDate,
  formatTableDescription,
  formatTableEffort,
  hasTableOrphanChildTasks,
  isTableOrphanParentTask,
  ORPHAN_PARENT_DEFAULT_LABEL,
  type TableTask,
} from '../../composables/useTableTaskGroups'
import {
  useTableTaskDragReorder,
  TABLE_LIST_DRAG_SURFACE,
} from '../../composables/useTableTaskDragReorder'
import {
  TABLE_COLUMNS,
  useTableColumnResize,
} from '../../composables/useTableColumnResize'
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
import type { TaskFormLabel, TaskFormMember } from '../../composables/useTaskFormHelpers'
import { memberDisplayName } from '../../composables/useMemberDisplay'
import { useApi } from '../../composables/useApi'
import { TASK_TITLE_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { useOrgEffortUnit } from '../../composables/useOrgEffortSettings'
import { useWorkspaceBoardPageData } from '../../composables/useWorkspaceBoardPageData'
import { useWorkspaceTablePageData, type WorkspaceTablePageSnapshot } from '../../composables/useWorkspaceTablePageData'
import { resolveLabelColors, resolveListColors } from '../../utils/colorPresetResolution'
import { syncAppLoadingCursor } from '../../composables/useAppLoadingCursor'
import WorkspaceGanttColorPopover from './WorkspaceGanttColorPopover.vue'
import TaskEditPopoverLayer from '../task/TaskEditPopoverLayer.vue'

const GANTT_DAY_COL_WIDTH = 34

const props = defineProps<{
  orgSlug: string
  workspaceId: string
}>()
const emit = defineEmits<{
  'edit-mode-change': [active: boolean]
  'edit-saving-change': [saving: boolean]
}>()
const { api } = useApi()
const { patchCachedTasks } = useWorkspaceBoardPageData()
const { getCached: getTableCached, setCached: setTableCached } = useWorkspaceTablePageData()
const { orgEffortUnit, ensureOrgEffortUnit } = useOrgEffortUnit(() => props.orgSlug)
const loading = ref(false)
const error = ref<string | null>(null)
const tasks = ref<TableTask[]>([])
const orphanParentLabel = ref(ORPHAN_PARENT_DEFAULT_LABEL)
const orphanParentSortOrder = ref<number | null>(null)
const orgLabels = ref<TaskFormLabel[]>([])
const workspaceMembers = ref<TaskFormMember[]>([])
const workspaceLists = ref<WorkspaceListOption[]>([])
const collapsedParentIds = ref<Set<number>>(new Set())
const editMode = ref(false)
const editSaving = ref(false)
const initialMonth = currentYearMonth()
const visibleYear = ref(initialMonth.year)
const visibleMonth = ref(initialMonth.month)
const colorPopoverOpen = ref(false)
const colorPopoverAnchor = ref<{ top: number; left: number } | null>(null)
const colorPopoverValue = ref('')
const colorPopoverTaskId = ref<number | null>(null)
const colorSaving = ref(false)
const ganttDateSaving = ref(false)
type TableReorderSnapshot = {
  tasks: TableTask[]
  orphanParentSortOrder: number | null
  collapsedParentIds: Set<number>
}
const reorderSnapshot = ref<TableReorderSnapshot | null>(null)
watch(editMode, (active) => {
  emit('edit-mode-change', active)
}, { immediate: true })
watch(editSaving, (saving) => {
  emit('edit-saving-change', saving)
}, { immediate: true })
const editLayerRef = ref<InstanceType<typeof TaskEditPopoverLayer> | null>(null)
type TablePopoverCellField = 'assignees' | 'labels' | 'list' | 'startDate' | 'dueDate' | 'effort' | 'notes'
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
function popoverTypeToCellField (popover: PopoverType): TablePopoverCellField | null {
  switch (popover) {
    case 'start-date': return 'startDate'
    case 'due-date': return 'dueDate'
    case 'effort': return 'effort'
    case 'members':
    case 'member-detail': return 'assignees'
    case 'labels': return 'labels'
    case 'list': return 'list'
    case 'description': return 'notes'
    default: return null
  }
}
function isPopoverCellActive (taskId: number, field: TablePopoverCellField): boolean {
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
const tableBusy = computed(() => (
  loading.value || titleSaving.value || editSaving.value || colorSaving.value || ganttDateSaving.value
))
syncAppLoadingCursor(tableBusy)
const titleInputEl = ref<HTMLInputElement | HTMLInputElement[] | null>(null)
const tableScrollEl = ref<HTMLElement | null>(null)
const tableBodyEl = ref<HTMLTableSectionElement | null>(null)
const columnStorageKey = computed(() => `table-column-widths:${props.orgSlug}:${props.workspaceId}`)
const {
  columnWidths,
  tableWidth,
  columnResizeBoundaries,
  isResizing,
  loadWidths,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onResizePointerCancel,
} = useTableColumnResize(columnStorageKey, { leadingColWidth: 0 })
const monthDays = computed(() => buildMonthDays(visibleYear.value, visibleMonth.value))
const monthDayIsos = computed(() => monthDays.value.map(day => day.iso))
const monthLabel = computed(() => formatGanttMonthLabel(visibleYear.value, visibleMonth.value))
const fullTableWidth = computed(() => (
  tableWidth.value + monthDays.value.length * GANTT_DAY_COL_WIDTH
))
const isCurrentMonth = computed(() => {
  const now = currentYearMonth()
  return visibleYear.value === now.year && visibleMonth.value === now.month
})
const stickyLeftOffsets = computed(() => {
  const offsets: number[] = []
  let left = 0
  for (const column of TABLE_COLUMNS) {
    offsets.push(left)
    left += columnWidths.value[column.key]
  }
  return offsets
})
function stickyDescStyle (columnIndex: number, isHeader = false) {
  const left = stickyLeftOffsets.value[columnIndex] ?? 0
  const stack = TABLE_COLUMNS.length - columnIndex
  return {
    left: `${left}px`,
    zIndex: (isHeader ? 20 : 5) + stack,
  }
}
const {
  dragging,
  activeRows,
  draggingTaskIds,
  onDragHandlePointerDown: onDragHandlePointerDownInner,
  shouldSuppressClick,
} = useTableTaskDragReorder({
  tasks,
  tableBodyEl,
  collapsedParentIds,
  orphanParentLabel,
  orphanParentSortOrder,
  surface: TABLE_LIST_DRAG_SURFACE,
  onCommit: commitTableOrderFromDrag,
})
const displayRows = computed(() => {
  if (dragging.value) {
    return activeRows.value
  }
  return buildTableDisplayRows(
    tasks.value,
    collapsedParentIds.value,
    orphanParentLabel.value,
    orphanParentSortOrder.value,
  )
})
/** 既存バー数から、次に自動割当する色を決める（作成時・未保存プレビュー用） */
function nextAutoGanttBarColor (excludeTaskId?: number): string {
  let barCount = 0
  for (const task of tasks.value) {
    if (excludeTaskId != null && task.id === excludeTaskId) {
      continue
    }
    if (isTableOrphanParentTask(task)) {
      continue
    }
    if (!resolveTaskDateRange(task)) {
      continue
    }
    barCount += 1
  }
  return ganttBarColorAtSequenceIndex(barCount)
}
function resolveTaskGanttBarColor (task: TableTask): string {
  if (task.gantt_bar_color?.trim()) {
    return resolveGanttBarColor(task)
  }
  // 未保存: いまのバー並びにおける位置の色（他バー削除で保存色は動かさない）
  return nextAutoGanttBarColor(task.id)
}
async function commitGanttDateRange (taskId: number, start: string | null, end: string | null) {
  const idx = tasks.value.findIndex(task => task.id === taskId)
  if (idx < 0 || isTableOrphanParentTask(tasks.value[idx]!)) {
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
  const shouldAssignColor = Boolean(nextStart && nextDue) && !current.gantt_bar_color?.trim()
  const shouldClearColor = !nextStart && !nextDue && Boolean(current.gantt_bar_color?.trim())
  const nextColor = shouldAssignColor
    ? nextAutoGanttBarColor(taskId)
    : (shouldClearColor ? null : prevColor)
  const colorChanged = shouldAssignColor || shouldClearColor
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
  persistTableCache()
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
    persistTableCache()
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
  clickSelection: ganttClickSelection,
  isDaySelectionOutlined,
  isSelectionStartDay,
  isSelectionEndDay,
  isSelectedFilledBarDay,
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
      && !isTableOrphanParentTask(task)
      && !ganttDateSaving.value
      && !colorSaving.value,
    )
  },
  getTask: (taskId) => tasks.value.find(row => row.id === taskId) ?? null,
  onCommitRange: commitGanttDateRange,
  onFilledBarDoubleClick: openGanttColorPopover,
  dayIsoList: () => monthDayIsos.value,
  scrollContainer: tableScrollEl,
})
watch(ganttClickSelection, (selection) => {
  if (!colorPopoverOpen.value) {
    return
  }
  if (!selection || selection.taskId !== colorPopoverTaskId.value) {
    closeColorPopover()
  }
})
function cloneTableTasks (source: TableTask[]): TableTask[] {
  return structuredClone(toRaw(source))
}
function onDragHandlePointerDown (taskId: number, event: PointerEvent) {
  if (!editMode.value || editSaving.value) {
    return
  }
  onDragHandlePointerDownInner(taskId, event)
}
function onDragHandleClick () {
  if (shouldSuppressClick()) {
    return
  }
}
function applyLocalTableOrder (
  updatedTasks: TableTask[],
  nextOrphanParentSortOrder: number | null,
) {
  if (!hasTableOrphanChildTasks(updatedTasks)) {
    orphanParentSortOrder.value = nextOrphanParentSortOrder
  }
}
async function commitTableOrderFromDrag (
  updatedTasks: TableTask[],
  nextOrphanParentSortOrder: number | null,
) {
  applyLocalTableOrder(updatedTasks, nextOrphanParentSortOrder)
  if (!editMode.value) {
    await saveTableOrder(updatedTasks, nextOrphanParentSortOrder)
  }
}
async function saveTableOrder (
  updatedTasks: TableTask[],
  nextOrphanParentSortOrder: number | null,
): Promise<boolean> {
  try {
    const body: {
      tasks: ReturnType<typeof buildTableReorderPayload>
      orphan_parent_sort_order?: number | null
    } = {
      tasks: buildTableReorderPayload(updatedTasks),
    }
    if (!hasTableOrphanChildTasks(updatedTasks)) {
      body.orphan_parent_sort_order = nextOrphanParentSortOrder
    }
    await api<{ data: { ok: boolean } }>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/table/reorder`,
      {
        method: 'PATCH',
        body,
      },
    )
    if (!hasTableOrphanChildTasks(updatedTasks)) {
      orphanParentSortOrder.value = nextOrphanParentSortOrder
    }
    persistTableCache()
    patchCachedTasks(
      props.orgSlug,
      props.workspaceId,
      updatedTasks
        .filter(task => !isTableOrphanParentTask(task))
        .map(task => ({
          id: task.id,
          sort_order: task.sort_order,
          parent_task_id: task.parent_task_id ?? null,
          is_parent_task: task.is_parent_task,
        })),
    )
    return true
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'タスクの並び順の保存に失敗しました'
    await loadTableTasks()
    return false
  }
}
function dismissEditInteractions () {
  cancelTitleEdit()
  editLayerRef.value?.closePopover()
  closeColorPopover()
}
function startEdit () {
  if (editMode.value || loading.value || !displayRows.value.length) {
    return
  }
  reorderSnapshot.value = {
    tasks: cloneTableTasks(tasks.value),
    orphanParentSortOrder: orphanParentSortOrder.value,
    collapsedParentIds: new Set(collapsedParentIds.value),
  }
  collapsedParentIds.value = new Set()
  editMode.value = true
}
function cancelEdit () {
  if (!editMode.value || editSaving.value) {
    return
  }
  dismissEditInteractions()
  const snapshot = reorderSnapshot.value
  if (snapshot) {
    tasks.value = cloneTableTasks(snapshot.tasks)
    orphanParentSortOrder.value = snapshot.orphanParentSortOrder
    collapsedParentIds.value = new Set(snapshot.collapsedParentIds)
  }
  reorderSnapshot.value = null
  editMode.value = false
}
async function confirmEdit () {
  if (!editMode.value || editSaving.value) {
    return
  }
  dismissEditInteractions()
  editSaving.value = true
  error.value = null
  try {
    const ok = await saveTableOrder(tasks.value, orphanParentSortOrder.value)
    if (!ok) {
      reorderSnapshot.value = null
      editMode.value = false
      return
    }
    const snapshot = reorderSnapshot.value
    if (snapshot) {
      collapsedParentIds.value = new Set(snapshot.collapsedParentIds)
    }
    reorderSnapshot.value = null
    editMode.value = false
  } finally {
    editSaving.value = false
  }
}
function toggleParentCollapse (parentId: number) {
  if (editMode.value) {
    return
  }
  const next = new Set(collapsedParentIds.value)
  if (next.has(parentId)) {
    next.delete(parentId)
  } else {
    next.add(parentId)
  }
  collapsedParentIds.value = next
}
function syncTaskUpdate (updated: TaskPopoverEditable) {
  const idx = tasks.value.findIndex(task => task.id === updated.id)
  if (idx < 0) return
  const current = tasks.value[idx]!
  const listChanged = updated.list_id !== undefined && updated.list_id !== current.list_id
  tasks.value[idx] = {
    ...current,
    title: updated.title,
    description: updated.description,
    list_id: updated.list_id ?? current.list_id,
    list_name: updated.list_name ?? current.list_name,
    sort_order: listChanged ? current.sort_order : (updated.sort_order ?? current.sort_order),
    start_date: updated.start_date,
    due_date: updated.due_date,
    effort_value: updated.effort_value,
    effort_hours: updated.effort_hours,
    effort_unit: updated.effort_unit,
    assignees: updated.assignees,
    labels: updated.labels,
  }
  patchCachedTasks(props.orgSlug, props.workspaceId, [{
    id: updated.id,
    title: updated.title,
    description: updated.description,
    list_id: updated.list_id ?? current.list_id,
    sort_order: listChanged ? current.sort_order : (updated.sort_order ?? current.sort_order),
    start_date: updated.start_date,
    due_date: updated.due_date,
    effort_value: updated.effort_value,
    effort_hours: updated.effort_hours,
    effort_unit: updated.effort_unit,
    assignees: updated.assignees,
    labels: updated.labels,
  }])
  persistTableCache()
}
function dayCellStyle (task: TableTask, dayIso: string) {
  const barColor = resolveTaskGanttBarColor(task)
  const style: Record<string, string> = {
    '--gantt-selection-color': barColor,
  }
  if (shouldShowFilledBar(task, dayIso)) {
    style.backgroundColor = barColor
  }
  return style
}
function goPrevMonth () {
  const next = shiftVisibleMonth(visibleYear.value, visibleMonth.value, -1)
  visibleYear.value = next.year
  visibleMonth.value = next.month
}
function goNextMonth () {
  const next = shiftVisibleMonth(visibleYear.value, visibleMonth.value, 1)
  visibleYear.value = next.year
  visibleMonth.value = next.month
}
function goCurrentMonth () {
  const now = currentYearMonth()
  visibleYear.value = now.year
  visibleMonth.value = now.month
}
function openGanttColorPopover (taskId: number, clientX: number, clientY: number) {
  const task = tasks.value.find(row => row.id === taskId)
  if (!task || isTableOrphanParentTask(task) || !resolveTaskDateRange(task)) {
    return
  }
  if (colorPopoverOpen.value && colorPopoverTaskId.value === taskId) {
    closeColorPopover()
    return
  }
  colorPopoverTaskId.value = taskId
  colorPopoverValue.value = resolveTaskGanttBarColor(task)
  colorPopoverAnchor.value = {
    top: clientY,
    left: clientX,
  }
  colorPopoverOpen.value = true
}
function closeColorPopover () {
  if (colorSaving.value) {
    return
  }
  colorPopoverOpen.value = false
  colorPopoverAnchor.value = null
  colorPopoverTaskId.value = null
}
function syncTaskGanttColor (taskId: number, color: string) {
  const idx = tasks.value.findIndex(task => task.id === taskId)
  if (idx < 0) {
    return
  }
  tasks.value[idx] = {
    ...tasks.value[idx]!,
    gantt_bar_color: color,
  }
  patchCachedTasks(props.orgSlug, props.workspaceId, [{
    id: taskId,
    gantt_bar_color: color,
  }])
  persistTableCache()
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
function applyTableSnapshot (snapshot: WorkspaceTablePageSnapshot) {
  tasks.value = snapshot.tasks
  orphanParentLabel.value = snapshot.orphanParentLabel
  orphanParentSortOrder.value = snapshot.orphanParentSortOrder
  orgLabels.value = snapshot.orgLabels
  workspaceMembers.value = snapshot.workspaceMembers
  workspaceLists.value = snapshot.workspaceLists
}
function buildTableSnapshot (): WorkspaceTablePageSnapshot {
  return {
    tasks: tasks.value,
    orphanParentLabel: orphanParentLabel.value,
    orphanParentSortOrder: orphanParentSortOrder.value,
    orgLabels: orgLabels.value,
    workspaceMembers: workspaceMembers.value,
    workspaceLists: workspaceLists.value,
  }
}
function persistTableCache () {
  if (tasks.value.length === 0 && loading.value) {
    return
  }
  setTableCached(props.orgSlug, props.workspaceId, buildTableSnapshot())
}
function bindAndOpen (
  task: TableTask,
  opener: (event?: Event) => void,
  event: Event,
) {
  if (!editMode.value) {
    return
  }
  editLayerRef.value?.bindTask(task)
  opener(event)
}
function openStartDate (task: TableTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openDatePicker('start', e), event)
}
function openDueDate (task: TableTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openDatePicker('due', e), event)
}
function openEffort (task: TableTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openEffortPicker(e), event)
}
function openMembers (task: TableTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openMemberPicker(e), event)
}
function onMembersCellClick (task: TableTask, event: MouseEvent) {
  if (!editMode.value) {
    return
  }
  openMembers(task, event)
}
function openMemberDetail (task: TableTask, member: TaskFormMember, event: Event) {
  editLayerRef.value?.bindTask(task)
  editLayerRef.value?.openMemberDetail(member, event)
}
function openLabels (task: TableTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openLabelPicker(e), event)
}
function openDescription (task: TableTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openDescriptionPicker(e), event)
}
function openList (task: TableTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openListPicker(e), event)
}
function listNameStyle (listId: number | null | undefined) {
  const color = resolveListColor(listId, workspaceLists.value)
  return color ? { color } : undefined
}
async function startTitleEdit (task: TableTask) {
  editingTitleTaskId.value = task.id
  titleDraft.value = task.title
  await nextTick()
  const el = Array.isArray(titleInputEl.value)
    ? titleInputEl.value[0]
    : titleInputEl.value
  el?.focus()
  el?.select()
}
function onTitleFieldActivate (task: TableTask, event?: Event) {
  if (!editMode.value || editingTitleTaskId.value === task.id) {
    return
  }
  if (event?.target instanceof Element && event.target.closest('.workspace-table__toggle, .workspace-table__drag-handle')) {
    return
  }
  void startTitleEdit(task)
}
function onTitleCellMouseDown (task: TableTask, event: MouseEvent) {
  if (editingTitleTaskId.value !== task.id) return
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('.workspace-table__title-input')) return
  if (target.closest('.workspace-table__toggle, .workspace-table__drag-handle')) return
  event.preventDefault()
}
function cancelTitleEdit () {
  editingTitleTaskId.value = null
  titleDraft.value = ''
}
async function confirmTitleEdit (task: TableTask) {
  if (titleSaving.value || editingTitleTaskId.value !== task.id) return
  const title = titleDraft.value.trim()
  if (!title || title === task.title) {
    cancelTitleEdit()
    return
  }
  titleSaving.value = true
  try {
    if (isTableOrphanParentTask(task)) {
      const res = await api<{ data: { orphan_parent_label: string } }>(
        `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/table/orphan-parent-label`,
        { method: 'PATCH', body: { label: title } },
      )
      orphanParentLabel.value = res.data.orphan_parent_label
      persistTableCache()
    } else {
      await api<{ title: string }>(
        `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/${task.id}`,
        { method: 'PATCH', body: { title } },
      )
      syncTaskUpdate({ ...task, title })
    }
    cancelTitleEdit()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'タスク名の更新に失敗しました'
  } finally {
    titleSaving.value = false
  }
}
async function loadTableTasks (opts?: { silent?: boolean }) {
  if (!opts?.silent) {
    loading.value = true
  }
  error.value = null
  try {
    const [, tasksRes, labelsRes, membersRes, listsRes] = await Promise.all([
      ensureOrgEffortUnit(),
      api<{ data: TableTask[]; meta?: { orphan_parent_label?: string; orphan_parent_sort_order?: number | null } }>(
        `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/table`,
      ),
      api<{ data: TaskFormLabel[] }>(
        `/orgs/${props.orgSlug}/task-labels`,
      ),
      api<{ data: TaskFormMember[] }>(
        `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/members`,
      ),
      api<{ data: WorkspaceListOption[] }>(
        `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/lists`,
      ),
    ])
    tasks.value = (tasksRes.data ?? []).map(task => ({
      ...task,
      labels: task.labels ? resolveLabelColors(task.labels) : task.labels,
    }))
    orphanParentLabel.value = tasksRes.meta?.orphan_parent_label?.trim()
      || ORPHAN_PARENT_DEFAULT_LABEL
    orphanParentSortOrder.value = tasksRes.meta?.orphan_parent_sort_order ?? null
    orgLabels.value = resolveLabelColors(labelsRes.data ?? [])
    workspaceMembers.value = membersRes.data ?? []
    workspaceLists.value = resolveListColors([...(listsRes.data ?? [])]).sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )
    persistTableCache()
  } catch (e: unknown) {
    if (!opts?.silent) {
      error.value = e instanceof Error ? e.message : 'Tableの読み込みに失敗しました'
      tasks.value = []
      orphanParentLabel.value = ORPHAN_PARENT_DEFAULT_LABEL
      orphanParentSortOrder.value = null
      orgLabels.value = []
      workspaceMembers.value = []
      workspaceLists.value = []
    }
  } finally {
    if (!opts?.silent) {
      loading.value = false
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
    const cached = getTableCached(props.orgSlug, props.workspaceId)
    if (cached) {
      applyTableSnapshot(cached)
      void loadTableTasks({ silent: true })
      return
    }
    void loadTableTasks()
  },
  { immediate: true },
)
function refreshOnViewSwitch (): Promise<void> {
  const cached = getTableCached(props.orgSlug, props.workspaceId)
  if (cached) {
    applyTableSnapshot(cached)
  }
  return loadTableTasks({ silent: tasks.value.length > 0 })
}
defineExpose({
  refreshOnViewSwitch,
  editMode,
  editSaving,
  startEdit,
  cancelEdit,
  confirmEdit,
})
watch(loading, async (isLoading) => {
  if (isLoading) return
  await nextTick()
  const containerWidth = tableScrollEl.value?.clientWidth
  if (!containerWidth) return
  if (!import.meta.client || !localStorage.getItem(columnStorageKey.value)) {
    // 説明列の右側に約2週間分のガント日列が見えるよう余白を残す
    loadWidths(Math.max(480, containerWidth - GANTT_DAY_COL_WIDTH * 14))
  }
})
</script>
<style lang="scss" scoped>
.workspace-table-board {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.workspace-table-board__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10.5px;
  margin-bottom: 6.3px;
  flex-shrink: 0;
}
.workspace-table-board__month-nav {
  display: inline-flex;
  align-items: center;
  gap: 4.9px;
}
.workspace-table-board__nav-btn,
.workspace-table-board__today-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid mixin.$border-light;
  border-radius: 6px;
  background: #fff;
  color: mixin.$text;
  cursor: pointer;
  font: inherit;
}
.workspace-table-board__nav-btn {
  width: 24.5px;
  height: 24.5px;
  padding: 0;
  font-size: 14px;
  line-height: 1;
}
.workspace-table-board__today-btn {
  height: 24.5px;
  padding: 0 9.1px;
  font-size: 14px;
  font-weight: 600;
}
.workspace-table-board__today-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.workspace-table-board__month-strip {
  display: flex;
  align-items: flex-end;
  width: fit-content;
  min-width: 100%;
  margin-bottom: 2.8px;
  flex-shrink: 0;
}
.workspace-table-board__month-strip-spacer {
  flex-shrink: 0;
}
.workspace-table-board__month-strip-label {
  flex: 1;
  min-width: 0;
  padding-left: 4.9px;
  font-size: 14px;
  font-weight: 700;
  color: mixin.$text;
  line-height: 1.2;
}
.workspace-table-board__viewport {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  overflow: auto;
}
.workspace-table-board__viewport--dragging {
  cursor: default;
  user-select: none;
}
.workspace-table-board__viewport--gantt-interacting {
  overflow: hidden;
  overscroll-behavior: none;
  touch-action: none;
}
.workspace-table-board__frame {
  display: block;
  width: fit-content;
  border: 1px solid mixin.$border-light;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}
.workspace-table-wrap {
  position: relative;
  width: fit-content;
}
.workspace-table-wrap--dragging {
  cursor: default;
}
.workspace-table-wrap--dragging .workspace-table__drag-handle {
  cursor: default;
}
.workspace-table-wrap--dragging .workspace-table__task-row--drag-preview {
  pointer-events: none;
}
.workspace-table-wrap--dragging .workspace-table__task-row--drag-preview .workspace-table__drag-handle {
  visibility: hidden;
}
.workspace-table-wrap--resizing {
  cursor: default;
  user-select: none;
}
.workspace-table__resize-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
}
.workspace-table-board__state,
.workspace-table-board__error {
  margin: 0;
  padding: 14px 3.5px;
  font-size: 14px;
}
.workspace-table-board__error {
  color: mixin.$danger;
  font-weight: 600;
}
.workspace-table {
  --table-row-height: 36px;
  --table-parent-row-height: 40px;
  --table-chip-height: 24px;
  --table-label-chip-width: 32px;
  --table-leading-control-width: 18.9px;
  --table-width: auto;
  --gantt-day-col-width: 34px;
  width: var(--table-width);
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 14px;
}
.workspace-table__day-col {
  width: var(--gantt-day-col-width);
}
.workspace-table__drag-handle {
  flex-shrink: 0;
  align-self: stretch;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: content-box;
  width: var(--table-leading-control-width);
  height: auto;
  margin: 0;
  padding: 0 8px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: mixin.$text-sub;
  cursor: pointer;
  touch-action: none;
}
.workspace-table__drag-handle:active {
  cursor: default;
}
.workspace-table-wrap--resizing .workspace-table__resize-handle {
  cursor: default;
}
.workspace-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  min-width: 0;
  padding: 7.7px 9.1px;
  background: mixin.$table-header-bg;
  border-bottom: 1px solid mixin.$table-header-bg;
  text-align: left;
  font-size: 14px;
  font-weight: 700;
  color: mixin.$white;
  white-space: nowrap;
  overflow: hidden;
  isolation: isolate;
}
.workspace-table__header-cell--sticky {
  box-shadow: 1px 0 0 rgba(255, 255, 255, 0.12);
}
.workspace-table__header-cell--sticky-edge {
  box-shadow: 2px 0 0 rgba(15, 23, 42, 0.12);
}
.workspace-table__header-label {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 4.9px;
}
.workspace-table__day-header {
  width: var(--gantt-day-col-width);
  min-width: var(--gantt-day-col-width);
  max-width: var(--gantt-day-col-width);
  padding: 4.2px 0;
  text-align: center;
  line-height: 1.05;
  box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.12);
}
.workspace-table__day-header--weekend {
  background: rgba(255, 255, 255, 0.08);
}
.workspace-table__day-header--today {
  box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.95);
}
.workspace-table__day-date {
  display: block;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.05;
}
.workspace-table__day-weekday {
  display: block;
  margin-top: 0.28px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.05;
  opacity: 0.92;
}
.workspace-table__resize-guide {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  pointer-events: none;
}
.workspace-table__resize-guide::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 1px;
  margin-left: -0.5px;
  background: rgba(148, 163, 184, 0.45);
}
.workspace-table__resize-guide--no-line::after {
  display: none;
}
.workspace-table__resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 10px;
  transform: translateX(50%);
  touch-action: none;
  cursor: col-resize;
  z-index: 1;
}
.workspace-table thead th:first-child {
  border-top-left-radius: 12px;
}
.workspace-table thead th:last-child {
  border-top-right-radius: 12px;
}
.workspace-table__task-row:last-child td:first-child {
  border-bottom-left-radius: 12px;
}
.workspace-table__task-row:last-child td:last-child {
  border-bottom-right-radius: 12px;
}
.workspace-table__task-row td {
  height: var(--table-row-height);
  max-height: var(--table-row-height);
  min-width: 0;
  padding: 0;
  border-bottom: 1px solid mixin.$border-light;
  vertical-align: middle;
  color: mixin.$text;
  line-height: 1.2;
  overflow: hidden;
}
.workspace-table__desc-cell {
  position: sticky;
  background: #fff;
  box-shadow: 1px 0 0 mixin.$border-light;
}
.workspace-table__desc-cell--edge {
  box-shadow: 2px 0 0 rgba(15, 23, 42, 0.12);
}
.workspace-table__task-row--parent .workspace-table__desc-cell {
  background: mixin.$table-parent-bg;
}
.workspace-table__day-cell {
  width: var(--gantt-day-col-width);
  min-width: var(--gantt-day-col-width);
  max-width: var(--gantt-day-col-width);
  padding: 0;
  background: #fff;
  position: relative;
  touch-action: none;
  user-select: none;
}
.workspace-table__task-row td.workspace-table__day-cell {
  border-left: none;
  overflow: visible;
  box-shadow: inset 1px 0 0 mixin.$border-light;
}
.workspace-table__day-cell--interactive {
  cursor: cell;
}
.workspace-table__day-cell--interactive.workspace-table__day-cell--filled {
  cursor: grab;
  transition: opacity 180ms ease;
}
.workspace-table__task-row td.workspace-table__day-cell--selected.workspace-table__day-cell--filled {
  opacity: 0.8;
}
.workspace-table__task-row td.workspace-table__day-cell--create-preview {
  z-index: 2;
}
.workspace-table__task-row td.workspace-table__day-cell--create-preview::after {
  content: '';
  position: absolute;
  top: -1px;
  right: 0;
  bottom: -1px;
  left: 0;
  box-sizing: border-box;
  border-top: 1px solid var(--gantt-selection-color, #{mixin.$main});
  border-bottom: 1px solid var(--gantt-selection-color, #{mixin.$main});
  pointer-events: none;
  z-index: 3;
}
.workspace-table__task-row td.workspace-table__day-cell--create-preview.workspace-table__day-cell--create-preview-start::after {
  border-left: 1px solid var(--gantt-selection-color, #{mixin.$main});
}
.workspace-table__task-row td.workspace-table__day-cell--create-preview.workspace-table__day-cell--create-preview-end::after {
  right: -1px;
  border-right: 1px solid var(--gantt-selection-color, #{mixin.$main});
}
.workspace-table__day-cell--dragging {
  cursor: grabbing;
}
.workspace-table__gantt-edge {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: ew-resize;
  z-index: 2;
}
.workspace-table__gantt-edge--start {
  left: 0;
}
.workspace-table__gantt-edge--end {
  right: 0;
}
.workspace-table__gantt-edge:focus-visible {
  outline: 2px solid mixin.$main;
  outline-offset: -2px;
}
.workspace-table--edit .workspace-table__task-row td:has(.workspace-table__cell-btn:not(.workspace-table__cell-btn--readonly)),
.workspace-table--edit .workspace-table__task-row td:has(.workspace-table__title-cell--editable) {
  cursor: pointer;
}
.workspace-table__task-row td > .workspace-table__placeholder {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  min-height: var(--table-row-height);
  padding: 0 9.1px;
}
.workspace-table__task-row:last-child td {
  border-bottom: none;
}
.workspace-table__task-row--parent td {
  height: var(--table-parent-row-height);
  max-height: var(--table-parent-row-height);
  background: mixin.$table-parent-bg;
}
.workspace-table__task-row--parent td > .workspace-table__placeholder {
  min-height: var(--table-parent-row-height);
}
.workspace-table__task-row--parent .workspace-table__cell-btn {
  min-height: var(--table-parent-row-height);
}
.workspace-table__task-title {
  font-weight: 700;
  padding-left: 0 !important;
}
.workspace-table__title-cell {
  display: flex;
  align-items: stretch;
  gap: 0;
  box-sizing: border-box;
  min-width: 0;
  width: 100%;
  height: var(--table-row-height);
  padding-right: 9.1px;
}
.workspace-table__title-cell--editable {
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.12s ease;
}
.workspace-table__title-cell--editable:hover {
  background: mixin.$main-aqua-surface-light;
}
.workspace-table__title-cell--editable:focus-visible {
  @include mixin.input-focus-ring;
  border-radius: 4px;
}
.workspace-table__task-row--parent .workspace-table__title-cell {
  height: var(--table-parent-row-height);
}
.workspace-table__title-cell--child {
  padding-left: var(--table-leading-control-width);
}
.workspace-table__title-field {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  align-self: stretch;
  box-sizing: border-box;
  min-height: 100%;
}
.workspace-table__title-field--after-toggle {
  padding-left: 4.9px;
}
.workspace-table__title-text,
.workspace-table__title-input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 0 4.9px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: inherit;
  font-family: inherit;
  line-height: 1;
  color: inherit;
}
.workspace-table__title-text {
  display: flex;
  align-items: center;
  align-self: stretch;
  min-height: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  border: 1px solid transparent;
}
.workspace-table__title-input {
  height: 24px;
  min-height: 24px;
  margin: auto 0;
  border: 1px solid mixin.$border;
  background: #fff;
  line-height: calc(24px - 2px);
}
.workspace-table__title-input:focus {
  @include mixin.input-focus-ring;
}
.workspace-table__toggle {
  flex-shrink: 0;
  align-self: stretch;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--table-leading-control-width);
  height: auto;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  color: mixin.$text-sub;
  cursor: pointer;
}
.workspace-table__ellipsis {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.workspace-table__cell-btn {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: var(--table-row-height);
  margin: 0;
  padding: 0 12.6px;
  border: none;
  border-radius: 0;
  background: transparent;
  text-align: left;
  color: inherit;
  font: inherit;
  cursor: pointer;
  overflow: hidden;
  transition: background-color 0.12s ease;
}
.workspace-table__cell-btn--popover-open {
  box-shadow: inset 0 0 0 1.4px mixin.$main;
}
.workspace-table__cell-btn--readonly {
  cursor: default;
}
.workspace-table__cell-btn:focus-visible {
  @include mixin.input-focus-ring;
}
.workspace-table__cell-btn--text {
  height: 100%;
  min-height: var(--table-row-height);
}
.workspace-table__task-row--parent .workspace-table__cell-btn--text {
  min-height: var(--table-parent-row-height);
}
.workspace-table__cell-btn--text > span:not(.workspace-table__placeholder) {
  display: block;
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.workspace-table__cell-btn--notes {
  max-width: 100%;
}
.workspace-table__cell-btn--text .workspace-table__labels {
  flex: 1;
  min-width: 0;
}
.workspace-table__placeholder {
  color: mixin.$text-sub;
  font-weight: 500;
}
.workspace-table__members-cell {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 2.8px;
  box-sizing: border-box;
  min-width: 0;
  width: 100%;
  min-height: var(--table-row-height);
  height: 100%;
  overflow: hidden;
  padding: 0 12.6px 0 14.6px;
}
.workspace-table__members-cell--edit {
  cursor: pointer;
}
.workspace-table__members-cell--picker-open {
  box-shadow: inset 0 0 0 1.4px mixin.$main;
}
.workspace-table__task-row--parent .workspace-table__members-cell {
  min-height: var(--table-parent-row-height);
}
.workspace-table__avatar-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--table-chip-height);
  height: var(--table-chip-height);
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  overflow: hidden;
}
.workspace-table__avatar-btn:focus-visible {
  @include mixin.input-focus-ring;
}
.workspace-table__avatar-btn--active {
  box-shadow: 0 0 0 1.4px mixin.$main;
}
.workspace-table__avatar-btn--add {
  border: 1.5px solid transparent;
  background: #fff;
  box-shadow: inset 0 0 0 1px mixin.$border;
  overflow: visible;
}
.workspace-table__avatar-btn--add.workspace-table__avatar-btn--active {
  box-shadow:
    inset 0 0 0 1px mixin.$border,
    0 0 0 1.4px mixin.$main;
}
.workspace-table__avatar-btn-plus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 400;
  line-height: 1;
  color: #64748b;
}
.workspace-table__avatar-pill {
  display: inline-flex;
  border-radius: 999px;
}
.workspace-table__avatar-pill :deep(.member-avatar) {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  border: 1.5px solid #fff;
}
.workspace-table__avatar-pill :deep(.member-avatar__initial) {
  font-size: 10px;
}
.workspace-table__labels-wrap {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: var(--table-row-height);
  padding: 0 12.6px;
  overflow: hidden;
}
.workspace-table__task-row--parent .workspace-table__labels-wrap {
  min-height: var(--table-parent-row-height);
}
.workspace-table__labels {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 2.8px;
  min-width: 0;
  overflow: hidden;
}
.workspace-table__labels--readonly :deep(.label-strip) {
  transition: opacity 0.12s ease;
}
.workspace-table__labels--readonly :deep(.label-strip:hover) {
  opacity: 0.8;
}
.workspace-table__labels :deep(.label-strip--sm) {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  height: var(--table-chip-height);
  width: max-content;
  min-width: var(--table-label-chip-width);
  max-width: none;
  flex-shrink: 0;
  justify-content: center;
  padding: 0 5.6px;
  font-size: 14px;
  line-height: 1;
  overflow: visible;
}
.workspace-table__labels :deep(.label-strip__text) {
  width: auto;
  overflow: visible;
  text-overflow: clip;
}
.workspace-table__label-add-chip {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--table-chip-height);
  width: var(--table-label-chip-width);
  min-width: var(--table-label-chip-width);
  padding: 0;
  border-radius: 4px;
  border: 1px solid mixin.$border;
  background: #fff;
  color: #64748b;
}
.workspace-table__label-add-plus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 400;
  line-height: 1;
  transform: translateY(-0.08em);
}
.workspace-table__notes {
  color: mixin.$text-sub;
}
</style>
<style lang="scss">
.workspace-table-drag-ghost {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 10000;
  pointer-events: none;
  cursor: default;
  opacity: 0.3;
}
</style>
