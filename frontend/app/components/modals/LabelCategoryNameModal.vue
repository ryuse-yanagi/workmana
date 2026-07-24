<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    :aria-label="title"
    :close-disabled="loading"
    focus-primary-input-on-open
    width="min(448px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="category-name-modal-body" @submit.prevent="submit">
      <label class="field">
        <span>カテゴリ名</span>
        <input
          v-model.trim="name"
          type="text"
          maxlength="40"
          required
          placeholder="カテゴリ名を入力してください"
          :disabled="loading"
        />
        <p v-if="nameError" class="field-error">{{ nameError }}</p>
      </label>
      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">キャンセル</button>
        <button type="submit" class="primary-btn primary-btn--pill" :disabled="loading">{{ submitLabel }}</button>
      </div>
    </form>
  </BaseModal>
</template>
<script setup lang="ts">
import { requiredTextFieldError } from '../../utils/formValidation'
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
watch(
  () => [props.modelValue, props.initialName] as const,
  ([open, initialName]) => {
    if (open) {
      name.value = initialName
      nameError.value = null
    }
  },
  { immediate: true },
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
  const validationError = requiredTextFieldError(name.value, 'カテゴリ名を入力してください')
  if (validationError) {
    nameError.value = validationError
    return
  }
  const trimmed = name.value.trim()
  nameError.value = null
  emit('submit', trimmed)
}
</script>
<style lang="scss" scoped>
.category-name-modal-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 11.2px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6.3px;
  color: #1e293b;
  font-weight: 700;
}
.field input {
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 7.7px 9.8px;
  font-size: 13.16px;
  &:focus {
    @include mixin.input-focus-ring;
  }
}
.actions {
  margin-top: 2.8px;
  display: flex;
  justify-content: center;
  gap: 7px;
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
