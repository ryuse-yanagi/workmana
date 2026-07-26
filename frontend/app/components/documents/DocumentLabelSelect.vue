<template>
  <div
    class="document-label-select"
    data-document-label-select-root
    @pointerdown.stop
    @pointerup.stop
  >
    <button
      ref="triggerRef"
      type="button"
      class="document-label-select__trigger"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      aria-label="ラベルを追加"
      :disabled="disabled || pending"
      @click.stop="toggleDropdown"
    >
      <span class="document-label-select__plus" aria-hidden="true">+</span>
    </button>
  </div>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="dropdownRef"
      class="document-label-select__dropdown"
      role="listbox"
      aria-label="ラベルを選択"
      aria-multiselectable="true"
      :style="dropdownStyle"
    >
      <header class="document-label-select__header">
        <h4 class="document-label-select__title">ラベル</h4>
        <button
          type="button"
          class="document-label-select__close"
          :disabled="pending"
          aria-label="閉じる"
          @click.stop="closeDropdown"
        >✕</button>
      </header>
      <input
        v-model="searchQuery"
        type="search"
        class="document-label-select__search"
        placeholder="ラベルを検索..."
        :disabled="pending"
        @click.stop
      />
      <p class="document-label-select__section">ラベル</p>
      <ul
        class="document-label-select__list"
        :style="listStyle"
      >
        <li
          v-for="label in filteredLabels"
          :key="label.id"
          class="document-label-select__item"
          role="option"
          :aria-selected="isSelected(label.id)"
        >
          <button
            type="button"
            class="document-label-select__option"
            :disabled="pending"
            @click.stop="toggleLabel(label)"
          >
            <span
              class="document-label-select__checkbox"
              :class="{ 'document-label-select__checkbox--checked': isSelected(label.id) }"
              aria-hidden="true"
            >
              <span v-if="isSelected(label.id)">✓</span>
            </span>
            <span
              class="document-label-select__bar"
              :style="{
                backgroundColor: label.color,
                color: labelBarTextColor(label.color),
              }"
            >
              {{ label.name }}
            </span>
          </button>
        </li>
      </ul>
      <p
        v-if="!labels.length"
        class="document-label-select__empty"
      >ラベルは設定画面で作成できます。</p>
      <p
        v-else-if="!filteredLabels.length"
        class="document-label-select__empty"
      >該当するラベルがありません。</p>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { useDropdownEscapeClose } from '../../composables/useDropdownEscapeClose'
import type { TaskFormLabel } from '../../composables/useTaskFormHelpers'

const props = withDefaults(defineProps<{
  selectedIds: number[]
  labels: TaskFormLabel[]
  disabled?: boolean
  pending?: boolean
}>(), {
  disabled: false,
  pending: false,
})

const emit = defineEmits<{
  toggle: [label: TaskFormLabel]
}>()

const DROPDOWN_GAP = 6
const VIEWPORT_PAD = 8
const DROPDOWN_VERTICAL_PADDING = 12
let activeCloseDropdown: (() => void) | null = null

const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const searchQuery = ref('')
const dropdownPosition = ref<{ top: number; left: number } | null>(null)
const listMaxHeight = ref<number | null>(null)

const filteredLabels = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return props.labels
  }
  return props.labels.filter(label => label.name.toLowerCase().includes(query))
})

const listStyle = computed(() => {
  if (listMaxHeight.value == null) {
    return {}
  }
  return {
    maxHeight: `${listMaxHeight.value}px`,
  }
})

const dropdownStyle = computed(() => {
  if (!dropdownPosition.value) {
    return {
      visibility: 'hidden',
    } as Record<string, string>
  }
  const { top, left } = dropdownPosition.value
  return {
    top: `${top}px`,
    left: `${left}px`,
    visibility: 'visible',
  }
})

function labelBarTextColor (color: string): string {
  const hex = color.replace('#', '').trim()
  if (hex.length !== 6) return '#172b4d'
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return '#172b4d'
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#172b4d' : '#ffffff'
}

function isSelected (labelId: number) {
  return props.selectedIds.includes(labelId)
}

function closeDropdown () {
  isOpen.value = false
  searchQuery.value = ''
  dropdownPosition.value = null
  listMaxHeight.value = null
  if (activeCloseDropdown === closeDropdown) {
    activeCloseDropdown = null
  }
}

function claimActiveDropdown () {
  if (activeCloseDropdown && activeCloseDropdown !== closeDropdown) {
    activeCloseDropdown()
  }
  activeCloseDropdown = closeDropdown
}

function positionDropdown () {
  const trigger = triggerRef.value
  if (!trigger || !import.meta.client) {
    dropdownPosition.value = null
    listMaxHeight.value = null
    return
  }
  const rect = trigger.getBoundingClientRect()
  const dropdownWidth = dropdownRef.value?.offsetWidth ?? 273
  let left = rect.left
  if (left + dropdownWidth > window.innerWidth - VIEWPORT_PAD) {
    left = rect.right - dropdownWidth
  }
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - dropdownWidth - VIEWPORT_PAD))
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD
  const spaceAbove = rect.top - VIEWPORT_PAD
  let top: number
  if (spaceBelow >= 160) {
    top = rect.bottom + DROPDOWN_GAP
    listMaxHeight.value = Math.max(0, spaceBelow - DROPDOWN_GAP - DROPDOWN_VERTICAL_PADDING - 96)
  } else {
    listMaxHeight.value = Math.max(0, spaceAbove - DROPDOWN_GAP - DROPDOWN_VERTICAL_PADDING - 96)
    top = Math.max(VIEWPORT_PAD, rect.top - DROPDOWN_GAP - (dropdownRef.value?.offsetHeight ?? 240))
  }
  dropdownPosition.value = { top, left }
}

