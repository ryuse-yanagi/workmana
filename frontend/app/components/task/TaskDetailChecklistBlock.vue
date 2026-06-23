<template>
  <section class="task-checklist">
    <header class="task-checklist__header">
      <div class="task-checklist__title-row">
        <span class="task-checklist__icon" aria-hidden="true">
          <SquareCheck :size="20" :stroke-width="2.25" />
        </span>
        <h3 class="task-checklist__title">{{ checklist.title }}</h3>
      </div>
      <button
        type="button"
        class="task-checklist__delete-btn"
        @click="emit('delete')"
      >
        削除
      </button>
    </header>

    <div class="task-checklist__progress">
      <span class="task-checklist__progress-label">{{ progressPercent }}%</span>
      <div
        class="task-checklist__progress-track"
        role="progressbar"
        :aria-valuenow="progressPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`チェックリスト進捗 ${progressPercent}%`"
      >
        <span
          class="task-checklist__progress-fill"
          :class="{ 'task-checklist__progress-fill--complete': progressPercent === 100 }"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
    </div>

    <ul v-if="checklist.items.length" class="task-checklist__items">
      <li
        v-for="item in checklist.items"
        :key="item.id"
        class="task-checklist__item"
      >
        <div
          v-if="editingItemId === item.id"
          :ref="setEditComposerRef"
          class="task-checklist__item-edit"
        >
          <input
            :ref="setEditItemInputRef"
            v-model="editItemDraft"
            type="text"
            class="task-checklist__composer-input"
            aria-label="チェックリスト項目を編集"
            @keydown.enter.prevent="submitEditItem"
            @keydown.escape.prevent="cancelEditItem"
          />
          <div class="task-checklist__composer-actions">
            <button
              type="button"
              class="task-checklist__add-btn"
              :disabled="!editItemDraft.trim()"
              @click="submitEditItem"
            >
              保存
            </button>
            <button
              type="button"
              class="task-checklist__cancel-btn"
              @click="cancelEditItem"
            >
              キャンセル
            </button>
          </div>
        </div>
        <div
          v-else
          class="task-checklist__item-row"
        >
          <label class="task-checklist__item-checkbox-label">
            <input
              type="checkbox"
              class="task-checklist__item-checkbox"
              :checked="item.checked"
              @change="toggleItem(item.id)"
            />
          </label>
          <button
            type="button"
            class="task-checklist__item-text-btn"
            :class="{ 'task-checklist__item-text-btn--checked': item.checked }"
            @click="openEditItem(item)"
          >
            {{ item.text }}
          </button>
        </div>
      </li>
    </ul>

    <div
      v-if="showAddForm"
      ref="addComposerRef"
      class="task-checklist__composer"
    >
      <input
        ref="addItemInputRef"
        v-model="addItemDraft"
        type="text"
        class="task-checklist__composer-input"
        placeholder="項目を追加"
        aria-label="チェックリスト項目"
        @keydown.enter.prevent="submitAddItem"
        @keydown.escape.prevent="cancelAddItem"
      />
      <div class="task-checklist__composer-actions">
        <button
          type="button"
          class="task-checklist__add-btn"
          :disabled="!addItemDraft.trim()"
          @click="submitAddItem"
        >
          追加
        </button>
        <button
          type="button"
          class="task-checklist__cancel-btn"
          @click="cancelAddItem"
        >
          キャンセル
        </button>
      </div>
    </div>

    <button
      v-else
      type="button"
      class="task-checklist__open-composer-btn"
      @click="openAddForm"
    >
      項目を追加
    </button>
  </section>
</template>

<script setup lang="ts">
import { SquareCheck } from 'lucide-vue-next'

export type TaskChecklistItem = {
  id: string
  text: string
  checked: boolean
}

export type TaskChecklist = {
  title: string
  items: TaskChecklistItem[]
}

const props = defineProps<{
  checklist: TaskChecklist
  showAddForm?: boolean
}>()

const emit = defineEmits<{
  delete: []
  update: [TaskChecklist]
  'update:showAddForm': [boolean]
}>()

const addItemDraft = ref('')
const addItemInputRef = ref<HTMLInputElement | null>(null)
const addComposerRef = ref<HTMLElement | null>(null)
const editingItemId = ref<string | null>(null)
const editItemDraft = ref('')
const editItemInputRef = ref<HTMLInputElement | null>(null)
const editComposerRef = ref<HTMLElement | null>(null)

function setEditItemInputRef (el: unknown) {
  editItemInputRef.value = el instanceof HTMLInputElement ? el : null
}

function setEditComposerRef (el: unknown) {
  editComposerRef.value = el instanceof HTMLElement ? el : null
}

const composerOpen = computed(() => Boolean(props.showAddForm || editingItemId.value))

function isComposerTarget (target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false
  return [addComposerRef.value, editComposerRef.value].some(
    root => root?.contains(target),
  )
}

function dismissOpenComposer () {
  if (editingItemId.value !== null) {
    cancelEditItem()
  }
  if (props.showAddForm) {
    cancelAddItem()
  }
}

let pendingOutsideDismiss = false

function onDocumentPointerDown (event: PointerEvent) {
  if (!composerOpen.value || event.button !== 0) return
  pendingOutsideDismiss = !isComposerTarget(event.target)
}

function onDocumentPointerUp (event: PointerEvent) {
  if (!composerOpen.value || event.button !== 0) return
  if (!pendingOutsideDismiss) return
  pendingOutsideDismiss = false
  if (isComposerTarget(event.target)) return
  dismissOpenComposer()
}

function attachComposerDismissListeners () {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('pointerup', onDocumentPointerUp, true)
}

function detachComposerDismissListeners () {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('pointerup', onDocumentPointerUp, true)
}

