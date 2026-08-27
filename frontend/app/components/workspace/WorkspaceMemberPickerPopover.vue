<template>
  <PopoverShell
    ref="shellRef"
    shell-class="workspace-member-picker-popover popover popover--members"
    header-class="popover-header--labels"
    :style="style"
    :title="title"
    :aria-label="title"
    :close-disabled="disabled"
    @close="$emit('close')"
  >
    <input
      v-model="searchQueryModel"
      type="search"
      class="label-search-input"
      :placeholder="searchPlaceholder"
      :disabled="disabled"
      @click.stop
    />
    <div class="popover-scroll">
      <template v-if="filteredAssignedMembers.length">
        <p class="label-section-heading">{{ assignedSectionHeading }}</p>
        <ul class="label-picker-list">
          <li v-for="member in filteredAssignedMembers" :key="`assigned-${member.id}`">
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
      <template v-if="filteredUnassignedMembers.length">
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
      <p v-if="!orgMembers.length" class="empty-text label-picker-empty">
        {{ emptyMembersMessage }}
      </p>
      <p
        v-else-if="!filteredAssignedMembers.length && !filteredUnassignedMembers.length"
        class="empty-text label-picker-empty"
      >
        該当するユーザーがいません。
      </p>
      <p v-if="error" class="err">{{ error }}</p>
    </div>
  </PopoverShell>
</template>

<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { memberDisplayName } from '../../composables/useMemberDisplay'
import type { TaskFormMember } from '../../composables/useTaskFormHelpers'
import PopoverShell from '../ui/PopoverShell.vue'

const props = withDefaults(defineProps<{
  assignees: TaskFormMember[]
  orgMembers: TaskFormMember[]
  searchQuery?: string
  disabled?: boolean
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
  error: null,
  emptyMembersMessage: '組織ユーザーがいません。',
  title: '担当者',
  assignedSectionHeading: '担当者',
  unassignedSectionHeading: 'ユーザー',
  searchPlaceholder: 'ユーザーを検索...',
})

const emit = defineEmits<{
  close: []
  'toggle-member': [member: TaskFormMember]
  'update:searchQuery': [query: string]
}>()

const shellRef = ref<{ rootRef: HTMLElement | null } | null>(null)

const searchQueryModel = computed({
  get: () => props.searchQuery,
  set: (query: string) => emit('update:searchQuery', query),
})

function memberMatchesSearch (member: TaskFormMember, query: string): boolean {
  if (!query) return true
  const name = memberDisplayName(member).toLowerCase()
  const email = (member.email ?? '').toLowerCase()
  return name.includes(query) || email.includes(query)
}

const filteredAssignedMembers = computed(() => {
  const query = props.searchQuery.trim().toLowerCase()
  return props.assignees.filter(member => memberMatchesSearch(member, query))
})

const filteredUnassignedMembers = computed(() => {
  const query = props.searchQuery.trim().toLowerCase()
  const assignedIds = new Set(props.assignees.map(member => member.id))
  return props.orgMembers.filter(
    member => !assignedIds.has(member.id) && memberMatchesSearch(member, query),
  )
})

defineExpose({
  get rootRef () {
    return shellRef.value?.rootRef ?? null
  },
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/workspace/WorkspaceMemberPickerPopover.scss"></style>
