<template>
  <article
    class="task-card"
    :class="{ 'task-card--parent': task.is_parent_task }"
  >
    <div class="task-card-body">
      <TaskCardLabelList
        v-if="task.labels?.length"
        :labels="task.labels"
      />
      <p
        v-if="parentTaskTitle"
        class="task-parent-title"
      >
        {{ parentTaskTitle }}
      </p>
      <p class="task-title-row">
        <span class="task-title">{{ task.title }}</span>
      </p>
      <div
        v-if="hasTaskCardScheduleMeta(task)"
        class="task-card-meta"
      >
        <p
          v-if="taskCardDateRange"
          class="task-card-meta__row"
        >
          <CalendarDays :size="12" :stroke-width="2.25" aria-hidden="true" />
          <span>{{ taskCardDateRange }}</span>
        </p>
        <p
          v-if="taskCardEffortText"
          class="task-card-meta__row"
        >
          <Clock :size="12" :stroke-width="2.25" aria-hidden="true" />
          <span>{{ taskCardEffortText }}</span>
        </p>
      </div>
      <div v-if="visibleAssignees.length" class="task-card-footer">
        <div class="task-card-members" aria-label="担当者">
          <MemberAvatar
            v-for="member in visibleAssignees"
            :key="member.id"
            :member="member"
            size="xs"
            :title="memberDisplayName(member)"
          />
        </div>
      </div>
    </div>
  </article>
</template>
<script setup lang="ts">
import { CalendarDays, Clock } from 'lucide-vue-next'
import TaskCardLabelList from './TaskCardLabelList.vue'
import { memberDisplayName } from '../../composables/useMemberDisplay'
import {
  formatTaskCardDateRange,
  formatTaskCardEffort,
  hasTaskCardScheduleMeta,
  resolveParentTaskTitle,
  type TaskCardParentLookup,
} from '../../composables/useTaskCardMeta'
export type TaskBoardCardLabel = { id: number; name: string; color: string }
export type TaskBoardCardMember = {
  id: number
  name: string | null
  email: string | null
  avatar_url: string | null
}
export type TaskBoardCardTask = {
  id: number
  title: string
  start_date?: string | null
  due_date?: string | null
  effort_hours?: number | string | null
  labels?: TaskBoardCardLabel[]
  assignees?: TaskBoardCardMember[]
  parent_task_id?: number | null
  parent_task_title?: string | null
  is_parent_task?: boolean
}
const props = defineProps<{
  task: TaskBoardCardTask
  parentTasks?: TaskCardParentLookup[]
}>()
const parentTaskTitle = computed(() => resolveParentTaskTitle(
  props.task,
  props.parentTasks ?? [],
))
const taskCardDateRange = computed(() => formatTaskCardDateRange(
  props.task.start_date,
  props.task.due_date,
))
const taskCardEffortText = computed(() => formatTaskCardEffort(props.task))
const visibleAssignees = computed(() => (props.task.assignees ?? []).slice(0, 3))
</script>
<style lang="scss" scoped src="~/assets/styles/components/task/TaskBoardCard.scss"></style>
