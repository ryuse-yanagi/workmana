<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    :aria-label="title"
    :close-disabled="loading"
    width="min(32rem, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="label-create-modal-body" @submit.prevent="submit">
      <label class="field">
        <span>ラベル名</span>
        <input
          v-model.trim="name"
          type="text"
          maxlength="40"
          required
          placeholder="ラベル名を入力してください"
          :disabled="loading"
        />
      </label>

      <ColorPresetPicker v-model="color" :disabled="loading" />

      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">キャンセル</button>
        <button type="submit" class="primary-btn primary-btn--pill" :disabled="loading || !name">作成</button>
      </div>
    </form>
  </BaseModal>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  loading?: boolean
}>(), {
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{ name: string; color: string }]
}>()

const defaultColor = '#c084fc'

const name = ref('')
const color = ref<string>(defaultColor)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      name.value = ''
      color.value = defaultColor
    }
  },
)

function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}

function submit () {
  const trimmed = name.value.trim()
  if (!trimmed || props.loading) return
  emit('submit', { name: trimmed, color: color.value })
}
</script>

<style lang="scss" scoped>
.label-create-modal-body {
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
