<template>
  <li class="member-row">
    <div class="member-row__leading">
      <MemberAvatar
        v-if="member"
        :member="member"
        size="sm"
      />
      <span class="member-row__name">{{ name }}</span>
    </div>
    <span
      v-if="email"
      class="member-row__email"
    >{{ email }}</span>
    <div
      v-if="$slots.actions"
      class="member-row__actions"
    >
      <slot name="actions" />
    </div>
  </li>
</template>

<script setup lang="ts">
import MemberAvatar from '../ui/MemberAvatar.vue'

defineProps<{
  name: string
  email?: string | null
  member?: {
    id: number
    name: string
    email?: string | null
    avatar_url?: string | null
  } | null
}>()
</script>
