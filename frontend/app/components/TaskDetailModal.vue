<template>
  <Teleport to="body">
    <Transition name="tm-fade">
      <div
        v-if="modelValue"
        class="modal-overlay"
        role="presentation"
        @click.self="close"
      >
        <section
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-label="タスク詳細"
        >
          <header class="modal-header">
            <h3>タスク詳細</h3>
            <button
              type="button"
              class="icon-close"
              :disabled="saving"
              @click="close"
            >✕</button>
          </header>

          <div v-if="loading" class="modal-body modal-body--state">
            <p class="state-message">読み込み中...</p>
          </div>
          <div v-else-if="loadError" class="modal-body modal-body--state">
            <p class="err">{{ loadError }}</p>
            <div class="actions">
              <button type="button" class="ghost-btn" @click="close">閉じる</button>
              <button type="button" class="primary-btn" @click="reload">再試行</button>
            </div>
          </div>
          <div v-else class="modal-body">
            <section class="field-block">
              <span class="field-label">カード名</span>
              <template v-if="editingTitle">
                <form class="inline-edit" @submit.prevent="saveTitle">
                  <input
                    ref="titleInputRef"
                    v-model.trim="titleDraft"
                    type="text"
                    maxlength="500"
                    class="title-input"
                    :disabled="saving"
                    @keydown.escape.prevent="cancelTitleEdit"
                  />
                  <div class="edit-actions">
                    <button
                      type="submit"
                      class="primary-btn small"
                      :disabled="saving || !titleDraft"
                    >
                      {{ saving ? '保存中...' : '保存' }}
                    </button>
                    <button
                      type="button"
                      class="ghost-btn small"
                      :disabled="saving"
                      @click="cancelTitleEdit"
                    >
                      キャンセル
                    </button>
                  </div>
                </form>
              </template>
              <template v-else>
                <button
                  type="button"
                  class="title-display"
                  :disabled="saving"
                  @click="startTitleEdit"
                >
                  {{ task?.title || '（タイトル未設定）' }}
                </button>
              </template>
            </section>

            <section class="field-block">
              <div class="field-label-row">
                <span class="field-label">ラベル</span>
                <button
                  type="button"
                  class="ghost-btn small"
                  :disabled="saving"
                  @click="toggleLabelPicker"
                >
                  {{ showLabelPicker ? '閉じる' : 'ラベル' }}
                </button>
              </div>

              <div v-if="(task?.labels ?? []).length" class="task-label-list">
                <span
                  v-for="label in task?.labels"
                  :key="label.id"
                  class="task-label-chip"
                >
                  <span class="task-label-dot" :style="{ backgroundColor: label.color }" />
                  {{ label.name }}
                </span>
              </div>
              <p v-else class="empty-text">ラベルは未設定です。</p>

              <div v-if="showLabelPicker" class="label-picker-block">
                <div class="task-label-picker">
                  <label
                    v-for="label in orgLabels"
                    :key="label.id"
                    class="label-option"
                  >
                    <input
                      v-model="labelDrafts"
                      type="checkbox"
                      :value="label.id"
                      :disabled="saving"
                    />
                    <span class="task-label-dot" :style="{ backgroundColor: label.color }" />
                    <span>{{ label.name }}</span>
                  </label>
                  <p v-if="!orgLabels.length" class="empty-text">ラベルは設定画面で作成できます。</p>
                </div>
                <div class="edit-actions">
                  <button
                    type="button"
                    class="primary-btn small"
                    :disabled="saving"
                    @click="saveLabels"
                  >
                    {{ saving ? '保存中...' : '保存' }}
                  </button>
                  <button
                    type="button"
                    class="ghost-btn small"
                    :disabled="saving"
                    @click="cancelLabelEdit"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </section>

            <section class="field-block">
              <div class="field-label-row">
                <span class="field-label">カード説明</span>
                <button
                  v-if="!editingDescription"
                  type="button"
                  class="ghost-btn small"
                  :disabled="saving"
                  @click="startDescriptionEdit"
                >
                  編集
                </button>
              </div>
              <template v-if="editingDescription">
                <textarea
                  ref="descriptionTextareaRef"
                  v-model="descriptionDraft"
                  rows="6"
                  maxlength="10000"
                  class="description-textarea"
                  placeholder="カードの説明を入力"
                  :disabled="saving"
                />
                <div class="edit-actions">
                  <button
                    type="button"
                    class="primary-btn small"
                    :disabled="saving"
                    @click="saveDescription"
                  >
                    {{ saving ? '保存中...' : '保存' }}
                  </button>
                  <button
                    type="button"
                    class="ghost-btn small"
                    :disabled="saving"
                    @click="cancelDescriptionEdit"
                  >
                    キャンセル
                  </button>
                </div>
              </template>
              <template v-else>
                <p v-if="task?.description" class="description-display">{{ task.description }}</p>
                <p v-else class="empty-text">説明はまだありません。</p>
              </template>
            </section>

            <p v-if="saveError" class="err">{{ saveError }}</p>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useApi } from '../composables/useApi'

