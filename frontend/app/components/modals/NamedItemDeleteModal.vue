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
        この{{ itemKind }}を削除します。よろしいですか？
        <template v-if="itemName"><br>【対象】 {{ itemName }}</template>
        <template v-if="extraMessage"><br>※{{ extraMessage }}</template>
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
  /** 確認文の後に出す追記（例: 配下ラベルも削除される旨） */
  extraMessage?: string
  loading?: boolean
}>(), {
  itemName: '',
  extraMessage: '',
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
