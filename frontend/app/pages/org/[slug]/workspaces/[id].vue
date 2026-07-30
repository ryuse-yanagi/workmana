<template>
  <div class="project-page-root">
    <WorkspaceProjectView
      ref="boardRef"
      v-show="displayedView === 'board'"
      mode="board"
    />
    <WorkspaceProjectView
      v-if="tableMounted"
      ref="tableViewRef"
      v-show="displayedView === 'table'"
      mode="table"
      :org-slug="slug"
      :workspace-id="workspaceId"
    />
  </div>
</template>
<script setup lang="ts">
import WorkspaceProjectView from '../../../../components/workspace/WorkspaceProjectView.vue'
import { withAppLoadingCursor } from '../../../../composables/useAppLoadingCursor'
import { prefetchWorkspaceDetail, warmWorkspaceDetailCache } from '../../../../composables/useWorkspaceDetailMeta'
import { useWorkspaceViewRoutes, type WorkspaceViewKey } from '../../../../composables/useWorkspaceViewRoutes'
import { useWorkspaceViewPageRoot } from '../../../../composables/useWorkspaceViewPageRoot'
definePageMeta({
  name: 'org-slug-workspaces-id',
  key: route => `${route.params.slug}:${route.params.id}`,
  keepalive: true,
})
useWorkspaceViewPageRoot()
const route = useRoute()
const slug = computed(() => route.params.slug as string)
const workspaceId = computed(() => route.params.id as string)
onBeforeMount(() => {
  warmWorkspaceDetailCache(slug.value, workspaceId.value)
  void prefetchWorkspaceDetail(slug.value, workspaceId.value)
})
const { activeView } = useWorkspaceViewRoutes(() => slug.value, () => workspaceId.value)
const boardRef = ref<InstanceType<typeof WorkspaceProjectView> | null>(null)
const tableViewRef = ref<InstanceType<typeof WorkspaceProjectView> | null>(null)
const tableMounted = ref(false)
function initialProjectView (): WorkspaceViewKey {
  const view = activeView.value
  if (view === 'table') {
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
}
async function refreshProjectView (view: WorkspaceViewKey) {
  if (view === 'table') {
    tableMounted.value = true
  }
  await nextTick()
  await withAppLoadingCursor(async () => {
    if (view === 'board') {
      await boardRef.value?.refreshOnViewSwitch()
      return
    }
    await tableViewRef.value?.refreshOnViewSwitch()
  })
}
watch(activeView, async (view) => {
  if (view !== 'board' && view !== 'table') {
    return
  }
  const seq = ++viewSwitchSeq
  if (view === 'board') {
    displayedView.value = 'board'
  } else {
    tableMounted.value = true
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
  ([nextSlug, nextWorkspaceId]) => {
    syncViewFromRoute()
    warmWorkspaceDetailCache(nextSlug, nextWorkspaceId)
    void prefetchWorkspaceDetail(nextSlug, nextWorkspaceId)
  },
)
onActivated(() => {
  syncViewFromRoute()
  warmWorkspaceDetailCache(slug.value, workspaceId.value)
})
onDeactivated(() => {
  displayedView.value = 'board'
  tableMounted.value = false
})
</script>
<style lang="scss" scoped src="~/assets/styles/pages/org/slug/workspaces/id.scss"></style>
