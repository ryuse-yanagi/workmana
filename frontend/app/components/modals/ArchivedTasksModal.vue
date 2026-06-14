<template>
  <BaseModal
    :model-value="modelValue"
    title="アーカイブ済みカード"
    aria-label="アーカイブ済みカード"
    width="min(42rem, 100%)"
    align="top"
    :close-disabled="pendingId !== null"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="archived-tasks-modal__body">
      <p v-if="workUnitLabel" class="archived-tasks-modal__subtitle">
        {{ workUnitLabel }} #{{ projectId }} — アーカイブしたカードだけが表示されます。完全削除はこの画面からのみ行えます。
      </p>

      <p v-if="error" class="archived-tasks-modal__err">{{ error }}</p>

      <div v-if="loading && !tasks" class="archived-tasks-modal__state">
        読み込み中...
      </div>

      <section v-else-if="!tasks?.length" class="archived-tasks-modal__empty">
        <p>アーカイブ済みのカードはありません。</p>
      </section>

      <ul v-else class="archived-tasks-modal__list">
        <li v-for="task in tasks" :key="task.id" class="archived-tasks-modal__item">
          <TaskBoardCard :task="task" />
          <footer class="archived-tasks-modal__actions">
            <button
              type="button"
              class="archived-tasks-modal__action"
              :disabled="pendingId === task.id"
              @click="openRestoreConfirm(task)"
            >
              {{ pendingId === task.id ? '処理中...' : '復元' }}
            </button>
            <span class="archived-tasks-modal__action-sep" aria-hidden="true">•</span>
            <button
              type="button"
              class="archived-tasks-modal__action archived-tasks-modal__action--danger"
              :disabled="pendingId === task.id"
              @click="openDeleteConfirm(task)"
            >
              削除
            </button>
          </footer>
        </li>
      </ul>
    </div>

    <ConfirmModal
      v-model="restoreConfirmOpen"
      title="タスクカードの復元確認"
      confirm-text="復元"
      :loading="pendingId !== null"
      @confirm="confirmRestoreTask"
    />

    <ConfirmModal
      v-model="deleteConfirmOpen"
      title="タスクカードの完全削除"
      message="完全削除は取り消せません。"
      confirm-text="完全削除"
      variant="danger"
      :loading="pendingId !== null"
      @confirm="confirmPermanentDelete"
    />
  </BaseModal>
</template>

<script setup lang="ts">
import TaskBoardCard, { type TaskBoardCardTask } from '../task/TaskBoardCard.vue'
import { useApi } from '../../composables/useApi'
import type { RealtimeArchivedTask } from '../../composables/useProjectRealtimeChannel'

export type ArchivedTask = TaskBoardCardTask & {
  status: string
  list_id: number | null
  archived_at?: string | null
}

const props = defineProps<{
  modelValue: boolean
  orgSlug: string
  projectId: string
  workUnitLabel?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  restored: [ArchivedTask]
}>()

const { api } = useApi()

const tasks = ref<ArchivedTask[] | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)
const pendingId = ref<number | null>(null)
const deleteConfirmTask = ref<ArchivedTask | null>(null)
const restoreConfirmTask = ref<ArchivedTask | null>(null)

const restoreConfirmOpen = computed({
  get: () => restoreConfirmTask.value !== null,
  set: (open: boolean) => {
    if (!open) restoreConfirmTask.value = null
  },
})

const deleteConfirmOpen = computed({
  get: () => deleteConfirmTask.value !== null,
  set: (open: boolean) => {
    if (!open) deleteConfirmTask.value = null
  },
})

async function fetchArchived () {
  const res = await api<{ data: ArchivedTask[] }>(
    `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/archived`,
  )
  return res.data
}

async function load () {
  error.value = null
  loading.value = true
  try {
    tasks.value = await fetchArchived()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  } finally {
    loading.value = false
  }
}

async function restoreTask (task: ArchivedTask) {
  pendingId.value = task.id
  error.value = null
  try {
    const restored = await api<ArchivedTask>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${task.id}/unarchive`,
      { method: 'POST' },
    )
    tasks.value = (tasks.value ?? []).filter(t => t.id !== task.id)
    emit('restored', restored)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '復元に失敗しました'
  } finally {
    pendingId.value = null
  }
}

function openRestoreConfirm (task: ArchivedTask) {
  restoreConfirmTask.value = task
}

async function confirmRestoreTask () {
  const task = restoreConfirmTask.value
  if (!task) return
  restoreConfirmTask.value = null
  await restoreTask(task)
}

function openDeleteConfirm (task: ArchivedTask) {
  deleteConfirmTask.value = task
}

async function confirmPermanentDelete () {
  const task = deleteConfirmTask.value
  if (!task) return
  pendingId.value = task.id
  error.value = null
  try {
    await api(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${task.id}`,
      { method: 'DELETE' },
    )
    deleteConfirmTask.value = null
    tasks.value = (tasks.value ?? []).filter(t => t.id !== task.id)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '削除に失敗しました'
  } finally {
    pendingId.value = null
  }
}

function ensureTasks () {
  if (!tasks.value) {
    tasks.value = []
  }
}

function addTaskFromRealtime (task: RealtimeArchivedTask) {
  if (!props.modelValue) {
    return
  }
  ensureTasks()
  if (tasks.value!.some(t => t.id === task.id)) {
    return
  }
  tasks.value!.push({
    id: task.id,
    title: task.title,
    status: task.status,
    list_id: task.list_id,
    archived_at: task.archived_at ?? null,
    labels: task.labels ?? [],
    assignees: task.assignees ?? [],
  })
}

function removeTaskFromRealtime (taskId: number) {
  if (!tasks.value) {
    return
  }
  tasks.value = tasks.value.filter(t => t.id !== taskId)
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      void load()
    }
  },
)

defineExpose({
  addTaskFromRealtime,
  removeTaskFromRealtime,
})
</script>

<style lang="scss" scoped>
.archived-tasks-modal__body {
  padding: 1rem;
  max-height: min(70vh, 36rem);
  overflow-y: auto;
}

.archived-tasks-modal__subtitle {
  margin: 0 0 0.85rem;
  color: mixin.$text-sub;
  font-size: 0.88rem;
  line-height: 1.5;
}

.archived-tasks-modal__err {
  margin: 0 0 0.75rem;
  color: mixin.$danger;
  font-weight: 700;
  font-size: 0.88rem;
}

.archived-tasks-modal__state,
.archived-tasks-modal__empty {
  color: mixin.$text-muted;
  font-size: 0.9rem;
}

.archived-tasks-modal__empty p {
  margin: 0;
}

.archived-tasks-modal__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.archived-tasks-modal__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
}

.archived-tasks-modal__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.35rem;
  padding-left: 0.15rem;
}

.archived-tasks-modal__action {
  border: none;
  padding: 0;
  background: transparent;
  color: #5e6c84;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: mixin.$text;
    text-decoration: underline;
    text-underline-offset: 0.12em;
  }

  &:disabled {
    opacity: 0.55;
    cursor: default;
  }

  &--danger:hover:not(:disabled) {
    color: mixin.$danger;
  }
}

.archived-tasks-modal__action-sep {
  color: #94a3b8;
  font-size: 0.72rem;
  line-height: 1;
  user-select: none;
}
</style>
