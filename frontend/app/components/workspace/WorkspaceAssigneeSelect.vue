<template>
  <div
    class="workspace-assignee-select"
    data-workspace-assignee-select-root
    @pointerdown.stop
    @pointerup.stop
  >
    <button
      ref="triggerRef"
      type="button"
      class="workspace-assignee-select__btn"
      :class="{ 'workspace-assignee-select__btn--empty': assigneeCount === 0 }"
      :aria-expanded="isOpen"
      aria-haspopup="dialog"
      :aria-label="triggerAriaLabel"
      :disabled="disabled || pending"
      @click.stop="toggleDropdown"
    >
      {{ assigneeCount > 0 ? `計${assigneeCount}名` : '未設定' }}
    </button>
  </div>
  <Teleport to="body">
    <WorkspaceMemberPickerPopover
      v-if="isOpen"
      ref="dropdownRef"
      :style="dropdownStyle"
      :assignees="assignees"
      :org-members="orgMembers"
      v-model:search-query="memberSearchQuery"
      :disabled="disabled || pending"
      :error="error"
      @close="closeDropdown"
      @toggle-member="toggleMember"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { useDropdownEscapeClose } from '../../composables/useDropdownEscapeClose'
import type { TaskFormMember } from '../../composables/useTaskFormHelpers'
import WorkspaceMemberPickerPopover from './WorkspaceMemberPickerPopover.vue'

const props = withDefaults(defineProps<{
  assignees: TaskFormMember[]
  orgMembers: TaskFormMember[]
  disabled?: boolean
  pending?: boolean
  error?: string | null
}>(), {
  disabled: false,
  pending: false,
  error: null,
})

const emit = defineEmits<{
  change: [assigneeIds: number[]]
}>()

const DROPDOWN_GAP = 6
const VIEWPORT_PAD = 8
const DROPDOWN_VERTICAL_PADDING = 12
const DROPDOWN_WIDTH = 273
const DROPDOWN_MIN_HEIGHT = 120
let activeCloseDropdown: (() => void) | null = null

const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<{ rootRef: HTMLElement | null } | null>(null)
const isOpen = ref(false)
const dropdownPosition = ref<{ top: number; left: number; maxHeight: number } | null>(null)
const memberSearchQuery = ref('')

const assigneeCount = computed(() => props.assignees.length)

const triggerAriaLabel = computed(() => {
  if (assigneeCount.value > 0) {
    return `担当者 ${assigneeCount.value} 名。クリックして変更`
  }
  return '担当者未設定。クリックして選択'
})

const dropdownStyle = computed(() => {
  if (!dropdownPosition.value) {
    return {
      visibility: 'hidden',
    } as Record<string, string>
  }
  const { top, left, maxHeight } = dropdownPosition.value
  return {
    top: `${top}px`,
    left: `${left}px`,
    maxHeight: `${maxHeight}px`,
    visibility: 'visible',
  }
})

function closeDropdown () {
  isOpen.value = false
  dropdownPosition.value = null
  memberSearchQuery.value = ''
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
    return
  }
  const rect = trigger.getBoundingClientRect()
  const dropdownWidth = dropdownRef.value?.rootRef?.offsetWidth ?? DROPDOWN_WIDTH
  let left = rect.right + DROPDOWN_GAP
  if (left + dropdownWidth > window.innerWidth - VIEWPORT_PAD) {
    left = rect.left - dropdownWidth - DROPDOWN_GAP
  }
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - dropdownWidth - VIEWPORT_PAD))

  const top = Math.max(VIEWPORT_PAD, rect.top)
  const maxHeight = Math.max(
    DROPDOWN_MIN_HEIGHT,
    window.innerHeight - VIEWPORT_PAD - top - DROPDOWN_VERTICAL_PADDING,
  )

  dropdownPosition.value = { top, left, maxHeight }
}

function openDropdown () {
  if (props.disabled || props.pending) {
    return
  }
  claimActiveDropdown()
  memberSearchQuery.value = ''
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

function toggleMember (member: TaskFormMember) {
  if (props.disabled || props.pending) {
    return
  }
  const currentIds = props.assignees.map(item => item.id)
  const exists = currentIds.includes(member.id)
  const nextIds = exists
    ? currentIds.filter(id => id !== member.id)
    : [...currentIds, member.id]
  emit('change', nextIds)
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
  const dropdownEl = dropdownRef.value?.rootRef
  if (dropdownEl?.contains(target)) {
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
.workspace-assignee-select {
  display: inline-flex;
}
.workspace-assignee-select__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 80px;
  height: 30px;
  min-width: 80px;
  max-width: 80px;
  padding: 0;
  border: 1px solid #000;
  border-radius: 999px;
  background: #f0f0f0;
  color: #000;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.04em;
  cursor: pointer;
  white-space: nowrap;
}
.workspace-assignee-select__btn--empty {
  border-color: #cbd5e1;
  background: #f1f5f9;
  color: #64748b;
}
.workspace-assignee-select__btn:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.workspace-assignee-select__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
