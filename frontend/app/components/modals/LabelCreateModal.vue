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
    <form class="label-create-modal-body" @keydown="onFormKeydown">
      <label class="field">
        <span>ラベル名</span>
        <input
          v-model.trim="name"
          type="text"
          :maxlength="LABEL_NAME_MAX_LENGTH"
          required
          placeholder="ラベル名を入力してください"
          :disabled="loading"
          @keydown.enter.exact.prevent
        />
        <p v-if="nameError" class="field-error">{{ nameError }}</p>
      </label>
      <ColorPresetPicker v-model="color" :disabled="loading" />
      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">キャンセル</button>
        <button type="button" class="primary-btn primary-btn--pill" :disabled="loading" @click="submit">作成</button>
      </div>
    </form>
  </BaseModal>
</template>
<script setup lang="ts">
import { DEFAULT_COLOR_PRESET, colorPresetIndexFromHex } from '../../constants/colorPresets'
import { LABEL_NAME_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { isCtrlEnterKeydown } from '../../utils/uiInteraction'
import { requiredTextFieldError } from '../../utils/formValidation'
const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  loading?: boolean
}>(), {
  loading: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{ name: string; color_index: number }]
}>()
const defaultColor = DEFAULT_COLOR_PRESET
const name = ref('')
const color = ref<string>(defaultColor)
const nameError = ref<string | null>(null)
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      name.value = ''
      color.value = defaultColor
      nameError.value = null
    }
  },
)
watch(name, () => {
  if (nameError.value) {
    nameError.value = null
  }
})
function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}
function submit () {
  if (props.loading) return
  const validationError = requiredTextFieldError(name.value, 'ラベル名を入力してください')
  if (validationError) {
    nameError.value = validationError
    return
  }
  const trimmed = name.value.trim()
  nameError.value = null
  emit('submit', { name: trimmed, color_index: colorPresetIndexFromHex(color.value) })
}
function onFormKeydown (event: KeyboardEvent) {
  if (!isCtrlEnterKeydown(event)) return
  event.preventDefault()
  submit()
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/LabelCreateModal.scss"></style>
