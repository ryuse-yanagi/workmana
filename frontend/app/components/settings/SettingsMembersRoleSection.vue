<template>
  <section class="invite-section">
    <h3 class="invite-section__title">{{ title }}</h3>
    <p v-if="empty" class="invite-section__empty">{{ emptyMessage }}</p>
    <ul v-else class="member-row-list">
      <li
        v-for="member in members"
        :key="member.id"
        class="member-row"
      >
        <div class="member-row__leading">
          <MemberAvatar :member="member" size="sm" />
          <span class="member-row__name">{{ member.name }}</span>
        </div>
        <span class="member-row__email">{{ member.email }}</span>
        <div
          v-if="canManage && member.id !== currentUserId"
          class="member-row__actions"
        >
          <button
            type="button"
            class="label-action-btn label-action-btn--edit"
            :disabled="pendingMemberId === member.id"
            @click="emit('edit', member)"
          >
            編集
          </button>
          <button
            type="button"
            class="label-action-btn label-action-btn--delete"
            :disabled="pendingMemberId === member.id"
            @click="emit('remove', member)"
          >
            削除
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import MemberAvatar from '../ui/MemberAvatar.vue'

export type SettingsMemberRow = {
  id: number
  name: string
  email: string
  avatar_url?: string | null
}

defineProps<{
  title: string
  members: SettingsMemberRow[]
  emptyMessage: string
  canManage: boolean
  currentUserId: number | null
  pendingMemberId?: number | null
}>()

const emit = defineEmits<{
  edit: [SettingsMemberRow]
  remove: [SettingsMemberRow]
}>()

const empty = computed(() => {
  // computed from props via toRefs would be cleaner; use length check in template instead
  return false
})
</script>
