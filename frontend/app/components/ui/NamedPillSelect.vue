<template>
  <div
    class="named-pill-select"
    :class="{ 'named-pill-select--readonly': readonly }"
    data-named-pill-select-root
    @pointerdown="onRootPointerDown"
    @pointerup="onRootPointerUp"
  >
    <button
      v-if="!readonly"
      ref="triggerRef"
      type="button"
      class="named-pill-select__trigger"
      data-popover-trigger
      :aria-expanded="isOpen"
      aria-haspopup="dialog"
      :aria-label="triggerAriaLabel"
      :disabled="disabled || pending || !items.length"
      @click.stop="toggleDropdown"
    >
      <LabelStrip
        v-if="currentItem"
        :label="resolveLabel(currentItem)"
        :text-color="resolveTextColor(currentItem)"
        size="sm"
      />
      <span
        v-else
        class="named-pill-select__empty"
      >未設定</span>
    </button>
    <div
      v-else
      class="named-pill-select__display"
      :aria-label="triggerAriaLabel"
    >
      <LabelStrip
        v-if="currentItem"
        :label="resolveLabel(currentItem)"
        :text-color="resolveTextColor(currentItem)"
        size="sm"
      />
      <span
        v-else
        class="named-pill-select__empty named-pill-select__empty--readonly"
      >未設定</span>
    </div>
  </div>
  <Teleport v-if="!readonly" to="body">
    <Transition name="popover-fade" @after-leave="onDropdownAfterLeave">
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="named-pill-select__dropdown"
        role="dialog"
        :aria-label="labels.dialogAriaLabel"
        :style="dropdownStyle"
        @click.stop
      >
      <header class="named-pill-select__header">
        <button
          v-if="currentItem"
          type="button"
          class="board-filter-clear"
          @click.stop="clearSelection"
        >
          クリア
        </button>
        <p class="named-pill-select__title">{{ labels.title }}</p>
        <button
          type="button"
          class="named-pill-select__close"
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
        class="named-pill-select__search"
        :placeholder="labels.searchPlaceholder"
        :disabled="pending"
        @click.stop
      />
      <p class="named-pill-select__section-heading">{{ labels.sectionHeading }}</p>
      <div
        class="named-pill-select__list"
        :style="listStyle"
      >
        <ul class="named-pill-select__picker-list">
          <li
            v-for="item in filteredItems"
            :key="item.name"
          >
            <button
              type="button"
              class="named-pill-select__row"
              :disabled="pending"
              @click.stop="selectItem(item)"
            >
              <input
                type="radio"
                class="named-pill-select__checkbox"
                :checked="isSelected(item)"
                tabindex="-1"
                aria-hidden="true"
              >
              <span
                class="named-pill-select__pill"
                :style="surfacePillStyle(item)"
              >
                {{ item.name }}
              </span>
            </button>
          </li>
        </ul>
        <p
          v-if="!items.length"
          class="named-pill-select__empty-text"
        >
          {{ labels.emptyNoItems }}
        </p>
        <p
          v-else-if="!filteredItems.length"
          class="named-pill-select__empty-text"
        >
          {{ labels.emptyNoMatch }}
        </p>
      </div>
    </div>
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
import { X } from 'lucide-vue-next'
import {
  standardColorEmphasisText,
  standardColorSurfaceBackground,
} from '../../constants/colorPresets'
import { useDropdownEscapeClose } from '../../composables/useDropdownEscapeClose'
import { useExclusivePopover } from '../../composables/useExclusivePopover'
import { dismissPopoverFromOutsidePointer, isInsideFloatingPopover, isScrollInsideRoot } from '../../utils/uiInteraction'
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
} from '../../utils/popoverScrollbar'
import LabelStrip, { type LabelStripLabel } from './LabelStrip.vue'

export type NamedPillItem = {
  name: string
  color: string
}

export type NamedPillSelectLabels = {
  /** トリガー aria 用の名詞（例: カテゴリ / ステータス） */
  noun: string
  title: string
  searchPlaceholder: string
  sectionHeading: string
  emptyNoItems: string
  emptyNoMatch: string
  dialogAriaLabel: string
}

const props = withDefaults(defineProps<{
  items: NamedPillItem[]
  selected?: NamedPillItem | null
  disabled?: boolean
  pending?: boolean
  readonly?: boolean
  labels: NamedPillSelectLabels
  panelBaseWidth?: number
  getLabel?: (item: NamedPillItem) => LabelStripLabel
  getTextColor?: (item: NamedPillItem) => string
}>(), {
  selected: null,
  disabled: false,
  pending: false,
  readonly: false,
  panelBaseWidth: POPOVER_PANEL_BASE_WIDTH.status,
  getLabel: undefined,
  getTextColor: undefined,
})

const emit = defineEmits<{
  select: [item: NamedPillItem | null]
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

const currentItem = computed(() => props.selected ?? null)
const triggerAriaLabel = computed(() => {
  const noun = props.labels.noun
  if (props.readonly) {
    if (currentItem.value) {
      return `${noun} ${currentItem.value.name}`
    }
    return `${noun}未設定`
  }
  if (currentItem.value) {
    return `${noun} ${currentItem.value.name}。クリックして変更`
  }
  return `${noun}未設定。クリックして選択`
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

const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return props.items
  }
  return props.items.filter(item => item.name.toLowerCase().includes(query))
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

function resolveLabel (item: NamedPillItem): LabelStripLabel {
  if (props.getLabel) {
    return props.getLabel(item)
  }
  return {
    ...item,
    color: standardColorSurfaceBackground(item.color),
  }
}

function resolveTextColor (item: NamedPillItem) {
  if (props.getTextColor) {
    return props.getTextColor(item)
  }
  return standardColorEmphasisText(item.color)
}

function surfacePillStyle (item: NamedPillItem) {
  return {
    backgroundColor: standardColorSurfaceBackground(item.color),
    color: standardColorEmphasisText(item.color),
  }
}

function isSelected (item: NamedPillItem) {
  return currentItem.value?.name === item.name
}

function closeDropdown () {
  isOpen.value = false
  searchQuery.value = ''
}

function onDropdownAfterLeave () {
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
  const list = dropdown?.querySelector('.named-pill-select__list')
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
  const baseWidth = props.panelBaseWidth
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
  if (props.disabled || props.pending || !props.items.length) {
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

function selectItem (item: NamedPillItem) {
  if (props.pending) {
    return
  }
  emit('select', isSelected(item) ? null : item)
}

function clearSelection () {
  if (props.pending || !currentItem.value) {
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
<style lang="scss" scoped src="~/assets/styles/components/ui/NamedPillSelect.scss"></style>
