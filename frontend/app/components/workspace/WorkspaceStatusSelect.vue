<template>
  <div
    class="workspace-status-select"
    data-workspace-status-select-root
    @pointerdown.stop
    @pointerup.stop
  >
    <button
      ref="triggerRef"
      type="button"
      class="workspace-status-select__trigger"
      :aria-expanded="isOpen"
      aria-haspopup="dialog"
      :aria-label="triggerAriaLabel"
      :disabled="disabled || pending || !statuses.length"
      @click.stop="toggleDropdown"
    >
      <LabelStrip
        v-if="currentStatus"
        :label="statusLabel(currentStatus)"
        :text-color="statusTextColor(currentStatus.color)"
        size="sm"
      />
      <span
        v-else
        class="workspace-status-select__empty"
      >未設定</span>
    </button>
  </div>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="dropdownRef"
      class="workspace-status-select__dropdown"
      role="dialog"
      aria-label="ステータス"
      :style="dropdownStyle"
      @click.stop
    >
      <header class="workspace-status-select__header">
        <p class="workspace-status-select__title">ステータス</p>
        <button
          type="button"
          class="workspace-status-select__close"
          :disabled="pending"
          aria-label="閉じる"
          @click.stop="closeDropdown"
        >✕</button>
      </header>
      <input
        v-model="searchQuery"
        type="search"
        class="workspace-status-select__search"
        placeholder="ステータスを検索..."
        :disabled="pending"
        @click.stop
      />
      <p class="workspace-status-select__section-heading">ステータス</p>
      <div
        class="workspace-status-select__list"
        :style="listStyle"
      >
        <ul class="workspace-status-select__picker-list">
          <li
            v-for="status in filteredStatuses"
            :key="status.name"
          >
            <button
              type="button"
              class="workspace-status-select__row"
              :disabled="pending"
              @click.stop="selectStatus(status)"
            >
              <span
                class="workspace-status-select__checkbox"
                :class="{ 'workspace-status-select__checkbox--checked': isSelected(status) }"
                aria-hidden="true"
              >
                <span v-if="isSelected(status)">✓</span>
              </span>
              <span
                class="workspace-status-select__pill"
                :style="surfacePillStyle(status.color)"
              >
                {{ status.name }}
              </span>
            </button>
          </li>
        </ul>
        <p
          v-if="!statuses.length"
          class="workspace-status-select__empty-text"
        >
          ステータスは設定画面で作成できます。
        </p>
        <p
          v-else-if="!filteredStatuses.length"
          class="workspace-status-select__empty-text"
        >
          該当するステータスがありません。
        </p>
      </div>
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
import type { OrgWorkspaceStatus } from '../../composables/useOrgWorkspaceIndexPageData'
import LabelStrip from '../ui/LabelStrip.vue'

const props = withDefaults(defineProps<{
  status?: OrgWorkspaceStatus | null
  statuses: OrgWorkspaceStatus[]
  disabled?: boolean
  pending?: boolean
}>(), {
  status: null,
  disabled: false,
  pending: false,
})

const emit = defineEmits<{
  select: [status: OrgWorkspaceStatus]
}>()

const DROPDOWN_GAP = 6
const VIEWPORT_PAD = 8
const DROPDOWN_CHROME_HEIGHT = 96
const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const searchQuery = ref('')
const dropdownPosition = ref<{ top: number; left: number; scrollbarGutter: number } | null>(null)
const listMaxHeight = ref<number | null>(null)

const currentStatus = computed(() => props.status ?? null)
const triggerAriaLabel = computed(() => {
  if (currentStatus.value) {
    return `ステータス ${currentStatus.value.name}。クリックして変更`
  }
  return 'ステータス未設定。クリックして選択'
})

const filteredStatuses = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    return props.statuses
  }
  return props.statuses.filter(status => status.name.toLowerCase().includes(query))
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

function statusLabel (status: OrgWorkspaceStatus) {
  return {
    ...status,
    color: standardColorSurfaceBackground(status.color),
  }
}

function statusTextColor (color: string) {
  return standardColorEmphasisText(color)
}

function surfacePillStyle (color: string) {
  return {
    backgroundColor: standardColorSurfaceBackground(color),
    color: standardColorEmphasisText(color),
  }
}

function isSelected (status: OrgWorkspaceStatus) {
  return currentStatus.value?.name === status.name
}

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
  const list = dropdown?.querySelector('.workspace-status-select__list')
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD
  const spaceAbove = rect.top - VIEWPORT_PAD
  let top: number
  if (spaceBelow >= 160) {
    top = rect.bottom + DROPDOWN_GAP
    listMaxHeight.value = Math.max(0, spaceBelow - DROPDOWN_GAP - DROPDOWN_CHROME_HEIGHT)
  } else {
    listMaxHeight.value = Math.max(0, spaceAbove - DROPDOWN_GAP - DROPDOWN_CHROME_HEIGHT)
    top = Math.max(VIEWPORT_PAD, rect.top - DROPDOWN_GAP - (dropdown?.offsetHeight ?? 240))
  }
  const scrollbarGutter = list instanceof HTMLElement
    ? resolvePopoverScrollbarGutter(list, listMaxHeight.value)
    : 0
  const dropdownWidth = (dropdown?.offsetWidth ?? 252) + popoverWidthExtraForGutter(scrollbarGutter)
  let left = rect.left
  if (left + dropdownWidth > window.innerWidth - VIEWPORT_PAD) {
    left = rect.right - dropdownWidth
  }
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - dropdownWidth - VIEWPORT_PAD))
  dropdownPosition.value = { top, left, scrollbarGutter }
}

function openDropdown () {
  if (props.disabled || props.pending || !props.statuses.length) {
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

function selectStatus (status: OrgWorkspaceStatus) {
  if (props.pending) {
    return
  }
  if (isSelected(status)) {
    closeDropdown()
    return
  }
  emit('select', status)
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
<style lang="scss" scoped src="~/assets/styles/components/workspace/WorkspaceStatusSelect.scss"></style>
