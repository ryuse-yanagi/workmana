<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    :aria-label="title"
    :close-disabled="loading"
    focus-primary-input-on-open
    width="min(36rem, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="workspace-create-modal-body" @submit.prevent="submit">
      <label class="field">
        <span>ワークスペース名</span>
        <input
          v-model.trim="name"
          type="text"
          required
          minlength="2"
          :maxlength="WORKSPACE_NAME_MAX_LENGTH"
          placeholder="ワークスペース名を入力してください"
          :disabled="loading"
        />
      </label>
      <label class="field">
        <span>ラベル（複数選択）</span>
        <div class="label-picker">
          <label v-for="label in labels" :key="label.id" class="label-option">
            <input
              v-model="labelIds"
              type="checkbox"
              :value="label.id"
              :disabled="loading"
            />
            <span class="label-dot" :style="{ backgroundColor: label.color }" />
            <span>{{ label.name }}</span>
          </label>
          <p v-if="!labels.length" class="label-empty">ラベルは設定画面から作成できます。</p>
        </div>
      </label>
      <div class="actions">
        <button type="button" class="ghost-btn ghost-btn--pill" :disabled="loading" @click="close">
          キャンセル
        </button>
        <button type="submit" class="primary-btn primary-btn--pill" :disabled="loading || name.length < 2">
          {{ loading ? '作成中...' : '登録' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>

<script setup lang="ts">
import { WORKSPACE_NAME_MAX_LENGTH } from '../../constants/fieldLengthLimits'

export type WorkspaceCreateLabel = { id: number; name: string; color: string }

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  labels: WorkspaceCreateLabel[]
  loading?: boolean
}>(), {
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  submit: [{ name: string; label_ids: number[] }]
}>()

const name = ref('')
const labelIds = ref<number[]>([])

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      name.value = ''
      labelIds.value = []
    }
  },
)

function close () {
  if (props.loading) return
  emit('update:modelValue', false)
}

function submit () {
  if (props.loading || name.value.length < 2) return
  emit('submit', { name: name.value, label_ids: [...labelIds.value] })
}
</script>

<style lang="scss" scoped>
.workspace-create-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #334155;
}

.field input[type='text'] {
  border: 1px solid mixin.$border;
  border-radius: 8px;
  padding: 0.55rem 0.65rem;
  font: inherit;
}

.label-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.label-option {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid #dbe3ee;
  border-radius: 999px;
  padding: 0.2rem 0.5rem;
  font-size: 0.82rem;
  font-weight: 600;
  background: #fff;
}

.label-dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
}

.label-empty {
  margin: 0;
  color: #64748b;
  font-size: 0.82rem;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}
</style>
