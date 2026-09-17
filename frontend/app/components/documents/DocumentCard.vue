<template>
  <component
    :is="skeleton ? 'div' : 'button'"
    :type="skeleton ? undefined : 'button'"
    class="document-card"
    :class="{ 'document-card--skeleton': skeleton }"
    v-bind="skeleton ? { 'aria-hidden': true } : {}"
    @pointerenter="onPointerEnter"
    @focus="onFocus"
    @click="onClick"
    @contextmenu="onContextMenu"
  >
    <template v-if="skeleton">
      <span class="document-skeleton-bar document-skeleton-bar--doc-icon" />
      <span class="document-card__body">
        <span class="document-skeleton-bar document-skeleton-bar--doc-name" />
        <span class="document-skeleton-bar document-skeleton-bar--doc-meta" />
      </span>
    </template>
    <template v-else>
      <span
        class="document-card__icon"
        aria-hidden="true"
      >
        <FileText
          :size="17"
          :stroke-width="2"
        />
      </span>
      <span class="document-card__body">
        <span class="document-card__name">{{ name }}</span>
        <span
          v-if="description"
          class="document-card__desc"
        >{{ description }}</span>
        <span
          v-if="categoryLabel"
          class="document-card__category"
        >
          <LabelStrip
            :label="categoryLabel"
            :text-color="categoryTextColor"
            size="sm"
          />
        </span>
      </span>
      <slot name="menu" />
    </template>
  </component>
</template>

<script setup lang="ts">
import { FileText } from 'lucide-vue-next'
import LabelStrip from '../ui/LabelStrip.vue'

withDefaults(defineProps<{
  name?: string
  description?: string | null
  categoryLabel?: { name: string; color: string } | null
  categoryTextColor?: string
  skeleton?: boolean
}>(), {
  name: '',
  description: null,
  categoryLabel: null,
  categoryTextColor: undefined,
  skeleton: false,
})

const emit = defineEmits<{
  click: [MouseEvent]
  pointerenter: [PointerEvent]
  focus: [FocusEvent]
  contextmenu: [MouseEvent]
}>()

function onClick (event: MouseEvent) {
  emit('click', event)
}

function onPointerEnter (event: PointerEvent) {
  emit('pointerenter', event)
}

function onFocus (event: FocusEvent) {
  emit('focus', event)
}

function onContextMenu (event: MouseEvent) {
  event.preventDefault()
  emit('contextmenu', event)
}
</script>

<style lang="scss" scoped src="~/assets/styles/components/documents/DocumentCard.scss"></style>
