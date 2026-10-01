<template>
  <DefaultNamedColorItemFormModal
    ref="innerRef"
    :model-value="modelValue"
    :mode="mode"
    name-label="リスト名"
    name-placeholder="リスト名を入力..."
    add-title="リストの追加"
    edit-title="リストの編集"
    :initial-values="initialValues"
    :loading="loading"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="emit('submit', $event)"
  />
</template>
<script setup lang="ts">
import DefaultNamedColorItemFormModal from '../shared/DefaultNamedColorItemFormModal.vue'

withDefaults(defineProps<{
  modelValue: boolean
  mode?: 'add' | 'edit'
  initialValues?: { name: string; color_index: number } | null
  loading?: boolean
}>(), {
  mode: 'add',
  initialValues: null,
  loading: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{ name: string; color_index: number }]
}>()
const innerRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
function setSubmitError (message: string) {
  innerRef.value?.setSubmitError(message)
}
defineExpose({ setSubmitError })
</script>
