<template>
  <NamedItemDeleteModal
    ref="innerRef"
    :model-value="modelValue"
    title="ユーザーの削除"
    item-kind="ユーザー"
    :item-name="memberName"
    :loading="loading"
    @update:model-value="emit('update:modelValue', $event)"
    @confirm="emit('confirm')"
  />
</template>
<script setup lang="ts">
import NamedItemDeleteModal from './NamedItemDeleteModal.vue'

withDefaults(defineProps<{
  modelValue: boolean
  memberName?: string
  loading?: boolean
}>(), {
  memberName: '',
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
