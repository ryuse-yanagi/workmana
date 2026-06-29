<template>
  <BaseModal
    :model-value="modelValue"
    :title="modalTitle"
    :aria-label="modalTitle"
    :close-disabled="loading"
    focus-primary-input-on-open
    width="min(32rem, 100%)"
    align="top"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="list-create-modal-body" @keydown="onFormKeydown">
      <label class="field">
        <span>リスト名</span>
        <input
          v-model.trim="name"
          type="text"
          maxlength="40"
          required
          placeholder="リスト名を入力してください"
          :disabled="loading"
          @keydown.enter.exact.prevent
        />
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
        <button type="button" class="primary-btn primary-btn--pill" :disabled="loading || !name" @click="submit">
          {{ loading ? submitPendingLabel : submitLabel }}
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
const props = withDefaults(defineProps<{
  modelValue: boolean
  mode?: 'create' | 'edit'
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
const modalTitle = computed(() => (
  props.mode === 'edit' ? 'リストの編集' : 'リスト追加'
))
const submitLabel = computed(() => (
  props.mode === 'edit' ? '保存' : '作成'
))
const submitPendingLabel = computed(() => (
  props.mode === 'edit' ? '保存中...' : '作成中...'
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
      color.value = DEFAULT_STANDARD_COLOR
    }
    submitError.value = null
  },
)
function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}
function submit () {
  const trimmed = name.value.trim()
  if (!trimmed || props.loading) return
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
.list-create-modal-body {
  padding: 1rem 1.35rem 1.35rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  color: #0f172a;
  font-weight: 800;
  font-size: 0.88rem;
}
.field input {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 0.62rem 0.75rem;
  font-size: 0.9rem;
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
  color: #b91c1c;
  font-weight: 700;
  font-size: 0.86rem;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 0.25rem;
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
