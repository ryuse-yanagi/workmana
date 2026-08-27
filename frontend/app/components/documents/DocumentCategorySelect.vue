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
import { useExclusivePopover } from '../../composables/useExclusivePopover'
import { isScrollInsideRoot } from '../../utils/uiInteraction'
import { popoverMaxHeightStyle, popoverScrollbarGutterStyle, POPOVER_SCROLLBAR_GUTTER_VAR, popoverWidthExtraForGutter, resolvePopoverScrollbarGutter } from '../../utils/popoverScrollbar'
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
const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const dropdownPosition = ref<{ top: number; left: number; scrollbarGutter: number } | null>(null)
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
  const list = dropdown?.querySelector('.document-category-select__list')
  const top = Math.max(VIEWPORT_PAD, rect.top)
  listMaxHeight.value = Math.max(
    0,
    window.innerHeight - VIEWPORT_PAD - top - DROPDOWN_VERTICAL_PADDING,
  )
  const scrollbarGutter = list instanceof HTMLElement && listMaxHeight.value != null
    ? resolvePopoverScrollbarGutter(list, listMaxHeight.value)
    : 0
  const dropdownWidth = (dropdown?.offsetWidth ?? 128) + popoverWidthExtraForGutter(scrollbarGutter)
  let left = rect.right + DROPDOWN_GAP
  if (left + dropdownWidth > window.innerWidth - VIEWPORT_PAD) {
    left = rect.left - dropdownWidth - DROPDOWN_GAP
  }
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - dropdownWidth - VIEWPORT_PAD))
  dropdownPosition.value = { top, left, scrollbarGutter }
}

function openDropdown () {
  if (props.disabled || props.pending || !props.categories.length) {
    return
  }
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

onBeforeUnmount(() => {
  unbindGlobalListeners()
})

useDropdownEscapeClose(isOpen, closeDropdown)
useExclusivePopover(isOpen, closeDropdown)
</script>
<style lang="scss" scoped src="~/assets/styles/components/documents/DocumentCategorySelect.scss"></style>
