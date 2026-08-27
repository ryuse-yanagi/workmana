<template>
  <NamedItemDeleteModal
    ref="innerRef"
    :model-value="modelValue"
    title="カテゴリの削除"
    item-kind="カテゴリ"
    :item-name="categoryName"
    extra-message="配下のラベルも削除されます。"
    :loading="loading"
    @update:model-value="emit('update:modelValue', $event)"
    @confirm="emit('confirm')"
  />
</template>
<script setup lang="ts">
import NamedItemDeleteModal from './NamedItemDeleteModal.vue'

withDefaults(defineProps<{
  modelValue: boolean
  categoryName?: string
  loading?: boolean
}>(), {
  categoryName: '',
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
