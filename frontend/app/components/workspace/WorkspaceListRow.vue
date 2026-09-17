<template>
  <tr
    :class="[
      'clickable-row',
      {
        'workspace-row--fade-in': justCreated,
      },
    ]"
    role="button"
    tabindex="0"
    @pointerenter="emit('warm')"
    @focusin="emit('warm')"
    @pointerdown="emit('pointerdown', $event)"
    @contextmenu.prevent="emit('contextmenu', $event)"
    @keydown.enter.prevent="emit('activate')"
    @keydown.space.prevent="emit('activate')"
  >
    <td colspan="5" class="workspace-card-cell">
      <div class="workspace-card">
        <div
          v-if="workspace.labels?.length"
          class="workspace-card__labels"
        >
          <OverflowFlexRow :watch-key="workspace.labels.length">
            <LabelStrip
              v-for="label in workspace.labels"
              :key="label.id"
              :label="label"
              size="md"
            />
          </OverflowFlexRow>
        </div>
        <div class="workspace-card__body">
          <div class="workspace-card__name">
            <span class="workspace-card__pin-slot" aria-hidden="true">
              <Pin
                v-if="workspace.pinned"
                class="workspace-card__pin"
                :size="20"
                :stroke-width="2.25"
              />
            </span>
            <p class="name-text">{{ workspace.name }}</p>
          </div>
          <div class="workspace-card__description">
            <p v-if="workspace.description" class="description-text">
              {{ workspaceListDescription(workspace.description) }}
            </p>
          </div>
          <div class="workspace-card__assignees">
            <WorkspaceAssigneeSelect
              readonly
              :assignees="workspace.assignees ?? []"
              :org-members="orgMembers"
            />
          </div>
          <div class="workspace-card__status">
            <WorkspaceStatusSelect
              readonly
              :status="workspace.status"
              :statuses="workspaceStatuses"
            />
          </div>
          <div class="workspace-card__actions">
            <CardMenuTrigger
              :wrap="false"
              trigger-class="subheader-menu-btn workspace-card__menu-btn"
              :open="menuOpen"
              aria-label="スペースのメニュー"
              :icon-size="18"
              stop-click
              stop-pointer
              @click="emit('menu-click', $event)"
            />
          </div>
        </div>
        <p
          v-if="workspace.updated_at"
          class="workspace-card__updated"
        >更新 {{ formatDateDisplay(workspace.updated_at) }}</p>
      </div>
    </td>
  </tr>
</template>

<script setup lang="ts">
import { Pin } from 'lucide-vue-next'
import { formatDateDisplay, type TaskFormMember } from '../../composables/useTaskFormHelpers'
import type { OrgWorkspaceStatus } from '../../composables/useOrgWorkspaceIndexPageData'
import LabelStrip from '../ui/LabelStrip.vue'
import OverflowFlexRow from '../ui/OverflowFlexRow.vue'
import CardMenuTrigger from '../ui/CardMenuTrigger.vue'
import WorkspaceAssigneeSelect from './WorkspaceAssigneeSelect.vue'
import WorkspaceStatusSelect from './WorkspaceStatusSelect.vue'

export type WorkspaceListRowItem = {
  id: number
  name: string
  description?: string | null
  status?: OrgWorkspaceStatus | null
  labels?: Array<{ id: number; name: string; color: string }>
  assignees?: TaskFormMember[]
  updated_at?: string
  pinned?: boolean
}

defineProps<{
  workspace: WorkspaceListRowItem
  orgMembers: TaskFormMember[]
  workspaceStatuses: OrgWorkspaceStatus[]
  menuOpen: boolean
  justCreated?: boolean
}>()

const emit = defineEmits<{
  warm: []
  pointerdown: [PointerEvent]
  contextmenu: [MouseEvent]
  activate: []
  'menu-click': [MouseEvent]
}>()

function workspaceListDescription (description: string | null | undefined): string {
  if (!description) {
    return ''
  }
  return description.split(/\r?\n/)[0] ?? ''
}
</script>
