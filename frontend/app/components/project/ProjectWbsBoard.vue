<template>
  <div class="project-wbs-board">
    <div v-if="loading" class="project-wbs-board__state">
      読み込み中...
    </div>
    <p v-else-if="error" class="project-wbs-board__error">{{ error }}</p>
    <p v-else-if="!displayRows.length" class="project-wbs-board__state">
      表示できるタスクがありません。
    </p>
    <div v-else class="project-wbs-board__scroll">
      <table class="project-wbs-table">
        <thead>
          <tr>
            <th scope="col">タスク</th>
            <th scope="col">担当者</th>
            <th scope="col">ラベル</th>
            <th scope="col">リスト</th>
            <th scope="col">開始日</th>
            <th scope="col">終了日</th>
            <th scope="col">工数</th>
            <th scope="col">備考</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in displayRows"
            :key="`${row.kind}-${row.task.id}`"
            class="project-wbs-table__task-row"
            :class="{
              'project-wbs-table__task-row--parent': row.kind === 'parent',
              'project-wbs-table__task-row--child': row.kind === 'child',
            }"
          >
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
                <div class="project-wbs-table__title-field">
                  <span
                    v-if="editingTitleTaskId !== row.task.id"
                    class="project-wbs-table__title-text project-wbs-table__title-clickable"
                    role="button"
                    tabindex="0"
                    @click="startTitleEdit(row.task)"
                    @keydown.enter.prevent="startTitleEdit(row.task)"
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
                >{{ row.childCount }}</span>
              </div>
            </td>
            <td>
              <div
                v-if="row.task.assignees?.length"
                class="project-wbs-table__members-cell"
              >
                <button
                  v-for="member in row.task.assignees"
                  :key="member.id"
                  type="button"
                  class="project-wbs-table__avatar-btn"
                  :title="memberDisplayName(member)"
                  :aria-label="memberDisplayName(member)"
                  @click="openMemberDetail(row.task, member, $event)"
                >
                  <MemberAvatar
                    :member="member"
                    size="xs"
                    decorative
                  />
                </button>
                <button
                  type="button"
                  class="project-wbs-table__cell-btn project-wbs-table__cell-btn--add"
                  aria-label="担当者を編集"
                  @click="openMembers(row.task, $event)"
                >+</button>
              </div>
              <button
                v-else
                type="button"
                class="project-wbs-table__cell-btn"
                @click="openMembers(row.task, $event)"
              >
                <span class="project-wbs-table__placeholder">担当者を追加</span>
              </button>
            </td>
            <td>
              <button
                type="button"
                class="project-wbs-table__cell-btn"
                @click="openLabels(row.task, $event)"
              >
                <div v-if="row.task.labels?.length" class="project-wbs-table__labels">
                  <LabelStrip
                    v-for="label in row.task.labels"
                    :key="label.id"
                    :label="label"
                    size="sm"
                  />
                </div>
                <span v-else class="project-wbs-table__placeholder">ラベルを追加</span>
              </button>
            </td>
            <td>
              <button
                type="button"
                class="project-wbs-table__cell-btn project-wbs-table__cell-btn--text"
                @click="openList(row.task, $event)"
              >
                <span v-if="row.task.list_name">{{ row.task.list_name }}</span>
                <span v-else class="project-wbs-table__placeholder">—</span>
              </button>
            </td>
            <td>
              <button
                type="button"
                class="project-wbs-table__cell-btn project-wbs-table__cell-btn--text"
                @click="openStartDate(row.task, $event)"
              >
                <span v-if="formatWbsDate(row.task.start_date)">{{ formatWbsDate(row.task.start_date) }}</span>
                <span v-else class="project-wbs-table__placeholder">—</span>
              </button>
            </td>
            <td>
              <button
                type="button"
                class="project-wbs-table__cell-btn project-wbs-table__cell-btn--text"
                @click="openDueDate(row.task, $event)"
              >
                <span v-if="formatWbsDate(row.task.due_date)">{{ formatWbsDate(row.task.due_date) }}</span>
                <span v-else class="project-wbs-table__placeholder">—</span>
              </button>
            </td>
            <td>
              <button
                type="button"
                class="project-wbs-table__cell-btn project-wbs-table__cell-btn--text"
                @click="openEffort(row.task, $event)"
              >
                <span v-if="formatWbsEffort(row.task)">{{ formatWbsEffort(row.task) }}</span>
                <span v-else class="project-wbs-table__placeholder">—</span>
              </button>
            </td>
            <td>
              <button
                type="button"
                class="project-wbs-table__cell-btn project-wbs-table__cell-btn--text project-wbs-table__cell-btn--notes"
                @click="openDescription(row.task, $event)"
              >
                <span
                  v-if="formatWbsDescription(row.task.description)"
                  class="project-wbs-table__notes"
                >{{ formatWbsDescription(row.task.description) }}</span>
                <span v-else class="project-wbs-table__placeholder">備考を追加</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
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
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import {
  buildWbsDisplayRows,
  formatWbsDate,
  formatWbsDescription,
  formatWbsEffort,
  type WbsTask,
} from '../../composables/useWbsTaskGroups'
import type { ProjectListOption, TaskPopoverEditable } from '../../composables/useTaskPopoverEditor'
import type { TaskFormLabel, TaskFormMember } from '../../composables/useTaskFormHelpers'
import { memberDisplayName } from '../../composables/useMemberDisplay'
import { useApi } from '../../composables/useApi'
import TaskEditPopoverLayer from '../task/TaskEditPopoverLayer.vue'

