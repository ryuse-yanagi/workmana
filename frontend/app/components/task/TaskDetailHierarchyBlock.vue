<template>
  <section
    class="task-hierarchy"
    :class="{ 'task-hierarchy--compact': !showHeader }"
  >
    <header v-if="showHeader" class="task-hierarchy__header">
      <span class="task-hierarchy__icon" aria-hidden="true">
        <Network :size="20" :stroke-width="2.25" />
      </span>
      <h3 class="task-hierarchy__title">タスク階層</h3>
    </header>
    <div class="task-hierarchy__group">
      <p class="task-hierarchy__group-label">親タスク</p>
      <TaskBoardCard
        v-if="parentTask"
        :task="parentTask"
        :parent-tasks="parentLookup"
        interactive
        :aria-label="`${parentTask.title}の詳細を開く`"
        @select="onSelect(parentTask.id)"
      />
      <p v-else class="task-hierarchy__empty">親タスクはありません</p>
    </div>
    <div
      v-if="childTasks.length"
      class="task-hierarchy__group"
    >
      <p class="task-hierarchy__group-label">子タスク ({{ childTasks.length }})</p>
      <ul class="task-hierarchy__child-list">
        <li
          v-for="child in childTasks"
          :key="child.id"
        >
          <TaskBoardCard
            :task="child"
            :parent-tasks="parentLookup"
            interactive
            :aria-label="`${child.title}の詳細を開く`"
            @select="onSelect(child.id)"
          />
        </li>
      </ul>
    </div>
  </section>
</template>
<script setup lang="ts">
import { Network } from 'lucide-vue-next'
import TaskBoardCard, { type TaskBoardCardTask } from './TaskBoardCard.vue'
import type { TaskCardParentLookup } from '../../composables/task/useTaskCardMeta'
import type { WorkspaceListOption } from '../../composables/task/useTaskPopoverEditor'

export type TaskHierarchyParent = TaskBoardCardTask & {
  list_id?: number | null
  list_name?: string | null
  list_color?: string | null
}
export type TaskHierarchyChild = TaskBoardCardTask & {
  list_id?: number | null
  list_name?: string | null
  list_color?: string | null
}

const props = withDefaults(defineProps<{
  parentTask: TaskHierarchyParent | null
  childTasks: TaskHierarchyChild[]
  workspaceLists?: WorkspaceListOption[]
  /** false のとき見出しを出さない（ポップオーバー内など） */
  showHeader?: boolean
}>(), {
  workspaceLists: () => [],
  showHeader: true,
})

const emit = defineEmits<{
  select: [taskId: number]
}>()

const parentLookup = computed((): TaskCardParentLookup[] => {
  const rows: TaskCardParentLookup[] = []
  if (props.parentTask) {
    rows.push({
      id: props.parentTask.id,
      title: props.parentTask.title,
    })
  }
  for (const child of props.childTasks) {
    if (child.parent_task_title && child.parent_task_id != null) {
      rows.push({
        id: child.parent_task_id,
        title: child.parent_task_title,
      })
    }
  }
  return rows
})

function onSelect (taskId: number) {
  emit('select', taskId)
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/task/TaskDetailHierarchyBlock.scss"></style>
