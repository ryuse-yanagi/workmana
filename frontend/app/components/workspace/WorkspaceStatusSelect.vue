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
      aria-haspopup="listbox"
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
      role="listbox"
      aria-label="ステータスを選択"
      :style="dropdownStyle"
    >
      <ul
        class="workspace-status-select__list"
        :style="listStyle"
      >
        <li
          v-for="status in statuses"
          :key="status.name"
          class="workspace-status-select__item"
          role="option"
          :aria-selected="isSelected(status)"
        >
          <button
            type="button"
            class="workspace-status-select__option"
            :class="{ 'workspace-status-select__option--selected': isSelected(status) }"
            :disabled="pending"
            @click.stop="selectStatus(status)"
          >
            <LabelStrip
              :label="statusLabel(status)"
              :text-color="statusTextColor(status.color)"
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
const DROPDOWN_VERTICAL_PADDING = 12
let activeCloseDropdown: (() => void) | null = null

const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const dropdownPosition = ref<{ top: number; left: number } | null>(null)
const listMaxHeight = ref<number | null>(null)

const currentStatus = computed(() => props.status ?? null)
const triggerAriaLabel = computed(() => {
  if (currentStatus.value) {
    return `ステータス ${currentStatus.value.name}。クリックして変更`
  }
  return 'ステータス未設定。クリックして選択'
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

function statusLabel (status: OrgWorkspaceStatus) {
  return {
    ...status,
    color: standardColorSurfaceBackground(status.color),
  }
}

function statusTextColor (color: string) {
  return standardColorEmphasisText(color)
}

function isSelected (status: OrgWorkspaceStatus) {
  return currentStatus.value?.name === status.name
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
  if (props.disabled || props.pending || !props.statuses.length) {
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
.workspace-status-select {
  display: inline-flex;
  max-width: 100%;
}
.workspace-status-select__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  line-height: 1;
}
.workspace-status-select__trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.workspace-status-select__trigger:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
  border-radius: 999px;
}
.workspace-status-select__empty {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 96px;
  height: 30px;
  min-width: 96px;
  max-width: 96px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}
.workspace-status-select__trigger :deep(.label-strip) {
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
.workspace-status-select__dropdown {
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
.workspace-status-select__list {
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.workspace-status-select__item {
  margin: 0;
  padding: 0;
}
.workspace-status-select__option {
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
.workspace-status-select__option:hover:not(:disabled) {
  background: #f1f5f9;
}
.workspace-status-select__option--selected {
  background: #f1f5f9;
}
.workspace-status-select__option:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.workspace-status-select__option :deep(.label-strip) {
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
