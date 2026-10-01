<template>
  <BaseModal
    :model-value="modelValue"
    :title="modalTitle"
    :aria-label="modalTitle"
    :close-disabled="loading"
    focus-primary-input-on-open
    :width="COLOR_PRESET_PICKER_MODAL_WIDTH"
    @update:model-value="emit('update:modelValue', $event)"
    @ctrl-enter="submit"
  >
    <form class="named-color-item-form-modal-body" @submit.prevent>
      <label class="field">
        <span>{{ nameLabel }}</span>
        <input
          v-model.trim="name"
          type="text"
          :maxlength="resolvedNameMaxLength"
          :placeholder="namePlaceholder"
          :disabled="loading"
          @keydown.enter.exact.prevent
        />
        <p v-if="nameError" class="field-error">{{ nameError }}</p>
      </label>
      <ColorPresetPicker
        v-model="color"
        :presets="STANDARD_COLORS"
        :grid-columns="5"
        :disabled="loading"
      />
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
import ColorPresetPicker from '../../ui/ColorPresetPicker.vue'
import {
  COLOR_PRESET_PICKER_MODAL_WIDTH,
  DEFAULT_STANDARD_COLOR,
  STANDARD_COLORS,
  standardColorAtIndex,
  standardColorIndexFromHex,
} from '../../../constants/colorPresets'
import { DEFAULT_NAMED_ITEM_NAME_MAX_LENGTH } from '../../../constants/fieldLengthLimits'
import { requiredTextFieldError } from '../../../utils/shared/formValidation'
const props = withDefaults(defineProps<{
  modelValue: boolean
  mode?: 'add' | 'edit' | 'create'
  nameLabel: string
  namePlaceholder: string
  addTitle?: string
  createTitle?: string
  editTitle: string
  nameMaxLength?: number
  initialValues?: { name: string; color_index: number } | null
  loading?: boolean
}>(), {
  mode: 'add',
  addTitle: undefined,
  createTitle: undefined,
  nameMaxLength: undefined,
  initialValues: null,
  loading: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{ name: string; color_index: number }]
}>()
const name = ref('')
const color = ref<string>(DEFAULT_STANDARD_COLOR)
const submitError = ref<string | null>(null)
const nameError = ref<string | null>(null)
const isEdit = computed(() => props.mode === 'edit')
const modalTitle = computed(() => (
  isEdit.value
    ? props.editTitle
    : (props.addTitle ?? props.createTitle ?? '追加')
))
const submitLabel = computed(() => (
  isEdit.value ? '保存' : '追加'
))
const resolvedNameMaxLength = computed(() => props.nameMaxLength ?? DEFAULT_NAMED_ITEM_NAME_MAX_LENGTH)
watch(
  () => [props.modelValue, props.mode, props.initialValues] as const,
  ([open]) => {
    if (!open) return
    if (isEdit.value && props.initialValues) {
      name.value = props.initialValues.name
      color.value = standardColorAtIndex(props.initialValues.color_index)
    } else {
      name.value = ''
      color.value = props.initialValues
        ? standardColorAtIndex(props.initialValues.color_index)
        : DEFAULT_STANDARD_COLOR
    }
    submitError.value = null
    nameError.value = null
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
  const validationError = requiredTextFieldError(name.value, props.nameLabel, resolvedNameMaxLength.value)
  if (validationError) {
    nameError.value = validationError
    return
  }
  const trimmed = name.value.trim()
  nameError.value = null
  submitError.value = null
  emit('submit', {
    name: trimmed,
    color_index: standardColorIndexFromHex(color.value),
  })
}
function setSubmitError (message: string) {
  submitError.value = message
}
defineExpose({ setSubmitError })
</script>
<style lang="scss" scoped src="~/assets/styles/components/modals/shared/DefaultNamedColorItemFormModal.scss"></style>
