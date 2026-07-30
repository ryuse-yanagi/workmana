<template>
  <NamedItemDeleteModal
    ref="innerRef"
    :model-value="modelValue"
    title="資料の削除"
    item-kind="資料"
    :item-name="documentName"
    :loading="loading"
    @update:model-value="emit('update:modelValue', $event)"
    @confirm="emit('confirm')"
  />
</template>
<script setup lang="ts">
import NamedItemDeleteModal from './NamedItemDeleteModal.vue'

withDefaults(defineProps<{
  modelValue: boolean
  documentName?: string
  loading?: boolean
}>(), {
  documentName: '',
  loading: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  confirm: []
}>()
const innerRef = ref<{ setSubmitError: (message: string) => void } | null>(null)
function setSubmitError (message: string) {
  innerRef.value?.setSubmitError(message)
}
defineExpose({ setSubmitError })
</script>
