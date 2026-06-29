<template>
  <div class="project-wbs-gantt-board">
    <div class="project-wbs-gantt-board__toolbar">
      <div class="project-wbs-gantt-board__month-nav">
        <button
          type="button"
          class="project-wbs-gantt-board__nav-btn"
          aria-label="前の月"
          @click="goPrevMonth"
        >
          ‹
        </button>
        <button
          type="button"
          class="project-wbs-gantt-board__nav-btn"
          aria-label="次の月"
          @click="goNextMonth"
        >
          ›
        </button>
      </div>
      <button
        type="button"
        class="project-wbs-gantt-board__today-btn"
        :disabled="isCurrentMonth"
        @click="goCurrentMonth"
      >
        今月
      </button>
    </div>
    <div v-if="loading" class="project-wbs-gantt-board__state">
      読み込み中...
    </div>
    <p v-else-if="error" class="project-wbs-gantt-board__error">{{ error }}</p>
    <p v-else-if="!displayRows.length" class="project-wbs-gantt-board__state">
      表示できるタスクがありません。
    </p>
    <div
      v-else
      ref="viewportEl"
      class="project-wbs-gantt-board__viewport"
      :class="{ 'project-wbs-gantt-board__viewport--dragging': dragging }"
    >
      <div
        class="project-wbs-gantt-board__month-strip"
        :style="{ width: `${ganttTableWidth}px` }"
      >
        <div
          class="project-wbs-gantt-board__month-strip-spacer"
          :style="{ width: `${ganttLeftColsWidth}px` }"
        />
        <span class="project-wbs-gantt-board__month-strip-label">{{ monthLabel }}</span>
      </div>
      <div class="project-wbs-gantt-board__frame">
        <div
          class="project-wbs-gantt-table-wrap"
          :class="{ 'project-wbs-table-wrap--dragging': dragging }"
        >
          <table
            class="project-wbs-gantt-table"
            :style="{
              '--gantt-table-width': `${ganttTableWidth}px`,
              '--gantt-task-col-width': `${GANTT_TASK_COL_WIDTH}px`,
              '--gantt-assignees-col-width': `${GANTT_ASSIGNEES_COL_WIDTH}px`,
              '--gantt-date-col-width': `${GANTT_DATE_COL_WIDTH}px`,
              '--gantt-day-col-width': `${GANTT_DAY_COL_WIDTH}px`,
              '--wbs-drag-col-width': `${WBS_DRAG_COL_WIDTH}px`,
            }"
          >
            <colgroup>
              <col class="project-wbs-table__drag-col">
              <col class="project-wbs-gantt-table__task-col">
              <col class="project-wbs-gantt-table__assignees-col">
              <col class="project-wbs-gantt-table__date-col">
              <col class="project-wbs-gantt-table__date-col">
              <col
                v-for="day in monthDays"
                :key="`col-${day.iso}`"
                class="project-wbs-gantt-table__day-col"
              >
            </colgroup>
            <thead>
              <tr>
                <th
                  class="project-wbs-table__drag-header project-wbs-gantt-table__drag-header"
                  scope="col"
                  aria-hidden="true"
                />
                <th
                  class="project-wbs-gantt-table__task-header"
                  scope="col"
                >
                  タスク
                </th>
                <th
                  class="project-wbs-gantt-table__assignees-header"
                  scope="col"
                >
                  担当者
                </th>
                <th
                  class="project-wbs-gantt-table__date-header project-wbs-gantt-table__date-header--start"
                  scope="col"
                >
                  開始日
                </th>
                <th
                  class="project-wbs-gantt-table__date-header project-wbs-gantt-table__date-header--due"
                  scope="col"
                >
                  終了日
                </th>
                <th
                  v-for="day in monthDays"
                  :key="`head-${day.iso}`"
                  scope="col"
                  class="project-wbs-gantt-table__day-header"
                  :class="{
                    'project-wbs-gantt-table__day-header--today': day.isToday,
                    'project-wbs-gantt-table__day-header--weekend': day.isWeekend,
                  }"
                >
                  <span class="project-wbs-gantt-table__day-date">{{ day.day }}</span>
                  <span class="project-wbs-gantt-table__day-weekday">{{ day.weekday }}</span>
                </th>
              </tr>
            </thead>
            <tbody ref="tableBodyEl">
              <tr
                v-for="(row, rowIndex) in displayRows"
                :key="`${row.kind}-${row.task.id}`"
                class="project-wbs-table__task-row project-wbs-gantt-table__task-row"
                :class="{
                  'project-wbs-table__task-row--parent': row.kind === 'parent',
                  'project-wbs-table__task-row--child': row.kind === 'child',
                  'project-wbs-table__task-row--drag-preview': draggingTaskIds.has(row.task.id),
                  'project-wbs-gantt-table__task-row--parent': row.kind === 'parent',
                  'project-wbs-gantt-table__task-row--child': row.kind === 'child',
                }"
                :data-wbs-row-index="rowIndex"
                :data-wbs-task-id="row.task.id"
              >
                <td class="project-wbs-table__drag-cell project-wbs-gantt-table__drag-cell">
                  <button
                    type="button"
                    class="project-wbs-table__drag-handle"
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
                </td>
                <td class="project-wbs-table__task-title project-wbs-gantt-table__task-title">
                  <div
                    class="project-wbs-table__title-cell"
                    :class="{
                      'project-wbs-table__title-cell--child': row.kind === 'child',
                    }"
                  >
                    <button
                      v-if="row.kind === 'parent'"
                      type="button"
                      class="project-wbs-table__toggle"
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
                    <div
                      class="project-wbs-table__title-field"
                      :class="{ 'project-wbs-table__title-field--after-toggle': row.kind === 'parent' }"
                    >
                      <button
                        v-if="!isWbsOrphanParentTask(row.task)"
                        type="button"
                        class="project-wbs-gantt-table__title-btn"
                        @click="openTaskDetail(row.task)"
                      >
                        <span
                          class="project-wbs-table__title-text"
                          :title="row.task.title"
                        >{{ row.task.title }}</span>
                      </button>
                      <span
                        v-else
                        class="project-wbs-table__title-text"
                        :title="row.task.title"
                      >{{ row.task.title }}</span>
                    </div>
                  </div>
                </td>
                <td class="project-wbs-gantt-table__assignees-cell">
                  <button
                    v-if="!isWbsOrphanParentTask(row.task)"
                    type="button"
                    class="project-wbs-table__cell-btn"
                    aria-label="担当者を編集"
                    @click="openMembers(row.task, $event)"
                  >
                    <div class="project-wbs-table__members-cell">
                      <template v-if="row.task.assignees?.length">
                        <span
                          v-for="member in row.task.assignees"
                          :key="member.id"
                          class="project-wbs-table__avatar-pill"
                          :title="memberDisplayName(member)"
                        >
                          <MemberAvatar
                            :member="member"
                            size="xs"
                            decorative
                          />
                        </span>
                      </template>
                      <span
                        v-else
                        class="project-wbs-table__avatar-btn project-wbs-table__avatar-btn--add"
                        aria-hidden="true"
                      >
                        <span class="project-wbs-table__avatar-btn-plus" aria-hidden="true">+</span>
                      </span>
                    </div>
                  </button>
                  <span v-else class="project-wbs-table__placeholder">—</span>
                </td>
                <td
                  class="project-wbs-gantt-table__date-cell project-wbs-gantt-table__date-cell--start"
                >
                  <button
                    v-if="!isWbsOrphanParentTask(row.task)"
                    type="button"
                    class="project-wbs-table__cell-btn project-wbs-table__cell-btn--text"
                    @click="openStartDate(row.task, $event)"
                  >
                    <span v-if="formatWbsDate(row.task.start_date)">{{ formatWbsDate(row.task.start_date) }}</span>
                    <span v-else class="project-wbs-table__placeholder">—</span>
                  </button>
                  <span v-else class="project-wbs-table__placeholder">—</span>
                </td>
                <td
                  class="project-wbs-gantt-table__date-cell project-wbs-gantt-table__date-cell--due"
                >
                  <button
                    v-if="!isWbsOrphanParentTask(row.task)"
                    type="button"
                    class="project-wbs-table__cell-btn project-wbs-table__cell-btn--text"
                    @click="openDueDate(row.task, $event)"
                  >
                    <span v-if="formatWbsDate(row.task.due_date)">{{ formatWbsDate(row.task.due_date) }}</span>
                    <span v-else class="project-wbs-table__placeholder">—</span>
                  </button>
                  <span v-else class="project-wbs-table__placeholder">—</span>
                </td>
                <td
                  v-for="day in monthDays"
                  :key="`${row.task.id}-${day.iso}`"
                  class="project-wbs-gantt-table__day-cell"
                  :class="{
                    'project-wbs-gantt-table__day-cell--weekend': day.isWeekend,
                    'project-wbs-gantt-table__day-cell--today': day.isToday,
                    'project-wbs-gantt-table__day-cell--filled': isTaskActiveOnDay(row.task, day.iso),
                    'project-wbs-gantt-table__day-cell--clickable': isTaskBarClickable(row.task, day.iso),
                  }"
                  :style="dayCellStyle(row.task, day.iso)"
                  @click="onDayCellClick(row.task, day.iso, $event)"
                />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <WorkspaceWbsGanttColorPopover
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
      :project-lists="workspaceLists"
      @updated="syncTaskUpdate"
    />
    <TaskDetailModal
      v-if="detailInitialTask"
      v-model="taskDetailOpen"
      :org-slug="orgSlug"
      :workspace-id="workspaceId"
      :task-id="detailTaskId"
      :org-labels="orgLabels"
      :workspace-members="workspaceMembers"
      :initial-task-detail="detailInitialTask"
      :initial-parent-tasks="parentTasks"
      :hierarchy-tasks="detailHierarchyTasks"
      :initial-comments="detailInitialComments"
      :remote-update="detailModalRemotePatch"
      :remote-update-rev="detailModalRemoteRev"
      @updated="onTaskDetailUpdated"
      @comments-updated="onTaskCommentsUpdated"
    />
  </div>
