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
        <ListTree
          v-if="task.is_parent_task"
          :size="15"
          :stroke-width="2.25"
          class="task-title-row__icon"
          aria-hidden="true"
        />
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
import { CalendarDays, Clock, ListTree } from 'lucide-vue-next'
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
  effort_value?: number | string | null
  effort_unit?: string | null
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
<style lang="scss" scoped>
.task-card {
  position: relative;
  width: var(--task-card-width, 246px);
  max-width: var(--task-card-width, 246px);
  min-width: var(--task-card-width, 246px);
  box-sizing: border-box;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid mixin.$border;
  border-radius: 10px;
  padding: 6.3px 7.7px;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.06);
}
.task-parent-title {
  margin: 0 0 2.8px;
  max-width: 100%;
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1.25;
  color: mixin.$main;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.task-title-row {
  display: flex;
  align-items: flex-start;
  gap: 4.2px;
  margin: 0;
  min-width: 0;
}
.task-title-row__icon {
  flex-shrink: 0;
  margin-top: 1.68px;
  color: mixin.$main;
}
.task-title {
  margin: 0;
  flex: 1;
  min-width: 0;
  max-width: 100%;
  font-size: 12.25px;
  font-weight: 700;
  line-height: 1.25;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.task-card--parent .task-title {
  font-size: 13.125px;
  color: mixin.$main;
}
.task-card-meta {
  display: flex;
  flex-direction: column;
  gap: 2.52px;
  margin-top: 4.9px;
}
.task-card-meta__row {
  display: inline-flex;
  align-items: center;
  gap: 3.92px;
  margin: 0;
  font-size: 10.08px;
  font-weight: 600;
  line-height: 1.25;
  color: #64748b;
}
.task-card-meta__row span {
  min-width: 0;
}
.task-card-body {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
}
.task-card-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 4.2px;
}
.task-card-members {
  display: flex;
  align-items: center;
}
</style>
