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
<style lang="scss" scoped>
.member-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  overflow: hidden;
  flex-shrink: 0;
  background: #cbd5e1;
  border: none;
  padding: 0;
}
.member-avatar--interactive {
  cursor: pointer;
}
.member-avatar--xs {
  width: 21px;
  height: 21px;
}
.member-avatar--sm {
  width: 28px;
  height: 28px;
}
.member-avatar--md {
  width: 32.9px;
  height: 32.9px;
}
.member-avatar__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.member-avatar__initial {
  font-weight: 700;
  color: mixin.$text-sub;
  line-height: 1;
}
.member-avatar--xs .member-avatar__initial {
  font-size: 8.12px;
  font-weight: 600;
}
.member-avatar--sm .member-avatar__initial {
  font-size: 11.48px;
}
.member-avatar--md .member-avatar__initial {
  font-size: 12.6px;
}
</style>
