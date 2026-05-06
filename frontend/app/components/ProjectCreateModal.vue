<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" role="presentation" @click.self="close">
      <section
        class="modal-card"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <header class="modal-header">
          <h3>{{ title }}</h3>
          <button type="button" class="icon-close" :disabled="loading" @click="close">×</button>
        </header>

        <form class="modal-body" @submit.prevent="submit">
          <label class="field">
            <span>{{ workUnitLabel }}名</span>
            <input
              v-model.trim="name"
              type="text"
              required
              minlength="2"
              maxlength="80"
              placeholder="例: 顧客向けダッシュボード刷新"
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
            <button type="button" class="ghost-btn" :disabled="loading" @click="close">
              キャンセル
            </button>
            <button type="submit" class="primary-btn" :disabled="loading || name.length < 2">
              {{ loading ? '作成中...' : '登録' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
export type ProjectCreateLabel = { id: number; name: string; color: string }

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  workUnitLabel: string
  labels: ProjectCreateLabel[]
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
  const trimmed = name.value.trim()
  if (trimmed.length < 2 || props.loading) return
  emit('submit', { name: trimmed, label_ids: [...labelIds.value] })
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  z-index: 70;
}

.modal-card {
  width: min(36rem, 100%);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
}

.modal-header {
  background: #0b2bab;
  color: #fff;
  padding: 0.7rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.05rem;
}

.icon-close {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}

.modal-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  color: #1e293b;
  font-weight: 700;
}

.field input[type='text'] {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0.55rem 0.7rem;
  font-size: 0.94rem;
  background: #fff;
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

.label-empty {
  margin: 0.1rem 0 0;
  color: #64748b;
  font-size: 0.82rem;
}

.label-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
}

.actions {
  margin-top: 0.2rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.primary-btn,
.ghost-btn {
  border-radius: 999px;
  border: 1px solid transparent;
  padding: 0.45rem 1.4rem;
  font-weight: 800;
  cursor: pointer;
}

.primary-btn {
  background: #45c3cf;
  color: #fff;
}

.ghost-btn {
  border-color: #cbd5e1;
  color: #64748b;
  background: #f1f5f9;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
