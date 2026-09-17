<template>
  <div class="subheader-edit-with-divider">
    <template v-if="!editing">
      <button
        type="button"
        class="subheader-secondary-btn subheader-secondary-btn--edit"
        :title="editTitle"
        :disabled="disabled"
        @click="emit('edit')"
      >
        <Pencil
          :size="18"
          :stroke-width="2.25"
          aria-hidden="true"
        />
        {{ editLabel }}
      </button>
    </template>
    <template v-else>
      <button
        type="button"
        class="subheader-secondary-btn subheader-secondary-btn--cancel"
        :disabled="disabled"
        @click="emit('cancel')"
      >
        {{ cancelLabel }}
      </button>
      <button
        type="button"
        class="subheader-secondary-btn subheader-secondary-btn--save"
        :disabled="disabled"
        @click="emit('save')"
      >
        <Save
          :size="18"
          :stroke-width="2.25"
          aria-hidden="true"
        />
        {{ saveLabel }}
      </button>
    </template>
    <span
      v-if="showDivider"
      class="subheader-actions__divider"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
import { Pencil, Save } from 'lucide-vue-next'

withDefaults(defineProps<{
  editing: boolean
  disabled?: boolean
  editLabel?: string
  cancelLabel?: string
  saveLabel?: string
  editTitle?: string
  showDivider?: boolean
}>(), {
  disabled: false,
  editLabel: '編集',
  cancelLabel: 'キャンセル',
  saveLabel: '保存',
  editTitle: undefined,
  showDivider: false,
})

const emit = defineEmits<{
  edit: []
  cancel: []
  save: []
}>()
</script>
