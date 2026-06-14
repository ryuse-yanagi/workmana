<template>
  <BaseModal
    :model-value="modelValue"
    title="リスト追加"
    aria-label="リスト追加"
    :close-disabled="loading"
    width="min(32rem, 100%)"
    align="top"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="list-create-modal-body" @submit.prevent="submit">
      <label class="field">
        <span>リスト名</span>
        <input
          ref="nameInputRef"
          v-model.trim="name"
          type="text"
          maxlength="40"
          required
          placeholder="リスト名を入力してください"
          :disabled="loading"
        />
      </label>

      <p v-if="submitError" class="err">{{ submitError }}</p>

      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">
          キャンセル
        </button>
        <button type="submit" class="primary-btn primary-btn--pill" :disabled="loading || !name">
          {{ loading ? '作成中...' : '作成' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  loading?: boolean
}>(), {
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{ name: string }]
}>()

const name = ref('')
const submitError = ref<string | null>(null)
const nameInputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    name.value = ''
    submitError.value = null
    nextTick(() => {
      nameInputRef.value?.focus()
    })
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
  emit('submit', { name: trimmed })
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
