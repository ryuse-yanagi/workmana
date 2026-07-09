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
      </label>
      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">キャンセル</button>
        <button type="submit" class="primary-btn primary-btn--pill" :disabled="loading || !name">{{ submitLabel }}</button>
      </div>
    </form>
  </BaseModal>
</template>
<script setup lang="ts">
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
watch(
  () => [props.modelValue, props.initialName] as const,
  ([open, initialName]) => {
    if (open) {
      name.value = initialName
    }
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
