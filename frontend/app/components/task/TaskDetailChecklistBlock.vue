<template>
  <section
    ref="rootRef"
    class="task-checklist"
    :class="{ 'task-checklist--collapsed': collapsed }"
  >
    <header class="task-checklist__header">
      <div class="task-checklist__title-row">
        <button
          type="button"
          class="task-checklist__icon-toggle"
          :class="{ 'task-checklist__icon-toggle--collapsed': collapsed }"
          :aria-expanded="!collapsed"
          :aria-label="collapsed ? 'チェックリストを展開' : 'チェックリストを折りたたむ'"
          @click="toggleCollapsed"
        >
          <span class="task-checklist__icon task-checklist__icon--default" aria-hidden="true">
            <SquareCheck :size="20" :stroke-width="2.25" />
          </span>
          <span class="task-checklist__icon task-checklist__icon--hover" aria-hidden="true">
            <ChevronDown :size="20" :stroke-width="2.25" />
          </span>
          <span class="task-checklist__icon task-checklist__icon--collapsed" aria-hidden="true">
            <ChevronRight :size="20" :stroke-width="2.25" />
          </span>
        </button>
        <input
          v-if="editingTitle"
          ref="titleInputRef"
          v-model="titleDraft"
          type="text"
          class="task-checklist__title-input"
          :maxlength="CHECKLIST_TITLE_MAX_LENGTH"
          aria-label="チェックリスト名を編集"
          @keydown.enter.prevent="submitEditTitle"
          @keydown.escape.prevent="cancelEditTitle"
          @blur="submitEditTitle"
        />
        <button
          v-else
          type="button"
          class="task-checklist__title"
          @click="openEditTitle"
        >
          {{ checklist.title }}
        </button>
      </div>
      <div
        class="task-checklist__menu-wrap"
        :class="{ 'task-checklist__menu-wrap--open': menuOpen }"
        @click.stop
        @pointerdown.stop
      >
        <button
          type="button"
          class="task-checklist__menu"
          data-popover-trigger
          :aria-expanded="menuOpen"
          aria-haspopup="menu"
          aria-label="チェックリストのメニュー"
          @click="toggleMenu"
        >
          <Ellipsis :size="16" :stroke-width="2.25" aria-hidden="true" />
        </button>
      </div>
    </header>
    <FloatingMenu
      :open="menuOpen && menuPosition !== null"
      density="compact"
      :style="menuStyle"
      :items="menuItems"
      @select="onMenuSelect"
      @close="closeMenu"
    />
    <div class="task-checklist__progress">
      <span class="task-checklist__progress-percent">{{ progressPercent }}%</span>
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
      <span
        v-if="checklist.items.length"
        class="task-checklist__progress-count"
      >{{ completedCount }}/{{ checklist.items.length }}</span>
    </div>
    <div v-show="!collapsed" class="task-checklist__body">
    <ul class="task-checklist__items">
      <li
        v-for="item in checklist.items"
        :key="item.id"
        class="task-checklist__item"
        :class="{ 'task-checklist__item--editing': editingItemId === item.id }"
      >
        <div class="task-checklist__item-row">
          <label class="task-checklist__item-checkbox-label">
            <input
              type="checkbox"
              class="task-checklist__item-checkbox"
              :checked="item.checked"
              @change="toggleItem(item.id)"
            />
          </label>
          <textarea
            :ref="(el) => bindItemTextRef(item.id, el)"
            class="task-checklist__item-text"
            :class="{
              'task-checklist__item-text--editing': editingItemId === item.id,
              'task-checklist__item-text--checked': item.checked && editingItemId !== item.id,
            }"
            rows="1"
            :value="editingItemId === item.id ? editItemDraft : item.text"
            :readonly="editingItemId !== item.id"
            :maxlength="CHECKLIST_ITEM_TEXT_MAX_LENGTH"
            :aria-label="editingItemId === item.id ? 'チェックリスト項目を編集' : 'チェックリスト項目'"
            @pointerdown="onItemTextPointerDown($event, item)"
            @focus="onItemTextFocus(item)"
            @input="onItemTextInput($event, item)"
            @keydown.enter.exact.prevent="onItemTextEnter(item)"
            @keydown.escape.prevent="onItemTextEscape(item)"
            @blur="onItemTextBlur(item)"
          />
          <div
            class="task-checklist__item-menu-wrap"
            :class="{ 'task-checklist__item-menu-wrap--open': openItemMenuId === item.id }"
            @click.stop
            @pointerdown.stop
          >
            <button
              type="button"
              class="task-checklist__item-menu"
              data-popover-trigger
              :aria-expanded="openItemMenuId === item.id"
              aria-haspopup="menu"
              aria-label="項目のメニュー"
              @click="toggleItemMenu(item.id, $event)"
            >
              <Ellipsis :size="16" :stroke-width="2.25" aria-hidden="true" />
            </button>
          </div>
        </div>
      </li>
      <li
        class="task-checklist__item task-checklist__item--composer"
        :class="{ 'task-checklist__item--composer-open': showAddForm }"
      >
        <div class="task-checklist__item-row">
          <label class="task-checklist__item-checkbox-label">
            <input
              type="checkbox"
              class="task-checklist__item-checkbox"
              disabled
              tabindex="-1"
              aria-hidden="true"
            />
          </label>
          <textarea
            v-if="showAddForm"
            ref="addItemInputRef"
            v-model="addItemDraft"
            class="task-checklist__item-text task-checklist__item-text--editing"
            rows="1"
            :maxlength="CHECKLIST_ITEM_TEXT_MAX_LENGTH"
            placeholder="項目名を入力..."
            aria-label="チェックリスト項目"
            @input="adjustAddItemInputHeight"
            @keydown.enter.exact.prevent="submitAddItemAndContinue"
            @keydown.escape.prevent="cancelAddItem"
            @blur="onAddItemBlur"
          />
          <button
            v-else
            type="button"
            class="task-checklist__open-composer-btn"
            @click="openAddForm"
          >
            追加
          </button>
          <span
            class="task-checklist__item-menu-spacer"
            aria-hidden="true"
          />
        </div>
      </li>
    </ul>
    </div>
    <FloatingMenu
      :open="openItemMenuId !== null && itemMenuPosition !== null"
      density="compact"
      :style="itemMenuStyle"
      :items="itemMenuItems"
      @select="onItemMenuSelect"
      @close="closeItemMenu"
    />
  </section>