</template>
<script setup lang="ts">
import { ChevronDown, ChevronRight, Equal } from 'lucide-vue-next'
import TaskDetailModal, { type TaskDetail } from '../modals/TaskDetailModal.vue'
import type { TaskDetailComment } from '../task/taskCommentTypes'
import type { TaskCommentsByTaskId } from '../task/taskCommentTypes'
import {
  buildWbsDisplayRows,
  buildWbsReorderPayload,
  formatWbsDate,
  hasWbsOrphanChildTasks,
  isWbsOrphanParentTask,
  WBS_ORPHAN_PARENT_DEFAULT_LABEL,
  type WbsTask,
} from '../../composables/useWbsTaskGroups'
import {
  useWbsTaskDragReorder,
  WBS_GANTT_DRAG_SURFACE,
} from '../../composables/useWbsTaskDragReorder'
import {
  WBS_COLUMN_MIN_WIDTH,
  WBS_DRAG_COL_WIDTH,
} from '../../composables/useWbsTableColumnResize'
import {
  buildMonthDays,
  currentYearMonth,
  formatGanttMonthLabel,
  isTaskActiveOnDay,
  resolveGanttBarColor,
  shiftVisibleMonth,
} from '../../composables/useWbsGanttCalendar'
import type { WorkspaceListOption, TaskPopoverEditable } from '../../composables/useTaskPopoverEditor'
import type { TaskFormLabel, TaskFormMember } from '../../composables/useTaskFormHelpers'
import { memberDisplayName } from '../../composables/useMemberDisplay'
import { useApi } from '../../composables/useApi'
import { useOrgEffortUnit } from '../../composables/useOrgEffortSettings'
import { useWorkspaceBoardPageData, boardTaskToTaskDetail } from '../../composables/useWorkspaceBoardPageData'
import { enrichTaskDetailHierarchy } from '../../composables/useTaskHierarchy'
import { useWorkspaceWbsPageData, type WorkspaceWbsPageSnapshot } from '../../composables/useWorkspaceWbsPageData'
import { resolveLabelColors, resolveListColors } from '../../utils/colorPresetResolution'
import { syncAppLoadingCursor } from '../../composables/useAppLoadingCursor'
import WorkspaceWbsGanttColorPopover from './WorkspaceWbsGanttColorPopover.vue'
import TaskEditPopoverLayer from '../task/TaskEditPopoverLayer.vue'
const GANTT_TASK_COL_WIDTH = 240
const GANTT_ASSIGNEES_COL_WIDTH = Math.max(WBS_COLUMN_MIN_WIDTH, Math.round(1200 * 0.10))
const GANTT_DATE_COL_WIDTH = Math.max(WBS_COLUMN_MIN_WIDTH, Math.round(1200 * 0.09))
const GANTT_DAY_COL_WIDTH = 34
const props = defineProps<{
  orgSlug: string
  workspaceId: string
}>()
const { api } = useApi()
const { patchCachedTasks } = useWorkspaceBoardPageData()
const { getCached: getWbsCached, setCached: setWbsCached } = useWorkspaceWbsPageData()
const { ensureOrgEffortUnit } = useOrgEffortUnit(() => props.orgSlug)
const loading = ref(false)
const error = ref<string | null>(null)
const tasks = ref<WbsTask[]>([])
const orphanParentLabel = ref(WBS_ORPHAN_PARENT_DEFAULT_LABEL)
const orphanParentSortOrder = ref<number | null>(null)
const orgLabels = ref<TaskFormLabel[]>([])
const workspaceMembers = ref<TaskFormMember[]>([])
const workspaceLists = ref<WorkspaceListOption[]>([])
const collapsedParentIds = ref<Set<number>>(new Set())
const viewportEl = ref<HTMLElement | null>(null)
const tableBodyEl = ref<HTMLTableSectionElement | null>(null)
const editLayerRef = ref<InstanceType<typeof TaskEditPopoverLayer> | null>(null)
const initialMonth = currentYearMonth()
const visibleYear = ref(initialMonth.year)
const visibleMonth = ref(initialMonth.month)
const colorPopoverOpen = ref(false)
const colorPopoverAnchor = ref<{ top: number; left: number } | null>(null)
const colorPopoverValue = ref('')
const colorPopoverTaskId = ref<number | null>(null)
const colorSaving = ref(false)
const detailTaskId = ref<number | null>(null)
const taskCommentsByTaskId = ref<TaskCommentsByTaskId>({})
const detailModalRemotePatch = ref<Partial<TaskDetail> & { id: number } | null>(null)
const detailModalRemoteRev = ref(0)
const parentTasks = computed(() => tasks.value
  .filter(task => task.is_parent_task && !isWbsOrphanParentTask(task))
  .map(task => ({ id: task.id, title: task.title })))
