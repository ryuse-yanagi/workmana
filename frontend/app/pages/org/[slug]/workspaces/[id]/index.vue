<template>
  <div class="project-page-root">
    <WorkspaceBoard
      ref="boardRef"
      v-show="displayedView === 'board'"
    />
    <WorkspaceWbsView
      v-if="tableMounted"
      ref="tableViewRef"
      v-show="displayedView === 'table'"
      mode="table"
      :org-slug="slug"
      :workspace-id="workspaceId"
    />
    <WorkspaceWbsView
      v-if="ganttMounted"
      ref="ganttViewRef"
      v-show="displayedView === 'gantt'"
      mode="gantt"
      :org-slug="slug"
      :workspace-id="workspaceId"
    />
  </div>
</template>
<script setup lang="ts">
import WorkspaceBoard from '../../../../../components/workspace/WorkspaceBoard.vue'
import WorkspaceWbsView from '../../../../../components/workspace/WorkspaceWbsView.vue'
import { withAppLoadingCursor } from '../../../../../composables/useAppLoadingCursor'
import { useWorkspaceViewRoutes, type WorkspaceViewKey } from '../../../../../composables/useWorkspaceViewRoutes'
import { useWorkspaceViewPageRoot } from '../../../../../composables/useWorkspaceViewPageRoot'
definePageMeta({
  name: 'org-slug-workspaces-id',
  key: route => `${route.params.slug}:${route.params.id}`,
  keepalive: true,
})
useWorkspaceViewPageRoot()
const route = useRoute()
const slug = computed(() => route.params.slug as string)
const workspaceId = computed(() => route.params.id as string)
const { activeView } = useWorkspaceViewRoutes(() => slug.value, () => workspaceId.value)
const boardRef = ref<InstanceType<typeof WorkspaceBoard> | null>(null)
const tableViewRef = ref<InstanceType<typeof WorkspaceWbsView> | null>(null)
const ganttViewRef = ref<InstanceType<typeof WorkspaceWbsView> | null>(null)
const tableMounted = ref(false)
const ganttMounted = ref(false)
function initialProjectView (): WorkspaceViewKey {
  const view = activeView.value
  if (view === 'table' || view === 'gantt') {
    return view
  }
  return 'board'
}
const displayedView = ref<WorkspaceViewKey>(initialProjectView())
let viewSwitchSeq = 0
function syncViewFromRoute () {
  const view = initialProjectView()
  displayedView.value = view
  tableMounted.value = view === 'table'
  ganttMounted.value = view === 'gantt'
}
async function refreshProjectView (view: WorkspaceViewKey) {
  if (view === 'table') {
    tableMounted.value = true
  }
  if (view === 'gantt') {
    ganttMounted.value = true
  }
  await nextTick()
  await withAppLoadingCursor(async () => {
    if (view === 'board') {
      await boardRef.value?.refreshOnViewSwitch()
      return
    }
    if (view === 'table') {
      await tableViewRef.value?.refreshOnViewSwitch()
      return
    }
    await ganttViewRef.value?.refreshOnViewSwitch()
  })
}
watch(activeView, async (view) => {
  if (view !== 'board' && view !== 'table' && view !== 'gantt') {
    return
  }
  const seq = ++viewSwitchSeq
  if (view === 'board') {
    displayedView.value = 'board'
  } else {
    if (view === 'table') {
      tableMounted.value = true
    }
    if (view === 'gantt') {
      ganttMounted.value = true
    }
    await nextTick()
  }
  try {
    await refreshProjectView(view)
  } finally {
    if (seq === viewSwitchSeq) {
      displayedView.value = view
    }
  }
}, { immediate: true })
watch(
  () => [slug.value, workspaceId.value] as const,
  () => {
    syncViewFromRoute()
  },
)
onActivated(() => {
  syncViewFromRoute()
})
onDeactivated(() => {
  displayedView.value = 'board'
  tableMounted.value = false
  ganttMounted.value = false
})
</script>
<style lang="scss" scoped>
.project-page-root {
  min-height: calc(100dvh - var(--global-header-offset, 46px) - var(--app-shell-page-pad, 0.25rem));
  display: flex;
  flex-direction: column;
}
.project-page-root > :deep(*) {
  flex: 1;
  min-height: 0;
}
</style>
