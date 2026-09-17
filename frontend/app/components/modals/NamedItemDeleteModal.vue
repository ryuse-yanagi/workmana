<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    :aria-label="title"
    :close-disabled="loading"
    width="min(480px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
    @ctrl-enter="submit"
  >
    <div class="named-item-delete-modal-body">
      <p class="named-item-delete-modal-message">
        この{{ itemKind }}を削除します。よろしいですか？
        <template v-if="displayedItemName">
          <span class="named-item-delete-modal-target">【対象】<br>{{ displayedItemName }}</span>
        </template>
        <template v-if="extraMessage"><br>※{{ extraMessage }}</template>
      </p>
      <p v-if="submitError" class="err">{{ submitError }}</p>
      <ModalFooterActions
        confirm-text="削除"
        confirm-variant="danger"
        :disabled="loading"
        @cancel="close"
        @confirm="submit"
      />
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
/** 開いた時点の名称を保持し、削除中に親の itemName が消えてもモーダル高さが崩れないようにする */
const displayedItemName = ref('')
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      submitError.value = null
      displayedItemName.value = (props.itemName ?? '').trim()
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
