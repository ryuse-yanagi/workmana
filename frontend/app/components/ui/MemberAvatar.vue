<template>
  <component
    :is="interactive ? 'button' : 'span'"
    class="member-avatar"
    :class="[
      `member-avatar--${size}`,
      { 'member-avatar--interactive': interactive },
    ]"
    :type="interactive ? 'button' : undefined"
    :title="title ?? undefined"
    :aria-label="ariaLabel ?? undefined"
    v-bind="interactive ? {} : { 'aria-hidden': decorative }"
  >
    <img
      v-if="member.avatar_url"
      :src="member.avatar_url"
      alt=""
      class="member-avatar__image"
    />
    <span v-else class="member-avatar__initial">{{ initial }}</span>
  </component>
</template>
<script setup lang="ts">
import { memberInitial, type MemberLike } from '../../composables/useMemberDisplay'
const props = withDefaults(defineProps<{
  member: MemberLike
  size?: 'xs' | 'sm' | 'md'
  interactive?: boolean
  title?: string | null
  ariaLabel?: string | null
  decorative?: boolean
}>(), {
  size: 'sm',
  interactive: false,
  decorative: true,
})
const initial = computed(() => memberInitial(props.member))
</script>
<style lang="scss" scoped src="~/assets/styles/components/ui/MemberAvatar.scss"></style>
