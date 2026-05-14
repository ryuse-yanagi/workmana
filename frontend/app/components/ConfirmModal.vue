<template>
  <Teleport to="body">
    <Transition name="tm-fade">
      <div v-if="modelValue" class="modal-overlay" role="presentation" @click.self="close">
      <section class="modal-card" role="dialog" aria-modal="true" :aria-label="title">
        <header class="modal-header">
          <h3>{{ title }}</h3>
          <button type="button" class="icon-close" :disabled="loading" @click="close">✕</button>
        </header>
        <div class="modal-body">
          <p v-if="message" class="modal-message">{{ message }}</p>
          <div class="modal-actions">
            <button type="button" class="ghost-btn" :disabled="loading" @click="close">
              {{ cancelText }}
            </button>
            <button
              type="button"
              :class="variant === 'danger' ? 'danger-btn' : 'primary-btn'"
              :disabled="loading"
              @click="$emit('confirm')"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </section>
    </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
}>(), {
  message: '',
  confirmText: '実行',
  cancelText: 'キャンセル',
  variant: 'primary',
  loading: false,
})

const emit = defineEmits<{
  'update:modelValue': [boolean]
  confirm: []
}>()

function close () {
  if (props.loading) return
  emit('update:modelValue', false)
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
  width: min(31rem, 100%);
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
  font-size: 1.03rem;
}

.icon-close {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  margin: -0.2rem 0;
}

.modal-body {
  padding: 1rem;
}

.modal-message {
  margin: 0;
  font-size: 0.9rem;
  color: #475569;
  line-height: 1.45;
}

.modal-actions {
  margin-top: 0.95rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.ghost-btn,
.primary-btn,
.danger-btn {
  border-radius: 10px;
  border: 1px solid transparent;
  padding: 0.5rem 0.75rem;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
}

.ghost-btn {
  background: #fff;
  color: #334155;
  border-color: #94a3b8;
}

.primary-btn {
  background: #45c3cf;
  color: #fff;
}

.danger-btn {
  background: #ff0000;
  color: #fff;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
