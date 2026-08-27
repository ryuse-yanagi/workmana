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
      v-if="avatarSrc"
      :src="avatarSrc"
      alt=""
      class="member-avatar__image"
      @error="onAvatarError"
    />
    <span v-else class="member-avatar__initial">{{ initial }}</span>
  </component>
</template>
<script setup lang="ts">
import { memberInitial, type MemberLike } from '../../composables/useMemberDisplay'
import { resolveDisplayAvatarUrl } from '../../composables/userProfileUpdated'
import { resolveAvatarUrl } from '../../utils/resolveAvatarUrl'
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
const config = useRuntimeConfig()
const imageLoadFailed = ref(false)
const initial = computed(() => memberInitial(props.member))
const avatarSrc = computed(() => {
  if (imageLoadFailed.value) {
    return null
  }
  return resolveAvatarUrl(
    resolveDisplayAvatarUrl(props.member),
    String(config.public.apiBaseUrl || '/api'),
  )
})
watch(
  () => [props.member.id, props.member.avatar_url, resolveDisplayAvatarUrl(props.member)] as const,
  () => {
    imageLoadFailed.value = false
  },
)
function onAvatarError () {
  imageLoadFailed.value = true
}
</script>
<style lang="scss" scoped src="~/assets/styles/components/ui/MemberAvatar.scss"></style>
