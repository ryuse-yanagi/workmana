<template>
  <BaseModal
    :model-value="modelValue"
    title="リストの削除"
    aria-label="リストの削除"
    :close-disabled="loading"
    width="min(31rem, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="list-delete-modal-body">
      <p class="list-delete-modal-message">
        <template v-if="listName">
          「{{ listName }}」を削除しますか？<br>
          この操作は取り消せません。
        </template>
        <template v-else>
          このリストを削除しますか？<br>
          この操作は取り消せません。
        </template>
      </p>
      <p v-if="submitError" class="err">{{ submitError }}</p>
      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">
          キャンセル
        </button>
        <button type="button" class="danger-btn danger-btn--pill" :disabled="loading" @click="submit">
          {{ loading ? '削除中...' : '削除' }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>
<script setup lang="ts">
import { syncAppLoadingCursor } from '../../composables/useAppLoadingCursor'
const props = withDefaults(defineProps<{
  modelValue: boolean
  listName?: string
  loading?: boolean
}>(), {
  listName: '',
  loading: false,
})
const emit = defineEmits<{
  'update:modelValue': [boolean]
  confirm: []
}>()
const submitError = ref<string | null>(null)
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      submitError.value = null
    }
  },
)
function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}
function submit () {
  if (props.loading) return
  submitError.value = null
  emit('confirm')
}
function setSubmitError (message: string) {
  submitError.value = message
}
syncAppLoadingCursor(() => props.loading)
defineExpose({ setSubmitError })
</script>
<style lang="scss" scoped>
.list-delete-modal-body {
  padding: 1rem 1.35rem 1.35rem;
}
.list-delete-modal-message {
  margin: 0;
  font-size: 0.9rem;
  color: mixin.$text-sub;
  line-height: 1.45;
}
.err {
  margin: 0.75rem 0 0;
  color: #b91c1c;
  font-weight: 700;
  font-size: 0.86rem;
}
.actions {
  margin-top: 0.95rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
.ghost-btn,
.danger-btn {
  @include mixin.btn-base;
}
.ghost-btn--pill,
.danger-btn--pill {
  @include mixin.btn-pill;
}
.ghost-btn {
  @include mixin.btn-ghost;
}
.danger-btn {
  background: mixin.$danger;
  color: #fff;
}
</style>
