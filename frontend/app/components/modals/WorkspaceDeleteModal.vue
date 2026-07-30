<template>
  <NamedItemDeleteModal
    ref="innerRef"
    :model-value="modelValue"
    title="スペースの削除"
    item-kind="スペース"
    :item-name="workspaceName"
    :loading="loading"
    @update:model-value="emit('update:modelValue', $event)"
    @confirm="emit('confirm')"
  />
</template>
<script setup lang="ts">
import NamedItemDeleteModal from './NamedItemDeleteModal.vue'

withDefaults(defineProps<{
  modelValue: boolean
  workspaceName?: string
  loading?: boolean
}>(), {
  workspaceName: '',
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