const props = defineProps<{
  orgSlug: string
  projectId: string
}>()

const { api } = useApi()

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

const displayRows = computed(() => buildWbsDisplayRows(tasks.value, collapsedParentIds.value))

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
  tasks.value[idx] = {
    ...current,
    title: updated.title,
    description: updated.description,
    list_id: updated.list_id ?? current.list_id,
    list_name: updated.list_name ?? current.list_name,
    sort_order: updated.sort_order ?? current.sort_order,
    start_date: updated.start_date,
    due_date: updated.due_date,
    effort_value: updated.effort_value,
    effort_hours: updated.effort_hours,
    effort_unit: updated.effort_unit,
    assignees: updated.assignees,
    labels: updated.labels,
  }
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
    const [tasksRes, labelsRes, membersRes, listsRes] = await Promise.all([
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
</script>

<style lang="scss" scoped>
.project-wbs-board {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.project-wbs-board__scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid mixin.$border-light;
  border-radius: 10px;
  background: #fff;
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
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.8125rem;
}

.project-wbs-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0.55rem 0.65rem;
  background: mixin.$table-header-bg;
  border-bottom: 1px solid mixin.$table-header-bg;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 700;
  color: mixin.$white;
  white-space: nowrap;
}

.project-wbs-table thead th:nth-child(1) { width: 16%; }
.project-wbs-table thead th:nth-child(2) { width: 10%; }
.project-wbs-table thead th:nth-child(3) { width: 14%; }
.project-wbs-table thead th:nth-child(4) { width: 11%; }
.project-wbs-table thead th:nth-child(5),
.project-wbs-table thead th:nth-child(6) { width: 9%; }
.project-wbs-table thead th:nth-child(7) { width: 7%; }
.project-wbs-table thead th:nth-child(8) { width: 24%; }

.project-wbs-table__task-row td {
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid mixin.$border-light;
  vertical-align: top;
  color: mixin.$text;
  line-height: 1.35;
  word-break: break-word;
}

.project-wbs-table__task-row:last-child td {
  border-bottom: none;
}

.project-wbs-table__task-row--parent td {
  background: mixin.$main-aqua-surface;
}

.project-wbs-table__task-title {
  font-weight: 700;
}

.project-wbs-table__title-cell {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  min-width: 0;
}

.project-wbs-table__title-cell--child {
  padding-left: 1.35rem;
}

.project-wbs-table__title-field {
  flex: 1;
  min-width: 0;
}

.project-wbs-table__title-text,
.project-wbs-table__title-input {
  display: block;
  width: 100%;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  color: inherit;
}

.project-wbs-table__title-clickable {
  cursor: pointer;
  border-radius: 4px;
}

.project-wbs-table__title-clickable:hover {
  background: rgba(15, 23, 42, 0.05);
}

.project-wbs-table__title-clickable:focus-visible {
  @include mixin.input-focus-ring;
}

.project-wbs-table__title-input {
  box-sizing: border-box;
  border: 1px solid mixin.$border;
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
  background: #fff;
}

.project-wbs-table__title-input:focus {
  @include mixin.input-focus-ring;
}

.project-wbs-table__toggle {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.35rem;
  height: 1.35rem;
  margin-top: 0.05rem;
  padding: 0;
  border: none;
  border-radius: 4px;
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

.project-wbs-table__cell-btn {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0.15rem 0.25rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  text-align: left;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.project-wbs-table__cell-btn:hover {
  background: rgba(15, 23, 42, 0.05);
}

.project-wbs-table__cell-btn:focus-visible {
  @include mixin.input-focus-ring;
}

.project-wbs-table__cell-btn--text {
  min-height: 1.35rem;
}

.project-wbs-table__cell-btn--notes {
  max-width: 100%;
}

.project-wbs-table__placeholder {
  color: mixin.$text-sub;
  font-weight: 500;
}

.project-wbs-table__members-cell {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem;
}

.project-wbs-table__avatar-btn {
  display: inline-flex;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}

.project-wbs-table__avatar-btn:hover {
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.35);
}

.project-wbs-table__avatar-btn:focus-visible {
  @include mixin.input-focus-ring;
}

.project-wbs-table__cell-btn--add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  font-size: 1rem;
  font-weight: 400;
  color: mixin.$text-sub;
}

.project-wbs-table__labels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.project-wbs-table__notes {
  white-space: pre-wrap;
  color: mixin.$text-sub;
}
</style>