</template>
<script setup lang="ts">
import { ChevronDown, ChevronRight, Ellipsis, SquareCheck } from 'lucide-vue-next'
import {
  CHECKLIST_ITEM_TEXT_MAX_LENGTH,
  CHECKLIST_TITLE_MAX_LENGTH,
} from '../../constants/fieldLengthLimits'
import FloatingMenu, { type FloatingMenuItem } from '../ui/FloatingMenu.vue'
import { useTaskDetailSectionCollapse } from '../../composables/task/useTaskDetailSectionCollapse'
import { adjustTextareaHeight } from '../../utils/task/textareaAutoGrow'
import {
  POPOVER_VIEWPORT_INSET,
  clampPopoverBox,
  resolveMeasuredFloatingMenuHeight,
} from '../../utils/ui/popoverScrollbar'
export type TaskChecklistItem = {
  id: string
  text: string
  checked: boolean
}
export type TaskChecklist = {
  id: number
  title: string
  items: TaskChecklistItem[]
}
const props = defineProps<{
  checklist: TaskChecklist
  taskId?: number | null
  showAddForm?: boolean
}>()
const emit = defineEmits<{
  delete: []
  update: [TaskChecklist]
  'update:showAddForm': [boolean]
}>()
const CHECKLIST_MENU_MIN_WIDTH = 168
const ITEM_MENU_MIN_WIDTH = 140
const rootRef = ref<HTMLElement | null>(null)
const checklistCollapseTarget = computed(() => (
  props.taskId == null
    ? null
    : {
        type: 'checklist' as const,
        taskId: props.taskId,
        checklistId: props.checklist.id,
      }
))
const {
  collapsed,
  toggleCollapsed,
} = useTaskDetailSectionCollapse(checklistCollapseTarget)
watch(collapsed, (isCollapsed) => {
  if (!isCollapsed) return
  closeMenu()
  closeItemMenu()
  dismissOpenComposer()
})
const menuOpen = ref(false)
const menuPosition = ref<{ top: number; left: number } | null>(null)
const menuItems: FloatingMenuItem[] = [
  { key: 'edit', label: 'チェックリストの編集' },
  { key: 'delete', label: 'チェックリストの削除', danger: true },
]
const openItemMenuId = ref<string | null>(null)
const itemMenuPosition = ref<{ top: number; left: number } | null>(null)
const itemMenuItems: FloatingMenuItem[] = [
  { key: 'edit', label: '項目の編集' },
  { key: 'delete', label: '項目の削除', danger: true },
]
const menuStyle = computed(() => {
  if (!menuPosition.value) {
    return {}
  }
  const { top, left } = menuPosition.value
  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${CHECKLIST_MENU_MIN_WIDTH}px`,
    zIndex: 1100,
  }
})
const itemMenuStyle = computed(() => {
  if (!itemMenuPosition.value) {
    return {}
  }
  const { top, left } = itemMenuPosition.value
  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    minWidth: `${ITEM_MENU_MIN_WIDTH}px`,
    zIndex: 1100,
  }
})
function closeMenu () {
  menuOpen.value = false
  menuPosition.value = null
}
function closeItemMenu () {
  openItemMenuId.value = null
  itemMenuPosition.value = null
}
function positionMenu (anchor: HTMLElement) {
  if (!import.meta.client) {
    menuPosition.value = { top: 0, left: 0 }
    return
  }
  const rect = anchor.getBoundingClientRect()
  const margin = 6
  const pad = POPOVER_VIEWPORT_INSET
  const menuWidth = CHECKLIST_MENU_MIN_WIDTH
  const menuHeight = resolveMeasuredFloatingMenuHeight(menuItems.length)
  let left = rect.right + margin
  const maxLeft = window.innerWidth - menuWidth - pad
  if (left > maxLeft) {
    left = Math.max(pad, rect.left - menuWidth - margin)
  }
  menuPosition.value = clampPopoverBox(rect.top, left, menuWidth, menuHeight, pad)
}
function positionItemMenu (anchor: HTMLElement) {
  if (!import.meta.client) {
    itemMenuPosition.value = { top: 0, left: 0 }
    return
  }
  const rect = anchor.getBoundingClientRect()
  const margin = 6
  const pad = POPOVER_VIEWPORT_INSET
  const menuWidth = ITEM_MENU_MIN_WIDTH
  const menuHeight = resolveMeasuredFloatingMenuHeight(itemMenuItems.length)
  let left = rect.right + margin
  const maxLeft = window.innerWidth - menuWidth - pad
  if (left > maxLeft) {
    left = Math.max(pad, rect.left - menuWidth - margin)
  }
  itemMenuPosition.value = clampPopoverBox(rect.top, left, menuWidth, menuHeight, pad)
}
function openMenu (anchor: HTMLElement) {
  closeItemMenu()
  if (menuOpen.value) {
    closeMenu()
    return
  }
  positionMenu(anchor)
  menuOpen.value = true
  nextTick(() => {
    if (menuOpen.value) {
      positionMenu(anchor)
    }
  })
}
function openItemMenu (itemId: string, anchor: HTMLElement) {
  closeMenu()
  if (openItemMenuId.value === itemId) {
    closeItemMenu()
    return
  }
  positionItemMenu(anchor)
  openItemMenuId.value = itemId
  nextTick(() => {
    if (openItemMenuId.value === itemId) {
      positionItemMenu(anchor)
    }
  })
}
function toggleMenu (event: MouseEvent) {
  event.stopPropagation()
  const el = event.currentTarget
  if (!(el instanceof HTMLElement)) return
  openMenu(el)
}
function toggleItemMenu (itemId: string, event: MouseEvent) {
  event.stopPropagation()
  const el = event.currentTarget
  if (!(el instanceof HTMLElement)) return
  openItemMenu(itemId, el)
}
function onMenuSelect (item: FloatingMenuItem) {
  closeMenu()
  if (item.key === 'edit') {
    openEditTitle()
    return
  }
  if (item.key === 'delete') {
    emit('delete')
  }
}
function onItemMenuSelect (item: FloatingMenuItem) {
  const itemId = openItemMenuId.value
  closeItemMenu()
  if (!itemId) return
  if (item.key === 'edit') {
    const target = props.checklist.items.find(row => row.id === itemId)
    if (target) {
      openEditItem(target)
    }
    return
  }
  if (item.key === 'delete') {
    removeItem(itemId)
  }
}
let removeMenuResizeListener: (() => void) | null = null
function onMenuEscape (event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  if (openItemMenuId.value !== null) {
    event.stopPropagation()
    closeItemMenu()
    return
  }
  if (!menuOpen.value) return
  event.stopPropagation()
  closeMenu()
}
watch(
  () => menuOpen.value || openItemMenuId.value !== null,
  (open) => {
    removeMenuResizeListener?.()
    removeMenuResizeListener = null
    document.removeEventListener('keydown', onMenuEscape)
    if (!open) return
    document.addEventListener('keydown', onMenuEscape)
    const onResize = () => {
      closeMenu()
      closeItemMenu()
    }
    window.addEventListener('resize', onResize)
    removeMenuResizeListener = () => window.removeEventListener('resize', onResize)
  },
)
const editingTitle = ref(false)
const titleDraft = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)
const addItemDraft = ref('')
const addItemInputRef = ref<HTMLTextAreaElement | null>(null)
const editingItemId = ref<string | null>(null)
const editItemDraft = ref('')
const itemTextRefs = new Map<string, HTMLTextAreaElement>()
function bindItemTextRef (itemId: string, el: unknown) {
  if (el instanceof HTMLTextAreaElement) {
    itemTextRefs.set(itemId, el)
    nextTick(() => adjustTextareaHeight(el))
    return
  }
  itemTextRefs.delete(itemId)
}
function adjustItemTextHeight (itemId: string) {
  adjustTextareaHeight(itemTextRefs.get(itemId))
}
function adjustAllItemTextHeights () {
  for (const el of itemTextRefs.values()) {
    adjustTextareaHeight(el)
  }
}
function adjustAddItemInputHeight () {
  adjustTextareaHeight(addItemInputRef.value)
}
function getDetailScroller (from: Element | null | undefined): HTMLElement | null {
  return from?.closest('.modal-pane--detail__scroller') ?? null
}
/** focus / select / 高さ調整でモーダルが勝手にスクロールしないようにする */
function preserveDetailScroll (from: Element | null | undefined, run: () => void) {
  const scroller = getDetailScroller(from)
  const top = scroller?.scrollTop
  run()
  if (!scroller || top == null) return
  scroller.scrollTop = top
  requestAnimationFrame(() => {
    scroller.scrollTop = top
  })
}
function focusItemText (el: HTMLTextAreaElement | null | undefined, selectAll = false) {
  if (!el) return
  preserveDetailScroll(el, () => {
    adjustTextareaHeight(el)
    el.focus({ preventScroll: true })
    if (selectAll) {
      el.select()
    }
  })
}
function onItemTextPointerDown (event: PointerEvent, item: TaskChecklistItem) {
  if (event.button !== 0) return
  if (editingItemId.value === item.id) return
  // クリック由来の focus によるスクロールを防ぎ、こちらで preventScroll 付き focus する
  event.preventDefault()
  // キャプチャ段階の外側判定より後でも、他項目への切替を dismiss しない
  pendingOutsideDismiss = false
  openEditItem(item)
}
function onItemTextFocus (item: TaskChecklistItem) {
  if (editingItemId.value === item.id) return
  openEditItem(item)
}
function onItemTextInput (event: Event, item: TaskChecklistItem) {
  if (editingItemId.value !== item.id) return
  const target = event.target
  if (!(target instanceof HTMLTextAreaElement)) return
  editItemDraft.value = target.value
  adjustTextareaHeight(target)
}
function onItemTextEnter (item: TaskChecklistItem) {
  if (editingItemId.value !== item.id) return
  submitEditItem()
}
function onItemTextEscape (item: TaskChecklistItem) {
  if (editingItemId.value !== item.id) return
  cancelEditItem()
}
function onItemTextBlur (item: TaskChecklistItem) {
  if (editingItemId.value !== item.id) return
  submitEditItem()
}
const composerOpen = computed(() => Boolean(
  props.showAddForm || editingItemId.value || editingTitle.value,
))
function isComposerTarget (target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false
  const root = rootRef.value
  if (!root?.contains(target)) return false
  const el = target instanceof Element ? target : target.parentElement
  if (!el) return false
  // 他の項目表示をクリックしたときは外側扱いせず、入力モードへ切り替えられるようにする
  return Boolean(
    el.closest('.task-checklist__item-text')
    || el.closest('.task-checklist__item-menu-wrap')
    || el.closest('.task-checklist__title')
    || el.closest('.task-checklist__title-input')
    || el.closest('.task-checklist__open-composer-btn')
    || el.closest('.task-checklist__item--composer')
  )
}
function dismissOpenComposer () {
  if (editingTitle.value) {
    submitEditTitle()
  }
  if (editingItemId.value !== null) {
    submitEditItem()
  }
  if (props.showAddForm) {
    submitAddItem()
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
  document.removeEventListener('keydown', onMenuEscape)
  removeMenuResizeListener?.()
  removeMenuResizeListener = null
  closeMenu()
  closeItemMenu()
})
const completedCount = computed(() => (
  props.checklist.items.filter(item => item.checked).length
))
const progressPercent = computed(() => {
  const total = props.checklist.items.length
  if (total === 0) return 0
  return Math.round((completedCount.value / total) * 100)
})
function createItemId (): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // crypto.randomUUID が使えない環境向けの RFC4122 v4 互換フォールバック
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : ((random & 0x3) | 0x8)
    return value.toString(16)
  })
}
function toggleItem (itemId: string) {
  emit('update', {
    ...props.checklist,
    items: props.checklist.items.map(item => (
      item.id === itemId ? { ...item, checked: !item.checked } : item
    )),
  })
}
function removeItem (itemId: string) {
  if (openItemMenuId.value === itemId) {
    closeItemMenu()
  }
  if (editingItemId.value === itemId) {
    cancelEditItem()
  }
  emit('update', {
    ...props.checklist,
    items: props.checklist.items.filter(item => item.id !== itemId),
  })
}
function cancelEditTitle () {
  editingTitle.value = false
  titleDraft.value = ''
}
function openEditTitle () {
  cancelAddItem()
  cancelEditItem()
  editingTitle.value = true
  titleDraft.value = props.checklist.title
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}
function submitEditTitle () {
  if (!editingTitle.value) return
  const title = titleDraft.value.trim()
  if (!title || title === props.checklist.title) {
    cancelEditTitle()
    return
  }
  emit('update', {
    ...props.checklist,
    title,
  })
  cancelEditTitle()
}
function clearItemTextSelection (el: HTMLTextAreaElement | null | undefined) {
  if (!el) return
  // readonly のまま setSelectionRange しても Chromium で選択が残ることがある
  const restoreReadonly = el.readOnly
  if (restoreReadonly) {
    el.readOnly = false
  }
  try {
    el.setSelectionRange(0, 0)
  } catch {
    // ignore
  }
  if (restoreReadonly) {
    el.readOnly = true
  }
  if (document.activeElement === el) {
    el.blur()
  }
  window.getSelection()?.removeAllRanges()
}
function cancelEditItem () {
  const itemId = editingItemId.value
  const el = itemId ? itemTextRefs.get(itemId) : undefined
  editingItemId.value = null
  editItemDraft.value = ''
  if (!itemId) return
  preserveDetailScroll(el, () => {
    clearItemTextSelection(el)
  })
  nextTick(() => {
    const node = itemTextRefs.get(itemId)
    preserveDetailScroll(node, () => {
      clearItemTextSelection(node)
      adjustItemTextHeight(itemId)
    })
  })
}
function openEditItem (item: TaskChecklistItem) {
  if (editingItemId.value === item.id) return
  closeItemMenu()
  // 追加入力中なら先に追加確定（空なら閉じるだけ）してから切替
  if (props.showAddForm) {
    submitAddItem()
  }
  cancelEditTitle()
  // blur に頼らず、直前の項目を確定してから切り替える
  if (editingItemId.value !== null) {
    submitEditItem()
  }
  pendingOutsideDismiss = false
  editingItemId.value = item.id
  editItemDraft.value = item.text
  nextTick(() => {
    focusItemText(itemTextRefs.get(item.id), true)
  })
}
function submitEditItem () {
  const itemId = editingItemId.value
  if (!itemId) return
  const text = editItemDraft.value.trim()
  if (!text) {
    cancelEditItem()
    return
  }
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
  cancelEditTitle()
  emit('update:showAddForm', true)
  focusAddItemInput()
}
let suppressAddItemBlur = false
function submitAddItemAndContinue () {
  suppressAddItemBlur = true
  submitAddItem({ continueEditing: true })
  void nextTick(() => {
    requestAnimationFrame(() => {
      suppressAddItemBlur = false
    })
  })
}
function onAddItemBlur () {
  if (suppressAddItemBlur) {
    return
  }
  submitAddItem()
}
function submitAddItem (options?: { continueEditing?: boolean }) {
  if (!props.showAddForm) return
  const text = addItemDraft.value.trim()
  if (!text) {
    cancelAddItem()
    return
  }
  cancelEditItem()
  emit('update', {
    ...props.checklist,
    items: [
      ...props.checklist.items,
      { id: createItemId(), text, checked: false },
    ],
  })
  if (options?.continueEditing) {
    addItemDraft.value = ''
    focusAddItemInput()
    return
  }
  cancelAddItem()
}
function cancelAddItem () {
  addItemDraft.value = ''
  emit('update:showAddForm', false)
}
function focusAddItemInput () {
  if (!import.meta.client) {
    return
  }
  const apply = () => {
    const el = addItemInputRef.value
    if (!el || el.disabled) {
      return false
    }
    preserveDetailScroll(el, () => {
      adjustAddItemInputHeight()
      el.focus({ preventScroll: true })
    })
    return document.activeElement === el
  }
  void nextTick(() => {
    if (apply()) {
      return
    }
    requestAnimationFrame(() => {
      if (apply()) {
        return
      }
      requestAnimationFrame(() => {
        apply()
      })
    })
  })
}
watch(
  () => props.showAddForm,
  (open) => {
    if (!open) {
      addItemDraft.value = ''
      return
    }
    cancelEditItem()
    cancelEditTitle()
    focusAddItemInput()
  },
  { immediate: true },
)
watch(
  () => props.checklist.items,
  (items) => {
    if (editingItemId.value && !items.some(item => item.id === editingItemId.value)) {
      cancelEditItem()
    }
    nextTick(() => adjustAllItemTextHeights())
  },
  { deep: true },
)
watch(
  () => props.checklist.title,
  (title) => {
    if (editingTitle.value && titleDraft.value !== title) {
      // 外部更新時は編集を閉じる
      cancelEditTitle()
    }
  },
)
</script>
<style lang="scss" scoped src="~/assets/styles/components/task/TaskDetailChecklistBlock.scss"></style>
