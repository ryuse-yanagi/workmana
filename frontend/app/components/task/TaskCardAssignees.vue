<template>
  <div class="task-card-members" aria-label="担当者">
    <MemberAvatar
      v-for="member in visibleAssignees"
      :key="member.id"
      :member="member"
      size="xs"
      :title="memberDisplayName(member)"
    />
    <span
      v-if="hiddenAssignees.length"
      class="task-card-members__more"
      :title="hiddenAssigneeTitle"
      :aria-label="hiddenAssigneeLabel"
    >+{{ hiddenAssignees.length }}</span>
  </div>
</template>
<script setup lang="ts">
import MemberAvatar from '../ui/MemberAvatar.vue'
import { memberDisplayName, type MemberLike } from '../../composables/member/useMemberDisplay'

const VISIBLE_LIMIT = 5

const props = defineProps<{
  assignees: MemberLike[]
}>()

const visibleAssignees = computed(() => props.assignees.slice(0, VISIBLE_LIMIT))
const hiddenAssignees = computed(() => props.assignees.slice(VISIBLE_LIMIT))
const hiddenAssigneeTitle = computed(() =>
  hiddenAssignees.value.map(member => memberDisplayName(member)).join('、'),
)
const hiddenAssigneeLabel = computed(() => {
  const count = hiddenAssignees.value.length
  if (!count) {
    return undefined
  }
  return `他${count}人、${hiddenAssigneeTitle.value}`
})
</script>
<style lang="scss" scoped src="~/assets/styles/components/task/TaskCardAssignees.scss"></style>
