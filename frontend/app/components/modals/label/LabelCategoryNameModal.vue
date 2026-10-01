<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    :aria-label="title"
    :close-disabled="loading"
    focus-primary-input-on-open
    width="min(448px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
    @ctrl-enter="submit"
  >
    <form class="category-name-modal-body" novalidate @submit.prevent>
      <label class="field">
        <span>カテゴリ名</span>
        <input
          v-model.trim="name"
          type="text"
          :maxlength="LABEL_CATEGORY_NAME_MAX_LENGTH"
          placeholder="カテゴリ名を入力..."
          :disabled="loading"
          @keydown.enter.exact.prevent
        />
        <p v-if="nameError" class="field-error">{{ nameError }}</p>
      </label>
      <p v-if="submitError" class="err">{{ submitError }}</p>
      <ModalFooterActions
        :confirm-text="submitLabel"
        :disabled="loading"
        @cancel="close"
        @confirm="submit"
      />
    </form>
  </BaseModal>
</template>
<script setup lang="ts">
import { LABEL_CATEGORY_NAME_MAX_LENGTH } from '../../../constants/fieldLengthLimits'
import { requiredTextFieldError } from '../../../utils/shared/formValidation'
const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  submitLabel?: string
  initialName?: string
  loading?: boolean
}>(), {
  submitLabel: '保存',
  initialName: '',
  loading: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [string]
}>()
const name = ref('')
const nameError = ref<string | null>(null)
const submitError = ref<string | null>(null)
watch(
  () => [props.modelValue, props.initialName] as const,
  ([open, initialName]) => {
    if (open) {
      name.value = initialName
      nameError.value = null
      submitError.value = null
    }
  },
  { immediate: true },
)
watch(name, () => {
  if (nameError.value) {
    nameError.value = null
  }
  if (submitError.value) {
    submitError.value = null
  }
})
function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}
function submit () {
  if (props.loading) return
  const validationError = requiredTextFieldError(name.value, 'カテゴリ名', LABEL_CATEGORY_NAME_MAX_LENGTH)
  if (validationError) {
    nameError.value = validationError
    return
  }
  const trimmed = name.value.trim()
  nameError.value = null
  submitError.value = null
  emit('submit', trimmed)
}
function setSubmitError (message: string) {
  submitError.value = message
}
defineExpose({ setSubmitError })
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/label/LabelCategoryNameModal.scss"></style>
