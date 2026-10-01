<script setup lang="ts">
import BoardFilterSection from './BoardFilterSection.vue'
import MemberAvatar from './MemberAvatar.vue'
import { memberDisplayName, type MemberLike } from '../../composables/member/useMemberDisplay'
import { labelBarTextColor } from '../../composables/task/useTaskFormHelpers'
import type { ScheduleFilterKey } from '../../utils/task/workspaceTaskFilters'

export type FilterLabelCategory = {
  id: number | string
  name: string
  labels: Array<{ id: number; name: string; color: string }>
}

export type FilterNamedColorItem = {
  name: string
  color: string
}

export type BoardFilterSectionsOpen = {
  assignee: boolean
  label: boolean
  schedule?: boolean
  status?: boolean
}

const props = withDefaults(defineProps<{
  sectionsOpen: BoardFilterSectionsOpen
  assigneeSearch: string
  labelSearch: string
  members: MemberLike[]
  labelCategories: FilterLabelCategory[]
  isAssigneeSelected: (key: string) => boolean
  isLabelSelected: (key: string) => boolean
  /** 担当者セクション見出し（一覧では「メンバー」） */
  assigneeTitle?: string
  assigneeSearchPlaceholder?: string
  assigneeEmptyText?: string
  /** 第三セクション: schedule | status | none */
  tertiary?: 'schedule' | 'status' | 'none'
  scheduleOptions?: Array<{ key: ScheduleFilterKey; label: string }>
  isScheduleSelected?: (key: ScheduleFilterKey) => boolean
  statuses?: FilterNamedColorItem[]
  isStatusSelected?: (key: string) => boolean
}>(), {
  assigneeTitle: '担当者',
  assigneeSearchPlaceholder: '担当者を検索...',
  assigneeEmptyText: '担当者がありません',
  tertiary: 'schedule',
  scheduleOptions: () => [],
  statuses: () => [],
  isScheduleSelected: () => false,
  isStatusSelected: () => false,
})

const emit = defineEmits<{
  'update:sectionsOpen': [BoardFilterSectionsOpen]
  'update:assigneeSearch': [string]
  'update:labelSearch': [string]
  'assignee-change': [key: string, event: Event]
  'label-toggle': [key: string]
  'schedule-toggle': [key: ScheduleFilterKey]
  'status-toggle': [key: string]
  'section-toggle': []
}>()

const assigneeOpen = computed({
  get: () => props.sectionsOpen.assignee,
  set: (open: boolean) => {
    emit('update:sectionsOpen', { ...props.sectionsOpen, assignee: open })
  },
})
const labelOpen = computed({
  get: () => props.sectionsOpen.label,
  set: (open: boolean) => {
    emit('update:sectionsOpen', { ...props.sectionsOpen, label: open })
  },
})
const scheduleOpen = computed({
  get: () => props.sectionsOpen.schedule ?? true,
  set: (open: boolean) => {
    emit('update:sectionsOpen', { ...props.sectionsOpen, schedule: open })
  },
})
const statusOpen = computed({
  get: () => props.sectionsOpen.status ?? true,
  set: (open: boolean) => {
    emit('update:sectionsOpen', { ...props.sectionsOpen, status: open })
  },
})

const assigneeSearchModel = computed({
  get: () => props.assigneeSearch,
  set: (value: string) => emit('update:assigneeSearch', value),
})
const labelSearchModel = computed({
  get: () => props.labelSearch,
  set: (value: string) => emit('update:labelSearch', value),
})

function onSectionToggle () {
  emit('section-toggle')
}
</script>

