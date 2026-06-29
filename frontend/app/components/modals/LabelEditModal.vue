<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    :aria-label="title"
    :close-disabled="loading"
    focus-primary-input-on-open
    width="min(32rem, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="label-edit-modal-body" @keydown="onFormKeydown">
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
      </label>
      <ColorPresetPicker v-model="color" :disabled="loading" />
      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">キャンセル</button>
        <button type="button" class="primary-btn primary-btn--pill" :disabled="loading || !name" @click="submit">保存</button>
      </div>
    </form>
  </BaseModal>
</template>
<script setup lang="ts">
import { DEFAULT_COLOR_PRESET, colorAtPresetIndex, colorPresetIndexFromHex } from '../../constants/colorPresets'
import { LABEL_NAME_MAX_LENGTH } from '../../constants/fieldLengthLimits'
import { isCtrlEnterKeydown } from '../../utils/uiInteraction'
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
watch(
  () => [props.modelValue, props.initialName, props.initialColorIndex] as const,
  ([open, initialName, initialColorIndex]) => {
    if (!open) return
    name.value = initialName
    color.value = initialColorIndex === undefined
      ? DEFAULT_COLOR_PRESET
      : colorAtPresetIndex(initialColorIndex)
  },
  { immediate: true },
)
function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}
function submit () {
  const trimmed = name.value.trim()
  if (!trimmed || props.loading) return
  emit('submit', { name: trimmed, color_index: colorPresetIndexFromHex(color.value) })
}
function onFormKeydown (event: KeyboardEvent) {
  if (!isCtrlEnterKeydown(event)) return
  event.preventDefault()
  submit()
}
</script>
<style lang="scss" scoped>
.label-edit-modal-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  color: #1e293b;
  font-weight: 700;
}
.field input {
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
  font-size: 0.94rem;
  &:focus {
    @include mixin.input-focus-ring;
  }
}
.actions {
  margin-top: 0.2rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
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
