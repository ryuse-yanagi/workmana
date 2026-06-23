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
      <div v-if="parentTask" class="task-hierarchy__row task-hierarchy__row--parent">
        <span class="task-hierarchy__row-icon" aria-hidden="true">
          <ListTree :size="16" :stroke-width="2.25" />
        </span>
        <span class="task-hierarchy__row-title">{{ parentTask.title }}</span>
        <span class="task-hierarchy__badge task-hierarchy__badge--parent">親タスク</span>
      </div>
      <p v-else class="task-hierarchy__empty">親タスクはありません</p>
    </div>

    <div class="task-hierarchy__group">
      <p class="task-hierarchy__group-label">子タスク ({{ childTasks.length }})</p>
      <ul v-if="childTasks.length" class="task-hierarchy__child-list">
        <li
          v-for="child in childTasks"
          :key="child.id"
          class="task-hierarchy__row task-hierarchy__row--child"
        >
          <span class="task-hierarchy__row-title">{{ child.title }}</span>
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
            :class="`task-hierarchy__badge--${listBadgeTone(child.list_name)}`"
          >
            {{ child.list_name }}
          </span>
        </li>
      </ul>
      <p v-else class="task-hierarchy__empty">子タスクはありません</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { CalendarDays, ListTree, Network } from 'lucide-vue-next'

export type TaskHierarchyParent = {
  id: number
  title: string
}

export type TaskHierarchyChild = {
  id: number
  title: string
  due_date?: string | null
  list_name?: string | null
}

defineProps<{
  parentTask: TaskHierarchyParent | null
  childTasks: TaskHierarchyChild[]
}>()

function formatHierarchyDueDate (value: string | null | undefined): string {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) {
    return ''
  }
  return `${match[1]}/${match[2]}/${match[3]}`
}

function listBadgeTone (name: string): 'done' | 'progress' | 'default' {
  const normalized = name.trim()
  if (normalized.includes('完了')) {
    return 'done'
  }
  if (normalized.includes('進行')) {
    return 'progress'
  }
  return 'default'
}
</script>

<style scoped lang="scss">
.task-hierarchy {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 0.85rem 0;
}

.task-hierarchy__header {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
}

.task-hierarchy__icon {
  display: inline-flex;
  color: #334155;
}

.task-hierarchy__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.3;
}

.task-hierarchy__group {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.task-hierarchy__group-label {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: #64748b;
}

.task-hierarchy__empty {
  margin: 0;
  border: 1px dashed mixin.$border;
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  font-size: 0.82rem;
  color: #94a3b8;
  background: #f8fafc;
}

.task-hierarchy__child-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.task-hierarchy__row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  border: 1px solid mixin.$border;
  border-radius: 10px;
  background: #fff;
  padding: 0.65rem 0.75rem;
}

.task-hierarchy__row--parent {
  gap: 0.5rem;
}

.task-hierarchy__row--child {
  justify-content: flex-start;
}

.task-hierarchy__row-icon {
  display: inline-flex;
  flex-shrink: 0;
  color: #334155;
}

.task-hierarchy__row-title {
  min-width: 0;
  flex: 1 1 auto;
  font-size: 0.88rem;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-hierarchy__date {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex-shrink: 0;
  font-size: 0.78rem;
  color: #64748b;
  white-space: nowrap;
}

.task-hierarchy__badge {
  flex-shrink: 0;
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 1.55rem;
  padding: 0 0.55rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.task-hierarchy__badge--parent,
.task-hierarchy__badge--progress {
  background: #dbeafe;
  color: #1d4ed8;
}

.task-hierarchy__badge--done {
  background: #dcfce7;
  color: #15803d;
}

.task-hierarchy__badge--default {
  background: #f1f5f9;
  color: #475569;
}
</style>
