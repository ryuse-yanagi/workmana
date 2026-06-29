<template>
  <div class="workspace-table-board">
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
      :class="{ 'workspace-table-board__viewport--dragging': dragging }"
    >
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
          :style="{
            '--table-width': `${tableWidth}px`,
            '--table-drag-col-width': `${TABLE_DRAG_COL_WIDTH}px`,
          }"
        >
        <colgroup>
          <col class="workspace-table__drag-col">
          <col
            v-for="column in TABLE_COLUMNS"
            :key="column.key"
            :style="{ width: `${columnWidths[column.key]}px` }"
          >
        </colgroup>
        <thead>
          <tr>
            <th
              class="workspace-table__drag-header"
              scope="col"
              aria-hidden="true"
            />
            <th
              v-for="column in TABLE_COLUMNS"
              :key="column.key"
              scope="col"
              class="workspace-table__header-cell"
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
            <td class="workspace-table__drag-cell">
              <button
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
            </td>
            <td class="workspace-table__task-title">
              <div
                class="workspace-table__title-cell"
                :class="{
                  'workspace-table__title-cell--child': row.kind === 'child',
                  'workspace-table__title-cell--editable': editingTitleTaskId !== row.task.id,
                }"
                :tabindex="editingTitleTaskId !== row.task.id ? 0 : undefined"
                @click="onTitleFieldActivate(row.task, $event)"
                @mousedown="onTitleCellMouseDown(row.task, $event)"
                @keydown.enter.prevent="onTitleFieldActivate(row.task)"
              >
                <button
                  v-if="row.kind === 'parent'"
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
            <td>
              <button
                v-if="!isTableOrphanParentTask(row.task)"
                type="button"
                class="workspace-table__cell-btn"
                :class="{ 'workspace-table__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'assignees') }"
                aria-label="担当者を編集"
                @click="openMembers(row.task, $event)"
              >
                <div class="workspace-table__members-cell">
                  <template v-if="row.task.assignees?.length">
                    <span
                      v-for="member in row.task.assignees"
                      :key="member.id"
                      class="workspace-table__avatar-pill"
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
                    class="workspace-table__avatar-btn workspace-table__avatar-btn--add"
                    aria-hidden="true"
                  >
                    <span class="workspace-table__avatar-btn-plus" aria-hidden="true">+</span>
                  </span>
                </div>
              </button>
              <span v-else class="workspace-table__placeholder" />
            </td>
            <td>
              <button
                v-if="row.task.labels?.length && !isTableOrphanParentTask(row.task)"
                type="button"
                class="workspace-table__cell-btn"
                :class="{ 'workspace-table__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'labels') }"
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
                v-else-if="!isTableOrphanParentTask(row.task)"
                type="button"
                class="workspace-table__cell-btn"
                :class="{ 'workspace-table__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'labels') }"
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
            <td>
              <button
                v-if="!isTableOrphanParentTask(row.task)"
                type="button"
                class="workspace-table__cell-btn workspace-table__cell-btn--text"
                :class="{ 'workspace-table__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'list') }"
                @click="openList(row.task, $event)"
              >
                <span
                  v-if="row.task.list_name"
                  class="workspace-table__ellipsis"
                  :title="row.task.list_name"
                >{{ row.task.list_name }}</span>
                <span v-else class="workspace-table__placeholder" />
              </button>
              <span v-else class="workspace-table__placeholder" />
            </td>
            <td>
              <button
                v-if="!isTableOrphanParentTask(row.task)"
                type="button"
                class="workspace-table__cell-btn workspace-table__cell-btn--text"
                :class="{ 'workspace-table__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'startDate') }"
                @click="openStartDate(row.task, $event)"
              >
                <span v-if="formatTableDate(row.task.start_date)">{{ formatTableDate(row.task.start_date) }}</span>
                <span v-else class="workspace-table__placeholder" />
              </button>
              <span v-else class="workspace-table__placeholder" />
            </td>
            <td>
              <button
                v-if="!isTableOrphanParentTask(row.task)"
                type="button"
                class="workspace-table__cell-btn workspace-table__cell-btn--text"
                :class="{ 'workspace-table__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'dueDate') }"
                @click="openDueDate(row.task, $event)"
              >
                <span v-if="formatTableDate(row.task.due_date)">{{ formatTableDate(row.task.due_date) }}</span>
                <span v-else class="workspace-table__placeholder" />
              </button>
              <span v-else class="workspace-table__placeholder" />
            </td>
            <td>
              <button
                v-if="!isTableOrphanParentTask(row.task)"
                type="button"
                class="workspace-table__cell-btn workspace-table__cell-btn--text"
                :class="{ 'workspace-table__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'effort') }"
                @click="openEffort(row.task, $event)"
              >
                <span v-if="formatTableEffort(row.task, orgEffortUnit)">{{ formatTableEffort(row.task, orgEffortUnit) }}</span>
                <span v-else class="workspace-table__placeholder" />
              </button>
              <span v-else class="workspace-table__placeholder" />
            </td>
            <td>
              <button
                v-if="!isTableOrphanParentTask(row.task)"
                type="button"
                class="workspace-table__cell-btn workspace-table__cell-btn--text workspace-table__cell-btn--notes"
                :class="{ 'workspace-table__cell-btn--popover-open': isPopoverCellActive(row.task.id, 'notes') }"
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
    <TaskEditPopoverLayer
      ref="editLayerRef"
      :org-slug="orgSlug"
      :workspace-id="workspaceId"
      :org-labels="orgLabels"
      :workspace-members="workspaceMembers"
      :project-lists="workspaceLists"
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
import { useTableTaskDragReorder } from '../../composables/useTableTaskDragReorder'
import {
  TABLE_COLUMNS,
  TABLE_DRAG_COL_WIDTH,
  useTableColumnResize,
} from '../../composables/useTableColumnResize'
import {
  type WorkspaceListOption,
  type PopoverType,
  type TaskPopoverEditable,
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
import TaskEditPopoverLayer from '../task/TaskEditPopoverLayer.vue'
const props = defineProps<{
  orgSlug: string
  workspaceId: string
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
const editLayerRef = ref<InstanceType<typeof TaskEditPopoverLayer> | null>(null)
type TablePopoverCellField = 'assignees' | 'labels' | 'list' | 'startDate' | 'dueDate' | 'effort' | 'notes'
const popoverActiveTaskId = ref<number | null>(null)
const popoverActiveType = ref<PopoverType | null>(null)
function onPopoverActiveChange (payload: { taskId: number | null; popover: PopoverType | null }) {
  popoverActiveTaskId.value = payload.taskId
  popoverActiveType.value = payload.popover
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
const editingTitleTaskId = ref<number | null>(null)
const titleDraft = ref('')
const titleSaving = ref(false)
const tableBusy = computed(() => loading.value || titleSaving.value)
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
} = useTableColumnResize(columnStorageKey)
const {
  dragging,
  activeRows,
  draggingTaskIds,
  onDragHandlePointerDown,
  shouldSuppressClick,
} = useTableTaskDragReorder({
  tasks,
  tableBodyEl,
  collapsedParentIds,
  orphanParentLabel,
  orphanParentSortOrder,
  onCommit: saveTableOrder,
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
function onDragHandleClick () {
  if (shouldSuppressClick()) {
    return
  }
}
async function saveTableOrder (
  updatedTasks: TableTask[],
  nextOrphanParentSortOrder: number | null,
) {
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
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'タスクの並び順の保存に失敗しました'
    await loadTableTasks()
  }
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
  if (editingTitleTaskId.value === task.id) {
    return
  }
  if (event?.target instanceof Element && event.target.closest('.workspace-table__toggle')) {
    return
  }
  void startTitleEdit(task)
}
function onTitleCellMouseDown (task: TableTask, event: MouseEvent) {
  if (editingTitleTaskId.value !== task.id) return
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('.workspace-table__title-input')) return
  if (target.closest('.workspace-table__toggle')) return
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
})
watch(loading, async (isLoading) => {
  if (isLoading) return
  await nextTick()
  const containerWidth = tableScrollEl.value?.clientWidth
  if (!containerWidth) return
  if (!import.meta.client || !localStorage.getItem(columnStorageKey.value)) {
    loadWidths(containerWidth)
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
  align-items: flex-start;
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
  padding: 1rem 0.25rem;
  font-size: 0.875rem;
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
  --table-drag-col-width: 36px;
  --table-width: auto;
  width: var(--table-width);
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.8125rem;
}
.workspace-table__drag-col {
  width: var(--table-drag-col-width);
}
.workspace-table__drag-header {
  width: var(--table-drag-col-width);
  min-width: var(--table-drag-col-width);
  max-width: var(--table-drag-col-width);
  padding: 0 !important;
}
.workspace-table__drag-cell {
  width: var(--table-drag-col-width);
  min-width: var(--table-drag-col-width);
  max-width: var(--table-drag-col-width);
  padding: 0 !important;
  text-align: center;
  vertical-align: middle;
}
.workspace-table__drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  margin: 0;
  padding: 0;
  border: 1px solid mixin.$border-light;
  border-radius: 4px;
  background: #fff;
  color: mixin.$text-sub;
  cursor: pointer;
  touch-action: none;
}
.workspace-table__drag-handle:hover {
  background: rgba(15, 23, 42, 0.06);
  border-color: mixin.$border;
  color: mixin.$text;
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
  padding: 0.55rem 0.65rem;
  background: mixin.$table-header-bg;
  border-bottom: 1px solid mixin.$table-header-bg;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 700;
  color: mixin.$white;
  white-space: nowrap;
  overflow: hidden;
  isolation: isolate;
}
.workspace-table__header-label {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 0.35rem;
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
.workspace-table__task-row td:has(.workspace-table__cell-btn),
.workspace-table__task-row td:has(.workspace-table__title-cell--editable) {
  cursor: pointer;
}
.workspace-table__task-row td > .workspace-table__placeholder {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  min-height: var(--table-row-height);
  padding: 0 0.65rem;
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
  padding-right: 0.65rem;
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
  padding-left: 1.35rem;
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
  padding-left: 0.35rem;
}
.workspace-table__title-text,
.workspace-table__title-input {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding: 0 0.35rem;
  border-radius: 4px;
  font-size: 0.8125rem;
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
  height: 1.5rem;
  min-height: 1.5rem;
  margin: auto 0;
  border: 1px solid mixin.$border;
  background: #fff;
  line-height: calc(1.5rem - 2px);
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
  width: 1.35rem;
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
  padding: 0 0.9rem;
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
.workspace-table__cell-btn:hover {
  background: mixin.$main-aqua-surface-light;
}
.workspace-table__cell-btn--popover-open {
  box-shadow: inset 0 0 0 1.4px mixin.$main;
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
  gap: 0.2rem;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  padding-left: 2px;
}
.workspace-table__avatar-btn {
  display: inline-flex;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}
.workspace-table__avatar-btn--add {
  box-sizing: border-box;
  width: var(--table-chip-height);
  height: var(--table-chip-height);
  align-items: center;
  justify-content: center;
  border: 1px solid mixin.$border;
}
.workspace-table__avatar-btn-plus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 400;
  line-height: 1;
  transform: translateY(-0.08em);
  color: #64748b;
}
.workspace-table__avatar-pill {
  display: inline-flex;
  border-radius: 999px;
}
.workspace-table__cell-btn:focus-visible .workspace-table__avatar-pill :deep(.member-avatar) {
  border-color: rgba(37, 99, 235, 0.35);
}
.workspace-table__avatar-pill :deep(.member-avatar) {
  box-sizing: border-box;
  border: 2px solid transparent;
}
.workspace-table__labels {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.2rem;
  min-width: 0;
  overflow: hidden;
}
.workspace-table__labels :deep(.label-strip--sm) {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  height: var(--table-chip-height);
  width: var(--table-label-chip-width);
  min-width: var(--table-label-chip-width);
  justify-content: center;
  padding: 0;
  font-size: 0.68rem;
  line-height: 1;
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
  font-size: 1.05rem;
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
