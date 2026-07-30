<template>
  <section class="task-hierarchy">
    <header class="task-hierarchy__header">
      <span class="task-hierarchy__icon" aria-hidden="true">
        <Network :size="20" :stroke-width="2.25" />
      </span>
      <h3 class="task-hierarchy__title">タスクの親子関係</h3>
    </header>
    <div class="task-hierarchy__group">
      <p class="task-hierarchy__group-label">親タスク</p>
      <button
        v-if="parentTask"
        type="button"
        class="task-hierarchy__row task-hierarchy__row--parent"
        :class="{ 'task-hierarchy__row--current': isCurrentTask(parentTask.id) }"
        :disabled="isCurrentTask(parentTask.id)"
        :aria-current="isCurrentTask(parentTask.id) ? 'page' : undefined"
        @click="onSelect(parentTask.id)"
      >
        <span class="task-hierarchy__row-icon" aria-hidden="true">
          <ListTree :size="16" :stroke-width="2.25" />
        </span>
        <span class="task-hierarchy__row-main">
          <span class="task-hierarchy__row-title">{{ parentTask.title }}</span>
          <span
            v-if="isCurrentTask(parentTask.id)"
            class="task-hierarchy__current-label"
          >現在</span>
        </span>
        <span
          v-if="parentTask.list_name"
          class="task-hierarchy__badge"
          :style="listBadgeStyle(parentTask.list_id, parentTask.list_color)"
        >
          {{ parentTask.list_name }}
        </span>
      </button>
      <p v-else class="task-hierarchy__empty">親タスクはありません</p>
    </div>
    <div class="task-hierarchy__group">
      <p class="task-hierarchy__group-label">子タスク ({{ childTasks.length }})</p>
      <ul v-if="childTasks.length" class="task-hierarchy__child-list">
        <li
          v-for="child in childTasks"
          :key="child.id"
        >
          <button
            type="button"
            class="task-hierarchy__row task-hierarchy__row--child"
            :class="{ 'task-hierarchy__row--current': isCurrentTask(child.id) }"
            :disabled="isCurrentTask(child.id)"
            :aria-current="isCurrentTask(child.id) ? 'page' : undefined"
            @click="onSelect(child.id)"
          >
            <span class="task-hierarchy__row-main">
              <span class="task-hierarchy__row-title">{{ child.title }}</span>
              <span
                v-if="isCurrentTask(child.id)"
                class="task-hierarchy__current-label"
              >現在</span>
            </span>
            <span
              v-if="formatHierarchyDueDate(child.due_date)"
              class="task-hierarchy__date"
            >
              <CalendarDays :size="14" :stroke-width="2.25" aria-hidden="true" />
              <span>{{ formatHierarchyDueDate(child.due_date) }}</span>
            </span>
            <span
              v-if="child.list_name"
              class="task-hierarchy__badge"
              :style="listBadgeStyle(child.list_id, child.list_color)"
            >
              {{ child.list_name }}
            </span>
          </button>
        </li>
      </ul>
      <p v-else class="task-hierarchy__empty">子タスクはありません</p>
    </div>
  </section>
</template>
<script setup lang="ts">
import { CalendarDays, ListTree, Network } from 'lucide-vue-next'
import {
  standardColorEmphasisText,
  standardColorSurfaceBackground,
} from '../../constants/colorPresets'
import {
  resolveListColor,
  type WorkspaceListOption,
} from '../../composables/useTaskPopoverEditor'

export type TaskHierarchyParent = {
  id: number
  title: string
  list_id?: number | null
  list_name?: string | null
  list_color?: string | null
}
export type TaskHierarchyChild = {
  id: number
  title: string
  due_date?: string | null
  list_id?: number | null
  list_name?: string | null
  list_color?: string | null
}

const props = withDefaults(defineProps<{
  parentTask: TaskHierarchyParent | null
  childTasks: TaskHierarchyChild[]
  currentTaskId?: number | null
  workspaceLists?: WorkspaceListOption[]
}>(), {
  currentTaskId: null,
  workspaceLists: () => [],
})

const emit = defineEmits<{
  select: [taskId: number]
}>()

function isCurrentTask (taskId: number) {
  return props.currentTaskId === taskId
}

function onSelect (taskId: number) {
  if (isCurrentTask(taskId)) {
    return
  }
  emit('select', taskId)
}

function formatHierarchyDueDate (value: string | null | undefined): string {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) {
    return ''
  }
  return `${match[1]}/${match[2]}/${match[3]}`
}

function listBadgeStyle (
  listId: number | null | undefined,
  listColor: string | null | undefined,
) {
  const color = listColor
    ?? resolveListColor(listId, props.workspaceLists)
    ?? null
  if (!color) {
    return undefined
  }
  return {
    backgroundColor: standardColorSurfaceBackground(color),
    color: standardColorEmphasisText(color),
  }
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/task/TaskDetailHierarchyBlock.scss"></style>
