<template>
  <WorkspaceBoard
    v-if="mode === 'board'"
    ref="boardRef"
  />
  <div
    v-else
    class="workspace-project-view workspace-view-page"
    :class="`workspace-view-page--${mode}`"
    :style="pageCssVars"
  >
    <header class="page-header">
      <div class="subheader">
        <NuxtLink :to="`/org/${orgSlug}/workspaces`" class="subheader-title subheader-back-link">
          Workspaces
        </NuxtLink>
        <WorkspaceViewSwitcher :org-slug="orgSlug" :workspace-id="workspaceId" />
        <div class="subheader-spacer" />
      </div>
    </header>
    <section class="workspace-view-page__body">
      <WorkspaceTableBoard
        v-if="mode === 'table'"
        ref="tableBoardRef"
        :org-slug="orgSlug"
        :workspace-id="workspaceId"
      />
      <WorkspaceGanttBoard
        v-else
        ref="ganttBoardRef"
        :org-slug="orgSlug"
        :workspace-id="workspaceId"
      />
    </section>
  </div>
</template>
<script setup lang="ts">
import type { WorkspaceViewKey } from '../../composables/useWorkspaceViewRoutes'
import { useWorkspaceViewPageCssVars } from '../../composables/useWorkspaceViewPageRoot'
import WorkspaceBoard from './WorkspaceBoard.vue'
import WorkspaceGanttBoard from './WorkspaceGanttBoard.vue'
import WorkspaceTableBoard from './WorkspaceTableBoard.vue'
import WorkspaceViewSwitcher from './WorkspaceViewSwitcher.vue'

const props = defineProps<{
  mode: WorkspaceViewKey
  orgSlug?: string
  workspaceId?: string
}>()

const boardRef = ref<InstanceType<typeof WorkspaceBoard> | null>(null)
const tableBoardRef = ref<InstanceType<typeof WorkspaceTableBoard> | null>(null)
const ganttBoardRef = ref<InstanceType<typeof WorkspaceGanttBoard> | null>(null)
const pageCssVars = useWorkspaceViewPageCssVars()

function refreshOnViewSwitch (): Promise<void> {
  if (props.mode === 'board') {
    return boardRef.value?.refreshOnViewSwitch() ?? Promise.resolve()
  }
  if (props.mode === 'table') {
    return tableBoardRef.value?.refreshOnViewSwitch() ?? Promise.resolve()
  }
  return ganttBoardRef.value?.refreshOnViewSwitch() ?? Promise.resolve()
}

defineExpose({
  refreshOnViewSwitch,
})
</script>
<style lang="scss" scoped>
.workspace-project-view {
  box-sizing: border-box;
  height: calc(100dvh - var(--global-header-offset, 56px) - var(--app-shell-page-pad, 3.5px));
  max-height: calc(100dvh - var(--global-header-offset, 56px) - var(--app-shell-page-pad, 3.5px));
  padding: 0 14px;
  margin-top: calc(-1 * var(--app-shell-page-pad, 3.5px));
  padding-top: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.page-header {
  position: relative;
  z-index: 40;
  flex-shrink: 0;
  width: calc(100% + 28px);
  margin-left: -14px;
  margin-right: -14px;
  @include mixin.page-header-shell;
  padding: 0 19.6px 0 12.6px;
}
.page-header > * {
  width: 100%;
  height: 100%;
}
.subheader {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 100%;
  min-width: 0;
}
.subheader-title {
  @include mixin.page-header-title;
}
.subheader-back-link {
  display: inline-flex;
  align-items: center;
  gap: 4.2px;
  text-decoration: none;
  color: mixin.$main;
  letter-spacing: 0.05em;
  line-height: 1.1;
  transition: color 0.16s ease;
  &::before {
    content: '';
    flex-shrink: 0;
    display: block;
    width: 0.65em;
    height: 0.85em;
    background-color: currentColor;
    -webkit-mask-image: url('~/assets/images/chevron-left.svg');
    mask-image: url('~/assets/images/chevron-left.svg');
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
  }
}
.subheader-spacer {
  flex: 1;
  min-width: 0;
}
.workspace-view-page__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 0 10.5px;
}
.workspace-view-page__body > :deep(*) {
  flex: 1;
  min-height: 0;
}
</style>
