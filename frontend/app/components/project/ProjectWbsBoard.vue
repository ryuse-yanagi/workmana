<template>
  <div class="project-wbs-board">
    <div v-if="loading" class="project-wbs-board__state">
      読み込み中...
    </div>
    <p v-else-if="error" class="project-wbs-board__error">{{ error }}</p>
    <p v-else-if="!displayRows.length" class="project-wbs-board__state">
      表示できるタスクがありません。
    </p>
    <div
      v-else
      ref="tableScrollEl"
      class="project-wbs-board__viewport"
      :class="{ 'project-wbs-board__viewport--dragging': dragging }"
    >
      <div class="project-wbs-board__frame">
        <div
          class="project-wbs-table-wrap"
          :class="{
            'project-wbs-table-wrap--resizing': isResizing,
            'project-wbs-table-wrap--dragging': dragging,
          }"
        >
        <table
          class="project-wbs-table"
          :style="{
            '--wbs-table-width': `${tableWidth}px`,
            '--wbs-drag-col-width': `${WBS_DRAG_COL_WIDTH}px`,
          }"
        >
        <colgroup>
          <col class="project-wbs-table__drag-col">
          <col
            v-for="column in WBS_TABLE_COLUMNS"
            :key="column.key"
            :style="{ width: `${columnWidths[column.key]}px` }"
          >
        </colgroup>
        <thead>
          <tr>
            <th
              class="project-wbs-table__drag-header"
              scope="col"
              aria-hidden="true"
            />
            <th
              v-for="column in WBS_TABLE_COLUMNS"
              :key="column.key"
              scope="col"
              class="project-wbs-table__header-cell"
            >
              <span class="project-wbs-table__header-label">{{ column.label }}</span>
              <span
                class="project-wbs-table__resize-handle"
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
            class="project-wbs-table__task-row"
            :class="{
              'project-wbs-table__task-row--parent': row.kind === 'parent',
              'project-wbs-table__task-row--child': row.kind === 'child',
              'project-wbs-table__task-row--orphan-parent': isWbsOrphanParentTask(row.task),
              'project-wbs-table__task-row--drag-preview': draggingTaskIds.has(row.task.id),
            }"
            :data-wbs-row-index="rowIndex"
            :data-wbs-task-id="row.task.id"
          >
            <td class="project-wbs-table__drag-cell">
              <button
                v-if="!isWbsOrphanParentTask(row.task)"
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
            <td class="project-wbs-table__task-title">
              <div
                class="project-wbs-table__title-cell"
                :class="{ 'project-wbs-table__title-cell--child': row.kind === 'child' }"
              >
                <button
                  v-if="row.kind === 'parent'"
                  type="button"
                  class="project-wbs-table__toggle"
                  :aria-expanded="!collapsedParentIds.has(row.task.id)"
                  :aria-label="collapsedParentIds.has(row.task.id) ? '子タスクを展開' : '子タスクを折りたたむ'"
                  @click="toggleParentCollapse(row.task.id)"
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
                  :class="{
                    'project-wbs-table__title-field--after-toggle': row.kind === 'parent',
                    'project-wbs-table__title-field--editable': !isWbsOrphanParentTask(row.task),
                  }"
                  :tabindex="!isWbsOrphanParentTask(row.task) && editingTitleTaskId !== row.task.id ? 0 : undefined"
                  @click="onTitleFieldActivate(row.task)"
                  @keydown.enter.prevent="onTitleFieldActivate(row.task)"
                >
                  <span
                    v-if="isWbsOrphanParentTask(row.task)"
                    class="project-wbs-table__title-text project-wbs-table__title-text--orphan-parent"
                  >{{ row.task.title }}</span>
                  <span
                    v-else-if="editingTitleTaskId !== row.task.id"
                    class="project-wbs-table__title-text project-wbs-table__title-clickable"
                    :title="row.task.title"
                  >{{ row.task.title }}</span>
                  <input
                    v-else
                    ref="titleInputEl"
                    v-model="titleDraft"
                    type="text"
                    class="project-wbs-table__title-input"
                    :disabled="titleSaving"
                    @blur="confirmTitleEdit(row.task)"
                    @keydown.enter.prevent="confirmTitleEdit(row.task)"
                  />
                </div>
                <span
                  v-if="row.kind === 'parent' && row.childCount > 0"
                  class="project-wbs-table__child-count"
                  :class="{ 'project-wbs-table__child-count--orphan-parent': isWbsOrphanParentTask(row.task) }"
                >{{ row.childCount }}</span>
              </div>
            </td>
            <td>
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
            <td>
              <button
                v-if="row.task.labels?.length && !isWbsOrphanParentTask(row.task)"
                type="button"
                class="project-wbs-table__cell-btn"
                @click="openLabels(row.task, $event)"
              >
                <div class="project-wbs-table__labels">
                  <LabelStrip
                    v-for="label in row.task.labels"
                    :key="label.id"
                    :label="label"
                    size="sm"
                  />
                </div>
              </button>
              <button
                v-else-if="!isWbsOrphanParentTask(row.task)"
                type="button"
                class="project-wbs-table__cell-btn"
                aria-label="ラベルを追加"
                @click="openLabels(row.task, $event)"
              >
                <div class="project-wbs-table__labels">
                  <span class="project-wbs-table__label-add-chip" aria-hidden="true">
                    <span class="project-wbs-table__label-add-plus" aria-hidden="true">+</span>
                  </span>
                </div>
              </button>
              <span v-else class="project-wbs-table__placeholder">—</span>
            </td>
            <td>
              <button
                v-if="!isWbsOrphanParentTask(row.task)"
                type="button"
                class="project-wbs-table__cell-btn project-wbs-table__cell-btn--text"
                @click="openList(row.task, $event)"
              >
                <span v-if="row.task.list_name" class="project-wbs-table__ellipsis" :title="row.task.list_name">{{ row.task.list_name }}</span>
                <span v-else class="project-wbs-table__placeholder">—</span>
              </button>
              <span v-else class="project-wbs-table__placeholder">—</span>
            </td>
            <td>
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
            <td>
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
            <td>
              <button
                v-if="!isWbsOrphanParentTask(row.task)"
                type="button"
                class="project-wbs-table__cell-btn project-wbs-table__cell-btn--text"
                @click="openEffort(row.task, $event)"
              >
                <span v-if="formatWbsEffort(row.task, orgEffortUnit)">{{ formatWbsEffort(row.task, orgEffortUnit) }}</span>
                <span v-else class="project-wbs-table__placeholder">—</span>
              </button>
              <span v-else class="project-wbs-table__placeholder">—</span>
            </td>
            <td>
              <button
                v-if="!isWbsOrphanParentTask(row.task)"
                type="button"
                class="project-wbs-table__cell-btn project-wbs-table__cell-btn--text project-wbs-table__cell-btn--notes"
                @click="openDescription(row.task, $event)"
              >
                <span
                  v-if="formatWbsDescription(row.task.description)"
                  class="project-wbs-table__notes project-wbs-table__ellipsis"
                  :title="formatWbsDescription(row.task.description)"
                >{{ formatWbsDescription(row.task.description) }}</span>
                <span v-else class="project-wbs-table__placeholder">備考を追加</span>
              </button>
              <span v-else class="project-wbs-table__placeholder">—</span>
            </td>
          </tr>
        </tbody>
        </table>
        <div
          class="project-wbs-table__resize-overlay"
          aria-hidden="true"
        >
          <span
            v-for="(boundary, boundaryIndex) in columnResizeBoundaries"
            :key="`guide-${boundary.columnKey}`"
            class="project-wbs-table__resize-guide"
            :class="{ 'project-wbs-table__resize-guide--no-line': boundaryIndex === columnResizeBoundaries.length - 1 }"
            :style="{ left: `${boundary.offset}px` }"
          />
        </div>
      </div>
      </div>
    </div>

    <TaskEditPopoverLayer
      ref="editLayerRef"
      :org-slug="orgSlug"
      :project-id="projectId"
      :org-labels="orgLabels"
      :project-members="projectMembers"
      :project-lists="projectLists"
      @updated="syncTaskUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, ChevronRight, Equal } from 'lucide-vue-next'
