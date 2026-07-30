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
<style lang="scss" scoped src="~/assets/styles/components/documents/DocumentLabelSelect.scss"></style>