watch(composerOpen, (open) => {
  pendingOutsideDismiss = false
  detachComposerDismissListeners()
  if (open) {
    nextTick(() => {
      attachComposerDismissListeners()
    })
  }
})

onBeforeUnmount(() => {
  detachComposerDismissListeners()
})

const progressPercent = computed(() => {
  const total = props.checklist.items.length
  if (total === 0) return 0
  const completed = props.checklist.items.filter(item => item.checked).length
  return Math.round((completed / total) * 100)
})

function createItemId (): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `checklist-item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function toggleItem (itemId: string) {
  emit('update', {
    ...props.checklist,
    items: props.checklist.items.map(item => (
      item.id === itemId ? { ...item, checked: !item.checked } : item
    )),
  })
}

function cancelEditItem () {
  editingItemId.value = null
  editItemDraft.value = ''
}

function openEditItem (item: TaskChecklistItem) {
  cancelAddItem()
  editingItemId.value = item.id
  editItemDraft.value = item.text
  nextTick(() => editItemInputRef.value?.focus())
}

function submitEditItem () {
  const itemId = editingItemId.value
  if (!itemId) return
  const text = editItemDraft.value.trim()
  if (!text) return
  const current = props.checklist.items.find(item => item.id === itemId)
  if (!current || current.text === text) {
    cancelEditItem()
    return
  }
  emit('update', {
    ...props.checklist,
    items: props.checklist.items.map(item => (
      item.id === itemId ? { ...item, text } : item
    )),
  })
  cancelEditItem()
}

function openAddForm () {
  cancelEditItem()
  emit('update:showAddForm', true)
  nextTick(() => addItemInputRef.value?.focus())
}

function submitAddItem () {
  const text = addItemDraft.value.trim()
  if (!text) return
  cancelEditItem()
  emit('update', {
    ...props.checklist,
    items: [
      ...props.checklist.items,
      { id: createItemId(), text, checked: false },
    ],
  })
  addItemDraft.value = ''
  emit('update:showAddForm', true)
  nextTick(() => addItemInputRef.value?.focus())
}

function cancelAddItem () {
  addItemDraft.value = ''
  emit('update:showAddForm', false)
}

watch(
  () => props.showAddForm,
  (open) => {
    if (!open) {
      addItemDraft.value = ''
      return
    }
    cancelEditItem()
    nextTick(() => addItemInputRef.value?.focus())
  },
)

watch(
  () => props.checklist.items,
  (items) => {
    if (editingItemId.value && !items.some(item => item.id === editingItemId.value)) {
      cancelEditItem()
    }
  },
)
</script>

<style scoped lang="scss">
.task-checklist {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.85rem 0;
}

.task-checklist__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.task-checklist__title-row {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.task-checklist__icon {
  display: inline-flex;
  color: #334155;
}

.task-checklist__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.3;
}

.task-checklist__delete-btn {
  flex-shrink: 0;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 0.3rem 0.75rem;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  color: #334155;
  background: #fff;
  cursor: pointer;
}

.task-checklist__delete-btn:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.task-checklist__progress {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.65rem;
}

.task-checklist__progress-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: #64748b;
  min-width: 2rem;
}

.task-checklist__progress-track {
  height: 0.35rem;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
}

.task-checklist__progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #94a3b8;
  transition: width 0.15s ease, background 0.15s ease;
}

.task-checklist__progress-fill--complete {
  background: mixin.$main;
}

.task-checklist__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.task-checklist__item-row {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  width: 100%;
}

.task-checklist__item-checkbox-label {
  display: inline-flex;
  flex-shrink: 0;
  margin-top: 0.15rem;
  cursor: pointer;
}

.task-checklist__item-edit,
.task-checklist__composer {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding-left: 1.55rem;
}

.task-checklist__item-checkbox {
  width: 1rem;
  height: 1rem;
  margin: 0;
  accent-color: mixin.$main;
}

.task-checklist__item-text-btn {
  flex: 1;
  min-width: 0;
  align-self: stretch;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  font: inherit;
  font-size: 0.88rem;
  line-height: 1.45;
  color: #1e293b;
  text-align: left;
  word-break: break-word;
  cursor: pointer;
}

.task-checklist__item-text-btn:hover {
  color: mixin.$main-hover;
}

.task-checklist__item-text-btn--checked {
  color: #94a3b8;
  text-decoration: line-through;
}

.task-checklist__item-text-btn--checked:hover {
  color: #64748b;
}


.task-checklist__composer-input {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.55rem 0.65rem;
  font: inherit;
  font-size: 0.88rem;
  line-height: 1.45;
  color: #0f172a;
}

.task-checklist__composer-input:focus,
.task-checklist__composer-input:focus-visible {
  outline: none;
  border-color: mixin.$main;
  box-shadow: 0 0 0 3px color-mix(in srgb, mixin.$main 18%, transparent);
}

.task-checklist__composer-actions {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.task-checklist__add-btn {
  border: none;
  border-radius: 8px;
  padding: 0.42rem 0.95rem;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;
  color: #fff;
  background: mixin.$main;
  cursor: pointer;
}

.task-checklist__add-btn:hover:not(:disabled) {
  background: mixin.$main-hover;
}

.task-checklist__add-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.task-checklist__cancel-btn {
  border: none;
  background: transparent;
  padding: 0.42rem 0.55rem;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
}

.task-checklist__cancel-btn:hover {
  color: #334155;
}

.task-checklist__open-composer-btn {
  align-self: flex-start;
  border: none;
  background: transparent;
  padding: 0;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  color: mixin.$main-hover;
  cursor: pointer;
}

.task-checklist__open-composer-btn:hover {
  text-decoration: underline;
}
</style>
