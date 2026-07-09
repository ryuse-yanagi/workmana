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
<style lang="scss" scoped>
.popover-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.parent-task-loading {
  margin: 8px;
}
.parent-task-empty {
  margin: 0;
  padding: 28px 8px;
  text-align: center;
}
.parent-task-picker-list {
  list-style: none;
  margin: 0;
  padding: 6.4px 8px 3.2px;
  display: flex;
  flex-direction: column;
  gap: 2.8px;
}
.popover-field-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 0;
  padding: 4.8px 8px 8px;
}
.popover-field-clear-btn {
  min-width: 48px;
  height: 24px;
  padding: 0 8px;
  border: 1px solid mixin.$border-light;
  border-radius: 6px;
  background: #fff;
  color: mixin.$text-sub;
  font: inherit;
  font-size: 10.4px;
  font-weight: 600;
  cursor: pointer;
}
.popover-field-clear-btn:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.04);
  color: mixin.$text;
}
.popover-field-clear-btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.parent-task-picker-row {
  @include mixin.picker-checkbox-row;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  border-radius: 8px;
  padding: 6.4px 4.8px;
  background: transparent;
  text-align: left;
}
.parent-task-picker-row:hover {
  background: #f8fafc;
}
.parent-task-picker-row--selected {
  background: color-mix(in srgb, mixin.$main 8%, mixin.$white);
}
.parent-task-picker-radio {
  width: 14px;
  height: 14px;
  border: 2px solid #8590a2;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}
.parent-task-picker-radio--checked {
  border-color: mixin.$main;
  background: mixin.$main;
}
.parent-task-picker-radio--checked::after {
  content: '✓';
  font-size: 8px;
  font-weight: 800;
  line-height: 1;
  color: mixin.$white;
}
.parent-task-picker-label {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  color: mixin.$text;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.empty-text {
  margin: 0;
  font-size: 11.2px;
  color: #94a3b8;
}
.err {
  margin: 6.4px 8px;
  color: #b91c1c;
  font-weight: 700;
  font-size: 12.04px;
}
</style>
