<template>
  <li :class="`${prefix}__item`">
    <div
      v-if="variant === 'document'"
      class="archived-list-popover__document-card"
    >
      <span
        class="archived-list-popover__document-icon"
        aria-hidden="true"
      >
        <FileText
          :size="17"
          :stroke-width="2"
        />
      </span>
      <span class="archived-list-popover__document-body">
        <span class="archived-list-popover__document-name">{{ item.name }}</span>
        <span
          v-if="description"
          class="archived-list-popover__document-desc"
        >{{ description }}</span>
        <span
          v-if="categoryLabel"
          class="archived-list-popover__document-category"
        >
          <LabelStrip
            :label="categoryLabel"
            :text-color="categoryTextColor"
            size="sm"
          />
        </span>
      </span>
    </div>
    <div
      v-else
      class="archived-list-modal__card"
    >
      <div class="archived-list-modal__card-body">
        <p class="archived-list-modal__name">{{ item.name }}</p>
        <p
          v-if="item.description"
          class="archived-list-modal__description"
        >{{ item.description }}</p>
      </div>
    </div>
    <ArchivedListItemActions
      :prefix="prefix"
      :show="canManageArchive"
      :disabled="pending"
      @restore="$emit('restore')"
      @delete="$emit('delete')"
    />
  </li>
</template>

<script setup lang="ts">
import { FileText } from 'lucide-vue-next'
import {
  standardColorEmphasisText,
  standardColorSurfaceBackground,
} from '../../constants/colorPresets'
import { resolveStandardColors } from '../../utils/colorPresetResolution'
import type { ArchivedNamedItem } from '../../composables/useArchivedNamedItemsCache'
import LabelStrip from '../ui/LabelStrip.vue'
import ArchivedListItemActions from './ArchivedListItemActions.vue'

const props = withDefaults(defineProps<{
  item: ArchivedNamedItem
  variant: 'document' | 'workspace'
  canManageArchive?: boolean
  pending?: boolean
}>(), {
  canManageArchive: false,
  pending: false,
})

defineEmits<{
  restore: []
  delete: []
}>()

const prefix = computed(() => (
  props.variant === 'document' ? 'archived-list-popover' : 'archived-list-modal'
))

const description = computed(() => {
  const text = props.item.description?.trim()
  return text || null
})

const categoryLabel = computed(() => {
  const category = props.item.category
  if (!category?.name?.trim()) {
    return null
  }
  const resolved = resolveStandardColors([category])[0] ?? category
  if (!resolved.color) {
    return null
  }
  return {
    name: resolved.name ?? category.name,
    color: standardColorSurfaceBackground(resolved.color),
  }
})

const categoryTextColor = computed(() => {
  const category = props.item.category
  if (!category?.name?.trim()) {
    return undefined
  }
  const resolved = resolveStandardColors([category])[0] ?? category
  if (!resolved.color) {
    return undefined
  }
  return standardColorEmphasisText(resolved.color)
})
</script>
