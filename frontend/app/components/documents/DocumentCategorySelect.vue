<template>
  <div
    class="document-category-select"
    :class="{ 'document-category-select--readonly': readonly }"
    data-document-category-select-root
    @pointerdown="onRootPointerDown"
    @pointerup="onRootPointerUp"
  >
    <button
      v-if="!readonly"
      ref="triggerRef"
      type="button"
      class="document-category-select__trigger"
      data-popover-trigger
      :aria-expanded="isOpen"
      aria-haspopup="dialog"
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
    <div
      v-else
      class="document-category-select__display"
      :aria-label="triggerAriaLabel"
    >
      <LabelStrip
        v-if="currentCategory"
        :label="categoryLabel(currentCategory)"
        :text-color="categoryTextColor(currentCategory.color)"
        size="sm"
      />
      <span
        v-else
        class="document-category-select__empty document-category-select__empty--readonly"
      >未設定</span>
    </div>
  </div>
  <Teleport v-if="!readonly" to="body">
    <div
      v-if="isOpen"
      ref="dropdownRef"
      class="document-category-select__dropdown"
      role="dialog"
      aria-label="カテゴリ"
      :style="dropdownStyle"
      @click.stop
    >
      <header class="document-category-select__header">
        <button
          v-if="currentCategory"
          type="button"
          class="board-filter-clear"
          @click.stop="clearCategory"
        >
          クリア
        </button>
        <p class="document-category-select__title">カテゴリ</p>
        <button
          type="button"
          class="document-category-select__close"
          :disabled="pending"
          aria-label="閉じる"
          @click.stop="closeDropdown"
        >
          <X
            :size="16"
            :stroke-width="2.25"
            aria-hidden="true"
          />
        </button>
      </header>
      <input
        v-model="searchQuery"
        type="search"
        class="document-category-select__search"
        placeholder="カテゴリを検索..."
        :disabled="pending"
        @click.stop
      />
      <p class="document-category-select__section-heading">カテゴリ</p>
      <div
        class="document-category-select__list"
        :style="listStyle"
      >
        <ul class="document-category-select__picker-list">
        <li
            v-for="category in filteredCategories"
          :key="category.name"
        >
          <button
            type="button"
              class="document-category-select__row"
            :disabled="pending"
            @click.stop="selectCategory(category)"
          >
              <input
                type="radio"
                class="document-category-select__checkbox"
                :checked="isSelected(category)"
                tabindex="-1"
                aria-hidden="true"
              >
              <span
                class="document-category-select__pill"
                :style="surfacePillStyle(category.color)"
              >
                {{ category.name }}
              </span>
          </button>
        </li>
      </ul>
        <p
          v-if="!categories.length"
          class="document-category-select__empty-text"
        >
          カテゴリは設定画面で追加できます
        </p>
        <p
          v-else-if="!filteredCategories.length"
          class="document-category-select__empty-text"
        >
          カテゴリがありません
        </p>
      </div>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { X } from 'lucide-vue-next'
import {
  standardColorEmphasisText,
  standardColorSurfaceBackground,
} from '../../constants/colorPresets'
import { useDropdownEscapeClose } from '../../composables/ui/useDropdownEscapeClose'
import { useExclusivePopover } from '../../composables/ui/useExclusivePopover'
import { dismissPopoverFromOutsidePointer, isInsideFloatingPopover, isScrollInsideRoot } from '../../utils/ui/uiInteraction'
import {
  POPOVER_PANEL_BASE_WIDTH,
  POPOVER_VIEWPORT_INSET,
  clampPopoverBox,
  measurePopoverNaturalHeight,
  resolveFlippedPopoverVerticalLayout,
  popoverMaxHeightStyle,
  popoverPositionVisibilityStyle,
  popoverScrollbarLayoutStyle,
  popoverStablePanelWidthStyle,
  resolveAnchoredPopoverLayoutWidth,
  resolvePopoverScrollbarGutter,
  schedulePopoverOpenLayout,
} from '../../utils/ui/popoverScrollbar'
import type { TaskFormCategory } from '../../composables/task/useTaskFormHelpers'
import LabelStrip from '../ui/LabelStrip.vue'

const props = withDefaults(defineProps<{
  category?: TaskFormCategory | null
  categories: TaskFormCategory[]
  disabled?: boolean
  pending?: boolean
  readonly?: boolean
}>(), {
  category: null,
  disabled: false,
  pending: false,
  readonly: false,
})

const emit = defineEmits<{
  select: [category: TaskFormCategory | null]
}>()

const DROPDOWN_GAP = 6
const DROPDOWN_CHROME_HEIGHT = 96
const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const searchQuery = ref('')
const layoutSettled = ref(false)
const dropdownPosition = ref<{ top: number; left: number; scrollbarGutter: number; panelWidth: number } | null>(null)
const listMaxHeight = ref<number | null>(null)

