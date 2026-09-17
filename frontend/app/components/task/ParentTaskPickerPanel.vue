<template>
  <div class="popover-scroll">
    <p v-if="loading" class="empty-text parent-task-loading">
      読み込み中...
    </p>
    <ul
      v-else-if="parents.length || showUnsetOption"
      class="parent-task-picker-list"
    >
      <li v-if="showUnsetOption">
        <button
          type="button"
          class="parent-task-picker-row"
          :class="{ 'parent-task-picker-row--selected': selectedParentId === null }"
          :disabled="clearDisabled"
          @click.stop="emit('clear')"
        >
          <input
            type="radio"
            class="parent-task-picker-radio"
            :checked="selectedParentId === null"
            tabindex="-1"
            aria-hidden="true"
          >
          <span class="parent-task-picker-label">未設定</span>
        </button>
      </li>
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
          <input
            type="radio"
            class="parent-task-picker-radio"
            :checked="selectedParentId === parent.id"
            tabindex="-1"
            aria-hidden="true"
          >
          <span class="parent-task-picker-label">{{ parent.title }}</span>
        </button>
      </li>
    </ul>
    <p v-if="!loading && !parents.length && !showUnsetOption" class="empty-text parent-task-empty">
      該当する親タスクがありません
    </p>
    <p v-if="error" class="err">{{ error }}</p>
  </div>
</template>
<script setup lang="ts">
export type ParentTaskPickerOption = {
  id: number
  title: string
}
withDefaults(defineProps<{
  loading?: boolean
  parents: ParentTaskPickerOption[]
  selectedParentId: number | null
  clearDisabled?: boolean
  showUnsetOption?: boolean
  error?: string | null
}>(), {
  loading: false,
  clearDisabled: false,
  showUnsetOption: false,
  error: null,
})
const emit = defineEmits<{
  select: [number]
  clear: []
}>()
</script>
<style lang="scss" scoped src="~/assets/styles/components/task/ParentTaskPickerPanel.scss"></style>
