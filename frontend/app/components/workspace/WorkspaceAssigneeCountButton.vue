<template>
  <div
    class="workspace-assignee-count"
    data-workspace-assignee-count-root
    @pointerdown.stop
    @pointerup.stop
  >
    <button
      ref="triggerRef"
      type="button"
      class="workspace-assignee-count__btn"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      :aria-label="`担当者 ${assigneeCount} 名を表示`"
      @click.stop="toggleDropdown"
    >
      計{{ assigneeCount }}名
    </button>
  </div>
  <Teleport to="body">
    <div
      v-if="isOpen"
      ref="dropdownRef"
      class="workspace-assignee-count__dropdown"
      role="listbox"
      aria-label="担当者一覧"
      :style="dropdownStyle"
    >
      <ul
        class="workspace-assignee-count__list"
        :style="listStyle"
      >
        <li
          v-for="member in assignees"
          :key="member.id"
          class="workspace-assignee-count__item"
          role="option"
          :aria-selected="false"
        >
          <MemberAvatar
            :member="member"
            size="xs"
            class="workspace-assignee-count__avatar"
          />
          <span class="workspace-assignee-count__name">{{ memberDisplayName(member) }}</span>
        </li>
      </ul>
    </div>
  </Teleport>
</template>
<script setup lang="ts">
import { memberDisplayName } from '../../composables/useMemberDisplay'
import { useDropdownEscapeClose } from '../../composables/useDropdownEscapeClose'
import type { TaskFormMember } from '../../composables/useTaskFormHelpers'
const props = defineProps<{
  assignees: TaskFormMember[]
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
const assigneeCount = computed(() => props.assignees.length)
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
  const dropdownWidth = dropdownRef.value?.offsetWidth ?? 184
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
.workspace-assignee-count {
  display: inline-flex;
}
.workspace-assignee-count__btn {
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
.workspace-assignee-count__btn:hover {
  background: #e8e8e8;
}
.workspace-assignee-count__btn:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.workspace-assignee-count__dropdown {
  position: fixed;
  z-index: 120;
  box-sizing: border-box;
  min-width: 184px;
  max-width: 256px;
  padding: 6px 0;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
}
.workspace-assignee-count__list {
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}
.workspace-assignee-count__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  min-width: 0;
}
.workspace-assignee-count__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #172b4d;
}
.workspace-assignee-count__avatar :deep(.member-avatar) {
  flex-shrink: 0;
}
</style>