const currentCategory = computed(() => props.category ?? null)
const triggerAriaLabel = computed(() => {
  if (props.readonly) {
    if (currentCategory.value) {
      return `カテゴリ ${currentCategory.value.name}`
    }
    return 'カテゴリ未設定'
  }
  if (currentCategory.value) {
    return `カテゴリ ${currentCategory.value.name}。クリックして変更`
  }
  return 'カテゴリ未設定。クリックして選択'
})

function onRootPointerDown (event: PointerEvent) {
  if (!props.readonly) {
    event.stopPropagation()
  }
}

function onRootPointerUp (event: PointerEvent) {
  if (!props.readonly) {
    event.stopPropagation()
  }
}

const filteredCategories = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return props.categories
  }
  return props.categories.filter(category => category.name.toLowerCase().includes(query))
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
    return popoverPositionVisibilityStyle(false)
  }
  const { top, left, scrollbarGutter, panelWidth } = dropdownPosition.value
  return {
    top: `${top}px`,
    left: `${left}px`,
    ...popoverPositionVisibilityStyle(layoutSettled.value),
    ...popoverStablePanelWidthStyle(panelWidth),
    ...popoverScrollbarLayoutStyle(scrollbarGutter, true),
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

function surfacePillStyle (color: string) {
  return {
    backgroundColor: standardColorSurfaceBackground(color),
    color: standardColorEmphasisText(color),
  }
}

function isSelected (category: TaskFormCategory) {
  return currentCategory.value?.name === category.name
}

function closeDropdown () {
  isOpen.value = false
  searchQuery.value = ''
  layoutSettled.value = false
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
  const list = dropdown?.querySelector('.document-category-select__list')
  const pad = POPOVER_VIEWPORT_INSET
  const measuredHeight = dropdown ? Math.ceil(measurePopoverNaturalHeight(dropdown) || 0) : 0
  const preferredTop = rect.bottom + DROPDOWN_GAP
  const spaceBelow = window.innerHeight - rect.bottom - pad
  let top: number
  if (spaceBelow >= 160) {
    const vertical = resolveFlippedPopoverVerticalLayout(preferredTop, {
      pad,
      contentHeight: measuredHeight,
    })
    top = vertical.top
    listMaxHeight.value = Math.max(0, vertical.maxHeight - DROPDOWN_CHROME_HEIGHT)
  } else {
    const vertical = resolveFlippedPopoverVerticalLayout(rect.top - DROPDOWN_GAP, {
    pad,
    contentHeight: measuredHeight,
  })
    top = vertical.top
    listMaxHeight.value = Math.max(0, vertical.maxHeight - DROPDOWN_CHROME_HEIGHT)
  }
  const baseWidth = POPOVER_PANEL_BASE_WIDTH.category
  const scrollbarGutter = list instanceof HTMLElement && listMaxHeight.value != null
    ? resolvePopoverScrollbarGutter(list, listMaxHeight.value, baseWidth)
    : 0
  const panelWidth = resolveAnchoredPopoverLayoutWidth(baseWidth, scrollbarGutter)
  let left = rect.left
  if (left + panelWidth > window.innerWidth - pad) {
    left = rect.right - panelWidth
  }
  left = Math.max(pad, Math.min(left, window.innerWidth - panelWidth - pad))
  const panelHeight = measuredHeight > 0
    ? measuredHeight
    : Math.min(160, (listMaxHeight.value ?? 0) + DROPDOWN_CHROME_HEIGHT)
  const clamped = clampPopoverBox(top, left, panelWidth, panelHeight, pad)
  dropdownPosition.value = { top: clamped.top, left: clamped.left, scrollbarGutter, panelWidth }
}

function openDropdown () {
  if (props.disabled || props.pending || !props.categories.length) {
    return
  }
  searchQuery.value = ''
  layoutSettled.value = false
  isOpen.value = true
  dropdownPosition.value = null
  listMaxHeight.value = null
  nextTick(() => {
    schedulePopoverOpenLayout(
      () => positionDropdown(),
      () => {
        layoutSettled.value = true
      },
    )
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
  emit('select', isSelected(category) ? null : category)
}

function clearCategory () {
  if (props.pending || !currentCategory.value) {
    return
  }
  emit('select', null)
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
  if (isInsideFloatingPopover(target)) {
    return
  }
  dismissPopoverFromOutsidePointer(target, closeDropdown)
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

watch(searchQuery, () => {
  if (!isOpen.value) {
    return
  }
  nextTick(() => {
    positionDropdown()
  })
})

onBeforeUnmount(() => {
  unbindGlobalListeners()
})

useDropdownEscapeClose(isOpen, closeDropdown)
useExclusivePopover(isOpen, closeDropdown)
</script>
<style lang="scss" scoped src="~/assets/styles/components/documents/DocumentCategorySelect.scss"></style>
