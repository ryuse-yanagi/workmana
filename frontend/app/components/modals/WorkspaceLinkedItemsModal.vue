<template>
  <BaseModal
    :model-value="modelValue"
    :title="title"
    :aria-label="title"
    width="min(672px, 100%)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="workspace-linked-items-modal__body">
      <section v-if="!items.length" class="workspace-linked-items-modal__empty">
        <p>{{ emptyMessage }}</p>
      </section>
      <ul v-else class="workspace-linked-items-modal__list">
        <li
          v-for="item in items"
          :key="item.id"
          class="workspace-linked-items-modal__item"
        >
          <button
            type="button"
            class="workspace-linked-items-modal__item-btn"
            @click="emit('select', item)"
          >
            <strong class="workspace-linked-items-modal__item-name">{{ item.name }}</strong>
            <p
              v-if="item.description"
              class="workspace-linked-items-modal__item-description"
            >{{ item.description }}</p>
          </button>
        </li>
      </ul>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from './BaseModal.vue'

export type WorkspaceLinkedItem = {
  id: number
  name: string
  description?: string | null
}

defineProps<{
  modelValue: boolean
  title: string
  emptyMessage: string
  items: WorkspaceLinkedItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  select: [item: WorkspaceLinkedItem]
}>()
</script>

<style lang="scss" scoped src="~/assets/styles/components/modals/WorkspaceLinkedItemsModal.scss"></style>
