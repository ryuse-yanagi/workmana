<template>
  <div class="workspace-wbs-board">
    <div
      v-if="showGantt"
      class="workspace-wbs-board__toolbar"
    >
      <div class="workspace-wbs-board__month-nav">
        <button
          type="button"
          class="workspace-wbs-board__nav-btn"
          aria-label="前の月"
          @click="goPrevMonth"
        >
          ‹
        </button>
        <button
          type="button"
          class="workspace-wbs-board__nav-btn"
          aria-label="次の月"
          @click="goNextMonth"
        >
          ›
        </button>
      </div>
      <button
        type="button"
        class="workspace-wbs-board__today-btn"
        :disabled="isCurrentMonth"
        @click="goCurrentMonth"
      >
        今月
      </button>
    </div>
    <div v-if="loading" class="workspace-wbs-board__state">
      読み込み中...
    </div>
    <p v-else-if="error" class="workspace-wbs-board__error">{{ error }}</p>
    <p v-else-if="!hasDisplayRows" class="workspace-wbs-board__state">
      表示できるタスクがありません。
    </p>
    <div
      v-else
      ref="wbsScrollEl"
      class="workspace-wbs-board__viewport"
      :class="{
        'workspace-wbs-board__viewport--dragging': dragging,
        'workspace-wbs-board__viewport--gantt-interacting': ganttPointerActive,
      }"
    >
      <div
        v-if="showGantt"
        class="workspace-wbs-board__month-strip"
        :style="{ width: `${fullWbsWidth}px` }"
      >
        <div
          class="workspace-wbs-board__month-strip-spacer"
          :style="{ width: `${visibleWbsWidth}px` }"
        />
        <span class="workspace-wbs-board__month-strip-label">{{ monthLabel }}</span>
      </div>
      <div
        v-for="(section, sectionIndex) in wbsSections"
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
          :class="{ 'workspace-wbs--edit': editMode }"
          :style="{
            '--wbs-width': `${fullWbsWidth}px`,
            '--gantt-day-col-width': `${GANTT_DAY_COL_WIDTH}px`,
          }"
        >
        <colgroup>
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
          <tr>
            <th
              v-for="(column, columnIndex) in visibleColumns"
              :key="column.key"
              scope="col"
              class="workspace-wbs__header-cell workspace-wbs__header-cell--sticky"
              :class="{
                'workspace-wbs__header-cell--sticky-edge': columnIndex === visibleColumns.length - 1,
              }"
              :style="stickyDescStyleForKey(column.key, true)"
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
              v-for="day in ganttDays"
              :key="`head-${day.iso}`"
              scope="col"
              class="workspace-wbs__day-header"
              :class="{
                'workspace-wbs__day-header--today': day.isToday,
                'workspace-wbs__day-header--weekend': day.isWeekend,
              }"
            >
              <span class="workspace-wbs__day-date">{{ day.day }}</span>
              <span class="workspace-wbs__day-weekday">{{ day.weekday }}</span>
            </th>
          </tr>
        </thead>
        <tbody :ref="el => registerSectionBody(section.key, el)">
          <tr
            v-for="(row, rowIndex) in section.rows"
            :key="`${row.kind}-${row.task.id}`"
            class="workspace-wbs__task-row"
            :class="{
              'workspace-wbs__task-row--parent': row.kind === 'parent',
              'workspace-wbs__task-row--child': row.kind === 'child',
              'workspace-wbs__task-row--drag-preview': draggingTaskIds.has(row.task.id),
            }"
            :data-wbs-row-index="rowIndex"
            :data-wbs-task-id="row.task.id"
          >
            <td
              v-if="isColumnVisible('title')"
              class="workspace-wbs__task-title workspace-wbs__desc-cell"
              :class="{ 'workspace-wbs__desc-cell--edge': isLastVisibleColumn('title') }"
              :style="stickyDescStyleForKey('title')"
            >
              <div
                class="workspace-wbs__title-cell"
                :class="{
                  'workspace-wbs__title-cell--child': row.kind !== 'parent' && !editMode,
                  'workspace-wbs__title-cell--editable': editMode && editingTitleTaskId !== row.task.id,
                }"
                :tabindex="editMode && editingTitleTaskId !== row.task.id ? 0 : undefined"
                data-no-drag-scroll
                @pointerdown="onTitleFieldActivate(row.task, $event)"
                @mousedown="onTitleCellMouseDown(row.task, $event)"
                @keydown.enter.prevent="onTitleFieldActivate(row.task)"
              >
                <button
                  v-if="row.kind === 'parent' && !editMode"
                  type="button"
                  class="workspace-wbs__toggle"
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
                  class="workspace-wbs__drag-handle"
                  aria-label="ドラッグしてタスクの並び順を変更"
                  @pointerdown="onDragHandlePointerDown(section.key, row.task.id, $event)"
                  @click.prevent="onDragHandleClick"
                >
                  <Equal
                    :size="14"
                    :stroke-width="2.25"
                    aria-hidden="true"
                  />
                </button>
                <div
                  class="workspace-wbs__title-field"
                >
                  <span
                    v-if="editingTitleTaskId !== row.task.id"
                    class="workspace-wbs__title-text"
                    :title="row.task.title"
                  >{{ row.task.title }}</span>
                  <input
                    v-else
                    :ref="(el) => setTitleInputEl(row.task.id, el)"
                    v-model="titleDraft"
                    type="text"
                    class="workspace-wbs__title-input"
                    :data-task-id="row.task.id"
                    :maxlength="TASK_TITLE_MAX_LENGTH"
                    :disabled="titleSaving"
                    @pointerdown.stop
                    @click.stop
                    @blur="confirmTitleEdit(row.task)"
                    @keydown.enter.prevent="confirmTitleEdit(row.task)"
                  />
                </div>
              </div>
            </td>
            <td
              v-if="isColumnVisible('assignees')"
              class="workspace-wbs__desc-cell"
              :class="{ 'workspace-wbs__desc-cell--edge': isLastVisibleColumn('assignees') }"
              :style="stickyDescStyleForKey('assignees')"
            >
              <div
                class="workspace-wbs__members-cell"
                :class="{
                  'workspace-wbs__members-cell--edit': editMode,
                }"
                @click="onMembersCellClick(row.task, $event)"
              >
                <template v-if="row.task.assignees?.length">
                  <button
                    v-for="member in row.task.assignees"
                    :key="member.id"
                    type="button"
                    class="workspace-wbs__avatar-btn workspace-wbs__avatar-pill"
                    :class="{
                      'workspace-wbs__avatar-btn--active':
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
                  class="workspace-wbs__avatar-btn workspace-wbs__avatar-btn--add"
                  :class="{ 'workspace-wbs__avatar-btn--active': isAssigneePickerActive(row.task.id) }"
                  aria-label="担当者を追加"
                  @click.stop="openMembers(row.task, $event)"
                >
                  <span class="workspace-wbs__avatar-btn-plus" aria-hidden="true">+</span>
                </button>
                <span
                  v-else-if="!row.task.assignees?.length"
                  class="workspace-wbs__placeholder"
                />
              </div>
            </td>
            <td
              v-if="isColumnVisible('labels')"
              class="workspace-wbs__desc-cell"
              :class="{ 'workspace-wbs__desc-cell--edge': isLastVisibleColumn('labels') }"
              :style="stickyDescStyleForKey('labels')"
            >
              <div
                v-if="row.task.labels?.length && !editMode"
                class="workspace-wbs__labels-wrap"
              >
                <div class="workspace-wbs__labels workspace-wbs__labels--readonly">
                  <LabelStrip
                    v-for="label in row.task.labels"
                    :key="label.id"
                    :label="label"
                    size="sm"
                  />
                </div>
              </div>
              <button
                v-else-if="editMode"
                type="button"
                class="workspace-wbs__cell-btn"
                aria-label="ラベルを追加"
                @click="openLabels(row.task, $event)"
              >
                <div class="workspace-wbs__labels">
                  <LabelStrip
                    v-for="label in row.task.labels ?? []"
                    :key="label.id"
                    :label="label"
                    size="sm"
                  />
                  <span
                    class="workspace-wbs__label-add-chip"
                    :class="{
                      'workspace-wbs__label-add-chip--active': isPopoverCellActive(row.task.id, 'labels'),
                    }"
                    aria-hidden="true"
                  >
                    <span class="workspace-wbs__label-add-plus" aria-hidden="true">+</span>
                  </span>
                </div>
              </button>
              <span v-else class="workspace-wbs__placeholder" />
            </td>
            <td
              v-if="isColumnVisible('list')"
              class="workspace-wbs__desc-cell"
              :class="{ 'workspace-wbs__desc-cell--edge': isLastVisibleColumn('list') }"
              :style="stickyDescStyleForKey('list')"
            >
              <button
                type="button"
                class="workspace-wbs__cell-btn workspace-wbs__cell-btn--text"
                :class="{
                  'workspace-wbs__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'list'),
                  'workspace-wbs__cell-btn--readonly': !editMode,
                }"
                :tabindex="editMode ? undefined : -1"
                @click="openList(row.task, $event)"
              >
                <span
                  v-if="row.task.list_name"
                  class="workspace-wbs__ellipsis workspace-wbs__list-name"
                  :title="row.task.list_name"
                  :style="listNameStyle(row.task.list_id)"
                >{{ row.task.list_name }}</span>
                <span v-else class="workspace-wbs__placeholder" />
              </button>
            </td>
            <td
              v-if="isColumnVisible('startDate')"
              class="workspace-wbs__desc-cell"
              :class="{ 'workspace-wbs__desc-cell--edge': isLastVisibleColumn('startDate') }"
              :style="stickyDescStyleForKey('startDate')"
            >
              <button
                type="button"
                class="workspace-wbs__cell-btn workspace-wbs__cell-btn--text"
                :class="{
                  'workspace-wbs__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'startDate'),
                  'workspace-wbs__cell-btn--readonly': !editMode,
                }"
                :tabindex="editMode ? undefined : -1"
                @click="openStartDate(row.task, $event)"
              >
                <span v-if="formatWbsDate(row.task.start_date)">{{ formatWbsDate(row.task.start_date) }}</span>
                <span v-else class="workspace-wbs__placeholder" />
              </button>
            </td>
            <td
              v-if="isColumnVisible('dueDate')"
              class="workspace-wbs__desc-cell"
              :class="{ 'workspace-wbs__desc-cell--edge': isLastVisibleColumn('dueDate') }"
              :style="stickyDescStyleForKey('dueDate')"
            >
              <button
                type="button"
                class="workspace-wbs__cell-btn workspace-wbs__cell-btn--text"
                :class="{
                  'workspace-wbs__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'dueDate'),
                  'workspace-wbs__cell-btn--readonly': !editMode,
                }"
                :tabindex="editMode ? undefined : -1"
                @click="openDueDate(row.task, $event)"
              >
                <span v-if="formatWbsDate(row.task.due_date)">{{ formatWbsDate(row.task.due_date) }}</span>
                <span v-else class="workspace-wbs__placeholder" />
              </button>
            </td>
            <td
              v-if="isColumnVisible('effort')"
              class="workspace-wbs__desc-cell"
              :class="{ 'workspace-wbs__desc-cell--edge': isLastVisibleColumn('effort') }"
              :style="stickyDescStyleForKey('effort')"
            >
              <button
                type="button"
                class="workspace-wbs__cell-btn workspace-wbs__cell-btn--text"
                :class="{
                  'workspace-wbs__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'effort'),
                  'workspace-wbs__cell-btn--readonly': !editMode,
                }"
                :tabindex="editMode ? undefined : -1"
                @click="openEffort(row.task, $event)"
              >
                <span v-if="formatWbsEffort(row.task)">{{ formatWbsEffort(row.task) }}</span>
                <span v-else class="workspace-wbs__placeholder" />
              </button>
            </td>
            <td
              v-if="isColumnVisible('notes')"
              class="workspace-wbs__desc-cell"
              :class="{ 'workspace-wbs__desc-cell--edge': isLastVisibleColumn('notes') }"
              :style="stickyDescStyleForKey('notes')"
            >
              <button
                type="button"
                class="workspace-wbs__cell-btn workspace-wbs__cell-btn--text workspace-wbs__cell-btn--notes"
                :class="{
                  'workspace-wbs__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'notes'),
                  'workspace-wbs__cell-btn--readonly': !editMode && !row.task.description?.trim(),
                }"
                :aria-disabled="!editMode && !row.task.description?.trim()"
                @click="openDescription(row.task, $event)"
              >
                <span
                  v-if="formatWbsDescription(row.task.description)"
                  class="workspace-wbs__notes workspace-wbs__ellipsis"
                  :title="formatWbsDescription(row.task.description)"
                >{{ formatWbsDescription(row.task.description) }}</span>
                <span v-else class="workspace-wbs__placeholder" />
              </button>
            </td>
            <td
              v-for="day in ganttDays"
              :key="`${row.task.id}-${day.iso}`"
              class="workspace-wbs__day-cell"
              :class="{
                'workspace-wbs__day-cell--weekend': day.isWeekend,
                'workspace-wbs__day-cell--today': day.isToday,
                'workspace-wbs__day-cell--filled': shouldShowFilledBar(row.task, day.iso),
                'workspace-wbs__day-cell--selected': isSelectedFilledBarDay(row.task, day.iso),
                'workspace-wbs__day-cell--create-preview': isDaySelectionOutlined(row.task, day.iso),
                'workspace-wbs__day-cell--create-preview-start': isSelectionStartDay(row.task, day.iso),
                'workspace-wbs__day-cell--create-preview-end': isSelectionEndDay(row.task, day.iso),
                'workspace-wbs__day-cell--interactive': editMode,
                'workspace-wbs__day-cell--dragging': ganttDragging,
              }"
              :style="dayCellStyle(row.task, day.iso)"
              @pointerdown="onDayCellPointerDown(row.task.id, day.iso, $event)"
              @contextmenu.prevent
            >
              <button
                v-if="editMode && isBarStartDay(row.task, day.iso)"
                type="button"
                class="workspace-wbs__gantt-edge workspace-wbs__gantt-edge--start"
                aria-label="開始日を変更"
                @pointerdown.stop="onDayCellPointerDown(row.task.id, day.iso, $event, 'start-edge')"
              />
              <button
                v-if="editMode && isBarEndDay(row.task, day.iso)"
                type="button"
                class="workspace-wbs__gantt-edge workspace-wbs__gantt-edge--end"
                aria-label="終了日を変更"
                @pointerdown.stop="onDayCellPointerDown(row.task.id, day.iso, $event, 'end-edge')"
              />
            </td>
          </tr>
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
      :readonly-description="!editMode"
      @updated="syncTaskUpdate"
      @popover-active-change="onPopoverActiveChange"
    />
    <TaskCreateModal
      v-model="taskCreateOpen"
      :org-slug="orgSlug"
      :workspace-id="workspaceId"
      :list-id="taskCreateListId"
      :org-labels="orgLabels"
      :workspace-members="workspaceMembers"
      :workspace-lists="workspaceLists"
      @created="onTaskCreatedFromModal"
    />
    <WbsDisplayItemsModal
      v-model="displayItemsModalOpen"
      :selected-keys="visibleColumnKeys"
      @save="onDisplayItemsSave"
    />
  </div>
