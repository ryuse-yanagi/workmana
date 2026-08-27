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
        <p class="document-label-select__title">ラベル</p>
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
      <div
        class="document-label-select__list"
        :style="listStyle"
      >
        <LabelPickerGroupedList
          :categories="filteredLabelCategories"
          :selected-ids="selectedIds"
          :has-source-labels="labels.length > 0"
          :disabled="pending"
          @toggle="toggleLabel"
        />
      </div>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { useDropdownEscapeClose } from '../../composables/useDropdownEscapeClose'
import { useExclusivePopover } from '../../composables/useExclusivePopover'
import { isScrollInsideRoot } from '../../utils/uiInteraction'
import { popoverMaxHeightStyle, popoverScrollbarGutterStyle, POPOVER_SCROLLBAR_GUTTER_VAR, popoverWidthExtraForGutter, resolvePopoverScrollbarGutter } from '../../utils/popoverScrollbar'
import type { TaskFormLabel } from '../../composables/useTaskFormHelpers'
import {
  filterLabelCategories,
  labelCategoriesFromFlat,
  type LabelCategoryGroup,
} from '../../composables/useLabelCategories'
import LabelPickerGroupedList from '../task/LabelPickerGroupedList.vue'

const props = withDefaults(defineProps<{
  selectedIds: number[]
  labels: TaskFormLabel[]
  labelCategories?: LabelCategoryGroup[]
  disabled?: boolean
  pending?: boolean
}>(), {
  disabled: false,
  pending: false,
  labelCategories: () => [],
})

const emit = defineEmits<{
  toggle: [label: TaskFormLabel]
}>()

const DROPDOWN_GAP = 6
const VIEWPORT_PAD = 8
const DROPDOWN_VERTICAL_PADDING = 12
const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const searchQuery = ref('')
const dropdownPosition = ref<{ top: number; left: number; scrollbarGutter: number } | null>(null)
const listMaxHeight = ref<number | null>(null)

const filteredLabelCategories = computed(() => {
  return filterLabelCategories(
    labelCategoriesFromFlat(props.labelCategories, props.labels),
    searchQuery.value,
  )
})

const listStyle = computed(() => {
  if (listMaxHeight.value == null) {
    return {}
  }
  const scrollbarGutter = dropdownPosition.value?.scrollbarGutter ?? 0
  return popoverMaxHeightStyle(listMaxHeight.value, scrollbarGutter)
})

const dropdownStyle = computed(() => {
  if (!dropdownPosition.value) {
    return {
      visibility: 'hidden',
    } as Record<string, string>
  }
  const { top, left, scrollbarGutter } = dropdownPosition.value
  return {
    top: `${top}px`,
    left: `${left}px`,
    visibility: 'visible',
    ...popoverScrollbarGutterStyle(scrollbarGutter),
  }
})

function closeDropdown () {
  isOpen.value = false
  searchQuery.value = ''
  dropdownPosition.value = null
  listMaxHeight.value = null
}

function positionDropdown () {
  const trigger = triggerRef.value
  if (!trigger || !import.meta.client) {
    dropdownPosition.value = null
    listMaxHeight.value = null
    return
  }
  const rect = trigger.getBoundingClientRect()
  const dropdown = dropdownRef.value
  if (dropdown) {
    dropdown.style.setProperty(POPOVER_SCROLLBAR_GUTTER_VAR, '0px')
  }
  const list = dropdown?.querySelector('.document-label-select__list')
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD
  const spaceAbove = rect.top - VIEWPORT_PAD
  let top: number
  if (spaceBelow >= 160) {
    top = rect.bottom + DROPDOWN_GAP
    listMaxHeight.value = Math.max(0, spaceBelow - DROPDOWN_GAP - DROPDOWN_VERTICAL_PADDING - 96)
  } else {
    listMaxHeight.value = Math.max(0, spaceAbove - DROPDOWN_GAP - DROPDOWN_VERTICAL_PADDING - 96)
    top = Math.max(VIEWPORT_PAD, rect.top - DROPDOWN_GAP - (dropdown?.offsetHeight ?? 240))
  }
  const scrollbarGutter = list instanceof HTMLElement
    ? resolvePopoverScrollbarGutter(list, listMaxHeight.value)
    : 0
  const dropdownWidth = (dropdown?.offsetWidth ?? 273) + popoverWidthExtraForGutter(scrollbarGutter)
  let left = rect.left
  if (left + dropdownWidth > window.innerWidth - VIEWPORT_PAD) {
    left = rect.right - dropdownWidth
  }
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - dropdownWidth - VIEWPORT_PAD))
  dropdownPosition.value = { top, left, scrollbarGutter }
}

function openDropdown () {
  if (props.disabled || props.pending) {
    return
  }
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

function onWindowScroll (event: Event) {
  if (!isOpen.value) {
    return
  }
  if (isScrollInsideRoot(event, dropdownRef.value)) {
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
useExclusivePopover(isOpen, closeDropdown)

onBeforeUnmount(() => {
  unbindGlobalListeners()
})
</script>
<style lang="scss" scoped src="~/assets/styles/components/documents/DocumentLabelSelect.scss"></style>
