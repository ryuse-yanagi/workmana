<template>
  <LabelFormModal
    ref="innerRef"
    mode="add"
    :model-value="modelValue"
    :title="title"
    :loading="loading"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="emit('submit', $event)"
  />
</template>
<script setup lang="ts">
import LabelFormModal from './LabelFormModal.vue'

withDefaults(defineProps<{
  modelValue: boolean
  title: string
  loading?: boolean
}>(), {
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