<template>
  <BoardFilterSection
    v-model:open="assigneeOpen"
    :title="assigneeTitle"
    @toggle="onSectionToggle"
  >
    <ul class="board-filter-options">
      <li>
        <label class="board-filter-option">
          <input
            type="checkbox"
            :checked="isAssigneeSelected('unset')"
            @change="emit('assignee-change', 'unset', $event)"
          >
          <span>未設定</span>
        </label>
      </li>
    </ul>
    <input
      v-model="assigneeSearchModel"
      type="search"
      class="board-filter-search"
      :placeholder="assigneeSearchPlaceholder"
      :aria-label="assigneeSearchPlaceholder.replace(/\.\.\.$/, '')"
      @click.stop
    >
    <ul class="board-filter-options">
      <li
        v-for="member in members"
        :key="member.id"
      >
        <label class="board-filter-option">
          <input
            type="checkbox"
            :checked="isAssigneeSelected(String(member.id))"
            @change="emit('assignee-change', String(member.id), $event)"
          >
          <MemberAvatar
            :member="member"
            size="xs"
            class="board-filter-option-avatar"
          />
          <span>{{ memberDisplayName(member) }}</span>
        </label>
      </li>
    </ul>
    <p
      v-if="assigneeSearch.trim() && !members.length"
      class="board-filter-empty"
    >{{ assigneeEmptyText }}</p>
  </BoardFilterSection>

  <BoardFilterSection
    v-model:open="labelOpen"
    title="ラベル"
    @toggle="onSectionToggle"
  >
    <ul class="board-filter-options">
      <li>
        <label class="board-filter-option">
          <input
            type="checkbox"
            :checked="isLabelSelected('unset')"
            @change="emit('label-toggle', 'unset')"
          >
          <span>未設定</span>
        </label>
      </li>
    </ul>
    <input
      v-model="labelSearchModel"
      type="search"
      class="board-filter-search"
      placeholder="ラベルを検索..."
      aria-label="ラベルを検索"
      @click.stop
    >
    <div
      v-for="category in labelCategories"
      :key="category.id"
      class="board-filter-label-group"
    >
      <p class="board-filter-category-title">{{ category.name }}</p>
      <ul class="board-filter-options">
        <li
          v-for="label in category.labels"
          :key="label.id"
        >
          <label class="board-filter-option">
            <input
              type="checkbox"
              :checked="isLabelSelected(String(label.id))"
              @change="emit('label-toggle', String(label.id))"
            >
            <span
              class="board-filter-label-bar"
              :style="{
                backgroundColor: label.color,
                color: labelBarTextColor(label.color),
              }"
            >{{ label.name }}</span>
          </label>
        </li>
      </ul>
    </div>
    <p
      v-if="labelSearch.trim() && !labelCategories.length"
      class="board-filter-empty"
    >ラベルがありません</p>
  </BoardFilterSection>

  <BoardFilterSection
    v-if="tertiary === 'schedule'"
    v-model:open="scheduleOpen"
    title="日程"
    @toggle="onSectionToggle"
  >
    <ul class="board-filter-options">
      <li
        v-for="option in scheduleOptions"
        :key="option.key"
      >
        <label class="board-filter-option">
          <input
            type="checkbox"
            :checked="isScheduleSelected(option.key)"
            @change="emit('schedule-toggle', option.key)"
          >
          <span>{{ option.label }}</span>
        </label>
      </li>
    </ul>
  </BoardFilterSection>

  <BoardFilterSection
    v-else-if="tertiary === 'status'"
    v-model:open="statusOpen"
    title="ステータス"
    @toggle="onSectionToggle"
  >
    <ul class="board-filter-options">
      <li>
        <label class="board-filter-option">
          <input
            type="checkbox"
            :checked="isStatusSelected('unset')"
            @change="emit('status-toggle', 'unset')"
          >
          <span>未設定</span>
        </label>
      </li>
    </ul>
    <div class="board-filter-label-group">
      <ul class="board-filter-options">
        <li
          v-for="status in statuses"
          :key="status.name"
        >
          <label class="board-filter-option">
            <input
              type="checkbox"
              :checked="isStatusSelected(status.name)"
              @change="emit('status-toggle', status.name)"
            >
            <span
              class="board-filter-label-bar"
              :style="{
                backgroundColor: status.color,
                color: labelBarTextColor(status.color),
              }"
            >{{ status.name }}</span>
          </label>
        </li>
      </ul>
    </div>
  </BoardFilterSection>
</template>
