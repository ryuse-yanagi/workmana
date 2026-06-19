<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="modal-overlay"
      :class="{ 'modal-overlay--popover-open': panePopoverOpen }"
      role="presentation"
    >
        <section
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-label="タスク追加"
        >
          <header class="modal-header">
            <h3>タスク追加</h3>
            <button
              type="button"
              class="icon-close"
              :disabled="submitting"
              aria-label="閉じる"
              @click="close"
            >✕</button>
          </header>

          <div class="modal-body">
            <section class="parent-section">
              <div
                class="parent-toggle-card"
              >
                <div class="parent-toggle-card__head">
                  <div class="parent-toggle-card__label-wrap">
                    <ListTree
                      :size="18"
                      :stroke-width="2"
                      class="parent-toggle-card__icon"
                      aria-hidden="true"
                    />
                    <span class="parent-toggle-card__label">親タスクとして新規作成する</span>
                  </div>
                  <button
                    type="button"
                    class="toggle-switch"
                    role="switch"
                    :aria-checked="createAsParent"
                    :disabled="submitting"
                    @click="toggleCreateAsParent"
                  >
                    <span class="toggle-switch__track" aria-hidden="true">
                      <span class="toggle-switch__thumb" />
                    </span>
                  </button>
                </div>
                <p class="parent-toggle-card__hint">
                  OFFにの場合、既存の親タスクに紐づく子タスクとして作成されます
                </p>
              </div>

              <div v-if="!createAsParent" class="parent-select-row">
                <span class="parent-select-label">親タスク</span>
                <div class="parent-select-wrap">
                  <select
                    v-model="parentTaskIdModel"
                    class="parent-select"
                    :class="{ 'parent-select--placeholder': parentTaskId === null }"
                    :disabled="submitting || parentTasksLoading || parentTaskDefaultsLoading"
                    aria-label="親タスク"
                  >
                    <option value="">親タスクを選択してください</option>
                    <option
                      v-for="parent in parentTasks"
                      :key="parent.id"
                      :value="String(parent.id)"
                    >
                      {{ parent.title }}
                    </option>
                  </select>
                  <ChevronDown
                    :size="16"
                    :stroke-width="2.25"
                    class="parent-select-chevron"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </section>

            <div class="task-form-section">
              <TaskFormPane
                ref="taskFormPaneRef"
                v-model="draft"
                :org-slug="orgSlug"
                :org-labels="orgLabels"
                :project-members="projectMembers"
                :disabled="submitting"
                relaxed-title-padding
              />
            </div>

            <p v-if="submitError" class="err">{{ submitError }}</p>

            <footer class="modal-footer">
              <button
                type="button"
                class="ghost-btn"
                :disabled="submitting"
                @click="close"
              >
                キャンセル
              </button>
              <button
                type="button"
                class="primary-btn"
                :disabled="!canSubmit"
                @click="submit"
              >
                {{ submitting ? '作成中...' : '新規作成' }}
              </button>
            </footer>
          </div>
        </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ChevronDown, ListTree } from 'lucide-vue-next'
import TaskFormPane from '../task/TaskFormPane.vue'
import { useApi } from '../../composables/useApi'
import {
  applyTaskDefaultsToDraft,
  buildTaskCreateBody,
  clearTaskDraftDefaults,
  createEmptyTaskFormDraft,
  type TaskFormDraft,
  type TaskFormLabel,
  type TaskFormMember,
} from '../../composables/useTaskFormHelpers'
import type { TaskFormPopoverType } from '../../composables/useTaskFormPane'
import { useOrgEffortSettings } from '../../composables/useOrgEffortSettings'

type ParentTaskOption = {
  id: number
  title: string
}

type ParentTaskDetail = {
  start_date: string | null
  due_date: string | null
  effort_hours: number | string | null
  effort_value: number | string | null
  effort_unit: string | null
  assignees: TaskFormMember[]
  labels: TaskFormLabel[]
}

