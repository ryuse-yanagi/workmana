<template>
  <div class="project-page-root">
    <ProjectBoard
      ref="boardRef"
      v-show="displayedView === 'board'"
    />
    <ProjectWbsView
      v-if="tableMounted"
      ref="tableViewRef"
      v-show="displayedView === 'table'"
      mode="table"
      :org-slug="slug"
      :project-id="projectId"
    />
    <ProjectWbsView
      v-if="ganttMounted"
      ref="ganttViewRef"
      v-show="displayedView === 'gantt'"
      mode="gantt"
      :org-slug="slug"
      :project-id="projectId"
    />
  </div>
</template>

<script setup lang="ts">
import ProjectBoard from '../../../../../components/project/ProjectBoard.vue'
import ProjectWbsView from '../../../../../components/project/ProjectWbsView.vue'
import { useProjectViewRoutes, type ProjectViewKey } from '../../../../../composables/useProjectViewRoutes'
import { useProjectViewPageRoot } from '../../../../../composables/useProjectViewPageRoot'

definePageMeta({
  name: 'org-slug-projects-id',
  key: route => `${route.params.slug}:${route.params.id}`,
  keepalive: true,
})

useProjectViewPageRoot()

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const projectId = computed(() => route.params.id as string)
const { activeView } = useProjectViewRoutes(() => slug.value, () => projectId.value)

const boardRef = ref<InstanceType<typeof ProjectBoard> | null>(null)
const tableViewRef = ref<InstanceType<typeof ProjectWbsView> | null>(null)
const ganttViewRef = ref<InstanceType<typeof ProjectWbsView> | null>(null)
const tableMounted = ref(false)
const ganttMounted = ref(false)

function initialProjectView (): ProjectViewKey {
  const view = activeView.value
  if (view === 'table' || view === 'gantt') {
    return view
  }
  return 'board'
}

const displayedView = ref<ProjectViewKey>(initialProjectView())

let viewSwitchSeq = 0

function syncViewFromRoute () {
  const view = initialProjectView()
  displayedView.value = view
  tableMounted.value = view === 'table'
  ganttMounted.value = view === 'gantt'
}

async function refreshProjectView (view: ProjectViewKey) {
  if (view === 'table') {
    tableMounted.value = true
  }
  if (view === 'gantt') {
    ganttMounted.value = true
  }
  await nextTick()
  if (view === 'board') {
    await boardRef.value?.refreshOnViewSwitch()
    return
  }
  if (view === 'table') {
    await tableViewRef.value?.refreshOnViewSwitch()
    return
  }
  await ganttViewRef.value?.refreshOnViewSwitch()
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
  () => [slug.value, projectId.value] as const,
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