import {
  buildWbsDisplayRows,
  buildWbsReorderPayload,
  formatWbsDate,
  formatWbsDescription,
  formatWbsEffort,
  isWbsOrphanParentTask,
  type WbsTask,
} from '../../composables/useWbsTaskGroups'
import { useWbsTaskDragReorder } from '../../composables/useWbsTaskDragReorder'
import {
  WBS_TABLE_COLUMNS,
  WBS_DRAG_COL_WIDTH,
  useWbsTableColumnResize,
} from '../../composables/useWbsTableColumnResize'
import type { ProjectListOption, TaskPopoverEditable } from '../../composables/useTaskPopoverEditor'
import type { TaskFormLabel, TaskFormMember } from '../../composables/useTaskFormHelpers'
import { memberDisplayName } from '../../composables/useMemberDisplay'
import { useApi } from '../../composables/useApi'
import { useOrgEffortUnit } from '../../composables/useOrgEffortSettings'
import { useProjectBoardPageData } from '../../composables/useProjectBoardPageData'
import TaskEditPopoverLayer from '../task/TaskEditPopoverLayer.vue'

const props = defineProps<{
  orgSlug: string
  projectId: string
}>()

const { api } = useApi()
const { patchCachedTasks } = useProjectBoardPageData()
const { orgEffortUnit, ensureOrgEffortUnit } = useOrgEffortUnit(() => props.orgSlug)