export type TaskDetailLabel = { id: number; name: string; color: string }
export type TaskDetail = {
  id: number
  title: string
  description: string | null
  status: string
  list_id: number | null
  labels: TaskDetailLabel[]
}

const props = defineProps<{
  modelValue: boolean
  orgSlug: string
  projectId: string
  taskId: number | null
  orgLabels: TaskDetailLabel[]
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  updated: [TaskDetail]
}>()

const { api } = useApi()

const task = ref<TaskDetail | null>(null)
const loading = ref(false)
const saving = ref(false)
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)

const editingTitle = ref(false)
const titleDraft = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

const editingDescription = ref(false)
const descriptionDraft = ref('')
const descriptionTextareaRef = ref<HTMLTextAreaElement | null>(null)

const showLabelPicker = ref(false)
const labelDrafts = ref<number[]>([])

function resetState () {
  task.value = null
  loading.value = false
  saving.value = false
  loadError.value = null
  saveError.value = null
  editingTitle.value = false
  titleDraft.value = ''
  editingDescription.value = false
  descriptionDraft.value = ''
  showLabelPicker.value = false
  labelDrafts.value = []
}

async function loadTask () {
  if (props.taskId === null) return
  loading.value = true
  loadError.value = null
  try {
    const detail = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${props.taskId}`,
    )
    task.value = {
      ...detail,
      labels: detail.labels ?? [],
    }
  } catch (e: unknown) {
    loadError.value = e instanceof Error ? e.message : '読み込みに失敗しました'
  } finally {
    loading.value = false
  }
}

async function reload () {
  await loadTask()
}

watch(
  () => [props.modelValue, props.taskId] as const,
  async ([open, id]) => {
    if (open && id !== null) {
      resetState()
      await loadTask()
    } else if (!open) {
      resetState()
    }
  },
  { immediate: true },
)

function close () {
  if (saving.value) return
  emit('update:modelValue', false)
}

function startTitleEdit () {
  if (!task.value) return
  titleDraft.value = task.value.title
  editingTitle.value = true
  saveError.value = null
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

function cancelTitleEdit () {
  editingTitle.value = false
  titleDraft.value = ''
}

async function saveTitle () {
  if (!task.value) return
  const title = titleDraft.value.trim()
  if (!title) return
  if (title === task.value.title) {
    editingTitle.value = false
    return
  }
  saving.value = true
  saveError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { title } },
    )
    task.value = { ...updated, labels: updated.labels ?? [] }
    editingTitle.value = false
    emit('updated', task.value)
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'カード名の更新に失敗しました'
  } finally {
    saving.value = false
  }
}

function toggleLabelPicker () {
  if (showLabelPicker.value) {
    cancelLabelEdit()
    return
  }
  if (!task.value) return
  labelDrafts.value = task.value.labels.map(label => label.id)
  showLabelPicker.value = true
  saveError.value = null
}

function cancelLabelEdit () {
  showLabelPicker.value = false
  labelDrafts.value = []
}

async function saveLabels () {
  if (!task.value) return
  const ids = [...labelDrafts.value].map(Number)
  saving.value = true
  saveError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { label_ids: ids } },
    )
    task.value = { ...updated, labels: updated.labels ?? [] }
    showLabelPicker.value = false
    labelDrafts.value = []
    emit('updated', task.value)
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'ラベルの更新に失敗しました'
  } finally {
    saving.value = false
  }
}

function startDescriptionEdit () {
  if (!task.value) return
  descriptionDraft.value = task.value.description ?? ''
  editingDescription.value = true
  saveError.value = null
  nextTick(() => {
    descriptionTextareaRef.value?.focus()
  })
}

function cancelDescriptionEdit () {
  editingDescription.value = false
  descriptionDraft.value = ''
}

async function saveDescription () {
  if (!task.value) return
  const description = descriptionDraft.value
  const normalized = description.trim() === '' ? null : description
  if ((normalized ?? '') === (task.value.description ?? '')) {
    editingDescription.value = false
    return
  }
  saving.value = true
  saveError.value = null
  try {
    const updated = await api<TaskDetail>(
      `/orgs/${props.orgSlug}/projects/${props.projectId}/tasks/${task.value.id}`,
      { method: 'PATCH', body: { description: normalized } },
    )
    task.value = { ...updated, labels: updated.labels ?? [] }
    editingDescription.value = false
    descriptionDraft.value = ''
    emit('updated', task.value)
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : '説明の更新に失敗しました'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 3rem 1rem 1rem;
  z-index: 70;
  overflow-y: auto;
}

.modal-card {
  width: min(40rem, 100%);
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
}

.modal-header {
  background: #0b2bab;
  color: #fff;
  padding: 0.7rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.05rem;
}

.icon-close {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  margin: -0.2rem 0;
}

.modal-body {
  padding: 1rem 1.1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-body--state {
  align-items: center;
  justify-content: center;
  min-height: 8rem;
}

.state-message {
  margin: 0;
  color: #475569;
  font-weight: 600;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.field-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: #475569;
}

.title-display {
  text-align: left;
  font-size: 1.18rem;
  font-weight: 800;
  color: #0f172a;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
  background: transparent;
  cursor: pointer;
  width: 100%;
}

.title-display:hover,
.title-display:focus-visible {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.inline-edit {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.title-input {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
  font-size: 1.02rem;
  font-weight: 700;
  background: #fff;
  width: 100%;
  box-sizing: border-box;
}

.edit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.task-label-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.task-label-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: 999px;
  padding: 0.18rem 0.5rem;
  font-size: 0.78rem;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.task-label-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
}

.empty-text {
  margin: 0;
  font-size: 0.84rem;
  color: #94a3b8;
}

.label-picker-block {
  margin-top: 0.35rem;
  padding: 0.7rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.task-label-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.label-option {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid #dbe3ee;
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: #334155;
  background: #fff;
  cursor: pointer;
}

.description-display {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.92rem;
  color: #1e293b;
  padding: 0.55rem 0.65rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.description-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.6rem 0.7rem;
  font: inherit;
  font-size: 0.94rem;
  color: #0f172a;
  resize: vertical;
  min-height: 6rem;
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

.primary-btn.small,
.ghost-btn.small {
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 700;
}

.primary-btn {
  background: #45c3cf;
  color: #fff;
}

.ghost-btn {
  border-color: #cbd5e1;
  color: #475569;
  background: #f1f5f9;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.8rem;
}

.err {
  margin: 0;
  color: #b91c1c;
  font-weight: 700;
  font-size: 0.86rem;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
