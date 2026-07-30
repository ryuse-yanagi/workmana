<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    :aria-label="title"
    :close-disabled="loading"
    width="min(496px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="named-item-delete-modal-body">
      <p class="named-item-delete-modal-message">
        <template v-if="itemName">
          「{{ itemName }}」を削除しますか？<br>
          この操作は取り消せません。
        </template>
        <template v-else>
          この{{ itemKind }}を削除しますか？<br>
          この操作は取り消せません。
        </template>
      </p>
      <p v-if="submitError" class="err">{{ submitError }}</p>
      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">
          キャンセル
        </button>
        <button type="button" class="danger-btn danger-btn--pill" :disabled="loading" @click="submit">
          削除
        </button>
      </div>
    </div>
  </BaseModal>
</template>
<script setup lang="ts">
import { syncAppLoadingCursor } from '../../composables/useAppLoadingCursor'
import BaseModal from './BaseModal.vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  itemKind: string
  itemName?: string
  loading?: boolean
}>(), {
  itemName: '',
  loading: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  confirm: []
}>()
const submitError = ref<string | null>(null)
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      submitError.value = null
    }
  },
)
function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}
function submit () {
  if (props.loading) return
  submitError.value = null
  emit('confirm')
}
function setSubmitError (message: string) {
  submitError.value = message
}
syncAppLoadingCursor(() => props.loading)
defineExpose({ setSubmitError })
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/NamedItemDeleteModal.scss"></style>
