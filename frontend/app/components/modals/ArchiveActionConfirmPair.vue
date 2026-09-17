<template>
  <ConfirmModal
    v-model="restoreOpen"
    width="min(480px, 100%)"
    :title="restoreTitle"
    :message="restoreMessage"
    confirm-text="復元"
    :loading="loading"
    @confirm="$emit('confirm-restore')"
  />
  <ConfirmModal
    v-model="deleteOpen"
    width="min(480px, 100%)"
    :title="deleteTitle"
    :message="deleteMessage"
    confirm-text="削除"
    variant="danger"
    :loading="loading"
    @confirm="$emit('confirm-delete')"
  />
</template>

<script setup lang="ts">
import ConfirmModal from './ConfirmModal.vue'

defineProps<{
  restoreTitle: string
  restoreMessage: string
  deleteTitle: string
  deleteMessage: string
  loading?: boolean
}>()

defineEmits<{
  'confirm-restore': []
  'confirm-delete': []
}>()

const restoreOpen = defineModel<boolean>('restoreOpen', { required: true })
const deleteOpen = defineModel<boolean>('deleteOpen', { required: true })
</script>
