<template>
  <div class="project-page-root">
    <KeepAlive :max="2">
      <WorkspaceProjectView
        :key="displayedView"
        ref="viewRef"
        :mode="displayedView"
        :org-slug="slug"
        :workspace-id="workspaceId"
      />
    </KeepAlive>
  </div>
</template>
<script setup lang="ts">
import WorkspaceProjectView from '../../../../components/workspace/WorkspaceProjectView.vue'
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
const viewRef = ref<InstanceType<typeof WorkspaceProjectView> | null>(null)
function resolveProjectView (view: string): WorkspaceViewKey {
  if (view === 'wbs') {
    return 'wbs'
  }
  return 'board'
}
const displayedView = ref<WorkspaceViewKey>(resolveProjectView(activeView.value))
let viewSwitchSeq = 0
function syncViewFromRoute () {
  displayedView.value = resolveProjectView(activeView.value)
}
/** 表示は待たず、切替後にバックグラウンドで最新化 */
function refreshActiveViewInBackground () {
  const seq = ++viewSwitchSeq
  void nextTick(() => {
    if (seq !== viewSwitchSeq) {
      return
    }
    void viewRef.value?.refreshOnViewSwitch()
  })
}
watch(activeView, (view) => {
  if (view !== 'board' && view !== 'wbs') {
    return
  }
  displayedView.value = view
  refreshActiveViewInBackground()
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
  refreshActiveViewInBackground()
})
</script>
<style lang="scss" scoped src="~/assets/styles/pages/org/slug/workspaces/id.scss"></style>
