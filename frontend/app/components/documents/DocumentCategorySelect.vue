<template>
  <div
    class="document-category-select"
    data-document-category-select-root
    @pointerdown.stop
    @pointerup.stop
  >
    <button
      ref="triggerRef"
      type="button"
      class="document-category-select__trigger"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      :aria-label="triggerAriaLabel"
      :disabled="disabled || pending || !categories.length"
      @click.stop="toggleDropdown"
    >
      <LabelStrip
        v-if="currentCategory"
        :label="categoryLabel(currentCategory)"
        :text-color="categoryTextColor(currentCategory.color)"
        size="sm"
      />
      <span
        v-else
        class="document-category-select__empty"
      >未設定</span>
    </button>
  </div>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="dropdownRef"
      class="document-category-select__dropdown"
      role="listbox"
      aria-label="カテゴリを選択"
      :style="dropdownStyle"
    >
      <ul
        class="document-category-select__list"
        :style="listStyle"
      >
        <li
          v-for="category in categories"
          :key="category.name"
          class="document-category-select__item"
          role="option"
          :aria-selected="isSelected(category)"
        >
          <button
            type="button"
            class="document-category-select__option"
            :class="{ 'document-category-select__option--selected': isSelected(category) }"
            :disabled="pending"
            @click.stop="selectCategory(category)"
          >
            <LabelStrip
              :label="categoryLabel(category)"
              :text-color="categoryTextColor(category.color)"
              size="sm"
            />
          </button>
        </li>
      </ul>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import {
  standardColorEmphasisText,
  standardColorSurfaceBackground,
} from '../../constants/colorPresets'
import { useDropdownEscapeClose } from '../../composables/useDropdownEscapeClose'
import type { TaskFormCategory } from '../../composables/useTaskFormHelpers'
import LabelStrip from '../ui/LabelStrip.vue'

const props = withDefaults(defineProps<{
  category?: TaskFormCategory | null
  categories: TaskFormCategory[]
  disabled?: boolean
  pending?: boolean
}>(), {
  category: null,
  disabled: false,
  pending: false,
})

const emit = defineEmits<{
  select: [category: TaskFormCategory]
}>()

const DROPDOWN_GAP = 6
const VIEWPORT_PAD = 8
const DROPDOWN_VERTICAL_PADDING = 12
let activeCloseDropdown: (() => void) | null = null

const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const dropdownPosition = ref<{ top: number; left: number } | null>(null)
const listMaxHeight = ref<number | null>(null)

const currentCategory = computed(() => props.category ?? null)
const triggerAriaLabel = computed(() => {
  if (currentCategory.value) {
    return `カテゴリ ${currentCategory.value.name}。クリックして変更`
  }
  return 'カテゴリ未設定。クリックして選択'
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

function categoryLabel (category: TaskFormCategory) {
  return {
    ...category,
    color: standardColorSurfaceBackground(category.color),
  }
}

function categoryTextColor (color: string) {
  return standardColorEmphasisText(color)
}

function isSelected (category: TaskFormCategory) {
  return currentCategory.value?.name === category.name
}

function closeDropdown () {
  isOpen.value = false
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
  const dropdownWidth = dropdownRef.value?.offsetWidth ?? 128
  let left = rect.right + DROPDOWN_GAP
  const top = Math.max(VIEWPORT_PAD, rect.top)
  if (left + dropdownWidth > window.innerWidth - VIEWPORT_PAD) {
    left = rect.left - dropdownWidth - DROPDOWN_GAP
  }
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - dropdownWidth - VIEWPORT_PAD))
  listMaxHeight.value = Math.max(
    0,
    window.innerHeight - VIEWPORT_PAD - top - DROPDOWN_VERTICAL_PADDING,
  )
  dropdownPosition.value = { top, left }
}

function openDropdown () {
  if (props.disabled || props.pending || !props.categories.length) {
    return
  }
  claimActiveDropdown()
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

function selectCategory (category: TaskFormCategory) {
  if (props.pending) {
    return
  }
  if (isSelected(category)) {
    closeDropdown()
    return
  }
  emit('select', category)
  closeDropdown()
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

onBeforeUnmount(() => {
  if (activeCloseDropdown === closeDropdown) {
    activeCloseDropdown = null
  }
  unbindGlobalListeners()
})

useDropdownEscapeClose(isOpen, closeDropdown)
</script>
<style lang="scss" scoped>
.document-category-select {
  display: inline-flex;
  max-width: 100%;
}
.document-category-select__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  line-height: 1;
}
.document-category-select__trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.document-category-select__trigger:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
  border-radius: 999px;
}
.document-category-select__empty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 96px;
  height: 30px;
  min-width: 96px;
  max-width: 96px;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}
.document-category-select__trigger :deep(.label-strip) {
  box-sizing: border-box;
  width: 96px;
  height: 30px;
  min-width: 96px;
  max-width: 96px;
  min-height: 30px;
  max-height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid currentColor;
  padding: 0 8px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}
.document-category-select__dropdown {
  position: fixed;
  z-index: 120;
  box-sizing: border-box;
  min-width: 128px;
  padding: 6px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
}
.document-category-select__list {
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.document-category-select__item {
  margin: 0;
  padding: 0;
}
.document-category-select__option {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  box-sizing: border-box;
  padding: 4px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}
.document-category-select__option--selected {
  background: #f1f5f9;
}
.document-category-select__option:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.document-category-select__option :deep(.label-strip) {
  box-sizing: border-box;
  width: 96px;
  height: 30px;
  min-width: 96px;
  max-width: 96px;
  min-height: 30px;
  max-height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid currentColor;
  padding: 0 8px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}
</style>
