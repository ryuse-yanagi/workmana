<template>
  <div class="project-page-root">
    <WorkspaceProjectView
      ref="boardRef"
      v-show="displayedView === 'board'"
      mode="board"
    />
    <WorkspaceProjectView
      v-if="wbsMounted"
      ref="wbsViewRef"
      v-show="displayedView === 'wbs'"
      mode="wbs"
      :org-slug="slug"
      :workspace-id="workspaceId"
    />
  </div>
</template>
<script setup lang="ts">
import WorkspaceProjectView from '../../../../components/workspace/WorkspaceProjectView.vue'
import { withAppLoadingCursor } from '../../../../composables/useAppLoadingCursor'
import {
  invalidateWorkspaceDetailMeta,
  prefetchWorkspaceDetail,
  warmWorkspaceDetailCache,
} from '../../../../composables/useWorkspaceDetailMeta'
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
async function redirectIfWorkspaceArchived () {
  try {
    const meta = await prefetchWorkspaceDetail(slug.value, workspaceId.value)
    if (!meta.workspace.archived_at) {
      return false
    }
    invalidateWorkspaceDetailMeta(slug.value, workspaceId.value)
    await navigateTo(`/org/${slug.value}/workspaces`)
    return true
  } catch {
    return false
  }
}
onBeforeMount(() => {
  warmWorkspaceDetailCache(slug.value, workspaceId.value)
  void redirectIfWorkspaceArchived()
})
const { activeView } = useWorkspaceViewRoutes(() => slug.value, () => workspaceId.value)
const boardRef = ref<InstanceType<typeof WorkspaceProjectView> | null>(null)
const wbsViewRef = ref<InstanceType<typeof WorkspaceProjectView> | null>(null)
const wbsMounted = ref(false)
function initialProjectView (): WorkspaceViewKey {
  const view = activeView.value
  if (view === 'wbs') {
    return view
  }
  return 'board'
}
const displayedView = ref<WorkspaceViewKey>(initialProjectView())
let viewSwitchSeq = 0
function syncViewFromRoute () {
  const view = initialProjectView()
  displayedView.value = view
  wbsMounted.value = view === 'wbs'
}
async function refreshProjectView (view: WorkspaceViewKey) {
  if (view === 'wbs') {
    wbsMounted.value = true
  }
  await nextTick()
  await withAppLoadingCursor(async () => {
    if (view === 'board') {
      await boardRef.value?.refreshOnViewSwitch()
      return
    }
    await wbsViewRef.value?.refreshOnViewSwitch()
  })
}
watch(activeView, async (view) => {
  if (view !== 'board' && view !== 'wbs') {
    return
  }
  const seq = ++viewSwitchSeq
  if (view === 'board') {
    displayedView.value = 'board'
  } else {
    wbsMounted.value = true
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
    void redirectIfWorkspaceArchived()
  },
)
onActivated(() => {
  syncViewFromRoute()
  warmWorkspaceDetailCache(slug.value, workspaceId.value)
  void redirectIfWorkspaceArchived()
})
onDeactivated(() => {
  displayedView.value = 'board'
  wbsMounted.value = false
})
</script>
<style lang="scss" scoped src="~/assets/styles/pages/org/slug/workspaces/id.scss"></style>
