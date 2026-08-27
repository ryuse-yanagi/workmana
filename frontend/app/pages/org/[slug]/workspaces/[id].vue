<template>
  <div class="project-page-root">
    <p v-if="archiveCheckError" class="project-page-root__error" role="alert">
      {{ archiveCheckError }}
      <button type="button" class="project-page-root__retry" @click="retryArchiveCheck">再試行</button>
    </p>
    <KeepAlive v-else-if="archiveGateReady" :max="2">
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
const archiveGateReady = ref(false)
const archiveCheckError = ref<string | null>(null)
async function redirectIfWorkspaceArchived (): Promise<boolean> {
  archiveCheckError.value = null
  try {
    const meta = await prefetchWorkspaceDetail(slug.value, workspaceId.value)
    if (!meta.workspace.archived_at) {
      return false
    }
    invalidateWorkspaceDetailMeta(slug.value, workspaceId.value)
    await navigateTo(`/org/${slug.value}/workspaces`)
    return true
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'スペース情報の取得に失敗しました'
    // 削除済み・権限なしなどはボードを出さず一覧へ戻す
    if (/No query results|not found|見つかりません|404/i.test(message)) {
      invalidateWorkspaceDetailMeta(slug.value, workspaceId.value)
      await navigateTo(`/org/${slug.value}/workspaces`)
      return true
    }
    archiveCheckError.value = message
    return false
  }
}
async function ensureActiveWorkspaceGate () {
  archiveGateReady.value = false
  const redirected = await redirectIfWorkspaceArchived()
  if (!redirected && !archiveCheckError.value) {
    archiveGateReady.value = true
  }
}
async function retryArchiveCheck () {
  await ensureActiveWorkspaceGate()
}
onBeforeMount(() => {
  warmWorkspaceDetailCache(slug.value, workspaceId.value)
  void ensureActiveWorkspaceGate()
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
  // タスク deep link がある場合はボードで詳細モーダルを開く
  if (route.query.task != null && route.query.task !== '') {
    displayedView.value = 'board'
    return
  }
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
  if (route.query.task != null && route.query.task !== '') {
    displayedView.value = 'board'
    refreshActiveViewInBackground()
    return
  }
  if (view !== 'board' && view !== 'wbs') {
    return
  }
  displayedView.value = view
  refreshActiveViewInBackground()
}, { immediate: true })
watch(
  () => route.query.task,
  () => {
    syncViewFromRoute()
  },
)
watch(
  () => [slug.value, workspaceId.value] as const,
  ([nextSlug, nextWorkspaceId]) => {
    syncViewFromRoute()
    warmWorkspaceDetailCache(nextSlug, nextWorkspaceId)
    void ensureActiveWorkspaceGate()
  },
)
onActivated(() => {
  syncViewFromRoute()
  warmWorkspaceDetailCache(slug.value, workspaceId.value)
  void ensureActiveWorkspaceGate()
  refreshActiveViewInBackground()
})
</script>
<style lang="scss" scoped src="~/assets/styles/pages/org/slug/workspaces/id.scss"></style>
