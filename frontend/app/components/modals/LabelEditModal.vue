<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    :aria-label="title"
    :close-disabled="loading"
    focus-primary-input-on-open
    width="min(512px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="label-edit-modal-body" @keydown="onFormKeydown">
      <label class="field">
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
      </label>
      <ColorPresetPicker v-model="color" :disabled="loading" />
      <p v-if="submitError" class="err">{{ submitError }}</p>
      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">キャンセル</button>
        <button type="button" class="primary-btn primary-btn--pill" :disabled="loading" @click="submit">保存</button>
      </div>
    </form>
  </BaseModal>
</template>
<script setup lang="ts">
import { DEFAULT_COLOR_PRESET, colorAtPresetIndex, colorPresetIndexFromHex } from '../../constants/colorPresets'
import { LABEL_NAME_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { isCtrlEnterKeydown } from '../../utils/uiInteraction'
import { requiredTextFieldError } from '../../utils/formValidation'
const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  initialName?: string
  initialColorIndex?: number
  loading?: boolean
}>(), {
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
watch(
  () => [props.modelValue, props.initialName, props.initialColorIndex] as const,
  ([open, initialName, initialColorIndex]) => {
    if (!open) return
    name.value = initialName
    color.value = initialColorIndex === undefined
      ? DEFAULT_COLOR_PRESET
      : colorAtPresetIndex(initialColorIndex)
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
function onFormKeydown (event: KeyboardEvent) {
  if (!isCtrlEnterKeydown(event)) return
  event.preventDefault()
  submit()
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/LabelEditModal.scss"></style>
