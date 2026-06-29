<template>
  <div class="project-wbs-view workspace-view-page workspace-view-page--wbs" :style="pageCssVars">
    <header class="page-header">
      <div class="subheader">
        <NuxtLink :to="`/org/${orgSlug}/workspaces`" class="subheader-title subheader-back-link">
          ワークスペース一覧
        </NuxtLink>
        <WorkspaceViewSwitcher :org-slug="orgSlug" :workspace-id="workspaceId" />
        <div class="subheader-spacer" />
      </div>
    </header>
    <section class="workspace-view-page__body workspace-view-page__body--wbs">
      <WorkspaceWbsBoard
        v-if="mode === 'table'"
        ref="tableBoardRef"
        :org-slug="orgSlug"
        :workspace-id="workspaceId"
      />
      <WorkspaceWbsGanttBoard
        v-else
        ref="ganttBoardRef"
        :org-slug="orgSlug"
        :workspace-id="workspaceId"
      />
    </section>
  </div>
</template>
<script setup lang="ts">
import WorkspaceViewSwitcher from './WorkspaceViewSwitcher.vue'
import WorkspaceWbsBoard from './WorkspaceWbsBoard.vue'
import WorkspaceWbsGanttBoard from './WorkspaceWbsGanttBoard.vue'
import { useWorkspaceViewPageCssVars } from '../../composables/useWorkspaceViewPageRoot'
const props = defineProps<{
  orgSlug: string
  workspaceId: string
  mode: 'table' | 'gantt'
}>()
const tableBoardRef = ref<InstanceType<typeof WorkspaceWbsBoard> | null>(null)
const ganttBoardRef = ref<InstanceType<typeof WorkspaceWbsGanttBoard> | null>(null)
const pageCssVars = useWorkspaceViewPageCssVars()
function refreshOnViewSwitch (): Promise<void> {
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
.project-wbs-view {
  box-sizing: border-box;
  height: calc(100dvh - var(--global-header-offset, 46px) - var(--app-shell-page-pad, 0.25rem));
  max-height: calc(100dvh - var(--global-header-offset, 46px) - var(--app-shell-page-pad, 0.25rem));
  padding: 0 1rem;
  margin-top: calc(-1 * var(--app-shell-page-pad, 0.25rem));
  padding-top: 0;
  font-family: system-ui, sans-serif;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.page-header {
  position: relative;
  z-index: 40;
  flex-shrink: 0;
  margin-bottom: 0.2rem;
  width: calc(100% + 2rem);
  margin-left: -1rem;
  margin-right: -1rem;
  box-sizing: border-box;
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 1.4rem 0 0.9rem;
  background: #fff;
  border-bottom: 1px solid rgba(15, 23, 42, 0.35);
  box-shadow: 0 1px 8px rgba(15, 23, 42, 0.18);
}
.page-header > * {
  width: 100%;
  height: 100%;
}
.subheader {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 100%;
  min-width: 0;
}
.subheader-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 900;
  color: #2b2e2f;
  line-height: 1.1;
  flex-shrink: 0;
}
.subheader-back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  text-decoration: none;
  color: mixin.$main-aqua;
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
.workspace-view-page__body--wbs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 0 0.75rem;
}
.workspace-view-page__body--wbs > :deep(*) {
  flex: 1;
  min-height: 0;
}
</style>
