<template>
  <PopoverShell
    ref="shellRef"
    shell-class="workspace-member-picker-popover popover popover--members"
    header-class="popover-header--labels"
    :style="style"
    :title="title"
    :aria-label="title"
    :close-disabled="disabled"
    :show-clear="canClear"
    :clear-disabled="disabled || readonly"
    @close="$emit('close')"
    @clear="$emit('clear')"
  >
    <input
      ref="searchInputRef"
      v-model="searchQueryModel"
      type="search"
      class="label-search-input"
      :placeholder="searchPlaceholder"
      :disabled="disabled"
      @click.stop
    />
    <div class="popover-scroll">
      <template v-if="filteredAssignedMembers.length">
        <p v-if="!readonly" class="label-section-heading">{{ assignedSectionHeading }}</p>
        <ul class="label-picker-list">
          <li v-for="member in filteredAssignedMembers" :key="`assigned-${member.id}`">
            <div
              v-if="readonly"
              class="label-picker-row member-picker-row--workspace member-picker-row--readonly"
            >
              <span class="label-picker-bar member-picker-bar">
                <MemberAvatar
                  :member="member"
                  size="xs"
                  class="member-picker-avatar"
                />
                <span
                  class="member-picker-name"
                  :title="memberDisplayName(member)"
                >{{ memberDisplayName(member) }}</span>
              </span>
            </div>
            <button
              v-else
              type="button"
              class="label-picker-row member-picker-row--workspace"
              :disabled="disabled"
              @click.stop="$emit('toggle-member', member)"
            >
              <span class="label-picker-bar member-picker-bar">
                <MemberAvatar
                  :member="member"
                  size="xs"
                  class="member-picker-avatar"
                />
                <span
                  class="member-picker-name"
                  :title="memberDisplayName(member)"
                >{{ memberDisplayName(member) }}</span>
              </span>
              <Check
                :size="16"
                :stroke-width="2.75"
                class="member-picker-check"
                aria-hidden="true"
              />
            </button>
          </li>
        </ul>
      </template>
      <template v-if="!readonly && filteredUnassignedMembers.length">
        <p class="label-section-heading">{{ unassignedSectionHeading }}</p>
        <ul class="label-picker-list">
          <li v-for="member in filteredUnassignedMembers" :key="`member-${member.id}`">
            <button
              type="button"
              class="label-picker-row member-picker-row--workspace"
              :disabled="disabled"
              @click.stop="$emit('toggle-member', member)"
            >
              <span class="label-picker-bar member-picker-bar">
                <MemberAvatar
                  :member="member"
                  size="xs"
                  class="member-picker-avatar"
                />
                <span
                  class="member-picker-name"
                  :title="memberDisplayName(member)"
                >{{ memberDisplayName(member) }}</span>
              </span>
            </button>
          </li>
        </ul>
      </template>
      <p v-if="!orgMembers.length && !filteredAssignedMembers.length" class="empty-text label-picker-empty">
        {{ emptyMembersMessage }}
      </p>
      <p
        v-else-if="!hasVisibleMembers"
        class="empty-text label-picker-empty"
      >
        {{ emptyFilterMessage }}
      </p>
      <p v-if="error" class="err">{{ error }}</p>
    </div>
  </PopoverShell>
</template>

<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { memberDisplayName, memberMatchesSearchQuery } from '../../composables/member/useMemberDisplay'
import type { TaskFormMember } from '../../composables/task/useTaskFormHelpers'
import PopoverShell from '../ui/PopoverShell.vue'
import { schedulePopoverInputFocus } from '../../utils/ui/schedulePopoverInputFocus'

const props = withDefaults(defineProps<{
  assignees: TaskFormMember[]
  orgMembers: TaskFormMember[]
  searchQuery?: string
  disabled?: boolean
  readonly?: boolean
  canClear?: boolean
  error?: string | null
  style?: Record<string, string>
  emptyMembersMessage?: string
  title?: string
  assignedSectionHeading?: string
  unassignedSectionHeading?: string
  searchPlaceholder?: string
}>(), {
  searchQuery: '',
  disabled: false,
  readonly: false,
  canClear: false,
  error: null,
  emptyMembersMessage: '組織ユーザーがいません',
  title: '担当者',
  assignedSectionHeading: '担当者',
  unassignedSectionHeading: 'メンバー',
  searchPlaceholder: 'ユーザーを検索...',
})

const emit = defineEmits<{
  close: []
  clear: []
  'toggle-member': [member: TaskFormMember]
  'update:searchQuery': [query: string]
}>()

const shellRef = ref<{ rootRef: HTMLElement | null } | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

const searchQueryModel = computed({
  get: () => props.searchQuery,
  set: (query: string) => emit('update:searchQuery', query),
})

const filteredAssignedMembers = computed(() => {
  const query = props.searchQuery
  return props.assignees.filter(member => memberMatchesSearchQuery(member, query))
})

const filteredUnassignedMembers = computed(() => {
  const query = props.searchQuery
  const assignedIds = new Set(props.assignees.map(member => member.id))
  return props.orgMembers.filter(
    member => !assignedIds.has(member.id) && memberMatchesSearchQuery(member, query),
  )
})

const hasVisibleMembers = computed(() => {
  if (filteredAssignedMembers.value.length > 0) {
    return true
  }
  return !props.readonly && filteredUnassignedMembers.value.length > 0
})

const emptyFilterMessage = computed(() => {
  if (props.searchQuery.trim()) {
    return 'ユーザーがいません'
  }
  return props.readonly ? 'メンバーがいません' : 'ユーザーがいません'
})

onMounted(() => {
  if (props.readonly) {
    return
  }
  schedulePopoverInputFocus(() => searchInputRef.value)
})

onUnmounted(() => {
  if (!props.searchQuery) return
  emit('update:searchQuery', '')
})

defineExpose({
  get rootRef () {
    return shellRef.value?.rootRef ?? null
  },
  get inputRef () {
    return searchInputRef.value
  },
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/workspace/WorkspaceMemberPickerPopover.scss"></style>
