<template>
  <div
    class="workspace-assignee-select"
    :class="{ 'workspace-assignee-select--readonly': readonly }"
    data-workspace-assignee-select-root
    @pointerdown.stop
    @pointerup.stop
  >
    <button
      v-if="!readonly"
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
    <div
      v-else
      class="workspace-assignee-select__btn"
      :class="{ 'workspace-assignee-select__btn--empty': assigneeCount === 0 }"
      :aria-label="triggerAriaLabel"
    >
      {{ assigneeCount > 0 ? `計${assigneeCount}名` : '未設定' }}
    </div>
  </div>
  <Teleport v-if="!readonly" to="body">
    <WorkspaceMemberPickerPopover
      v-if="isOpen"
      ref="dropdownRef"
      :style="dropdownStyle"
      :assignees="assignees"
      :org-members="orgMembers"
      :title="roleLabel"
      :assigned-section-heading="roleLabel"
      unassigned-section-heading="ユーザー"
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
import { useExclusivePopover } from '../../composables/useExclusivePopover'
import { popoverScrollbarGutterStyle, popoverWidthExtraForGutter, resolvePopoverScrollbarGutter } from '../../utils/popoverScrollbar'
import type { TaskFormMember } from '../../composables/useTaskFormHelpers'
import WorkspaceMemberPickerPopover from './WorkspaceMemberPickerPopover.vue'

const props = withDefaults(defineProps<{
  assignees: TaskFormMember[]
  orgMembers: TaskFormMember[]
  disabled?: boolean
  pending?: boolean
  readonly?: boolean
  error?: string | null
  /** 担当者など、ピッカー見出しと aria-label 用 */
  roleLabel?: string
}>(), {
  disabled: false,
  pending: false,
  readonly: false,
  error: null,
  roleLabel: '担当者',
})

const emit = defineEmits<{
  change: [assigneeIds: number[]]
}>()

const DROPDOWN_GAP = 6
const VIEWPORT_PAD = 8
const DROPDOWN_VERTICAL_PADDING = 12
const DROPDOWN_WIDTH = 273
const DROPDOWN_MIN_HEIGHT = 120

const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<{ rootRef: HTMLElement | null } | null>(null)
const isOpen = ref(false)
const dropdownPosition = ref<{ top: number; left: number; maxHeight: number; scrollbarGutter: number } | null>(null)
const memberSearchQuery = ref('')

const assigneeCount = computed(() => props.assignees.length)

const triggerAriaLabel = computed(() => {
  if (assigneeCount.value > 0) {
    return `${props.roleLabel} ${assigneeCount.value} 名。クリックして変更`
  }
  return `${props.roleLabel}未設定。クリックして選択`
})

const dropdownStyle = computed(() => {
  if (!dropdownPosition.value) {
    return {
      visibility: 'hidden',
    } as Record<string, string>
  }
  const { top, left, maxHeight, scrollbarGutter } = dropdownPosition.value
  return {
    top: `${top}px`,
    left: `${left}px`,
    maxHeight: `${maxHeight}px`,
    visibility: 'visible',
    ...popoverScrollbarGutterStyle(scrollbarGutter),
  }
})

function closeDropdown () {
  isOpen.value = false
  dropdownPosition.value = null
  memberSearchQuery.value = ''
}

function positionDropdown () {
  const trigger = triggerRef.value
  if (!trigger || !import.meta.client) {
    dropdownPosition.value = null
    return
  }
  const rect = trigger.getBoundingClientRect()
  const popover = dropdownRef.value?.rootRef ?? null
  const top = Math.max(VIEWPORT_PAD, rect.top)
  const maxHeight = Math.max(
    DROPDOWN_MIN_HEIGHT,
    window.innerHeight - VIEWPORT_PAD - top - DROPDOWN_VERTICAL_PADDING,
  )
  const scrollbarGutter = popover
    ? resolvePopoverScrollbarGutter(popover, maxHeight)
    : 0
  const dropdownWidth = (popover?.offsetWidth ?? DROPDOWN_WIDTH) + popoverWidthExtraForGutter(scrollbarGutter)
  let left = rect.right + DROPDOWN_GAP
  if (left + dropdownWidth > window.innerWidth - VIEWPORT_PAD) {
    left = rect.left - dropdownWidth - DROPDOWN_GAP
  }
  left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - dropdownWidth - VIEWPORT_PAD))

  dropdownPosition.value = { top, left, maxHeight, scrollbarGutter }
}

function openDropdown () {
  if (props.readonly || props.disabled || props.pending) {
    return
  }
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
  unbindGlobalListeners()
})

useDropdownEscapeClose(isOpen, closeDropdown)
useExclusivePopover(isOpen, closeDropdown)
</script>

<style lang="scss" scoped src="~/assets/styles/components/workspace/WorkspaceAssigneeSelect.scss"></style>
