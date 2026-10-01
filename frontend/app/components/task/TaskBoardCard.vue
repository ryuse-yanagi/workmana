<template>
  <article
    class="task-card"
    :class="{
      'task-card--parent': task.is_parent_task,
      'task-card--interactive': interactive,
    }"
    :role="interactive ? 'button' : undefined"
    :tabindex="interactive ? 0 : undefined"
    :aria-label="ariaLabel"
    @click="onActivate"
    @keydown.enter.prevent="onActivate"
    @keydown.space.prevent="onActivate"
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
        <p
          v-if="taskCardProgressRateText"
          class="task-card-meta__row"
        >
          <ChartNoAxesColumnIncreasing :size="12" :stroke-width="2.25" aria-hidden="true" />
          <span>{{ taskCardProgressRateText }}</span>
        </p>
      </div>
      <div v-if="task.assignees?.length" class="task-card-footer">
        <TaskCardAssignees :assignees="task.assignees ?? []" />
      </div>
    </div>
  </article>
</template>
<script setup lang="ts">
import { CalendarDays, ChartNoAxesColumnIncreasing, Clock } from 'lucide-vue-next'
import TaskCardAssignees from './TaskCardAssignees.vue'
import TaskCardLabelList from './TaskCardLabelList.vue'
import {
  formatTaskCardDateRange,
  formatTaskCardEffort,
  formatTaskCardProgressRate,
  hasTaskCardScheduleMeta,
  resolveParentTaskTitle,
  type TaskCardParentLookup,
} from '../../composables/task/useTaskCardMeta'
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
  progress_rate?: number | string | null
  labels?: TaskBoardCardLabel[]
  assignees?: TaskBoardCardMember[]
  parent_task_id?: number | null
  parent_task_title?: string | null
  is_parent_task?: boolean
}
const props = withDefaults(defineProps<{
  task: TaskBoardCardTask
  parentTasks?: TaskCardParentLookup[]
  interactive?: boolean
  ariaLabel?: string
}>(), {
  parentTasks: () => [],
  interactive: false,
  ariaLabel: undefined,
})
const emit = defineEmits<{
  select: []
}>()
const parentTaskTitle = computed(() => resolveParentTaskTitle(
  props.task,
  props.parentTasks,
))
const taskCardDateRange = computed(() => formatTaskCardDateRange(
  props.task.start_date,
  props.task.due_date,
))
const taskCardEffortText = computed(() => formatTaskCardEffort(props.task))
const taskCardProgressRateText = computed(() => formatTaskCardProgressRate(props.task))
function onActivate () {
  if (!props.interactive) {
    return
  }
  emit('select')
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/task/TaskBoardCard.scss"></style>