const loading = ref(true)
const error = ref<string | null>(null)
const tasks = ref<WbsTask[]>([])
const orgLabels = ref<TaskFormLabel[]>([])
const projectMembers = ref<TaskFormMember[]>([])
const projectLists = ref<ProjectListOption[]>([])
const collapsedParentIds = ref<Set<number>>(new Set())
const editLayerRef = ref<InstanceType<typeof TaskEditPopoverLayer> | null>(null)

const editingTitleTaskId = ref<number | null>(null)
const titleDraft = ref('')
const titleSaving = ref(false)
const titleInputEl = ref<HTMLInputElement | HTMLInputElement[] | null>(null)

const tableScrollEl = ref<HTMLElement | null>(null)
const tableBodyEl = ref<HTMLTableSectionElement | null>(null)
const columnStorageKey = computed(() => `wbs-column-widths:${props.orgSlug}:${props.projectId}`)
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
} = useWbsTableColumnResize(columnStorageKey)

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
  onCommit: saveWbsOrder,
})

const displayRows = computed(() => {
  if (dragging.value) {
    return activeRows.value
  }
  return buildWbsDisplayRows(tasks.value, collapsedParentIds.value)
})

function onDragHandleClick () {
  if (shouldSuppressClick()) {
    return
  }
}

async function saveWbsOrder (updatedTasks: WbsTask[]) {
  try {
    await api<{ data: { ok: boolean } }>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/wbs/reorder`,
      {
        method: 'PATCH',
        body: { tasks: buildWbsReorderPayload(updatedTasks) },
      },
    )
    patchCachedTasks(
      props.orgSlug,
      props.projectId,
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
  patchCachedTasks(props.orgSlug, props.projectId, [{
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

function openEffort (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openEffortPicker(e), event)
}

function openMembers (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openMemberPicker(e), event)
}

function openMemberDetail (task: WbsTask, member: TaskFormMember, event: Event) {
  editLayerRef.value?.bindTask(task)
  editLayerRef.value?.openMemberDetail(member, event)
}

function openLabels (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openLabelPicker(e), event)
}

function openDescription (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openDescriptionPicker(e), event)
}

function openList (task: WbsTask, event: Event) {
  bindAndOpen(task, (e) => editLayerRef.value?.openListPicker(e), event)
}

async function startTitleEdit (task: WbsTask) {
  editingTitleTaskId.value = task.id
  titleDraft.value = task.title
  await nextTick()
  const el = Array.isArray(titleInputEl.value)
    ? titleInputEl.value[0]
    : titleInputEl.value
  el?.focus()
  el?.select()
}

function onTitleFieldActivate (task: WbsTask) {
  if (isWbsOrphanParentTask(task)) {
    return
  }
  if (editingTitleTaskId.value === task.id) {
    return
  }
  void startTitleEdit(task)
}

function cancelTitleEdit () {
  editingTitleTaskId.value = null
  titleDraft.value = ''
}

async function confirmTitleEdit (task: WbsTask) {
  if (titleSaving.value || editingTitleTaskId.value !== task.id) return
  const title = titleDraft.value.trim()
  if (!title || title === task.title) {
    cancelTitleEdit()
    return
  }
  titleSaving.value = true
  try {
    await api<{ title: string }>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${task.id}`,
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

async function loadWbsTasks () {
  loading.value = true
  error.value = null
  try {
    const [, tasksRes, labelsRes, membersRes, listsRes] = await Promise.all([
      ensureOrgEffortUnit(),
      api<{ data: WbsTask[] }>(
        `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/wbs`,
      ),
      api<{ data: TaskFormLabel[] }>(
        `/orgs/${props.orgSlug}/task-labels`,
      ),
      api<{ data: TaskFormMember[] }>(
        `/orgs/${props.orgSlug}/projects/${props.projectId}/members`,
      ),
      api<{ data: ProjectListOption[] }>(
        `/orgs/${props.orgSlug}/projects/${props.projectId}/lists`,
      ),
    ])
    tasks.value = tasksRes.data ?? []
    orgLabels.value = labelsRes.data ?? []
    projectMembers.value = membersRes.data ?? []
    projectLists.value = [...(listsRes.data ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'WBSの読み込みに失敗しました'
    tasks.value = []
    orgLabels.value = []
    projectMembers.value = []
    projectLists.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.orgSlug, props.projectId] as const,
  () => {
    void loadWbsTasks()
  },
  { immediate: true },
)

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
.project-wbs-board {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.project-wbs-board__viewport {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  overflow: auto;
}

.project-wbs-board__viewport--dragging {
  cursor: grabbing;
  user-select: none;
}

.project-wbs-board__frame {
  display: block;
  width: fit-content;
  border: 1px solid mixin.$border-light;
  border-radius: 10px;
  background: #fff;
}

.project-wbs-table-wrap {
  position: relative;
  width: fit-content;
}

.project-wbs-table-wrap--dragging {
  cursor: grabbing;
}

.project-wbs-table-wrap--dragging .project-wbs-table__drag-handle {
  cursor: grabbing;
}

.project-wbs-table-wrap--dragging .project-wbs-table__task-row--drag-preview {
  pointer-events: none;
}

.project-wbs-table-wrap--dragging .project-wbs-table__task-row--drag-preview .project-wbs-table__drag-handle {
  visibility: hidden;
}

.project-wbs-table-wrap--resizing {
  cursor: col-resize;
  user-select: none;
}

.project-wbs-table__resize-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
}

.project-wbs-board__state,
.project-wbs-board__error {
  margin: 0;
  padding: 1rem 0.25rem;
  font-size: 0.875rem;
}

.project-wbs-board__error {
  color: mixin.$danger;
  font-weight: 600;
}

.project-wbs-table {
  --wbs-row-height: 36px;
  --wbs-parent-row-height: 40px;
  --wbs-chip-height: 24px;
  --wbs-label-chip-width: 32px;
  --wbs-drag-col-width: 36px;
  --wbs-table-width: auto;
  width: var(--wbs-table-width);
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.8125rem;
}

.project-wbs-table__drag-col {
  width: var(--wbs-drag-col-width);
}

.project-wbs-table__drag-header {
  width: var(--wbs-drag-col-width);
  min-width: var(--wbs-drag-col-width);
  max-width: var(--wbs-drag-col-width);
  padding: 0 !important;
}

.project-wbs-table__drag-cell {
  width: var(--wbs-drag-col-width);
  min-width: var(--wbs-drag-col-width);
  max-width: var(--wbs-drag-col-width);
  padding: 0 !important;
  text-align: center;
  vertical-align: middle;
}

.project-wbs-table__drag-handle {
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
  cursor: grab;
  touch-action: none;
}

.project-wbs-table__drag-handle:hover {
  background: rgba(15, 23, 42, 0.06);
  border-color: mixin.$border;
  color: mixin.$text;
}

.project-wbs-table__drag-handle:active {
  cursor: grabbing;
}

.project-wbs-table thead th {
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

.project-wbs-table__header-label {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 0.35rem;
}

.project-wbs-table__resize-guide {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  pointer-events: none;
}

.project-wbs-table__resize-guide::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 1px;
  margin-left: -0.5px;
  background: rgba(148, 163, 184, 0.45);
}

.project-wbs-table__resize-guide--no-line::after {
  display: none;
}

.project-wbs-table__resize-handle {
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

.project-wbs-table thead th:first-child {
  border-top-left-radius: 9px;
}

.project-wbs-table thead th:last-child {
  border-top-right-radius: 9px;
}

.project-wbs-table__task-row:last-child td:first-child {
  border-bottom-left-radius: 9px;
}

.project-wbs-table__task-row:last-child td:last-child {
  border-bottom-right-radius: 9px;
}

.project-wbs-table__task-row td {
  height: var(--wbs-row-height);
  max-height: var(--wbs-row-height);
  min-width: 0;
  padding: 0;
  border-bottom: 1px solid mixin.$border-light;
  vertical-align: middle;
  color: mixin.$text;
  line-height: 1.2;
  overflow: hidden;
}

.project-wbs-table__task-row td > .project-wbs-table__placeholder {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  min-height: var(--wbs-row-height);
  padding: 0 0.65rem;
}

.project-wbs-table__task-row:last-child td {
  border-bottom: none;
}

.project-wbs-table__task-row--parent td {
  height: var(--wbs-parent-row-height);
  max-height: var(--wbs-parent-row-height);
  background: mixin.$wbs-parent-bg;
}

.project-wbs-table__task-row--parent td > .project-wbs-table__placeholder {
  min-height: var(--wbs-parent-row-height);
}

.project-wbs-table__task-row--parent .project-wbs-table__cell-btn {
  min-height: var(--wbs-parent-row-height);
}

.project-wbs-table__task-row--orphan-parent td {
  background: #eef2f6;
}

.project-wbs-table__title-text--orphan-parent {
  color: mixin.$text-muted;
  font-weight: 600;
}

.project-wbs-table__child-count--orphan-parent {
  color: mixin.$text-muted;
}

.project-wbs-table__task-title {
  font-weight: 700;
  padding-left: 0 !important;
}

.project-wbs-table__title-cell {
  display: flex;
  align-items: center;
  gap: 0;
  box-sizing: border-box;
  min-width: 0;
  width: 100%;
  height: var(--wbs-row-height);
  padding-right: 0.65rem;
}

.project-wbs-table__task-row--parent .project-wbs-table__title-cell {
  height: var(--wbs-parent-row-height);
}

.project-wbs-table__title-cell--child {
  padding-left: 1.35rem;
}

.project-wbs-table__title-field {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  align-self: stretch;
  box-sizing: border-box;
}

.project-wbs-table__title-field--after-toggle {
  padding-left: 0.35rem;
}

.project-wbs-table__title-field--editable {
  cursor: pointer;
}

.project-wbs-table__title-field--editable:focus-visible {
  @include mixin.input-focus-ring;
  border-radius: 4px;
}

.project-wbs-table__title-text,
.project-wbs-table__title-input {
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

.project-wbs-table__title-text {
  display: flex;
  align-items: center;
  align-self: stretch;
  min-height: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  border: 1px solid transparent;
}

.project-wbs-table__title-input {
  height: 1.5rem;
  min-height: 1.5rem;
  margin: auto 0;
  border: 1px solid mixin.$border;
  background: #fff;
  line-height: calc(1.5rem - 2px);
}

.project-wbs-table__title-input:focus {
  @include mixin.input-focus-ring;
}

.project-wbs-table__title-field--editable:hover .project-wbs-table__title-clickable {
  background: rgba(15, 23, 42, 0.05);
}

.project-wbs-table__toggle {
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

.project-wbs-table__toggle:hover {
  background: rgba(15, 23, 42, 0.06);
  color: mixin.$text;
}

.project-wbs-table__child-count {
  flex-shrink: 0;
  margin-left: 0.15rem;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  color: mixin.$text-sub;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.3;
}

.project-wbs-table__ellipsis {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-wbs-table__cell-btn {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: var(--wbs-row-height);
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
}

.project-wbs-table__cell-btn:focus-visible {
  @include mixin.input-focus-ring;
}

.project-wbs-table__cell-btn--text {
  min-height: 0;
}

.project-wbs-table__cell-btn--text > span:not(.project-wbs-table__placeholder) {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-wbs-table__cell-btn--notes {
  max-width: 100%;
}

.project-wbs-table__cell-btn--text .project-wbs-table__labels {
  flex: 1;
  min-width: 0;
}

.project-wbs-table__placeholder {
  color: mixin.$text-sub;
  font-weight: 500;
}

.project-wbs-table__members-cell {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.2rem;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  padding-left: 2px;
}

.project-wbs-table__avatar-btn {
  display: inline-flex;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}

.project-wbs-table__avatar-btn--add {
  box-sizing: border-box;
  width: var(--wbs-chip-height);
  height: var(--wbs-chip-height);
  align-items: center;
  justify-content: center;
  border: 1px solid mixin.$border;
}

.project-wbs-table__avatar-btn-plus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 400;
  line-height: 1;
  transform: translateY(-0.08em);
  color: #64748b;
}

.project-wbs-table__avatar-pill {
  display: inline-flex;
  border-radius: 999px;
}

.project-wbs-table__cell-btn:focus-visible .project-wbs-table__avatar-pill :deep(.member-avatar) {
  border-color: rgba(37, 99, 235, 0.35);
}

.project-wbs-table__avatar-pill :deep(.member-avatar) {
  box-sizing: border-box;
  border: 2px solid transparent;
}

.project-wbs-table__labels {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.2rem;
  min-width: 0;
  overflow: hidden;
}

.project-wbs-table__labels :deep(.label-strip--sm) {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  height: var(--wbs-chip-height);
  width: var(--wbs-label-chip-width);
  min-width: var(--wbs-label-chip-width);
  justify-content: center;
  padding: 0;
  font-size: 0.68rem;
  line-height: 1;
}

.project-wbs-table__label-add-chip {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--wbs-chip-height);
  width: var(--wbs-label-chip-width);
  min-width: var(--wbs-label-chip-width);
  padding: 0;
  border-radius: 4px;
  border: 1px solid mixin.$border;
  background: #fff;
  color: #64748b;
}

.project-wbs-table__label-add-plus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
  font-weight: 400;
  line-height: 1;
  transform: translateY(-0.08em);
}

.project-wbs-table__notes {
  color: mixin.$text-sub;
}
</style>

<style lang="scss">
.project-wbs-drag-ghost {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 10000;
  pointer-events: none;
  cursor: grabbing;
  opacity: 0.3;
}
</style>