function openDropdown () {
  if (props.disabled || props.pending) {
    return
  }
  claimActiveDropdown()
  searchQuery.value = ''
  isOpen.value = true
  nextTick(() => {
    positionDropdown()
    requestAnimationFrame(() => positionDropdown())
  })
}

function toggleDropdown () {
  if (isOpen.value) {
    closeDropdown()
    return
  }
  openDropdown()
}

function toggleLabel (label: TaskFormLabel) {
  if (props.pending) {
    return
  }
  emit('toggle', label)
}

function isTriggerVisible (): boolean {
  const trigger = triggerRef.value
  if (!trigger) {
    return false
  }
  return trigger.getClientRects().length > 0
}

function shouldIgnoreOutsidePointer (target: Node): boolean {
  if (triggerRef.value?.contains(target)) {
    return true
  }
  if (dropdownRef.value?.contains(target)) {
    return true
  }
  return false
}

function onDocumentPointerUp (event: PointerEvent) {
  if (!isOpen.value || event.button !== 0) {
    return
  }
  const target = event.target
  if (!(target instanceof Node)) {
    closeDropdown()
    return
  }
  if (shouldIgnoreOutsidePointer(target)) {
    return
  }
  closeDropdown()
}

function onWindowResize () {
  if (!isOpen.value) {
    return
  }
  positionDropdown()
}

function onWindowScroll () {
  if (!isOpen.value) {
    return
  }
  if (!isTriggerVisible()) {
    closeDropdown()
    return
  }
  positionDropdown()
}

function bindGlobalListeners () {
  if (!import.meta.client) {
    return
  }
  document.addEventListener('pointerup', onDocumentPointerUp, true)
  window.addEventListener('resize', onWindowResize)
  window.addEventListener('scroll', onWindowScroll, true)
}

function unbindGlobalListeners () {
  if (!import.meta.client) {
    return
  }
  document.removeEventListener('pointerup', onDocumentPointerUp, true)
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('scroll', onWindowScroll, true)
}

watch(isOpen, (open) => {
  unbindGlobalListeners()
  if (!open) {
    return
  }
  nextTick(() => {
    if (!isOpen.value) {
      return
    }
    if (!isTriggerVisible()) {
      closeDropdown()
      return
    }
    bindGlobalListeners()
  })
})

useDropdownEscapeClose(isOpen, closeDropdown)

onBeforeUnmount(() => {
  unbindGlobalListeners()
  if (activeCloseDropdown === closeDropdown) {
    activeCloseDropdown = null
  }
})
</script>
<style lang="scss" scoped>
.document-label-select {
  display: inline-flex;
  flex-shrink: 0;
}
.document-label-select__trigger {
  width: 28px;
  height: 28px;
  box-sizing: border-box;
  border: none;
  border-radius: 6px;
  padding: 0;
  background: #94a3b8;
  color: #fff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.document-label-select__trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.document-label-select__trigger:focus-visible {
  outline: 2px solid mixin.$main;
  outline-offset: 2px;
}
.document-label-select__plus {
  font-size: 24px;
  font-weight: 500;
  line-height: 1;
}
.document-label-select__dropdown {
  position: fixed;
  z-index: 120;
  box-sizing: border-box;
  width: min(252px, calc(100vw - 21px));
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.18);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.document-label-select__header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 9.1px 28px 7.7px;
  border-bottom: 1px solid #dfe1e6;
}
.document-label-select__title {
  margin: 0;
  font-size: 12.32px;
  font-weight: 700;
  color: #172b4d;
}
.document-label-select__close {
  position: absolute;
  right: 6.3px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  padding: 4px;
}
.document-label-select__search {
  display: block;
  width: calc(100% - 18.2px);
  margin: 7.7px 9.1px 6.3px;
  box-sizing: border-box;
  border: 1px solid mixin.$border;
  border-radius: 6px;
  padding: 6.3px 7.7px;
  font-size: 12.32px;
  color: #172b4d;
}
.document-label-select__search:focus {
  @include mixin.input-focus-ring;
}
.document-label-select__section {
  margin: 2.1px 9.1px 4.9px;
  font-size: 10.92px;
  font-weight: 700;
  color: #5e6c84;
}
.document-label-select__list {
  margin: 0;
  padding: 0 7px 9.1px;
  list-style: none;
  overflow-y: auto;
  scrollbar-gutter: stable;
  display: flex;
  flex-direction: column;
  gap: 2.8px;
}
.document-label-select__option {
  @include mixin.picker-checkbox-row;
  display: flex;
  align-items: center;
  gap: 5.6px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 2.1px 0;
  text-align: left;
}
.document-label-select__checkbox {
  width: 14px;
  height: 14px;
  border: 2px solid #8590a2;
  border-radius: 3px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10.08px;
  font-weight: 800;
  color: #fff;
  background: #fff;
}
.document-label-select__checkbox--checked {
  background: #2563eb;
  border-color: #2563eb;
}
.document-label-select__bar {
  flex: 0 0 200px;
  width: 200px;
  height: 38px;
  min-height: 38px;
  border-radius: 4px;
  padding: 5.32px 7.7px;
  font-size: 12.32px;
  font-weight: 700;
  line-height: 1.2;
  box-sizing: border-box;
  display: flex;
  align-items: center;
}
.document-label-select__empty {
  margin: 0 9.1px 9.1px;
  font-size: 11.76px;
  color: #94a3b8;
}
</style>
