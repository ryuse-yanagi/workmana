<template>
  <div class="popover-scroll">
    <p v-if="loading" class="empty-text parent-task-loading">
      読み込み中...
    </p>
    <ul v-else-if="parents.length" class="parent-task-picker-list">
      <li
        v-for="parent in parents"
        :key="parent.id"
      >
        <button
          type="button"
          class="parent-task-picker-row"
          :class="{ 'parent-task-picker-row--selected': selectedParentId === parent.id }"
          @click.stop="emit('select', parent.id)"
        >
          <span
            class="parent-task-picker-radio"
            :class="{ 'parent-task-picker-radio--checked': selectedParentId === parent.id }"
            aria-hidden="true"
          />
          <span class="parent-task-picker-label">{{ parent.title }}</span>
        </button>
      </li>
    </ul>
    <p v-if="!loading && !parents.length" class="empty-text parent-task-empty">
      親タスクがありません。
    </p>
    <div v-if="!loading && parents.length" class="popover-field-actions">
      <button
        type="button"
        class="popover-field-clear-btn"
        :disabled="clearDisabled || selectedParentId === null"
        @click.stop="emit('clear')"
      >
        解除
      </button>
    </div>
    <p v-if="error" class="err">{{ error }}</p>
  </div>
</template>
<script setup lang="ts">
export type ParentTaskPickerOption = {
  id: number
  title: string
}
defineProps<{
  loading?: boolean
  parents: ParentTaskPickerOption[]
  selectedParentId: number | null
  clearDisabled?: boolean
  error?: string | null
}>()
const emit = defineEmits<{
  select: [number]
  clear: []
}>()
</script>
<style lang="scss" scoped src="~/assets/styles/components/task/ParentTaskPickerPanel.scss"></style>
