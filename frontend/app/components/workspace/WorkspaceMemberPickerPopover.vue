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
                <span class="member-picker-name">{{ memberDisplayName(member) }}</span>
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
                <span class="member-picker-name">{{ memberDisplayName(member) }}</span>
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

<style lang="scss" scoped>
.workspace-member-picker-popover.popover {
  position: fixed;
  margin: 0;
  z-index: 120;
  width: min(273px, calc(100vw - 21px));
  min-height: 0;
  max-height: inherit;
  overflow: hidden;
  padding: 0;
  gap: 0;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.2);
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
}
:deep(.popover-shell__header) {
  flex-shrink: 0;
}
.workspace-member-picker-popover.popover .empty-text,
.workspace-member-picker-popover.popover .err {
  margin-left: 9.1px;
  margin-right: 9.1px;
}
.popover-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
}
:deep(.popover-header--labels) {
  position: relative;
  justify-content: center;
  padding: 9.1px 28px 7.7px;
  border-bottom: 1px solid #dfe1e6;
}
:deep(.popover-header--labels .popover-shell__close) {
  position: absolute;
  right: 6.3px;
  top: 50%;
  transform: translateY(-50%);
}
.label-search-input {
  display: block;
  width: calc(100% - 18.2px);
  margin: 7.7px 9.1px 6.3px;
  box-sizing: border-box;
  border: 1px solid mixin.$border;
  border-radius: 6px;
  padding: 6.3px 7.7px;
  font-size: 12.32px;
  color: #172b4d;
  flex-shrink: 0;
}
.label-search-input:focus {
  @include mixin.input-focus-ring;
}
.label-section-heading {
  margin: 2.1px 9.1px 4.9px;
  font-size: 10.92px;
  font-weight: 700;
  color: #5e6c84;
}
.label-picker-list {
  list-style: none;
  margin: 0;
  padding: 0 7px 9.1px;
  display: flex;
  flex-direction: column;
  gap: 2.8px;
}
.label-picker-row {
  @include mixin.picker-checkbox-row;
  display: flex;
  align-items: center;
  gap: 5.6px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 2.1px 0;
  text-align: left;
}
.label-picker-row.member-picker-row--workspace {
  border-radius: 4px;
  padding: 0 7.7px;
  transition: background 0.12s ease;
}
.label-picker-bar {
  flex: 1;
  min-height: 28px;
  border-radius: 4px;
  padding: 5.32px 7.7px;
  font-size: 12.32px;
  font-weight: 700;
  line-height: 1.25;
  display: flex;
  align-items: center;
}
.member-picker-bar {
  background: #fff;
  color: #172b4d;
  gap: 7px;
  transition: background 0.12s ease;
}
.member-picker-row--workspace .member-picker-bar {
  flex: 1;
  background: transparent;
  padding-left: 0;
  padding-right: 0;
}
.member-picker-check {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 2.1px;
  color: #2563eb;
}
.member-picker-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.label-picker-empty {
  padding: 0 9.1px 10.5px;
}
.err {
  margin: 0 9.1px 10.5px;
  color: mixin.$danger;
  font-weight: 700;
  font-size: 12.04px;
}
.member-picker-avatar :deep(.member-avatar) {
  flex-shrink: 0;
}
button:disabled:not(.label-picker-row) {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
