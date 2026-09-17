<template>
  <div
    ref="rootRef"
    class="popover popover--member-detail"
    :class="{ 'popover--member-detail-no-remove': !showRemove }"
    :style="style"
    role="dialog"
    :aria-label="`${displayName}の詳細`"
    @click.stop
  >
    <div class="member-detail-card">
      <header class="member-detail-header">
        <button
          type="button"
          class="member-detail-close"
          :disabled="disabled"
          aria-label="閉じる"
          @click="$emit('close')"
        >
          <X
            :size="14"
            :stroke-width="2.25"
            aria-hidden="true"
          />
        </button>
        <div class="member-detail-profile">
          <img
            v-if="avatarSrc"
            :src="avatarSrc"
            alt=""
            class="member-detail-avatar"
            @error="$emit('avatar-error')"
          />
          <span
            v-else
            class="member-detail-initial"
          >{{ initial }}</span>
          <div class="member-detail-text">
            <p class="member-detail-name">{{ displayName }}</p>
            <p class="member-detail-email">{{ emailLine }}</p>
          </div>
        </div>
      </header>
      <div
        v-if="showRemove"
        class="member-detail-body"
      >
        <button
          type="button"
          class="member-detail-remove"
          :disabled="disabled"
          @click.stop="$emit('remove')"
        >
          {{ removeLabel }}
        </button>
      </div>
    </div>
    <p
      v-if="error"
      class="err member-detail-error"
    >{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'
withDefaults(defineProps<{
  style?: Record<string, string>
  disabled?: boolean
  error?: string | null
  displayName: string
  emailLine: string
  initial: string
  avatarSrc?: string | null
  showRemove?: boolean
  removeLabel?: string
}>(), {
  disabled: false,
  error: null,
  avatarSrc: null,
  showRemove: true,
  removeLabel: 'タスクから削除',
})

defineEmits<{
  close: []
  remove: []
  'avatar-error': []
}>()

const rootRef = ref<HTMLElement | null>(null)

defineExpose({ rootRef })
</script>

<style lang="scss" scoped src="~/assets/styles/components/task/popover/taskFieldPopovers.scss"></style>
