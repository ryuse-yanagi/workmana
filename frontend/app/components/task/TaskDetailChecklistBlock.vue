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
<style lang="scss" scoped src="~/assets/styles/components/task/TaskDetailChecklistBlock.scss"></style>
