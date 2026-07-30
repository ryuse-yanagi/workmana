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
<style lang="scss" scoped src="~/assets/styles/components/task/TaskCardLabelList.scss"></style>
