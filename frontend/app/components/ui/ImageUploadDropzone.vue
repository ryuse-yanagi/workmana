<template>
  <div class="image-upload-dropzone">
    <div class="image-upload-dropzone__row">
      <div class="image-upload-dropzone__preview">
        <img
          v-if="displaySrc"
          :src="displaySrc"
          :alt="imageAlt"
          class="image-upload-dropzone__image"
          @error="emit('image-error')"
        >
        <div
          v-else
          class="image-upload-dropzone__placeholder"
          :aria-label="placeholderAriaLabel"
        >
          <span class="image-upload-dropzone__initial">{{ initial }}</span>
        </div>
      </div>
      <div class="image-upload-dropzone__actions">
        <input
          ref="fileInputRef"
          class="image-upload-dropzone__file-input"
          type="file"
          accept="image/*"
          :disabled="disabled"
          @change="emit('file-change', $event)"
        >
        <button
          type="button"
          class="image-upload-dropzone__dropzone"
          :class="{ 'image-upload-dropzone__dropzone--active': dropActive }"
          :disabled="disabled"
          @click="emit('open-dialog')"
          @dragenter.prevent="emit('drag-enter')"
          @dragover.prevent="emit('drag-over')"
          @dragleave.prevent="emit('drag-leave')"
          @drop.prevent="emit('drop', $event)"
        >
          <CloudUpload
            class="image-upload-dropzone__icon"
            :size="28"
            :stroke-width="1.75"
            aria-hidden="true"
          />
          <span class="image-upload-dropzone__text">
            <span class="image-upload-dropzone__title">{{ dropzoneTitle }}</span>
            <span class="image-upload-dropzone__hint">{{ dropzoneHint }}</span>
          </span>
        </button>
        <button
          type="button"
          class="image-upload-dropzone__reset"
          :disabled="disabled || !canReset"
          @click="emit('reset')"
        >
          {{ resetLabel }}
        </button>
      </div>
    </div>
    <p v-if="error" class="field-error image-upload-dropzone__error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { CloudUpload } from 'lucide-vue-next'

withDefaults(defineProps<{
  displaySrc: string | null
  initial: string
  imageAlt?: string
  placeholderAriaLabel?: string
  dropzoneTitle?: string
  dropzoneHint?: string
  resetLabel?: string
  disabled?: boolean
  canReset?: boolean
  dropActive?: boolean
  error?: string | null
}>(), {
  imageAlt: 'アイコン',
  placeholderAriaLabel: 'デフォルトアイコン',
  dropzoneTitle: '画像を選択してアイコンを変更',
  dropzoneHint: 'またはドラッグ＆ドロップ',
  resetLabel: 'デフォルトに戻す',
  disabled: false,
  canReset: false,
  dropActive: false,
  error: null,
})

const emit = defineEmits<{
  'image-error': []
  'file-change': [event: Event]
  'open-dialog': []
  'drag-enter': []
  'drag-over': []
  'drag-leave': []
  drop: [event: DragEvent]
  reset: []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

defineExpose({
  get fileInputRef () {
    return fileInputRef.value
  },
})
</script>

<style lang="scss" scoped src="~/assets/styles/components/ui/ImageUploadDropzone.scss"></style>
