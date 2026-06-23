<template>
  <div
    v-if="labels.length"
    class="task-label-list"
    :class="{ 'task-label-list--named': showLabelNames }"
    @click.stop="toggleLabelNames"
  >
    <LabelStrip
      v-for="label in labels"
      :key="label.id"
      :label="label"
      size="sm"
      :display-mode="showLabelNames ? 'named' : 'bar'"
      class="task-label-list__strip"
    />
  </div>
</template>

<script setup lang="ts">
import LabelStrip, { type LabelStripLabel } from '../ui/LabelStrip.vue'
import { useBoardCardLabelDisplay } from '../../composables/useBoardCardLabelDisplay'

defineProps<{
  labels: LabelStripLabel[]
}>()

const { showLabelNames, toggleLabelNames } = useBoardCardLabelDisplay()
</script>

<style scoped lang="scss">
.task-label-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
  margin-bottom: 0.25rem;
}

.task-label-list :deep(.label-strip--bar),
.task-label-list :deep(.label-strip--named) {
  cursor: pointer;
  transition: box-shadow 120ms ease;
}

.task-label-list :deep(.label-strip--bar:hover),
.task-label-list :deep(.label-strip--named:hover) {
  box-shadow: inset 0 0 0 999px rgba(255, 255, 255, 0.28);
}

.task-label-list__strip {
  flex: 0 0 auto;
}
</style>