const detailInitialTask = computed((): TaskDetail | null => {
  const id = detailTaskId.value
  if (id === null) {
    return null
  }
  const task = tasks.value.find(row => row.id === id)
  if (!task) {
    return null
  }
  return enrichTaskDetailHierarchy(
    wbsTaskToTaskDetail(task),
    tasks.value,
    listId => workspaceLists.value.find(list => list.id === listId)?.name ?? null,
  )
})
const detailHierarchyTasks = computed(() => {
  return tasks.value.map(task => ({
    id: task.id,
    title: task.title,
    is_parent_task: task.is_parent_task,
    parent_task_id: task.parent_task_id ?? null,
    due_date: task.due_date ?? null,
    list_id: task.list_id,
    list_name: task.list_name ?? workspaceLists.value.find(list => list.id === task.list_id)?.name ?? null,
    sort_order: task.sort_order,
  }))
})
const detailInitialComments = computed((): TaskDetailComment[] | null => {
  const id = detailTaskId.value
  if (id === null) {
    return null
  }
  const cached = taskCommentsByTaskId.value[String(id)]
  return cached !== undefined ? cached : null
})
const taskDetailOpen = computed({
  get: () => detailTaskId.value !== null && detailInitialTask.value !== null,
  set: (open: boolean) => {
    if (!open) {
      detailTaskId.value = null
    }
  },
})
const ganttBusy = computed(() => loading.value || colorSaving.value)
syncAppLoadingCursor(ganttBusy)
const monthDays = computed(() => buildMonthDays(visibleYear.value, visibleMonth.value))
const monthLabel = computed(() => formatGanttMonthLabel(visibleYear.value, visibleMonth.value))
const ganttLeftColsWidth = computed(() => (
  WBS_DRAG_COL_WIDTH
  + GANTT_TASK_COL_WIDTH
  + GANTT_ASSIGNEES_COL_WIDTH
  + GANTT_DATE_COL_WIDTH * 2
))
const ganttTableWidth = computed(() => (
  ganttLeftColsWidth.value
  + monthDays.value.length * GANTT_DAY_COL_WIDTH
))
const isCurrentMonth = computed(() => {
  const now = currentYearMonth()
  return visibleYear.value === now.year && visibleMonth.value === now.month
})
const {
  dragging,
  activeRows,
  draggingTaskIds,
  onDragHandlePointerDown,
  shouldSuppressClick,
} = useWbsTaskDragReorder({
  tasks,
  tableBodyEl,
  collapsedParentIds,
  orphanParentLabel,
  orphanParentSortOrder,
  surface: WBS_GANTT_DRAG_SURFACE,
  onCommit: saveWbsOrder,
})
const displayRows = computed(() => {
  if (dragging.value) {
    return activeRows.value
  }
  return buildWbsDisplayRows(
    tasks.value,
    collapsedParentIds.value,
    orphanParentLabel.value,
    orphanParentSortOrder.value,
  )
})
function onDragHandleClick () {
  if (shouldSuppressClick()) {
    return
  }
}
async function saveWbsOrder (
  updatedTasks: WbsTask[],
  nextOrphanParentSortOrder: number | null,
) {
  try {
    const body: {
      tasks: ReturnType<typeof buildWbsReorderPayload>
      orphan_parent_sort_order?: number | null
    } = {
      tasks: buildWbsReorderPayload(updatedTasks),
    }
    if (!hasWbsOrphanChildTasks(updatedTasks)) {
      body.orphan_parent_sort_order = nextOrphanParentSortOrder
    }
    await api<{ data: { ok: boolean } }>(
      `/orgs/${props.orgSlug}/workspaces/${props.workspaceId}/tasks/wbs/reorder`,
      {
        method: 'PATCH',
        body,
      },
    )
    if (!hasWbsOrphanChildTasks(updatedTasks)) {
      orphanParentSortOrder.value = nextOrphanParentSortOrder
    }
    persistWbsCache()
    patchCachedTasks(
      props.orgSlug,
      props.workspaceId,
      updatedTasks
        .filter(task => !isWbsOrphanParentTask(task))
        .map(task => ({
          id: task.id,
          sort_order: task.sort_order,
          parent_task_id: task.parent_task_id ?? null,
          is_parent_task: task.is_parent_task,
        })),
    )
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'タスクの並び順の保存に失敗しました'
    await loadWbsTasks()
  }
}
function openMembers (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openMemberPicker(e), event)
}
function wbsTaskToTaskDetail (task: WbsTask): TaskDetail {
  return boardTaskToTaskDetail({
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    status: task.status ?? 'todo',
    list_id: task.list_id,
    start_date: task.start_date ?? null,
    due_date: task.due_date ?? null,
    effort_hours: task.effort_hours ?? null,
    effort_value: task.effort_value ?? null,
    effort_unit: task.effort_unit ?? null,
    assignees: task.assignees,
    labels: task.labels,
    checklist: task.checklist ?? null,
    is_parent_task: task.is_parent_task,
    parent_task_id: task.parent_task_id ?? null,
  })
}
function openTaskDetail (task: WbsTask) {
  if (isWbsOrphanParentTask(task)) {
    return
  }
  detailTaskId.value = task.id
}
function onTaskCommentsUpdated (payload: { taskId: number; comments: TaskDetailComment[] }) {
  taskCommentsByTaskId.value = {
    ...taskCommentsByTaskId.value,
    [String(payload.taskId)]: payload.comments,
  }
}
function onTaskDetailUpdated (detail: TaskDetail) {
  const idx = tasks.value.findIndex(task => task.id === detail.id)
  if (idx < 0) {
    return
  }
  const current = tasks.value[idx]!
  tasks.value[idx] = {
    ...current,
    title: detail.title,
    description: detail.description,
    status: detail.status,
    list_id: detail.list_id ?? current.list_id,
    start_date: detail.start_date,
    due_date: detail.due_date,
    effort_hours: detail.effort_hours,
    effort_value: detail.effort_value,
    effort_unit: detail.effort_unit,
    assignees: detail.assignees,
    labels: detail.labels,
    checklist: detail.checklist ?? null,
    is_parent_task: detail.is_parent_task ?? current.is_parent_task,
    parent_task_id: detail.parent_task_id ?? current.parent_task_id,
  }
  patchCachedTasks(props.orgSlug, props.workspaceId, [{
    id: detail.id,
    title: detail.title,
    description: detail.description,
    list_id: detail.list_id ?? current.list_id,
    start_date: detail.start_date,
    due_date: detail.due_date,
    effort_hours: detail.effort_hours,
    effort_value: detail.effort_value,
    effort_unit: detail.effort_unit,
    assignees: detail.assignees,
    labels: detail.labels,
    checklist: detail.checklist ?? null,
    is_parent_task: detail.is_parent_task ?? current.is_parent_task,
    parent_task_id: detail.parent_task_id ?? current.parent_task_id,
  }])
  persistWbsCache()
}
function toggleParentCollapse (parentId: number) {
  const next = new Set(collapsedParentIds.value)
  if (next.has(parentId)) {
    next.delete(parentId)
  } else {
    next.add(parentId)
  }
  collapsedParentIds.value = next
}
function bindAndOpen (
  task: WbsTask,
  opener: (event?: Event) => void,
  event: Event,
) {
  editLayerRef.value?.bindTask(task)
  opener(event)
}
function openStartDate (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openDatePicker('start', e), event)
}
function openDueDate (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openDatePicker('due', e), event)
}
function syncTaskUpdate (updated: TaskPopoverEditable) {
  const idx = tasks.value.findIndex(task => task.id === updated.id)
  if (idx < 0) {
    return
  }
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
  persistWbsCache()
}
function isTaskBarClickable (task: WbsTask, dayIso: string) {
  return !isWbsOrphanParentTask(task) && isTaskActiveOnDay(task, dayIso)
}
function dayCellStyle (task: WbsTask, dayIso: string) {
  if (!isTaskActiveOnDay(task, dayIso)) {
    return undefined
  }
  return {
    backgroundColor: resolveGanttBarColor(task),
  }
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
function onDayCellClick (task: WbsTask, dayIso: string, event: MouseEvent) {
  if (!isTaskBarClickable(task, dayIso)) {
    return
  }
  colorPopoverTaskId.value = task.id
  colorPopoverValue.value = resolveGanttBarColor(task)
  colorPopoverAnchor.value = {
    top: event.clientY,
    left: event.clientX,
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
function applyWbsSnapshot (snapshot: WorkspaceWbsPageSnapshot) {
  tasks.value = snapshot.tasks
  orphanParentLabel.value = snapshot.orphanParentLabel
  orphanParentSortOrder.value = snapshot.orphanParentSortOrder
  orgLabels.value = snapshot.orgLabels
  workspaceMembers.value = snapshot.workspaceMembers
  workspaceLists.value = snapshot.workspaceLists
}
function persistWbsCache () {
  if (tasks.value.length === 0 && loading.value) {
    return
  }
  setWbsCached(props.orgSlug, props.workspaceId, {
    tasks: tasks.value,
    orphanParentLabel: orphanParentLabel.value,
    orphanParentSortOrder: orphanParentSortOrder.value,
    orgLabels: orgLabels.value,
    workspaceMembers: workspaceMembers.value,
    workspaceLists: workspaceLists.value,
  })
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
async function loadWbsTasks (opts?: { silent?: boolean }) {
  if (!opts?.silent) {
    loading.value = true
  }
  error.value = null
  try {
    const [, tasksRes, labelsRes, membersRes, listsRes] = await Promise.all([
      ensureOrgEffortUnit(),
      api<{ data: WbsTask[]; meta?: { orphan_parent_label?: string; orphan_parent_sort_order?: number | null } }>(
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
    tasks.value = (tasksRes.data ?? []).map(task => ({
      ...task,
      labels: task.labels ? resolveLabelColors(task.labels) : task.labels,
    }))
    orphanParentLabel.value = tasksRes.meta?.orphan_parent_label?.trim()
      || WBS_ORPHAN_PARENT_DEFAULT_LABEL
    orphanParentSortOrder.value = tasksRes.meta?.orphan_parent_sort_order ?? null
    orgLabels.value = resolveLabelColors(labelsRes.data ?? [])
    workspaceMembers.value = membersRes.data ?? []
    workspaceLists.value = resolveListColors([...(listsRes.data ?? [])]).sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )
    persistWbsCache()
  } catch (e: unknown) {
    if (!opts?.silent) {
      error.value = e instanceof Error ? e.message : 'WBSの読み込みに失敗しました'
      tasks.value = []
      orphanParentLabel.value = WBS_ORPHAN_PARENT_DEFAULT_LABEL
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
defineExpose({
  refreshOnViewSwitch,
})
</script>
<style lang="scss" scoped>
@use '../../assets/styles/wbs-task-row';
@use '../../assets/styles/wbs-table-cell';
.project-wbs-gantt-board {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.project-wbs-gantt-board__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.45rem;
  flex-shrink: 0;
}
.project-wbs-gantt-board__month-nav {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.project-wbs-gantt-board__month-strip {
  display: flex;
  align-items: flex-end;
  width: fit-content;
  min-width: 100%;
  margin-bottom: 0.2rem;
  flex-shrink: 0;
}
.project-wbs-gantt-board__month-strip-spacer {
  flex-shrink: 0;
}
.project-wbs-gantt-board__month-strip-label {
  flex: 1;
  min-width: 0;
  padding-left: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: mixin.$text;
  line-height: 1.2;
}
.project-wbs-gantt-board__nav-btn,
.project-wbs-gantt-board__today-btn {
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
.project-wbs-gantt-board__nav-btn {
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  font-size: 1.1rem;
  line-height: 1;
}
.project-wbs-gantt-board__today-btn {
  height: 1.75rem;
  padding: 0 0.65rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.project-wbs-gantt-board__nav-btn:hover,
.project-wbs-gantt-board__today-btn:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.04);
}
.project-wbs-gantt-board__today-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.project-wbs-gantt-board__viewport {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: auto;
}
.project-wbs-gantt-board__viewport--dragging {
  cursor: default;
  user-select: none;
}
.project-wbs-gantt-board__frame {
  display: block;
  width: fit-content;
  border: 1px solid mixin.$border-light;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}
.project-wbs-gantt-board__state,
.project-wbs-gantt-board__error {
  margin: 0;
  padding: 1rem 0.25rem;
  font-size: 0.875rem;
}
.project-wbs-gantt-board__error {
  color: mixin.$danger;
  font-weight: 600;
}
.project-wbs-gantt-table-wrap {
  position: relative;
  width: fit-content;
}
.project-wbs-gantt-table {
  --wbs-row-height: 36px;
  --wbs-parent-row-height: 40px;
  --wbs-chip-height: 24px;
  --gantt-task-col-width: 240px;
  --gantt-assignees-col-width: 120px;
  --gantt-date-col-width: 108px;
  --gantt-day-col-width: 34px;
  --gantt-table-width: auto;
  width: var(--gantt-table-width);
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.8125rem;
}
.project-wbs-gantt-table__task-col {
  width: var(--gantt-task-col-width);
}
.project-wbs-gantt-table__assignees-col {
  width: var(--gantt-assignees-col-width);
}
.project-wbs-gantt-table__date-col {
  width: var(--gantt-date-col-width);
}
.project-wbs-gantt-table__day-col {
  width: var(--gantt-day-col-width);
}
.project-wbs-gantt-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: mixin.$table-header-bg;
  color: mixin.$white;
  font-weight: 700;
  text-align: center;
  vertical-align: middle;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.project-wbs-gantt-table__drag-header {
  left: 0;
  z-index: 8;
  border-top-left-radius: 12px;
}
.project-wbs-gantt-table__task-header {
  left: var(--wbs-drag-col-width);
  z-index: 7;
  width: var(--gantt-task-col-width);
  min-width: var(--gantt-task-col-width);
  max-width: var(--gantt-task-col-width);
  padding: 0.55rem 0.65rem;
  text-align: left;
  font-size: 0.75rem;
  white-space: nowrap;
}
.project-wbs-gantt-table__assignees-header {
  left: calc(var(--wbs-drag-col-width) + var(--gantt-task-col-width));
  z-index: 6;
  width: var(--gantt-assignees-col-width);
  min-width: var(--gantt-assignees-col-width);
  max-width: var(--gantt-assignees-col-width);
  padding: 0.55rem 0.65rem;
  text-align: left;
  font-size: 0.75rem;
  white-space: nowrap;
}
.project-wbs-gantt-table__date-header {
  width: var(--gantt-date-col-width);
  min-width: var(--gantt-date-col-width);
  max-width: var(--gantt-date-col-width);
  padding: 0.55rem 0.65rem;
  text-align: left;
  font-size: 0.75rem;
  white-space: nowrap;
}
.project-wbs-gantt-table__date-header--start {
  left: calc(var(--wbs-drag-col-width) + var(--gantt-task-col-width) + var(--gantt-assignees-col-width));
  z-index: 5;
}
.project-wbs-gantt-table__date-header--due {
  left: calc(var(--wbs-drag-col-width) + var(--gantt-task-col-width) + var(--gantt-assignees-col-width) + var(--gantt-date-col-width));
  z-index: 4;
}
.project-wbs-gantt-table__day-header {
  width: var(--gantt-day-col-width);
  min-width: var(--gantt-day-col-width);
  max-width: var(--gantt-day-col-width);
  padding: 0.3rem 0;
  line-height: 1.05;
}
.project-wbs-gantt-table__day-header:last-child {
  border-top-right-radius: 12px;
}
.project-wbs-gantt-table__day-header--weekend {
  background: rgba(255, 255, 255, 0.08);
}
.project-wbs-gantt-table__day-header--today {
  box-shadow: inset 0 -2px 0 rgba(255, 255, 255, 0.95);
}
.project-wbs-gantt-table__day-date {
  display: block;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.05;
}
.project-wbs-gantt-table__day-weekday {
  display: block;
  margin-top: 0.02rem;
  font-size: 0.6rem;
  font-weight: 600;
  line-height: 1.05;
  opacity: 0.92;
}
.project-wbs-gantt-table__task-row td {
  height: var(--wbs-row-height);
  max-height: var(--wbs-row-height);
  border-bottom: 1px solid mixin.$border-light;
  vertical-align: middle;
}
.project-wbs-gantt-table__task-row--parent td {
  height: var(--wbs-parent-row-height);
  max-height: var(--wbs-parent-row-height);
}
.project-wbs-gantt-table__task-row:last-child td {
  border-bottom: none;
}
.project-wbs-gantt-table__task-row:last-child .project-wbs-gantt-table__drag-cell {
  border-bottom-left-radius: 12px;
}
.project-wbs-gantt-table__task-row:last-child .project-wbs-gantt-table__day-cell:last-child {
  border-bottom-right-radius: 12px;
}
.project-wbs-gantt-table__drag-cell {
  position: sticky;
  left: 0;
  z-index: 5;
  background: #fff;
  box-shadow: 1px 0 0 mixin.$border-light;
}
.project-wbs-gantt-table__task-title {
  position: sticky;
  left: var(--wbs-drag-col-width);
  z-index: 4;
  width: var(--gantt-task-col-width);
  min-width: var(--gantt-task-col-width);
  max-width: var(--gantt-task-col-width);
  padding: 0 !important;
  background: #fff;
  box-shadow: 1px 0 0 mixin.$border-light;
  overflow: hidden;
}
.project-wbs-gantt-table__assignees-cell {
  position: sticky;
  left: calc(var(--wbs-drag-col-width) + var(--gantt-task-col-width));
  z-index: 3;
  width: var(--gantt-assignees-col-width);
  min-width: var(--gantt-assignees-col-width);
  max-width: var(--gantt-assignees-col-width);
  padding: 0;
  background: #fff;
  box-shadow: 1px 0 0 mixin.$border-light;
  vertical-align: middle;
}
.project-wbs-gantt-table__date-cell {
  position: sticky;
  z-index: 2;
  width: var(--gantt-date-col-width);
  min-width: var(--gantt-date-col-width);
  max-width: var(--gantt-date-col-width);
  padding: 0;
  background: #fff;
  box-shadow: 1px 0 0 mixin.$border-light;
  vertical-align: middle;
}
.project-wbs-gantt-table__date-cell--start {
  left: calc(var(--wbs-drag-col-width) + var(--gantt-task-col-width) + var(--gantt-assignees-col-width));
  z-index: 2;
}
.project-wbs-gantt-table__date-cell--due {
  left: calc(var(--wbs-drag-col-width) + var(--gantt-task-col-width) + var(--gantt-assignees-col-width) + var(--gantt-date-col-width));
  z-index: 1;
}
.project-wbs-gantt-table__task-row--parent .project-wbs-gantt-table__drag-cell,
.project-wbs-gantt-table__task-row--parent .project-wbs-gantt-table__task-title,
.project-wbs-gantt-table__task-row--parent .project-wbs-gantt-table__assignees-cell,
.project-wbs-gantt-table__task-row--parent .project-wbs-gantt-table__date-cell {
  background: mixin.$wbs-parent-bg;
}
.project-wbs-gantt-table__title-btn {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: stretch;
  align-self: stretch;
}
.project-wbs-gantt-table__title-btn:focus-visible {
  @include mixin.input-focus-ring;
  border-radius: 4px;
}
.project-wbs-gantt-table__task-title .project-wbs-table__title-field {
  gap: 0;
}
.project-wbs-gantt-table__day-cell {
  width: var(--gantt-day-col-width);
  min-width: var(--gantt-day-col-width);
  max-width: var(--gantt-day-col-width);
  padding: 0;
  border-left: 1px solid mixin.$border-light;
  background: #fff;
}
.project-wbs-gantt-table__day-cell--filled {
  cursor: pointer;
}
.project-wbs-gantt-table__day-cell--clickable:hover {
  filter: brightness(0.96);
}
</style>