</template>
<script setup lang="ts">
import { ChevronDown, ChevronRight, Equal } from 'lucide-vue-next'
import {
  buildFullWbsDisplayRows,
  buildStandaloneWbsDisplayRows,
  buildWbsDisplayRows,
  buildWbsReorderPayload,
  formatWbsDate,
  formatWbsDescription,
  formatWbsEffort,
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
import type { TaskFormLabel, TaskFormMember } from '../../composables/useTaskFormHelpers'
import { memberDisplayName } from '../../composables/useMemberDisplay'
import { useApi } from '../../composables/useApi'
import { TASK_TITLE_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import {
  useWorkspaceBoardPageData,
  type WorkspaceBoardTask,
} from '../../composables/useWorkspaceBoardPageData'
import { useWorkspaceWbsPageData, type WorkspaceWbsPageSnapshot } from '../../composables/useWorkspaceWbsPageData'
import {
  useWorkspaceRealtimeChannel,
  type RealtimeBoardTask,
  type RealtimeWbsReorderItem,
} from '../../composables/useWorkspaceRealtimeChannel'
import { resolveLabelColors, resolveListColors } from '../../utils/colorPresetResolution'
import { syncAppLoadingCursor } from '../../composables/useAppLoadingCursor'
import WorkspaceGanttColorPopover from './WorkspaceGanttColorPopover.vue'
import TaskEditPopoverLayer from '../task/TaskEditPopoverLayer.vue'
import TaskCreateModal, { type CreatedTask } from '../modals/TaskCreateModal.vue'
import WbsDisplayItemsModal from '../modals/WbsDisplayItemsModal.vue'

const GANTT_DAY_COL_WIDTH = 34

const props = defineProps<{
  orgSlug: string
  workspaceId: string
}>()
const emit = defineEmits<{
  'edit-saving-change': [saving: boolean]
}>()
/** 親ヘッダーと双方向同期。ボタン操作は親が直接 true/false にする */
const editMode = defineModel<boolean>('editMode', { default: false })
const { api } = useApi()
const {
  patchCachedTasks,
  getCached: getBoardCached,
  replaceCachedBoardState,
} = useWorkspaceBoardPageData()
const { getCached: getWbsCached, setCached: setWbsCached } = useWorkspaceWbsPageData()
const loading = ref(false)
const error = ref<string | null>(null)
const tasks = ref<WbsTask[]>([])
const orgLabels = ref<TaskFormLabel[]>([])
const workspaceMembers = ref<TaskFormMember[]>([])
const workspaceLists = ref<WorkspaceListOption[]>([])
const collapsedParentIds = ref<Set<number>>(new Set())
const editSaving = ref(false)
const taskCreateOpen = ref(false)
const taskCreateListId = ref<number | null>(null)
const initialMonth = currentYearMonth()
const visibleYear = ref(initialMonth.year)
const visibleMonth = ref(initialMonth.month)
const colorPopoverOpen = ref(false)
const colorPopoverAnchor = ref<{ top: number; left: number; right: number } | null>(null)
const colorPopoverValue = ref('')
const colorPopoverTaskId = ref<number | null>(null)
const colorSaving = ref(false)
const ganttDateSaving = ref(false)
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
    // 親から false に戻された場合（モード切替など）はスナップショットを破棄
    if (reorderSnapshot.value && !editSaving.value) {
      reorderSnapshot.value = null
    }
    dismissEditInteractions()
  }
})
const editLayerRef = ref<InstanceType<typeof TaskEditPopoverLayer> | null>(null)
type WbsPopoverCellField = 'assignees' | 'labels' | 'list' | 'startDate' | 'dueDate' | 'effort' | 'notes'
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
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onResizePointerCancel,
} = useWbsColumnResize(columnStorageKey, { leadingColWidth: 0 })
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
  let offset = 0
  return visibleColumns.value.map((column) => {
    offset += columnWidths.value[column.key]
    return {
      columnKey: column.key,
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
const monthDayIsos = computed(() => monthDays.value.map(day => day.iso))
const monthLabel = computed(() => formatGanttMonthLabel(visibleYear.value, visibleMonth.value))
const fullWbsWidth = computed(() => (
  visibleWbsWidth.value + ganttDays.value.length * GANTT_DAY_COL_WIDTH
))
const isCurrentMonth = computed(() => {
  const now = currentYearMonth()
  return visibleYear.value === now.year && visibleMonth.value === now.month
})
const stickyLeftOffsetsByKey = computed(() => {
  const offsets = {} as Record<WbsColumnKey, number>
  let left = 0
  for (const column of visibleColumns.value) {
    offsets[column.key] = left
    left += columnWidths.value[column.key]
  }
  return offsets
})
function stickyDescStyleForKey (key: WbsColumnKey, isHeader = false) {
  const index = visibleColumns.value.findIndex(column => column.key === key)
  const left = stickyLeftOffsetsByKey.value[key] ?? 0
  const stack = Math.max(0, visibleColumns.value.length - index)
  return {
    left: `${left}px`,
    zIndex: (isHeader ? 20 : 5) + stack,
  }
}
type WbsSectionKey = 'grouped' | 'standalone'
const groupedDrag = useWbsTaskDragReorder({
  tasks,
  wbsBodyEl: groupedBodyEl,
  collapsedParentIds,
  buildRows: () => buildWbsDisplayRows(tasks.value, collapsedParentIds.value),
  buildExpandedRows: () => buildFullWbsDisplayRows(tasks.value),
  composeOrderedRows: rows => [...rows, ...buildStandaloneWbsDisplayRows(tasks.value)],
  surface: WBS_LIST_DRAG_SURFACE,
  onCommit: commitWbsOrderFromDrag,
})
const standaloneDrag = useWbsTaskDragReorder({
  tasks,
  wbsBodyEl: standaloneBodyEl,
  collapsedParentIds,
  buildRows: () => buildStandaloneWbsDisplayRows(tasks.value),
  buildExpandedRows: () => buildStandaloneWbsDisplayRows(tasks.value),
  composeOrderedRows: rows => [...buildFullWbsDisplayRows(tasks.value), ...rows],
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
      && !ganttDateSaving.value
      && !colorSaving.value,
    )
  },
  getTask: (taskId) => tasks.value.find(row => row.id === taskId) ?? null,
  onCommitRange: commitGanttDateRange,
  onFilledBarDoubleClick: openGanttColorPopover,
  dayIsoList: () => monthDayIsos.value,
  scrollContainer: wbsScrollEl,
})
watch(ganttClickSelection, (selection) => {
  if (!colorPopoverOpen.value) {
    return
  }
  if (!selection || selection.taskId !== colorPopoverTaskId.value) {
    closeColorPopover()
  }
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
  // 保存待ちの非同期 close ではなく、同期で閉じる（編集モード遷移を阻害しない）
  editLayerRef.value?.dismissPopover()
  closeColorPopover()
}
function defaultTaskCreateListId (): number | null {
  return workspaceLists.value[0]?.id ?? null
}
function openTaskCreate () {
  if (loading.value || editSaving.value) {
    return
  }
  dismissEditInteractions()
  taskCreateListId.value = defaultTaskCreateListId()
  taskCreateOpen.value = true
}
function createdTaskToWbsTask (created: CreatedTask): WbsTask {
  const listId = created.list_id ?? null
  return {
    id: created.id,
    title: created.title,
    description: created.description ?? null,
    created_at: created.created_at ?? null,
    status: created.status,
    list_id: listId,
    list_name: workspaceLists.value.find(list => list.id === listId)?.name ?? null,
    start_date: created.start_date ?? null,
    due_date: created.due_date ?? null,
    effort_hours: created.effort_hours ?? null,
    effort_value: created.effort_value ?? null,
    effort_unit: created.effort_unit ?? null,
    labels: created.labels ? resolveLabelColors(created.labels) : [],
    assignees: created.assignees ?? [],
    sort_order: created.sort_order,
    is_parent_task: created.is_parent_task,
    parent_task_id: created.parent_task_id ?? null,
  }
}
function createdTaskToBoardTask (created: CreatedTask): WorkspaceBoardTask {
  return {
    id: created.id,
    title: created.title,
    description: created.description ?? null,
    status: created.status,
    list_id: created.list_id ?? null,
    is_parent_task: created.is_parent_task,
    parent_task_id: created.parent_task_id ?? null,
    sort_order: created.sort_order,
    start_date: created.start_date ?? null,
    due_date: created.due_date ?? null,
    effort_hours: created.effort_hours ?? null,
    effort_value: created.effort_value ?? null,
    effort_unit: created.effort_unit ?? null,
    labels: created.labels ? resolveLabelColors(created.labels) : [],
    assignees: created.assignees ?? [],
  }
}
function syncBoardCacheAfterCreate (created: CreatedTask) {
  const cached = getBoardCached(props.orgSlug, props.workspaceId)
  if (!cached) {
    return
  }
  const boardTask = createdTaskToBoardTask(created)
  replaceCachedBoardState(props.orgSlug, props.workspaceId, {
    tasks: [...cached.tasks, boardTask],
    parentTasks: created.is_parent_task
      ? [...cached.parentTasks, { id: created.id, title: created.title }]
      : cached.parentTasks,
  })
}
function onTaskCreatedFromModal (created: CreatedTask) {
  // 作成前に開始した silent reload が古い一覧で上書きしないように無効化する
  wbsLoadGeneration += 1
  const wbsTask = createdTaskToWbsTask(created)
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
  syncBoardCacheAfterCreate(created)
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
function cancelEdit () {
  if (!editMode.value || editSaving.value) {
    return
  }
  dismissEditInteractions()
  const snapshot = reorderSnapshot.value
  if (snapshot) {
    tasks.value = cloneWbsTasks(snapshot.tasks)
    collapsedParentIds.value = new Set(snapshot.collapsedParentIds)
  }
  reorderSnapshot.value = null
  editMode.value = false
}
async function confirmEdit () {
  if (!editMode.value || editSaving.value) {
    return
  }
  await persistAndDismissEditInteractions()
  editSaving.value = true
  error.value = null
  try {
    const ok = await saveWbsOrder(tasks.value)
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
    sort_order: nextSortOrder,
    start_date: nextStart,
    due_date: nextDue,
    ...(colorChanged ? { gantt_bar_color: nextColor } : {}),
    effort_value: updated.effort_value,
    effort_hours: updated.effort_hours,
    effort_unit: updated.effort_unit,
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
  if (!task || !resolveTaskDateRange(task)) {
    return
  }
  if (colorPopoverOpen.value && colorPopoverTaskId.value === taskId) {
    closeColorPopover()
    return
  }
  const hit = import.meta.client
    ? document.elementFromPoint(clientX, clientY)
    : null
  const wbsElement = hit instanceof Element
    ? hit.closest('table.workspace-wbs') ?? hit.closest('.workspace-wbs-board__frame')
    : null
  const wbsTop = wbsElement instanceof HTMLElement
    ? wbsElement.getBoundingClientRect().top
    : clientY
  colorPopoverTaskId.value = taskId
  colorPopoverValue.value = resolveTaskGanttBarColor(task)
  colorPopoverAnchor.value = {
    top: wbsTop,
    left: clientX,
    right: clientX,
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
function applyWbsSnapshot (snapshot: WorkspaceWbsPageSnapshot) {
  unsavedGanttBarColorByTaskId.clear()
  tasks.value = snapshot.tasks
  orgLabels.value = snapshot.orgLabels
  workspaceMembers.value = snapshot.workspaceMembers
  workspaceLists.value = snapshot.workspaceLists
}
function buildWbsSnapshot (): WorkspaceWbsPageSnapshot {
  return {
    tasks: tasks.value,
    orgLabels: orgLabels.value,
    workspaceMembers: workspaceMembers.value,
    workspaceLists: workspaceLists.value,
  }
}
function persistWbsCache () {
  if (tasks.value.length === 0 && loading.value) {
    return
  }
  setWbsCached(props.orgSlug, props.workspaceId, buildWbsSnapshot())
}
function bindAndOpen (
  task: WbsTask,
  opener: (event?: Event) => void,
  event: Event,
) {
  if (!editMode.value) {
    return
  }
  editLayerRef.value?.bindTask(task)
  opener(event)
}
function openStartDate (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openDatePicker('start', e), event)
}
function openDueDate (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openDatePicker('due', e), event)
}
function openEffort (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openEffortPicker(e), event)
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
function openMemberDetail (task: WbsTask, member: TaskFormMember, event: Event) {
  editLayerRef.value?.bindTask(task)
  editLayerRef.value?.openMemberDetail(member, event)
}
function openLabels (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openLabelPicker(e), event)
}
function openDescription (task: WbsTask, event: Event) {
  if (!editMode.value && !task.description?.trim()) {
    return
  }
  editLayerRef.value?.bindTask(task)
  editLayerRef.value?.openDescriptionPicker(event)
}
function openList (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openListPicker(e), event)
}
function listNameStyle (listId: number | null | undefined) {
  const color = resolveListColor(listId, workspaceLists.value)
  return color ? { color } : undefined
}
async function startTitleEdit (task: WbsTask) {
  titleEditOpening = true
  editingTitleTaskId.value = task.id
  titleDraft.value = task.title
  await nextTick()
  const el = titleInputEls.get(task.id)
  el?.focus()
  el?.select()
  requestAnimationFrame(() => {
    titleEditOpening = false
  })
}
function onTitleFieldActivate (task: WbsTask, event?: Event) {
  if (!editMode.value || editingTitleTaskId.value === task.id) {
    return
  }
  if (event instanceof PointerEvent && event.button !== 0) {
    return
  }
  if (event?.target instanceof Element && event.target.closest('.workspace-wbs__toggle, .workspace-wbs__drag-handle')) {
    return
  }
  // pointerdown で入力へ切替え、後続の click/focus 競合を避ける
  if (event?.type === 'pointerdown') {
    event.preventDefault()
  }
  void startTitleEdit(task)
}
function onTitleCellMouseDown (task: WbsTask, event: MouseEvent) {
  if (editingTitleTaskId.value !== task.id) return
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('.workspace-wbs__title-input')) return
  if (target.closest('.workspace-wbs__toggle, .workspace-wbs__drag-handle')) return
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
    const [tasksRes, labelsRes, membersRes, listsRes] = await Promise.all([
      api<{ data: WbsTask[] }>(
        `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/wbs`,
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
    if (generation !== wbsLoadGeneration) {
      return
    }
    tasks.value = (tasksRes.data ?? []).map(task => ({
      ...task,
      labels: task.labels ? resolveLabelColors(task.labels) : task.labels,
    }))
    orgLabels.value = resolveLabelColors(labelsRes.data ?? [])
    workspaceMembers.value = membersRes.data ?? []
    workspaceLists.value = resolveListColors([...(listsRes.data ?? [])]).sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )
    persistWbsCache()
  } catch (e: unknown) {
    if (generation !== wbsLoadGeneration) {
      return
    }
    if (!opts?.silent) {
      error.value = e instanceof Error ? e.message : 'WBSの読み込みに失敗しました'
      tasks.value = []
      orgLabels.value = []
      workspaceMembers.value = []
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
    const cached = getWbsCached(props.orgSlug, props.workspaceId)
    if (cached) {
      applyWbsSnapshot(cached)
      void loadWbsTasks({ silent: true })
      return
    }
    void loadWbsTasks()
  },
  { immediate: true },
)
function refreshOnViewSwitch (): Promise<void> {
  const cached = getWbsCached(props.orgSlug, props.workspaceId)
  if (cached) {
    applyWbsSnapshot(cached)
  }
  return loadWbsTasks({ silent: tasks.value.length > 0 })
}

function realtimeTaskToWbsTask (task: RealtimeBoardTask): WbsTask {
  const listId = task.list_id ?? null
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    list_id: listId,
    list_name: workspaceLists.value.find(list => list.id === listId)?.name ?? null,
    start_date: task.start_date ?? null,
    due_date: task.due_date ?? null,
    gantt_bar_color: task.gantt_bar_color ?? null,
    effort_hours: task.effort_hours ?? null,
    effort_value: task.effort_value ?? null,
    effort_unit: task.effort_unit ?? null,
    labels: task.labels ? resolveLabelColors(task.labels) : [],
    assignees: task.assignees ?? [],
    sort_order: task.sort_order,
    is_parent_task: task.is_parent_task,
    parent_task_id: task.parent_task_id ?? null,
  }
}

function upsertRealtimeWbsTask (task: RealtimeBoardTask) {
  const next = realtimeTaskToWbsTask(task)
  const idx = tasks.value.findIndex(row => row.id === next.id)
  if (idx >= 0) {
    const current = tasks.value[idx]!
    // 編集モード中のローカル並び替えを壊さない
    const keepLocalOrder = editMode.value && reorderSnapshot.value !== null
    tasks.value[idx] = {
      ...current,
      ...next,
      description: next.description ?? current.description ?? null,
      list_name: next.list_name ?? current.list_name ?? null,
      sort_order: keepLocalOrder ? current.sort_order : next.sort_order,
      parent_task_id: keepLocalOrder ? current.parent_task_id : next.parent_task_id,
      is_parent_task: keepLocalOrder ? current.is_parent_task : next.is_parent_task,
      checklists: current.checklists,
    }
  } else {
    tasks.value = sortWbsTasks([...tasks.value, next])
  }
  if (reorderSnapshot.value) {
    const snapIdx = reorderSnapshot.value.tasks.findIndex(row => row.id === next.id)
    if (snapIdx >= 0) {
      const snapCurrent = reorderSnapshot.value.tasks[snapIdx]!
      reorderSnapshot.value.tasks[snapIdx] = {
        ...snapCurrent,
        ...next,
        description: next.description ?? snapCurrent.description ?? null,
        list_name: next.list_name ?? snapCurrent.list_name ?? null,
        checklists: snapCurrent.checklists,
      }
    } else {
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
  onTaskArchived ({ id }) {
    removeRealtimeWbsTask(id)
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
})

defineExpose({
  refreshOnViewSwitch,
  editMode,
  editSaving,
  startEdit,
  cancelEdit,
  confirmEdit,
  openTaskCreate,
  openDisplayItems,
})
watch(loading, async (isLoading) => {
  if (isLoading) return
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
})
</script>
<style lang="scss" scoped src="~/assets/styles/components/workspace/WorkspaceWbsView.scss"></style>
<style lang="scss" src="~/assets/styles/components/workspace/WorkspaceWbsView.global.scss"></style>