export type CreatedTask = {
  id: number
  list_id: number | null
  sort_order?: number
  is_parent_task?: boolean
  parent_task_id?: number | null
  title: string
  description: string | null
  status: string
  priority?: string
  start_date?: string | null
  due_date?: string | null
  effort_hours?: number | string | null
  effort_value?: number | string | null
  effort_unit?: string | null
  assignee_id?: number | null
  assignees?: TaskFormMember[]
  labels?: TaskFormLabel[]
  created_at?: string
  updated_at?: string
}

type TaskFormPaneExpose = {
  resetPaneState: () => void
  activePopover?: TaskFormPopoverType | null
}

const props = defineProps<{
  modelValue: boolean
  orgSlug: string
  projectId: string
  listId: number | null
  orgLabels: TaskFormLabel[]
  projectMembers: TaskFormMember[]
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  created: [CreatedTask]
}>()

const { api } = useApi()
const {
  ensureOrgEffortSettings,
  getOrgEffortUnit,
} = useOrgEffortSettings()

const draft = ref<TaskFormDraft>(createEmptyTaskFormDraft())
const createAsParent = ref(false)
const parentTaskId = ref<number | null>(null)
const parentTasks = ref<ParentTaskOption[]>([])
const parentTasksLoading = ref(false)
const parentTaskDefaultsLoading = ref(false)
const submitting = ref(false)
const submitError = ref<string | null>(null)
const taskFormPaneRef = ref<TaskFormPaneExpose | null>(null)
let parentDefaultsRequestId = 0

const parentTaskIdModel = computed({
  get: () => (parentTaskId.value === null ? '' : String(parentTaskId.value)),
  set: (value: string) => {
    parentTaskId.value = value === '' ? null : Number(value)
  },
})

const canSubmit = computed(() =>
  draft.value.title.trim() !== ''
  && !submitting.value
  && props.listId !== null,
)

const panePopoverOpen = computed(() => taskFormPaneRef.value?.activePopover != null)

function toggleCreateAsParent () {
  if (submitting.value) return
  createAsParent.value = !createAsParent.value
}

function close () {
  if (submitting.value) return
  emit('update:modelValue', false)
}

async function fetchParentTasks () {
  parentTasksLoading.value = true
  try {
    const res = await api<{ data: ParentTaskOption[] }>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/parents`,
    )
    parentTasks.value = res.data
  } catch {
    parentTasks.value = []
  } finally {
    parentTasksLoading.value = false
  }
}

function resetForm () {
  draft.value = createEmptyTaskFormDraft()
  createAsParent.value = false
  parentTaskId.value = null
  parentTaskDefaultsLoading.value = false
  submitError.value = null
}

async function applyParentTaskDefaults (parentId: number | null) {
  if (createAsParent.value) return

  const requestId = ++parentDefaultsRequestId

  if (parentId === null) {
    draft.value = clearTaskDraftDefaults(draft.value)
    nextTick(() => {
      taskFormPaneRef.value?.resetPaneState()
    })
    return
  }

  parentTaskDefaultsLoading.value = true
  submitError.value = null
  try {
    const detail = await api<ParentTaskDetail>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${parentId}`,
    )
    if (requestId !== parentDefaultsRequestId) return
    draft.value = applyTaskDefaultsToDraft(draft.value, detail)
    nextTick(() => {
      taskFormPaneRef.value?.resetPaneState()
    })
  } catch (e: unknown) {
    if (requestId !== parentDefaultsRequestId) return
    submitError.value = e instanceof Error ? e.message : '親タスクの情報取得に失敗しました'
  } finally {
    if (requestId === parentDefaultsRequestId) {
      parentTaskDefaultsLoading.value = false
    }
  }
}

