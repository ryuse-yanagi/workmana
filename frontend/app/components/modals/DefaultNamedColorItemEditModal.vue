<template>
  <BaseModal
    :model-value="modelValue"
    :title="modalTitle"
    :aria-label="modalTitle"
    :close-disabled="loading"
    focus-primary-input-on-open
    width="min(512px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="named-color-item-edit-modal-body" @keydown="onFormKeydown">
      <label class="field">
        <span>{{ nameLabel }}</span>
        <input
          v-model.trim="name"
          type="text"
          maxlength="255"
          required
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
      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">
          キャンセル
        </button>
        <button type="button" class="primary-btn primary-btn--pill" :disabled="loading" @click="submit">
          {{ submitLabel }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
<script setup lang="ts">
import ColorPresetPicker from '../ui/ColorPresetPicker.vue'
import {
  DEFAULT_STANDARD_COLOR,
  STANDARD_COLORS,
  standardColorAtIndex,
  standardColorIndexFromHex,
} from '../../constants/colorPresets'
import { isCtrlEnterKeydown } from '../../utils/uiInteraction'
import { requiredTextFieldError } from '../../utils/formValidation'
const props = withDefaults(defineProps<{
  modelValue: boolean
  mode?: 'create' | 'edit'
  nameLabel: string
  namePlaceholder: string
  createTitle: string
  editTitle: string
  initialValues?: { name: string; color_index: number } | null
  loading?: boolean
}>(), {
  mode: 'create',
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
const modalTitle = computed(() => (
  props.mode === 'edit' ? props.editTitle : props.createTitle
))
const submitLabel = computed(() => (
  props.mode === 'edit' ? '保存' : '作成'
))
watch(
  () => [props.modelValue, props.mode, props.initialValues] as const,
  ([open]) => {
    if (!open) return
    if (props.mode === 'edit' && props.initialValues) {
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
  const validationError = requiredTextFieldError(name.value, `${props.nameLabel}を入力してください`)
  if (validationError) {
    nameError.value = validationError
    return
  }
  const trimmed = name.value.trim()
  nameError.value = null
  submitError.value = null
  emit('submit', { name: trimmed, color_index: standardColorIndexFromHex(color.value) })
}
function onFormKeydown (event: KeyboardEvent) {
  if (!isCtrlEnterKeydown(event)) return
  event.preventDefault()
  submit()
}
function setSubmitError (message: string) {
  submitError.value = message
}
defineExpose({ setSubmitError })
</script>
<style lang="scss" scoped>
.named-color-item-edit-modal-body {
  padding: 14px 18.9px 18.9px;
  display: flex;
  flex-direction: column;
  gap: 11.9px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6.3px;
  color: #0f172a;
  font-weight: 800;
  font-size: 12.32px;
}
.field input {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 8.68px 10.5px;
  font-size: 12.6px;
  font-weight: 400;
  color: #0f172a;
  background: #fff;
  line-height: 1.35;
  &:focus {
    @include mixin.input-focus-ring;
  }
}
.err {
  margin: 0;
  color: mixin.$danger;
  font-weight: 700;
  font-size: 12.04px;
}
.actions {
  display: flex;
  justify-content: center;
  gap: 7px;
  padding-top: 3.5px;
}
.ghost-btn,
.primary-btn {
  @include mixin.btn-base;
}
.ghost-btn--pill,
.primary-btn--pill {
  @include mixin.btn-pill;
}
.ghost-btn {
  @include mixin.btn-ghost;
}
.primary-btn {
  @include mixin.btn-primary;
}
</style>
