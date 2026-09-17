<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    :aria-label="title"
    :close-disabled="loading"
    focus-primary-input-on-open
    width="min(560px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
    @ctrl-enter="submit"
  >
    <form class="label-form-modal-body" @submit.prevent>
      <div class="field">
        <span>ラベル名</span>
        <input
          v-model.trim="name"
          type="text"
          :maxlength="LABEL_NAME_MAX_LENGTH"
          placeholder="ラベル名を入力..."
          :disabled="loading"
          @keydown.enter.exact.prevent
        />
        <p v-if="nameError" class="field-error">{{ nameError }}</p>
      </div>
      <ColorPresetPicker v-model="color" :disabled="loading" />
      <p v-if="submitError" class="err">{{ submitError }}</p>
      <ModalFooterActions
        :confirm-text="confirmText"
        :disabled="loading"
        @cancel="close"
        @confirm="submit"
      />
    </form>
  </BaseModal>
</template>
<script setup lang="ts">
import { DEFAULT_COLOR_PRESET, colorAtPresetIndex, colorPresetIndexFromHex } from '../../constants/colorPresets'
import { LABEL_NAME_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { requiredTextFieldError } from '../../utils/formValidation'
const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  mode?: 'add' | 'edit'
  initialName?: string
  initialColorIndex?: number
  loading?: boolean
}>(), {
  mode: 'add',
  initialName: '',
  initialColorIndex: undefined,
  loading: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{ name: string; color_index: number }]
}>()
const name = ref('')
const color = ref<string>(DEFAULT_COLOR_PRESET)
const nameError = ref<string | null>(null)
const submitError = ref<string | null>(null)
const confirmText = computed(() => (
  props.mode === 'add' ? '追加' : '保存'
))
watch(
  () => [props.modelValue, props.mode, props.initialName, props.initialColorIndex] as const,
  ([open]) => {
    if (!open) return
    if (props.mode === 'edit') {
      name.value = props.initialName
      color.value = props.initialColorIndex === undefined
        ? DEFAULT_COLOR_PRESET
        : colorAtPresetIndex(props.initialColorIndex)
    } else {
      name.value = ''
      color.value = DEFAULT_COLOR_PRESET
    }
    nameError.value = null
    submitError.value = null
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
  const validationError = requiredTextFieldError(name.value, 'ラベル名', LABEL_NAME_MAX_LENGTH)
  if (validationError) {
    nameError.value = validationError
    return
  }
  const trimmed = name.value.trim()
  nameError.value = null
  submitError.value = null
  emit('submit', { name: trimmed, color_index: colorPresetIndexFromHex(color.value) })
}
function setSubmitError (message: string) {
  submitError.value = message
}
defineExpose({ setSubmitError })
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/LabelFormModal.scss"></style>