async function submit () {
  if (!canSubmit.value || props.listId === null) return

  submitting.value = true
  submitError.value = null

  try {
    await ensureOrgEffortSettings(props.orgSlug)
    const body = buildTaskCreateBody(draft.value, {
      listId: props.listId,
      createAsParent: createAsParent.value,
      parentTaskId: parentTaskId.value,
      orgEffortUnit: getOrgEffortUnit(props.orgSlug),
    })

    const created = await api<CreatedTask>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks`,
      { method: 'POST', body },
    )

    emit('created', created)
    emit('update:modelValue', false)
  } catch (e: unknown) {
    submitError.value = e instanceof Error ? e.message : '作成に失敗しました'
  } finally {
    submitting.value = false
  }
}

watch(createAsParent, (enabled) => {
  if (enabled) {
    parentTaskId.value = null
    draft.value = clearTaskDraftDefaults(draft.value)
    nextTick(() => {
      taskFormPaneRef.value?.resetPaneState()
    })
  }
})

watch(parentTaskId, (parentId) => {
  void applyParentTaskDefaults(parentId)
})

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    resetForm()
    void fetchParentTasks()
    nextTick(() => {
      taskFormPaneRef.value?.resetPaneState()
    })
  },
)
</script>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 4rem 1rem 1rem;
  z-index: 70;
  overflow-y: auto;
}

.modal-overlay--popover-open {
  overflow: hidden;
}

.modal-card {
  position: relative;
  width: min(40rem, 100%);
  border-radius: 12px;
  overflow: visible;
  background: #fff;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
}

.modal-header {
  @include mixin.modal-header-bar;
  border-radius: 12px 12px 0 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1;
}

.icon-close {
  @include mixin.modal-close-hit-area;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}

.modal-body {
  position: relative;
  padding: 1.2rem 1.35rem 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  overflow: visible;
  border-radius: 0 0 12px 12px;
}

.parent-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.parent-toggle-card {
  border: 1.6px solid mixin.$main;
  border-radius: 10px;
  background: mixin.$main-aqua-surface;
  padding: 0.85rem 0.95rem;
}

.parent-toggle-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.parent-toggle-card__label-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.parent-toggle-card__icon {
  flex-shrink: 0;
  color: mixin.$text;
}

.parent-toggle-card__label {
  font-size: 0.92rem;
  font-weight: 700;
  color: mixin.$text;
  line-height: 1.3;
}

.parent-toggle-card__hint {
  margin: 0.45rem 0 0;
  padding-left: 1.65rem;
  font-size: 0.78rem;
  line-height: 1.45;
  color: mixin.$text;
}

.task-form-section {
  overflow: visible;
  min-width: 0;
}

.toggle-switch {
  border: none;
  padding: 0;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}

.toggle-switch__track {
  display: inline-flex;
  align-items: center;
  width: 2.6rem;
  height: 1.45rem;
  border-radius: 999px;
  background: #cbd5e1;
  padding: 0.15rem;
  box-sizing: border-box;
  transition: background 0.15s ease;
}

.toggle-switch[aria-checked='true'] .toggle-switch__track {
  background: mixin.$main;
}

.toggle-switch__thumb {
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.2);
  transform: translateX(0);
  transition: transform 0.15s ease;
}

.toggle-switch[aria-checked='true'] .toggle-switch__thumb {
  transform: translateX(1.15rem);
}

.parent-select-row {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.parent-select-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: mixin.$text-sub;
}

.parent-select-wrap {
  position: relative;
}

.parent-select {
  width: 100%;
  box-sizing: border-box;
  appearance: none;
  border: 1px solid #dbe3ee;
  border-radius: 8px;
  padding: 0.62rem 2.2rem 0.62rem 0.75rem;
  font-size: 0.9rem;
  color: #0f172a;
  background: #fff;
  line-height: 1.35;
}

.parent-select--placeholder {
  color: #94a3b8;
}

.parent-select-chevron {
  position: absolute;
  top: 50%;
  right: 0.75rem;
  transform: translateY(-50%);
  color: #94a3b8;
  pointer-events: none;
}

.parent-select:focus {
  @include mixin.input-focus-ring;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 0.25rem;
}

.primary-btn,
.ghost-btn {
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.5rem 1.1rem;
  font-weight: 800;
  cursor: pointer;
  font-size: 0.86rem;
}

.primary-btn {
  background: mixin.$main;
  color: mixin.$white;
}

.ghost-btn {
  border-color: #cbd5e1;
  color: mixin.$text-sub;
  background: #f1f5f9;
}

.err {
  margin: 0;
  color: #b91c1c;
  font-weight: 700;
  font-size: 0.86rem;
}

button:disabled,
select:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
